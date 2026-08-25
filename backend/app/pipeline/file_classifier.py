"""
Generic file classifier and static analyzer.
Detects file type, language, and extracts dependency signals from any file type
without requiring a full language parser.
"""
import re
import os
from typing import Dict, Any, List, Optional


# ─── File extension → language / action mapping ───────────────────────────────

EXTENSION_MAP = {
    # MUMPS
    ".m": ("MUMPS", "CONVERT"),
    ".mps": ("MUMPS", "CONVERT"),
    ".mumps": ("MUMPS", "CONVERT"),
    ".rou": ("MUMPS", "CONVERT"),
    # Python
    ".py": ("Python", "CONVERT"),
    # COBOL
    ".cob": ("COBOL", "REVIEW_REQUIRED"),
    ".cbl": ("COBOL", "REVIEW_REQUIRED"),
    # SQL
    ".sql": ("SQL", "PRESERVE"),
    # Java
    ".java": ("Java", "REVIEW_REQUIRED"),
    # JavaScript / TypeScript
    ".js": ("JavaScript", "REVIEW_REQUIRED"),
    ".jsx": ("JavaScript", "REVIEW_REQUIRED"),
    ".ts": ("TypeScript", "REVIEW_REQUIRED"),
    ".tsx": ("TypeScript", "REVIEW_REQUIRED"),
    # Config / Data files
    ".json": ("JSON", "PRESERVE"),
    ".yaml": ("YAML", "PRESERVE"),
    ".yml": ("YAML", "PRESERVE"),
    ".xml": ("XML", "PRESERVE"),
    ".env": ("ENV", "ADAPT"),
    ".ini": ("INI", "PRESERVE"),
    ".toml": ("TOML", "PRESERVE"),
    # Docs
    ".md": ("Markdown", "GENERATE"),
    ".txt": ("Text", "PRESERVE"),
    # R
    ".r": ("R", "CONVERT"),
    ".R": ("R", "CONVERT"),
}


def classify_file(filename: str, raw_code: str = "") -> Dict[str, Any]:
    """
    Classify a file by extension and content signals.
    Returns: { language, action, file_type, signals }
    """
    _, ext = os.path.splitext(filename.lower())
    language, action = EXTENSION_MAP.get(ext, ("Unknown", "REVIEW_REQUIRED"))

    # Heuristic content detection for files without clear extensions
    if language == "Unknown" and raw_code:
        if re.search(r'^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)', raw_code, re.IGNORECASE | re.MULTILINE):
            language, action = "SQL", "PRESERVE"
        elif re.search(r'^\s*IDENTIFICATION DIVISION', raw_code, re.IGNORECASE | re.MULTILINE):
            language, action = "COBOL", "REVIEW_REQUIRED"
        elif re.search(r'import\s+\w+|def\s+\w+\(|class\s+\w+:', raw_code):
            language, action = "Python", "CONVERT"

    return {
        "language": language,
        "action": action,
        "extension": ext,
        "filename": filename,
    }


def extract_generic_dependencies(filename: str, raw_code: str, language: str) -> Dict[str, Any]:
    """
    Generic static analysis that extracts dependency signals from any file.
    Returns nodes and edges in the same format as the MUMPS adapter.
    """
    basename = os.path.splitext(os.path.basename(filename))[0]
    nodes = [{"id": basename, "label": basename, "type": language.lower() + "_module"}]
    edges = []

    dep_signals = []

    if language == "Python":
        dep_signals = _extract_python_deps(raw_code, basename, nodes, edges)
    elif language == "SQL":
        dep_signals = _extract_sql_deps(raw_code, basename, nodes, edges)
    elif language in ("JavaScript", "TypeScript"):
        dep_signals = _extract_js_deps(raw_code, basename, nodes, edges)
    elif language == "Java":
        dep_signals = _extract_java_deps(raw_code, basename, nodes, edges)
    elif language in ("JSON", "YAML", "TOML", "INI", "ENV"):
        dep_signals = _extract_config_deps(raw_code, basename, nodes, edges, language)
    elif language == "COBOL":
        dep_signals = _extract_cobol_deps(raw_code, basename, nodes, edges)
    else:
        # Generic: extract any quoted strings that look like file references or URLs
        dep_signals = _extract_generic_refs(raw_code, basename, nodes, edges)

    return {
        "nodes": nodes,
        "edges": edges,
        "dep_signals": dep_signals,  # structured cross-file dependency candidates
    }


def _add_node_edge(nodes, edges, source_id, target_id, target_label, target_type, rel_type):
    if not any(n["id"] == target_id for n in nodes):
        nodes.append({"id": target_id, "label": target_label, "type": target_type})
    if not any(e["source"] == source_id and e["target"] == target_id for e in edges):
        edges.append({"source": source_id, "target": target_id, "relationship": rel_type})


