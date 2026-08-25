from typing import Dict, Any, List
from app.adapters.base import BaseLanguageAdapter

class COBOLAdapter(BaseLanguageAdapter):
    def get_language_name(self) -> str:
        return "COBOL"

    def parse_routine(self, raw_code: str) -> Dict[str, Any]:
        """Extensible stub for COBOL legacy routine parsing."""
        return {
            "routine_name": "COBOL_PROGRAM",
            "total_lines": len(raw_code.splitlines()),
            "tags": [{"name": "PROCEDURE_DIVISION", "parameters": [], "code": raw_code, "line_count": len(raw_code.splitlines())}],
            "globals_accessed": ["DATA_DIVISION_FILES"],
            "external_routine_calls": []
        }

    def extract_dependencies(self, raw_code: str) -> List[Dict[str, Any]]:
        return {
            "nodes": [
                {"id": "COBOL_PROGRAM", "label": "COBOL_PROGRAM", "type": "routine"},
                {"id": "PROCEDURE_DIVISION", "label": "PROCEDURE_DIVISION", "type": "function"}
            ],
            "edges": [
                {"source": "COBOL_PROGRAM", "target": "PROCEDURE_DIVISION", "relationship": "contains"}
            ]
        }
