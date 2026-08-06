import json
from app.llm_provider import llm_provider

class CodeConverter:
    def convert_code(self, spec_json_str: str, business_rules_json_str: str, target_language: str = "Python") -> str:
        """
        Module 2: Spec-grounded target code generation (Python / R).
        Preserves all extracted business rules.
        """
        try:
            spec = json.loads(spec_json_str)
            rules = json.loads(business_rules_json_str)
        except Exception:
            spec = {"summary": "Healthcare logic routine"}
            rules = ["Preserve all parameter validation and output structures"]

        prompt = f"""
You are an expert software engineer converting legacy spec specifications into idiomatic, robust {target_language} code.

BUSINESS SPECIFICATION:
{json.dumps(spec, indent=2)}

EXPLICIT BUSINESS RULES TO PRESERVE (MAIN FOCUS):
{json.dumps(rules, indent=2)}

REQUIREMENTS:
1. Implement clean object-oriented or modular {target_language} code.
2. Every business rule MUST have a docstring reference (e.g., # RULE-1: ...).
3. Include error handling and clean data structures.
4. Output ONLY executable, syntactically valid {target_language} code, with no markdown code blocks surrounding if possible, or clean standard code blocks.
"""

        generated = llm_provider.generate_completion(
            prompt,
            system_instruction=f"Generate production-grade, highly readable {target_language} code preserving exact business logic."
        )

        # Clean markdown ticks if present
        cleaned_code = generated
        if "```python" in cleaned_code:
            cleaned_code = cleaned_code.split("```python")[1].split("```")[0]
        elif "```r" in cleaned_code:
            cleaned_code = cleaned_code.split("```r")[1].split("```")[0]
        elif "```" in cleaned_code:
            cleaned_code = cleaned_code.split("```")[1].split("```")[0]

        return cleaned_code.strip()
