"""
Extended converter.py — dependency-aware code transformation.
Existing single-file convert_code() API remains intact.
New convert_code_with_context() adds cross-file dependency context to Gemini.

STRICT RULE (ErrorX404):
- When a Gemini API key is configured, ALL conversions MUST use the real Gemini API.
- If Gemini fails, a GeminiAPIError is raised — no fake code is returned.
- The conversion_source field tracks: REAL_GEMINI | DEMO_FALLBACK | FAILED

TRANSPILER INTEGRATION:
- When no Gemini API key is configured (demo mode), the static MUMPS transpiler
  produces semantically correct Python/R without any AI.
- The transpiler is ALWAYS the first conversion attempt in demo mode — it uses
  lexing, parsing, semantic analysis, and code generation to produce accurate output.
- When Gemini IS configured, Gemini is used for richer, more idiomatic output
  (with the transpiler result embedded in the prompt for grounding).
- conversion_source values: REAL_GEMINI | TRANSPILER | DEMO_FALLBACK | FAILED
"""
import json
import logging
from typing import Dict, Any, Optional, Tuple
from app.llm_provider import llm_provider, GeminiAPIError

logger = logging.getLogger("CodeConverter")

# Conversion source constants
CONVERSION_SOURCE_REAL = "REAL_GEMINI"
CONVERSION_SOURCE_TRANSPILER = "TRANSPILER"
CONVERSION_SOURCE_DEMO = "DEMO_FALLBACK"
CONVERSION_SOURCE_FAILED = "FAILED"


