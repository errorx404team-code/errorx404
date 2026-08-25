"""
project_analyzer.py
Workspace-level orchestrator: analyzes all files in a workspace,
builds the cross-file dependency graph, generates interface contracts,
and produces a dependency-aware conversion plan.
"""
import json
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app import models
from app.pipeline.file_classifier import build_cross_file_dependency_signals
from app.pipeline.dependency_resolver import dependency_resolver
from app.llm_provider import llm_provider


class ProjectAnalyzer:

    def analyze_workspace(self, workspace_id: str, db: Session) -> Dict[str, Any]:
        """
        Full workspace-level analysis:
        1. Collect all routines in the workspace
        2. Run cross-file dependency detection
        3. Build the application-level dependency graph
        4. Generate interface contracts
        5. Build dependency-aware conversion plan
        6. Detect circular dependencies
        7. Store everything in the DB
        """
        routines = db.query(models.Routine).filter(
            models.Routine.workspace_id == workspace_id
        ).all()

        if not routines:
            return {"error": "No routines found for workspace", "workspace_id": workspace_id}

        # Prepare routine dicts for analysis
        routine_dicts = [
            {
                "id": r.id,
                "name": r.name,
                "raw_code": r.raw_code,
                "source_language": r.source_language,
                "relative_path": r.relative_path,
                "file_action": r.file_action or "CONVERT",
            }
            for r in routines
        ]

        # ── Step 1: Cross-file dependency discovery ────────────────────────────
        cross_edges = build_cross_file_dependency_signals(routine_dicts)

        # ── Step 2: Store cross-file edges in DB ───────────────────────────────
        # Clear old edges for this workspace
        db.query(models.WorkspaceDependencyEdge).filter(
            models.WorkspaceDependencyEdge.workspace_id == workspace_id
        ).delete()

        # Build routine name → id map
        name_to_id = {r.name: r.id for r in routines}

        for edge in cross_edges:
            src_name = edge.get("source_routine_name", "")
            tgt_name = edge.get("target_routine_name", "")
            db_edge = models.WorkspaceDependencyEdge(
                workspace_id=workspace_id,
                source_routine_id=name_to_id.get(src_name),
                target_routine_id=name_to_id.get(tgt_name),
                source_file=edge.get("source_file", ""),
                target_file=edge.get("target_file", ""),
                source_symbol=edge.get("source_symbol"),
                target_symbol=edge.get("target_symbol"),
                dependency_type=edge.get("dependency_type", "CALLS"),
                confidence=edge.get("confidence", 1.0),
            )
            db.add(db_edge)
        db.commit()

        # ── Step 3: Build conversion plan (topological order + cycle detection) ─
        plan = dependency_resolver.build_conversion_plan(routine_dicts, cross_edges)

        # ── Step 4: Store conversion plan ─────────────────────────────────────
        db.query(models.WorkspaceConversionPlan).filter(
            models.WorkspaceConversionPlan.workspace_id == workspace_id
        ).delete()
        plan_row = models.WorkspaceConversionPlan(
            workspace_id=workspace_id,
            plan_json=json.dumps(plan["files"]),
            cycles_json=json.dumps(plan["cycles"]),
        )
        db.add(plan_row)
        db.commit()

        # ── Step 5: Generate interface contracts for each routine ───────────────
        contracts = {}
        for r_dict in routine_dicts:
            # Load existing spec if available
            spec_row = db.query(models.Specification).filter(
                models.Specification.routine_id == r_dict["id"]
            ).order_by(models.Specification.id.desc()).first()

            spec_data = {}
            if spec_row:
                try:
                    spec_data = json.loads(spec_row.spec_json)
                except Exception:
                    spec_data = {}

            contract = dependency_resolver.generate_interface_contract(
                r_dict, spec_data, cross_edges
            )
            contracts[r_dict["name"]] = contract

            # Store in DB
            db.query(models.InterfaceContract).filter(
                models.InterfaceContract.workspace_id == workspace_id,
                models.InterfaceContract.routine_id == r_dict["id"],
            ).delete()
            contract_row = models.InterfaceContract(
                workspace_id=workspace_id,
                routine_id=r_dict["id"],
                contract_json=json.dumps(contract),
            )
            db.add(contract_row)
        db.commit()

        # ── Step 6: Build merged workspace dependency graph ────────────────────
        # Merge per-file dep graphs from dependency_graph table + cross-file edges
        all_nodes = []
        all_edges = []
        seen_node_ids = set()
        seen_edge_keys = set()

        for r in routines:
            db_nodes = db.query(models.DependencyGraphNode).filter(
                models.DependencyGraphNode.routine_id == r.id
            ).all()
            for dn in db_nodes:
                if dn.node_id not in seen_node_ids:
                    seen_node_ids.add(dn.node_id)
                    all_nodes.append({
                        "id": dn.node_id,
                        "label": dn.node_id.split(".")[-1],
                        "type": dn.node_type,
                        "routine": r.name,
                    })

        # Add cross-file edges as graph edges
        for edge in cross_edges:
            src_id = edge.get("source_routine_name", "")
            tgt_id = edge.get("target_routine_name", "") or _basename(edge.get("target_file", ""))
            ekey = f"{src_id}--{edge.get('dependency_type', '')}--{tgt_id}"
            if ekey not in seen_edge_keys:
                seen_edge_keys.add(ekey)
                all_edges.append({
                    "source": src_id,
                    "target": tgt_id,
                    "relationship": edge.get("dependency_type", "CALLS"),
                    "confidence": edge.get("confidence", 1.0),
                    "cross_file": True,
                })

            # Also add source and target as nodes if missing
            for nid in [src_id, tgt_id]:
                if nid and nid not in seen_node_ids:
                    seen_node_ids.add(nid)
                    all_nodes.append({
                        "id": nid,
                        "label": nid,
                        "type": "routine",
                    })

        return {
            "workspace_id": workspace_id,
            "total_files": len(routines),
            "cross_edges": cross_edges,
            "conversion_plan": plan,
            "cycles": plan["cycles"],
            "has_cycles": plan["has_cycles"],
            "interface_contracts": contracts,
            "workspace_graph": {
                "nodes": all_nodes,
                "edges": all_edges,
            },
        }

    def get_conversion_plan(self, workspace_id: str, db: Session) -> Optional[Dict]:
        """Load existing conversion plan from DB."""
        plan_row = db.query(models.WorkspaceConversionPlan).filter(
            models.WorkspaceConversionPlan.workspace_id == workspace_id
        ).order_by(models.WorkspaceConversionPlan.id.desc()).first()
        if not plan_row:
            return None
        return {
            "files": json.loads(plan_row.plan_json),
            "cycles": json.loads(plan_row.cycles_json or "[]"),
            "has_cycles": len(json.loads(plan_row.cycles_json or "[]")) > 0,
        }

    def get_interface_contracts(self, workspace_id: str, db: Session) -> Dict[str, Dict]:
        """Load all interface contracts for a workspace."""
        contracts = {}
        rows = db.query(models.InterfaceContract).filter(
            models.InterfaceContract.workspace_id == workspace_id
        ).all()
        for row in rows:
            routine = db.query(models.Routine).filter(
                models.Routine.id == row.routine_id
            ).first()
            if routine:
                try:
                    contracts[routine.name] = json.loads(row.contract_json)
                except Exception:
                    pass
        return contracts

    def get_cross_edges(self, workspace_id: str, db: Session) -> List[Dict]:
        """Load cross-file dependency edges from DB."""
        rows = db.query(models.WorkspaceDependencyEdge).filter(
            models.WorkspaceDependencyEdge.workspace_id == workspace_id
        ).all()
        return [
            {
                "source_file": r.source_file,
                "target_file": r.target_file,
                "source_symbol": r.source_symbol,
                "target_symbol": r.target_symbol,
                "dependency_type": r.dependency_type,
                "confidence": r.confidence,
                "source_routine_name": _id_to_name(r.source_routine_id, db),
                "target_routine_name": _id_to_name(r.target_routine_id, db),
            }
            for r in rows
        ]

    def _fallback_plan(self, routines) -> Dict:
        """Fallback conversion plan when no cross-file analysis is available."""
        return {
            "files": [
                {
                    "routine_id": r.id,
                    "name": r.name,
                    "path": r.relative_path or r.name + ".m",
                    "source_language": r.source_language,
                    "action": r.file_action or "CONVERT",
                    "depends_on": [],
                    "priority": i + 1,
                    "blocked_by": None,
                }
                for i, r in enumerate(routines)
            ],
            "cycles": [],
            "has_cycles": False,
            "order_description": "Single-file order (no cross-file dependencies detected).",
        }


def _basename(path: str) -> str:
    import os
    return os.path.splitext(os.path.basename(path))[0] if path else ""


def _id_to_name(routine_id, db: Session) -> str:
    if not routine_id:
        return ""
    r = db.query(models.Routine).filter(models.Routine.id == routine_id).first()
    return r.name if r else ""


project_analyzer = ProjectAnalyzer()