def _make_signal(source_file, source_symbol, target_file, target_symbol, dep_type, confidence=0.9):
    return {
        "source_file": source_file,
        "source_symbol": source_symbol,
        "target_file": target_file,
        "target_symbol": target_symbol,
        "dependency_type": dep_type,
        "confidence": confidence,
    }


def _extract_python_deps(raw_code, basename, nodes, edges):
    signals = []
    # import X / from X import Y
    for m in re.finditer(r'^(?:from\s+([\w.]+)\s+import\s+([\w,\s*]+)|import\s+([\w.,\s]+))', raw_code, re.MULTILINE):
        if m.group(1):
            mod = m.group(1).replace(".", "/")
            sym = m.group(2).strip()
            target_id = f"MODULE.{mod}"
            _add_node_edge(nodes, edges, basename, target_id, mod, "python_module", "IMPORTS")
            signals.append(_make_signal(basename + ".py", None, mod + ".py", sym, "IMPORTS"))
        else:
            for mod_raw in (m.group(3) or "").split(","):
                mod = mod_raw.strip().replace(".", "/")
                if mod:
                    target_id = f"MODULE.{mod}"
                    _add_node_edge(nodes, edges, basename, target_id, mod, "python_module", "IMPORTS")
                    signals.append(_make_signal(basename + ".py", None, mod + ".py", None, "IMPORTS"))

    # class names
    for m in re.finditer(r'^class\s+(\w+)', raw_code, re.MULTILINE):
        cid = f"{basename}.{m.group(1)}"
        _add_node_edge(nodes, edges, basename, cid, m.group(1), "class", "contains")

    # def names
    for m in re.finditer(r'^def\s+(\w+)', raw_code, re.MULTILINE):
        fid = f"{basename}.{m.group(1)}"
        _add_node_edge(nodes, edges, basename, fid, m.group(1), "function", "contains")

    # DB references
    for m in re.finditer(r'(?:SELECT|INSERT|UPDATE|DELETE|CREATE TABLE)\s+(\w+)', raw_code, re.IGNORECASE):
        table = m.group(1)
        tid = f"TABLE.{table}"
        _add_node_edge(nodes, edges, basename, tid, table, "database_table", "USES_TABLE")
        signals.append(_make_signal(basename + ".py", None, table, None, "USES_TABLE", 0.7))

    # os.environ / os.getenv references
    for m in re.finditer(r'os\.(?:environ|getenv)\s*\[\s*["\'](\w+)["\']|\s*["\'](\w+)["\']\s*\]', raw_code):
        env_var = m.group(1) or m.group(2)
        if env_var:
            eid = f"ENV.{env_var}"
            _add_node_edge(nodes, edges, basename, eid, env_var, "env_variable", "USES_ENVIRONMENT")

    # HTTP calls
    for m in re.finditer(r'https?://[\w./\-_%?=&]+', raw_code):
        url = m.group(0)[:80]
        uid = f"API.{url[:40]}"
        _add_node_edge(nodes, edges, basename, uid, url[:40], "external_api", "USES_API")

    return signals


def _extract_sql_deps(raw_code, basename, nodes, edges):
    signals = []
    # Tables defined
    for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', raw_code, re.IGNORECASE):
        table = m.group(1)
        tid = f"TABLE.{table}"
        _add_node_edge(nodes, edges, basename, tid, table, "database_table", "DEFINES_TABLE")
        signals.append(_make_signal(basename + ".sql", None, table, None, "DEFINES_TABLE"))

    # Foreign key references
    for m in re.finditer(r'REFERENCES\s+(\w+)\s*\((\w+)\)', raw_code, re.IGNORECASE):
        ref_table = m.group(1)
        tid = f"TABLE.{ref_table}"
        _add_node_edge(nodes, edges, basename, tid, ref_table, "database_table", "REFERENCES")
        signals.append(_make_signal(basename + ".sql", None, ref_table, m.group(2), "REFERENCES"))

    return signals


def _extract_js_deps(raw_code, basename, nodes, edges):
    signals = []
    # import / require
    for m in re.finditer(r"""(?:import\s+.*?\s+from\s+['"](.*?)['"]|require\s*\(\s*['"](.*?)['"]\s*\))""", raw_code):
        mod = (m.group(1) or m.group(2) or "").strip()
        if mod and not mod.startswith("@") and "/" in mod or not mod.startswith("."):
            pass
        if mod:
            mod_clean = mod.lstrip("./").replace("/", "_")
            tid = f"MODULE.{mod_clean}"
            _add_node_edge(nodes, edges, basename, tid, mod_clean, "js_module", "IMPORTS")
            signals.append(_make_signal(basename + ".js", None, mod, None, "IMPORTS", 0.85))

    # fetch / axios calls
    for m in re.finditer(r'(?:fetch|axios\.(?:get|post|put|delete))\s*\(\s*["`\'](.*?)["`\']', raw_code):
        url = m.group(1)[:80]
        uid = f"API.{url[:40]}"
        _add_node_edge(nodes, edges, basename, uid, url[:40], "rest_api", "USES_API")
        signals.append(_make_signal(basename + ".js", None, url, None, "USES_API", 0.9))

    return signals