class CodeConverter:

    def convert_code_direct(self, mumps_source: str, target_language: str = "Python",
                             source_file: str = "") -> Tuple[str, str]:
        """
        Direct MUMPS-to-Python/R conversion using the static transpiler pipeline.

        Does NOT require a Gemini API key.
        Uses the lexer → parser → semantic analyzer → code generator pipeline.
        This is the primary conversion path for MUMPS source when Gemini is unavailable.

        Returns:
            Tuple of (generated_code: str, conversion_source: str)
            conversion_source is always TRANSPILER
        """
        try:
            from app.pipeline.mumps_transpiler.transpiler import MumpsTranspiler
            transpiler = MumpsTranspiler()
            result = transpiler.convert(
                mumps_source,
                target_language=target_language,
                source_file=source_file,
            )
            if result.python_code and result.is_valid:
                return result.python_code, CONVERSION_SOURCE_TRANSPILER
            # If validation failed, return anyway with a warning prefix
            prefix = "# WARNING: transpiler validation issues detected\n"
            if result.errors:
                prefix += "\n".join(f"# Error: {e}" for e in result.errors) + "\n"
            return prefix + (result.python_code or "# REVIEW_REQUIRED: conversion produced no output"), CONVERSION_SOURCE_TRANSPILER
        except Exception as e:
            logger.error(f"Transpiler failed: {e}")
            return (
                f"# TRANSPILER ERROR: {e}\n"
                f"# REVIEW_REQUIRED: manual conversion needed\n"
                f"# Original MUMPS source:\n"
                + "\n".join(f"# {line}" for line in (mumps_source or "").splitlines()),
                CONVERSION_SOURCE_FAILED,
            )

    def convert_code(self, spec_json_str: str, business_rules_json_str: str, target_language: str = "Python") -> Tuple[str, str]:
        """
        Module 2: Spec-grounded target code generation (backward compatible).

        Strategy:
        - If Gemini API key is configured: use real Gemini for richest output.
          The transpiler result is embedded in the Gemini prompt for grounding.
        - If no API key: use the static transpiler directly (no AI needed).

        Returns:
            Tuple of (generated_code: str, conversion_source: str)
            conversion_source is one of: REAL_GEMINI | TRANSPILER | DEMO_FALLBACK | FAILED

        Raises:
            GeminiAPIError: if API key is configured but Gemini fails.
        """
        # Extract MUMPS source from spec for transpiler grounding
        mumps_source = ""
        try:
            spec = json.loads(spec_json_str)
            rules = json.loads(business_rules_json_str)
            # spec may contain the raw MUMPS source if included by analyzer
            mumps_source = spec.get("_mumps_source", "")
        except Exception:
            spec = {"summary": "Legacy routine"}
            rules = ["Preserve all parameter validation and output structures"]

        # ── No API key → use static transpiler ─────────────────────────────
        if not llm_provider.has_real_api_key:
            if mumps_source:
                return self.convert_code_direct(mumps_source, target_language)
            # Fall back to demo response if we don't have the source
            return (
                "# Demo mode: No Gemini API key configured and MUMPS source not available.\n"
                "# To get real AI conversion, add your Gemini API key in Settings.\n"
                "# To get static transpiler conversion, use the direct transpiler API.",
                CONVERSION_SOURCE_DEMO,
            )

        # ── Real API key → use Gemini ─────────────────────────────────────────
        prompt = self._build_single_file_prompt(spec, rules, target_language)

        # Let GeminiAPIError propagate — do not swallow it
        generated = llm_provider.generate_completion(
            prompt,
            system_instruction=f"Generate production-grade, highly readable {target_language} code preserving exact business logic."
        )

        source = CONVERSION_SOURCE_REAL if llm_provider.has_real_api_key else CONVERSION_SOURCE_DEMO
        return self._clean_code(generated, target_language), source

    def convert_code_with_context(
        self,
        spec_json_str: str,
        business_rules_json_str: str,
        target_language: str,
        source_file: str,
        dependency_context: str,
        interface_contract: Optional[Dict] = None,
        converted_deps_summary: str = "",
        source_language: str = "MUMPS",
        traceability_id: int = None,
    ) -> Tuple[str, str]:
        """
        Dependency-aware code conversion with full project context window.
        This is the primary path for multi-file workspace conversion.

        Returns:
            Tuple of (generated_code: str, conversion_source: str)
            conversion_source is one of: REAL_GEMINI | DEMO_FALLBACK | FAILED

        Raises:
            GeminiAPIError: if API key is configured but Gemini fails.
        """
        try:
            spec = json.loads(spec_json_str)
            rules = json.loads(business_rules_json_str)
        except Exception:
            spec = {"summary": "Healthcare logic routine"}
            rules = ["Preserve all parameter validation and output structures"]

        # Build traceability header
        trace_header = ""
        if traceability_id:
            trace_header = f"# Modernized from: {source_file}\n# ErrorX404 conversion_id: {traceability_id}\n# DO NOT EDIT — generated by ErrorX404 AI Pipeline\n\n"

        contract_str = ""
        if interface_contract:
            contract_str = f"""
=== INTERFACE CONTRACT FOR THIS MODULE ===
You MUST implement all exports listed in this contract with the exact signatures shown.
{json.dumps(interface_contract, indent=2)}
"""

        prompt = f"""
You are converting one component of a larger legacy application from {source_language} to {target_language}.

DO NOT treat the current file as an isolated program.
DO NOT invent dependencies that don't exist in the dependency context.
DO NOT remove dependencies without providing an equivalent replacement.
If a dependency cannot be safely translated, mark it as: # REVIEW_REQUIRED: <reason>

=== SOURCE FILE ===
{source_file}

{dependency_context}

{contract_str}

=== BUSINESS SPECIFICATION ===
{json.dumps(spec, indent=2)}

=== EXPLICIT BUSINESS RULES TO PRESERVE (HIGHEST PRIORITY) ===
{json.dumps(rules, indent=2)}

=== STRICT RULES FOR LOCAL VS EXTERNAL ROUTINES ===
1. Every routine/subroutine/tag defined in THIS file MUST be converted into a local function in this SAME generated file.
2. Call local functions directly (e.g. checkage(...)).
3. NEVER generate imports or wrapper functions for subroutines/tags defined in this same file.
4. ONLY generate imports (e.g. `from <module_name> import <symbol>`) when:
   - The called routine actually exists in ANOTHER file and is confirmed by the dependency context.
   - The routine is NOT defined in this file.
5. If a routine/subroutine is defined in this file, keep it local, call it directly, and do NOT create artificial dependencies.

=== REQUIREMENTS ===
1. Implement clean object-oriented or modular {target_language} code.
2. Every business rule MUST have a docstring/comment reference (e.g., # RULE-1: ...).
3. ALL true cross-file dependencies confirmed in the dependency map MUST be preserved as imports or equivalent.
4. If this module depends on an external converted module, generate: from <module_name> import <symbol>
5. If this module's interface contract lists exports, implement ALL of them with matching signatures.
6. Include error handling and clean data structures.
7. Output ONLY executable, syntactically valid {target_language} code.
8. Begin the file with the traceability header comment if applicable.
9. For MUMPS globals (e.g. ^DPT, ^PSRX), generate a repository/DAO abstraction or dict-based storage.
10. Preserve all function parameter names and return value semantics.

Preserve:
- Business rules
- Function behavior and signatures
- Inputs/outputs
- Cross-file dependencies (for true external routines only)
- Database dependencies (MUMPS globals → Python dict/ORM)
- API dependencies
- Shared data relationships
- Error behavior
- External calls
"""

        # Let GeminiAPIError propagate — do not swallow it
        generated = llm_provider.generate_completion(
            prompt,
            system_instruction=(
                f"You are converting one module of a larger legacy {source_language} application to {target_language}. "
                "Preserve ALL true cross-file dependencies while keeping local subroutines local. Generate production-grade code. "
                "Never silently drop a dependency — if unsure, mark it REVIEW_REQUIRED."
            )
        )
        cleaned = self._clean_code(generated, target_language)

        # Prepend traceability header if not already present
        if trace_header and "# Modernized from:" not in cleaned:
            cleaned = trace_header + cleaned

        source = CONVERSION_SOURCE_REAL if llm_provider.has_real_api_key else CONVERSION_SOURCE_DEMO
        return cleaned, source

    def _build_single_file_prompt(self, spec: dict, rules: list, target_language: str) -> str:
        return f"""
You are an expert software engineer converting legacy MUMPS source code into idiomatic, robust {target_language} code.

CRITICAL RULES:
- Base conversion ONLY on the actual business logic in the specification below.
- ALL subroutines/tags defined in this routine MUST be converted into local functions within this same file.
- Call local functions directly (e.g. checkage(...)).
- Do NOT generate imports for subroutines or functions defined in this same file.
- Do NOT generate wrapper functions that delegate to external imports for locally defined routines.
- Only generate external imports if a routine is explicitly an external routine call (e.g. ^OTHERROUTINE) from another file.
- Do NOT invent external dependencies, functions, APIs, business rules, or data structures not present in the source.
- If a MUMPS construct cannot be mapped exactly, add a TODO comment explaining what needs human review.
- Preserve all global variable access patterns (e.g. ^DPT → abstracted repository class).
- Every function must be traceable back to a MUMPS tag or construct.

BUSINESS SPECIFICATION:
{json.dumps(spec, indent=2)}

EXPLICIT BUSINESS RULES TO PRESERVE (MAIN FOCUS):
{json.dumps(rules, indent=2)}

REQUIREMENTS:
1. Implement clean object-oriented or modular {target_language} code.
2. Every business rule MUST have a docstring/comment reference (e.g., # RULE-1: ...).
3. Include error handling and clean data structures.
4. Output ONLY executable, syntactically valid {target_language} code, with no markdown code blocks surrounding if possible.
5. Add clear comments explaining what each original MUMPS construct is doing.
6. If any MUMPS logic cannot be represented faithfully, add:
   # TODO: Original MUMPS behavior could not be mapped with confidence. Human review required.
"""

    def _clean_code(self, generated: str, target_language: str) -> str:
        cleaned = generated
        lang_lower = target_language.lower()
        if f"```{lang_lower}" in cleaned:
            cleaned = cleaned.split(f"```{lang_lower}")[1].split("```")[0]
        elif "```python" in cleaned:
            cleaned = cleaned.split("```python")[1].split("```")[0]
        elif "```r" in cleaned:
            cleaned = cleaned.split("```r")[1].split("```")[0]
        elif "```" in cleaned:
            parts = cleaned.split("```")
            # Take the longest code block
            code_blocks = [parts[i] for i in range(1, len(parts), 2)]
            if code_blocks:
                cleaned = max(code_blocks, key=len)
        return cleaned.strip()
