"""
Extended dependency_builder.py — now supports workspace-level graph building.
Keeps existing single-file API fully intact.
"""
import re
from app.adapters.mumps_adapter import MUMPSAdapter
from app.pipeline.file_classifier import extract_generic_dependencies


class DependencyBuilder:
    def __init__(self):
        self.adapter = MUMPSAdapter()

    def build_graph(self, raw_code: str, routine_name: str = "ROUTINE", source_language: str = "MUMPS"):
        """
        Module 1b: Dependency Graph Generator (single-file, backward compatible).
        Now handles multiple languages via the generic static analyzer.
        """
        if source_language == "MUMPS":
            return self.adapter.extract_dependencies(raw_code)
        else:
            return extract_generic_dependencies(routine_name, raw_code, source_language)

    def build_workspace_graph(self, routines):
        """
        Build a merged dependency graph for all routines in a workspace.
        Returns a unified nodes+edges structure across all files.
        """
        from app.pipeline.file_classifier import build_cross_file_dependency_signals

        all_nodes = []
        all_edges = []
        seen_nodes = set()
        seen_edges = set()

        # Per-file graphs
        for r in routines:
            lang = r.get("source_language", "MUMPS")
            code = r.get("raw_code", "")
            name = r.get("name", "")

            if lang == "MUMPS":
                g = self.adapter.extract_dependencies(code)
            else:
                g = extract_generic_dependencies(name, code, lang)

            for n in g.get("nodes", []):
                if n["id"] not in seen_nodes:
                    seen_nodes.add(n["id"])
                    all_nodes.append(n)

            for e in g.get("edges", []):
                ekey = f"{e['source']}|{e['target']}|{e['relationship']}"
                if ekey not in seen_edges:
                    seen_edges.add(ekey)
                    all_edges.append(e)

        # Cross-file edges
        cross_edges = build_cross_file_dependency_signals(routines)
        for ce in cross_edges:
            src = ce.get("source_routine_name", "")
            tgt = ce.get("target_routine_name", "") or ce.get("target_file", "").split(".")[0]
            ekey = f"{src}|{tgt}|{ce.get('dependency_type', 'CALLS')}"
            if ekey not in seen_edges:
                seen_edges.add(ekey)
                all_edges.append({
                    "source": src,
                    "target": tgt,
                    "relationship": ce.get("dependency_type", "CALLS"),
                    "cross_file": True,
                    "confidence": ce.get("confidence", 1.0),
                })

            for nid in [src, tgt]:
                if nid and nid not in seen_nodes:
                    seen_nodes.add(nid)
                    all_nodes.append({"id": nid, "label": nid, "type": "routine"})

        return {"nodes": all_nodes, "edges": all_edges}