def _extract_java_deps(raw_code, basename, nodes, edges):
    signals = []
    # import statements
    for m in re.finditer(r'^import\s+([\w.]+);', raw_code, re.MULTILINE):
        mod = m.group(1)
        parts = mod.split(".")
        pkg = "/".join(parts[:-1])
        cls = parts[-1]
        tid = f"CLASS.{mod}"
        _add_node_edge(nodes, edges, basename, tid, cls, "java_class", "IMPORTS")
        signals.append(_make_signal(basename + ".java", None, pkg + ".java", cls, "IMPORTS", 0.85))

    # class/method declarations
    for m in re.finditer(r'^(?:public|private|protected)?\s+(?:class|interface)\s+(\w+)', raw_code, re.MULTILINE):
        cid = f"{basename}.{m.group(1)}"
        _add_node_edge(nodes, edges, basename, cid, m.group(1), "class", "contains")

    return signals


def _extract_config_deps(raw_code, basename, nodes, edges, language):
    signals = []
    # Database URLs
    for m in re.finditer(r'(?:DATABASE_URL|DB_URL|JDBC_URL|CONNECTION_STRING)\s*[=:]\s*["\']?([^\s"\']+)', raw_code, re.IGNORECASE):
        url = m.group(1)
        did = f"DB.{url[:40]}"
        _add_node_edge(nodes, edges, basename, did, url[:40], "database_connection", "CONFIGURES")
        signals.append(_make_signal(basename, None, url[:40], None, "USES_CONFIG", 0.8))

    # API base URLs / keys
    for m in re.finditer(r'(?:API_URL|BASE_URL|SERVICE_URL|ENDPOINT)\s*[=:]\s*["\']?([^\s"\']+)', raw_code, re.IGNORECASE):
        url = m.group(1)
        uid = f"API.{url[:40]}"
        _add_node_edge(nodes, edges, basename, uid, url[:40], "api_endpoint", "CONFIGURES")

    # Environment variable definitions (KEY=VALUE in .env)
    for m in re.finditer(r'^([A-Z_]{3,})\s*=\s*(.+)$', raw_code, re.MULTILINE):
        key = m.group(1)
        eid = f"ENV.{key}"
        _add_node_edge(nodes, edges, basename, eid, key, "env_variable", "DEFINES")
        signals.append(_make_signal(basename, None, key, None, "USES_CONFIG", 0.95))

    return signals


def _extract_cobol_deps(raw_code, basename, nodes, edges):
    signals = []
    # COPY statements
    for m in re.finditer(r'COPY\s+(\w+)', raw_code, re.IGNORECASE):
        book = m.group(1)
        bid = f"COPYBOOK.{book}"
        _add_node_edge(nodes, edges, basename, bid, book, "copybook", "COPIES")
        signals.append(_make_signal(basename + ".cob", None, book + ".cob", None, "IMPORTS", 0.9))

    # CALL statements
    for m in re.finditer(r'CALL\s+["\'](\w+)["\']', raw_code, re.IGNORECASE):
        prog = m.group(1)
        pid = f"PROGRAM.{prog}"
        _add_node_edge(nodes, edges, basename, pid, prog, "cobol_program", "CALLS")
        signals.append(_make_signal(basename + ".cob", None, prog + ".cob", None, "CALLS", 0.9))

    # SELECT FILE in ENVIRONMENT / FILE-CONTROL
    for m in re.finditer(r'SELECT\s+(\w+)\s+ASSIGN\s+TO\s+(\S+)', raw_code, re.IGNORECASE):
        fid = f"FILE.{m.group(1)}"
        _add_node_edge(nodes, edges, basename, fid, m.group(1), "cobol_file", "USES_FILE")

    return signals


def _extract_generic_refs(raw_code, basename, nodes, edges):
    signals = []
    # File-like references in any quoted string
    for m in re.finditer(r'["\']([^"\']+\.(?:py|m|sql|json|yaml|yml|xml|cob|java|js|ts))["\']', raw_code):
        ref = m.group(1)
        ref_clean = re.sub(r'[/\\]', '_', ref)
        rid = f"FILE.{ref_clean}"
        _add_node_edge(nodes, edges, basename, rid, ref, "file_reference", "REFERENCES")
        signals.append(_make_signal(basename, None, ref, None, "REFERENCES", 0.5))

    return signals


