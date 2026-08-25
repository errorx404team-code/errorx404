"""
dependency_resolver.py
Topological sort, cycle detection, interface contract generation,
and conversion plan builder — all workspace-level.
"""
import json
from typing import List, Dict, Any, Optional, Set, Tuple


class DependencyResolver:

    def topological_sort(self, routines: List[Dict], cross_edges: List[Dict]) -> Tuple[List[Dict], List[List[str]]]:
        """
        Returns (sorted_routines, cycles).
        sorted_routines: ordered from "lowest dependency" to "highest"
        (i.e., leaf/utility files first, entry-points last).
        cycles: list of detected circular dependency chains.
        """
        # Build adjacency: source_name → {target_names}
        name_to_routine = {r["name"]: r for r in routines}
        adj: Dict[str, Set[str]] = {r["name"]: set() for r in routines}
        rev_adj: Dict[str, Set[str]] = {r["name"]: set() for r in routines}

        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src != tgt and src in adj and tgt in adj:
                adj[src].add(tgt)
                rev_adj[tgt].add(src)

        # Detect cycles using DFS
        cycles = []
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def dfs_cycle(node: str, path: List[str]):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            for nb in adj.get(node, set()):
                if nb not in visited:
                    dfs_cycle(nb, path)
                elif nb in rec_stack:
                    # Found cycle — record from nb to end of current path
                    cycle_start = path.index(nb)
                    cycles.append(path[cycle_start:] + [nb])
            path.pop()
            rec_stack.discard(node)

        for r in routines:
            if r["name"] not in visited:
                dfs_cycle(r["name"], [])

        # Break cycle edges for sorting purposes
        cycle_edges_to_skip = set()
        for cycle in cycles:
            # Skip the last edge of each cycle to break it
            if len(cycle) >= 2:
                cycle_edges_to_skip.add((cycle[-2], cycle[-1]))

        adj_clean: Dict[str, Set[str]] = {r["name"]: set() for r in routines}
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src != tgt and src in adj_clean and tgt in adj_clean:
                if (src, tgt) not in cycle_edges_to_skip:
                    adj_clean[src].add(tgt)

        # Kahn's algorithm on cleaned graph
        in_degree = {r["name"]: 0 for r in routines}
        for src, targets in adj_clean.items():
            for tgt in targets:
                in_degree[tgt] = in_degree.get(tgt, 0) + 1

        queue = [r["name"] for r in routines if in_degree.get(r["name"], 0) == 0]
        sorted_names = []
        while queue:
            node = queue.pop(0)
            sorted_names.append(node)
            for nb in adj_clean.get(node, set()):
                in_degree[nb] -= 1
                if in_degree[nb] == 0:
                    queue.append(nb)

        # Add any remaining nodes (from cycles that weren't fully resolved)
        for r in routines:
            if r["name"] not in sorted_names:
                sorted_names.append(r["name"])

        # Map back to routine objects
        sorted_routines = []
        for name in sorted_names:
            if name in name_to_routine:
                sorted_routines.append(name_to_routine[name])

        return sorted_routines, cycles

    def build_conversion_plan(
        self,
        routines: List[Dict],
        cross_edges: List[Dict],
        file_actions: Dict[str, str] = None,  # {routine_name: action}
    ) -> Dict[str, Any]:
        """
        Build a prioritized, dependency-aware conversion plan.
        Returns:
        {
          "files": [{ routine_id, name, path, action, depends_on, priority }],
          "cycles": [...],
          "has_cycles": bool,
          "order_description": str
        }
        """
        file_actions = file_actions or {}
        sorted_routines, cycles = self.topological_sort(routines, cross_edges)

        # Build depends_on map from cross_edges
        depends_on_map: Dict[str, List[str]] = {r["name"]: [] for r in routines}
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src != tgt and src in depends_on_map:
                dep_tgt = edge.get("target_file", tgt + ".m")
                if dep_tgt not in depends_on_map[src]:
                    depends_on_map[src].append(dep_tgt)

        plan_files = []
        for priority, r in enumerate(sorted_routines, start=1):
            action = file_actions.get(r["name"]) or r.get("file_action") or "CONVERT"
            plan_files.append({
                "routine_id": r.get("id"),
                "name": r["name"],
                "path": r.get("relative_path") or r["name"] + ".m",
                "source_language": r.get("source_language", "MUMPS"),
                "action": action,
                "depends_on": depends_on_map.get(r["name"], []),
                "priority": priority,
                "blocked_by": None,
            })

        return {
            "files": plan_files,
            "cycles": cycles,
            "has_cycles": len(cycles) > 0,
            "order_description": "Dependency-aware order: leaf/utility files converted first, entry points last.",
        }

    def generate_interface_contract(self, routine: Dict, spec_data: Dict, cross_edges: List[Dict]) -> Dict[str, Any]:
        """
        Generate an interface contract for a routine.
        Contract defines what the module exports, what it depends on, and who consumes it.
        """
        name = routine.get("name", "UNKNOWN")
        spec = spec_data or {}

        # Exports: functions/methods defined in this routine
        exports = []
        for func in spec.get("functions", []):
            exports.append({
                "name": func.get("name", ""),
                "parameters": func.get("parameters", []),
                "return_type": "Any",  # LLM will refine this
                "purpose": func.get("purpose", ""),
            })

        # Dependencies: files this routine depends on
        dependencies = []
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src == name:
                dep = {
                    "target": tgt,
                    "target_file": edge.get("target_file", tgt + ".m"),
                    "symbol": edge.get("target_symbol"),
                    "type": edge.get("dependency_type", "CALLS"),
                }
                if dep not in dependencies:
                    dependencies.append(dep)

        # Consumers: files that depend on this routine
        consumers = []
        for edge in cross_edges:
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            if tgt == name:
                if src not in consumers:
                    consumers.append(src)

        # Data dependencies
        globals_accessed = spec.get("globals_accessed", [])
        data_deps = [{"type": "MUMPS_GLOBAL", "name": g} for g in globals_accessed]

        return {
            "module": name,
            "source_file": routine.get("relative_path") or name + ".m",
            "source_language": routine.get("source_language", "MUMPS"),
            "exports": exports,
            "dependencies": dependencies,
            "consumers": consumers,
            "data_dependencies": data_deps,
            "business_rules": spec.get("business_rules", []),
        }

    def build_dependency_context(
        self,
        target_routine: Dict,
        all_routines: List[Dict],
        cross_edges: List[Dict],
        converted_codes: Dict[str, str],  # {routine_name: generated_code}
        interface_contracts: Dict[str, Dict],  # {routine_name: contract}
        spec_data: Dict = None,
    ) -> str:
        """
        Build a dependency-aware context window to pass to Gemini for conversion.
        Includes only relevant connected files, not the entire project.
        """
        name = target_routine.get("name", "UNKNOWN")
        context_parts = []

        # 1. Direct dependencies of this file
        dep_names = set()
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src == name:
                dep_names.add(tgt)

        # 2. Files that depend on this file (consumers)
        consumer_names = set()
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if tgt == name:
                consumer_names.add(src)

        # 3. Cross-file dependency summary
        cross_summary_lines = []
        for edge in cross_edges:
            src = edge.get("source_routine_name") or _basename(edge.get("source_file", ""))
            tgt = edge.get("target_routine_name") or _basename(edge.get("target_file", ""))
            if src == name or tgt == name:
                cross_summary_lines.append(
                    f"  {src} --[{edge.get('dependency_type', 'CALLS')} {edge.get('source_symbol', '')}→{edge.get('target_symbol', '')}]--> {tgt}"
                )

        if cross_summary_lines:
            context_parts.append("=== CROSS-FILE DEPENDENCY MAP ===")
            context_parts.extend(cross_summary_lines)
            context_parts.append("")

        # 4. Interface contracts for dependencies
        dep_contracts_added = 0
        for dep_name in dep_names:
            contract = interface_contracts.get(dep_name)
            if contract:
                context_parts.append(f"=== INTERFACE CONTRACT: {dep_name} ===")
                context_parts.append(json.dumps(contract, indent=2))
                context_parts.append("")
                dep_contracts_added += 1

        # 5. Already-converted code for dependencies (limited to first 60 lines)
        for dep_name in dep_names:
            code = converted_codes.get(dep_name)
            if code:
                lines = code.splitlines()[:60]
                context_parts.append(f"=== ALREADY CONVERTED: {dep_name} (first 60 lines) ===")
                context_parts.append("\n".join(lines))
                context_parts.append("")

        # 6. Consumer expectations (who calls this module)
        if consumer_names:
            context_parts.append(f"=== CONSUMERS OF THIS MODULE (files that will import/call it) ===")
            for cname in consumer_names:
                contract = interface_contracts.get(cname)
                if contract:
                    # Show what the consumer expects from this module
                    for dep in contract.get("dependencies", []):
                        if dep.get("target") == name:
                            context_parts.append(
                                f"  {cname} expects: {dep.get('symbol', 'unknown')} via {dep.get('type', 'CALLS')}"
                            )
                else:
                    context_parts.append(f"  {cname} (no contract available yet)")
            context_parts.append("")

        # 7. Business spec for this file
        if spec_data:
            context_parts.append("=== BUSINESS SPECIFICATION ===")
            context_parts.append(json.dumps(spec_data, indent=2))
            context_parts.append("")

        return "\n".join(context_parts)

    def propagate_blocking_status(
        self,
        plan_files: List[Dict],
        failed_routines: Set[str],
    ) -> List[Dict]:
        """
        If a file failed conversion, mark all files that depend on it as BLOCKED.
        """
        updated = []
        for pf in plan_files:
            depends = [_basename(d) for d in pf.get("depends_on", [])]
            blocked_by = None
            for dep in depends:
                if dep in failed_routines:
                    blocked_by = dep
                    break
            pf = dict(pf)
            pf["blocked_by"] = blocked_by
            if blocked_by:
                pf["status"] = "BLOCKED"
            updated.append(pf)
        return updated


def _basename(path: str) -> str:
    """Extract basename without extension from a file path."""
    import os
    return os.path.splitext(os.path.basename(path))[0] if path else ""


dependency_resolver = DependencyResolver()
