import re
from typing import Dict, Any, List
from app.adapters.base import BaseLanguageAdapter

class MUMPSAdapter(BaseLanguageAdapter):
    def get_language_name(self) -> str:
        return "MUMPS"

    def parse_routine(self, raw_code: str) -> Dict[str, Any]:
        """
        Parses MUMPS code into tags, commands, global references, and parameters.
        """
        lines = raw_code.splitlines()
        routine_name = "UNKNOWN"
        tags = []
        globals_accessed = set()
        routine_calls = set()
        
        current_tag = None
        current_lines = []

        for line_num, line in enumerate(lines, 1):
            line_str = line.strip()
            if not line_str:
                continue

            # First line often names the routine e.g. "PSOHLDS ;VistA Outpatient Pharmacy Routine"
            if line_num == 1 and ";" in line:
                first_token = line.split()[0].split(";")[0].strip()
                if first_token:
                    routine_name = first_token

            # Check for external routine calls e.g., D ^ORWU, DO ^PSOHL, DO TAG^ROUTINE, $$TAG^ROUTINE
            ext_calls = re.findall(r"(?:(?:D|DO|G|GOTO)\s+|\$\$)(?:[A-Z0-9%]+\s*\^|\^)([A-Z0-9%]+)", line, re.IGNORECASE)
            for call in ext_calls:
                if call.upper() != routine_name.upper():
                    routine_calls.add(call)

            # Check for global variables (e.g., ^DPT, ^PSRX, ^PS(55))
            # Must NOT be an external routine call (^ after DO/D/G/GOTO/$$)
            found_globals = re.findall(r"(?<!\^)(?<!\bDO\s)(?<!\bD\s)(?<!\bGOTO\s)(?<!\bG\s)(?<!\$\$)\^([A-Z0-9%\(]+)", line, re.IGNORECASE)
            for g in found_globals:
                base_g = g.split("(")[0]
                if base_g not in ["DO", "QUIT", "SET", "IF", "WRITE", "GOTO", "READ", "KILL", "NEW", "MERGE", "HANG"]:
                    if base_g not in routine_calls:
                        globals_accessed.add(f"^{base_g}")

            # Check for line tag/label definition at beginning of line (non-whitespace)
            tag_match = re.match(r"^([A-Z0-9%]+)(\(([^\)]*)\))?", line)
            if tag_match and not line.startswith(" ") and not line.startswith("\t") and not line.startswith(";"):
                tag_name = tag_match.group(1)
                params_str = tag_match.group(3) or ""
                params = [p.strip() for p in params_str.split(",") if p.strip()]

                if current_tag:
                    tags.append({
                        "name": current_tag["name"],
                        "parameters": current_tag["parameters"],
                        "code": "\n".join(current_lines),
                        "line_count": len(current_lines)
                    })

                current_tag = {
                    "name": tag_name,
                    "parameters": params,
                }
                current_lines = [line]
            else:
                if current_tag:
                    current_lines.append(line)

        if current_tag:
            tags.append({
                "name": current_tag["name"],
                "parameters": current_tag["parameters"],
                "code": "\n".join(current_lines),
                "line_count": len(current_lines)
            })

        return {
            "routine_name": routine_name,
            "total_lines": len(lines),
            "tags": tags,
            "globals_accessed": sorted(list(globals_accessed)),
            "external_routine_calls": sorted(list(routine_calls))
        }

    def extract_dependencies(self, raw_code: str) -> List[Dict[str, Any]]:
        parsed = self.parse_routine(raw_code)
        nodes = []
        edges = []

        main_node = parsed["routine_name"] or "ROUTINE"
        nodes.append({"id": main_node, "label": main_node, "type": "routine"})

        for tag in parsed["tags"]:
            tag_id = f"{main_node}.{tag['name']}"
            nodes.append({"id": tag_id, "label": tag["name"], "type": "function"})
            edges.append({"source": main_node, "target": tag_id, "relationship": "contains"})

        for g in parsed["globals_accessed"]:
            g_id = f"GLOBAL.{g}"
            nodes.append({"id": g_id, "label": g, "type": "global_variable"})
            edges.append({"source": main_node, "target": g_id, "relationship": "reads/writes"})

        for ext in parsed["external_routine_calls"]:
            ext_id = f"EXT.{ext}"
            nodes.append({"id": ext_id, "label": ext, "type": "external_routine"})
            edges.append({"source": main_node, "target": ext_id, "relationship": "calls"})

        return {"nodes": nodes, "edges": edges}