def build_cross_file_dependency_signals(routines: List[Dict]) -> List[Dict]:
    """
    Given a list of routines with {name, raw_code, source_language, relative_path},
    correlate signals across files to produce cross-file dependency edges.
    """
    cross_edges = []

    # Build a lookup: symbol name → routine name
    symbol_to_routine = {}
    for r in routines:
        lang = r.get("source_language", "Unknown")
        code = r.get("raw_code", "")
        name = r.get("name", "")
        rel = r.get("relative_path", name)

        if lang == "MUMPS":
            # Tags defined in this file
            for m in re.finditer(r'^([A-Z0-9%]+)\s*(?:\(|[\s])', code, re.MULTILINE):
                tag = m.group(1)
                symbol_to_routine[tag] = {"routine_name": name, "relative_path": rel}
            symbol_to_routine[name] = {"routine_name": name, "relative_path": rel}

        elif lang == "Python":
            for m in re.finditer(r'^(?:def|class)\s+(\w+)', code, re.MULTILINE):
                sym = m.group(1)
                symbol_to_routine[sym] = {"routine_name": name, "relative_path": rel}

        elif lang == "SQL":
            for m in re.finditer(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)', code, re.IGNORECASE):
                sym = m.group(1)
                symbol_to_routine[sym] = {"routine_name": name, "relative_path": rel}

    # Now scan each file for calls to symbols defined in other files
    for r in routines:
        lang = r.get("source_language", "Unknown")
        code = r.get("raw_code", "")
        name = r.get("name", "")
        rel = r.get("relative_path", name)

        if lang == "MUMPS":
            # External routine calls: DO ^ROUTINE or DO TAG^ROUTINE
            for m in re.finditer(r'(?:D|DO)\s+(?:(\w+)\^)?(\w+)', code, re.IGNORECASE):
                tag_call = m.group(1)
                rtn_call = m.group(2)
                # Check if rtn_call matches a known routine name
                if rtn_call in symbol_to_routine:
                    info = symbol_to_routine[rtn_call]
                    if info["routine_name"] != name:
                        cross_edges.append({
                            "source_file": rel or name + ".m",
                            "target_file": info["relative_path"] or info["routine_name"] + ".m",
                            "source_symbol": name,
                            "target_symbol": tag_call or rtn_call,
                            "dependency_type": "CALLS",
                            "confidence": 0.9,
                            "source_routine_name": name,
                            "target_routine_name": info["routine_name"],
                        })
                # Tag call within potential cross-file: TAG^ROUTINE pattern
                if tag_call and rtn_call != name:
                    # Even if not in symbol map, record as potential cross-file call
                    cross_edges.append({
                        "source_file": rel or name + ".m",
                        "target_file": rtn_call + ".m",
                        "source_symbol": name,
                        "target_symbol": tag_call,
                        "dependency_type": "CALLS",
                        "confidence": 0.75,
                        "source_routine_name": name,
                        "target_routine_name": rtn_call,
                    })

            # Global variable sharing: if multiple files access same global
            for m in re.finditer(r'\^([A-Z0-9%]+)', code):
                global_name = "^" + m.group(1).split("(")[0]
                for other in routines:
                    if other["name"] == name:
                        continue
                    if global_name in other.get("raw_code", ""):
                        cross_edges.append({
                            "source_file": rel or name + ".m",
                            "target_file": other.get("relative_path") or other["name"] + ".m",
                            "source_symbol": global_name,
                            "target_symbol": global_name,
                            "dependency_type": "USES_GLOBAL",
                            "confidence": 0.85,
                            "source_routine_name": name,
                            "target_routine_name": other["name"],
                        })
            break  # avoid quadratic - global sharing detected once per file

        elif lang == "Python":
            # from module import X — check if module matches a known routine
            for m in re.finditer(r'from\s+([\w.]+)\s+import\s+([\w,\s*]+)', code, re.MULTILINE):
                mod = m.group(1).split(".")[-1]
                sym = m.group(2).strip()
                if mod in symbol_to_routine:
                    info = symbol_to_routine[mod]
                    if info["routine_name"] != name:
                        cross_edges.append({
                            "source_file": rel or name + ".py",
                            "target_file": info["relative_path"] or info["routine_name"] + ".py",
                            "source_symbol": name,
                            "target_symbol": sym,
                            "dependency_type": "IMPORTS",
                            "confidence": 0.95,
                            "source_routine_name": name,
                            "target_routine_name": info["routine_name"],
                        })

    # Deduplicate
    seen = set()
    unique_edges = []
    for e in cross_edges:
        key = (e["source_file"], e["target_file"], e["dependency_type"], e.get("source_symbol", ""), e.get("target_symbol", ""))
        if key not in seen:
            seen.add(key)
            unique_edges.append(e)

    return unique_edges
