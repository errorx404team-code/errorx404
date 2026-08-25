import json
from app.adapters.mumps_adapter import MUMPSAdapter
from app.llm_provider import llm_provider, GeminiAPIError

class SpecAnalyzer:
    def __init__(self):
        self.mumps_adapter = MUMPSAdapter()

    def analyze_routine(self, raw_code: str, source_language: str = "MUMPS"):
        """
        Module 1: Extract spec_json, spec_readable_text, and business_rules_json.
        Preserving business logic is the MAIN focus.

        STRICT RULE:
        - When a Gemini API key is configured, real Gemini analysis is REQUIRED.
        - If Gemini fails, GeminiAPIError propagates to the caller.
        - The fallback spec_data below is ONLY used when no API key is configured
          (demo/fallback mode) or when Gemini returns a non-JSON parseable response
          for a genuine API call (graceful degradation with real data from parser).
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

IMPORTANT:
- Base analysis ONLY on the source code shown above.
- Do NOT invent functions, globals, or business rules not present in the source.
- If a construct is unclear, note it with "UNCERTAIN:" prefix in the relevant field.
"""

        # Let GeminiAPIError propagate when a real API key is configured
        llm_response = llm_provider.generate_completion(
            prompt,
            system_instruction="You are a senior healthcare software architect specializing in MUMPS VistA modernization. Focus strictly on business logic preservation. Base all analysis on the actual source code provided — never invent behavior.",
            json_mode=True
        )

        try:
            spec_data = json.loads(llm_response)
        except Exception:
            # JSON parse failed — build a minimal spec from the parsed structure.
            # This uses REAL parsed data (not hardcoded demo data) regardless of API key status.
            spec_data = {
                "summary": f"Routine {parsed['routine_name']} — specification extracted from parsed structure (AI JSON parse failed).",
                "functions": [{"name": t["name"], "parameters": t["parameters"], "purpose": f"Process logic for tag {t['name']}"} for t in parsed["tags"]],
                "business_rules": [
                    f"RULE-{i+1}: Validate all inputs before accessing global {g}"
                    for i, g in enumerate(parsed["globals_accessed"])
                ] or ["RULE-1: Ensure non-null parameters before subroutine entry"],
                "globals_accessed": parsed["globals_accessed"],
                "edge_cases": ["AI JSON parse failed — manual review of business rules required"]
            }

        readable_text = f"# Business Specification for {parsed['routine_name']}\n\n"
        readable_text += f"**Summary**: {spec_data.get('summary', '')}\n\n"
        readable_text += "## Business Rules Preserved\n"
        for rule in spec_data.get("business_rules", []):
            readable_text += f"- {rule}\n"
        readable_text += "\n## Functions & Tags\n"
        for func in spec_data.get("functions", []):
            readable_text += f"- **{func.get('name')}**: {func.get('purpose')}\n"

        # Embed the raw MUMPS source in the spec so the converter can use it for
        # the static transpiler path (Gemini-free conversion).
        spec_data["_mumps_source"] = raw_code

        return {
            "spec_json": json.dumps(spec_data, indent=2),
            "spec_readable_text": readable_text,
            "business_rules_json": json.dumps(spec_data.get("business_rules", []), indent=2)
        }
