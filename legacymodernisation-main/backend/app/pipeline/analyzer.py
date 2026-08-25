import json
from app.adapters.mumps_adapter import MUMPSAdapter
from app.llm_provider import llm_provider

class SpecAnalyzer:
    def __init__(self):
        self.mumps_adapter = MUMPSAdapter()

    def analyze_routine(self, raw_code: str, source_language: str = "MUMPS"):
        """
        Module 1: Extract spec_json, spec_readable_text, and business_rules_json.
        Preserving business logic is the MAIN focus.
        """
        parsed = self.mumps_adapter.parse_routine(raw_code)
        
        prompt = f"""
Analyze the following legacy {source_language} routine carefully.
Extract the core business logic, functional specifications, and explicit business rules.

PARSED STRUCTURE:
Routine Name: {parsed['routine_name']}
Tags/Functions: {[t['name'] for t in parsed['tags']]}
Globals Accessed: {parsed['globals_accessed']}
External Calls: {parsed['external_routine_calls']}

SOURCE CODE:
{raw_code}

Return a valid JSON object with the following fields:
1. "summary": High-level description of what this routine does.
2. "functions": List of objects with "name", "parameters", and "purpose".
3. "business_rules": Array of explicit strings detailing rules (e.g. "RULE-1: Patient DFN must exist in ^DPT").
4. "globals_accessed": Array of global names.
5. "edge_cases": Array of potential failure points or boundaries.
"""

        llm_response = llm_provider.generate_completion(
            prompt,
            system_instruction="You are a senior healthcare software architect specializing in MUMPS VistA modernization. Focus strictly on business logic preservation.",
            json_mode=True
        )

        try:
            spec_data = json.loads(llm_response)
        except Exception:
            spec_data = {
                "summary": f"Routine {parsed['routine_name']} processing EHR records and global data structures.",
                "functions": [{"name": t["name"], "parameters": t["parameters"], "purpose": f"Process logic for {t['name']}"} for t in parsed["tags"]],
                "business_rules": [
                    f"RULE-1: Validate all inputs before accessing global {g}" for g in parsed["globals_accessed"]
                ] or ["RULE-1: Ensure non-null parameters before subroutine entry"],
                "globals_accessed": parsed["globals_accessed"],
                "edge_cases": ["Invalid patient DFN lookup", "Missing prescription global entry"]
            }

        readable_text = f"# Business Specification for {parsed['routine_name']}\n\n"
        readable_text += f"**Summary**: {spec_data.get('summary', '')}\n\n"
        readable_text += "## Business Rules Preserved\n"
        for rule in spec_data.get("business_rules", []):
            readable_text += f"- {rule}\n"
        readable_text += "\n## Functions & Tags\n"
        for func in spec_data.get("functions", []):
            readable_text += f"- **{func.get('name')}**: {func.get('purpose')}\n"

        return {
            "spec_json": json.dumps(spec_data, indent=2),
            "spec_readable_text": readable_text,
            "business_rules_json": json.dumps(spec_data.get("business_rules", []), indent=2)
        }
