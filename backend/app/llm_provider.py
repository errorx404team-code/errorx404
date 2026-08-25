import os
import json
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the PROJECT ROOT (parent of backend/), not the cwd
_project_root = Path(__file__).resolve().parents[2]
_env_path = _project_root / ".env"
load_dotenv(dotenv_path=_env_path)

logger = logging.getLogger("LLMProvider")
logger.setLevel(logging.INFO)

CANDIDATE_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
]

# Sentinel exception raised when the real Gemini API is configured but cannot be reached
class GeminiAPIError(Exception):
    """Raised when the Gemini API is configured but a real call fails.
    Never swallowed silently — must propagate to the caller so no fake
    conversion can be substituted.
    """
    def __init__(self, message: str, error_category: str = "unknown"):
        super().__init__(message)
        self.error_category = error_category


class LLMProvider:
    def __init__(self):
        raw_key = os.getenv("GEMINI_API_KEY", "").strip()
        # Reject only the generic placeholder value
        self.api_key = "" if raw_key == "your_gemini_api_key_here" else raw_key
        self.last_model_used = CANDIDATE_MODELS[0]  # tracks which model succeeded last call
        logger.info(f"LLMProvider initialized. API key present: {bool(self.api_key)}")
        logger.info(f"Loaded .env from: {_env_path}")

    @property
    def has_real_api_key(self) -> bool:
        """True when a non-placeholder API key is configured."""
        return bool(self.api_key and self.api_key != "your_gemini_api_key_here")

    def set_api_key(self, key: str):
        self.api_key = key.strip()

    def persist_api_key(self, key: str):
        """Save API key to the project root .env file and update in memory."""
        self.set_api_key(key)
        os.environ["GEMINI_API_KEY"] = key.strip()

        # Read existing .env, update or add the GEMINI_API_KEY line
        env_file = _env_path
        lines = []
        key_found = False
        if env_file.exists():
            with open(env_file, "r") as f:
                for line in f:
                    if line.strip().startswith("GEMINI_API_KEY="):
                        lines.append(f"GEMINI_API_KEY={key.strip()}\n")
                        key_found = True
                    else:
                        lines.append(line)
        if not key_found:
            lines.insert(0, f"GEMINI_API_KEY={key.strip()}\n")

        with open(env_file, "w") as f:
            f.writelines(lines)

    def test_connection(self, api_key: str = None) -> dict:
        """
        Test Gemini API key validity against live Google endpoints.
        """
        key_to_use = (api_key or self.api_key or "").strip()
        if not key_to_use or key_to_use == "your_gemini_api_key_here":
            return {"success": False, "message": "No API key provided. Enter your Gemini API key in settings.", "is_fallback": True}

        for model in CANDIDATE_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key_to_use}"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": "Hello, respond with OK."}]}]
            }
            try:
                res = requests.post(url, json=payload, timeout=30)
                if res.status_code == 200:
                    return {"success": True, "message": f"Connected to Gemini API ({model}) successfully!", "model_used": model, "is_fallback": False}
                elif res.status_code == 400 or res.status_code == 403:
                    return {"success": False, "message": f"API Key Invalid or Unauthorized (HTTP {res.status_code})", "is_fallback": False}
            except Exception as e:
                logger.error(f"Error testing Gemini connection with {model}: {e}")

        return {"success": False, "message": "Could not connect to Gemini API. Operating in fallback mode.", "is_fallback": True}

    def generate_completion(self, prompt: str, system_instruction: str = None, json_mode: bool = False, api_key: str = None) -> str:
        """
        Call live Gemini API using passed or configured API key across candidate models.

        STRICT RULE:
        - If a real API key is configured, ONLY real Gemini calls are made.
        - If Gemini fails with a real key configured, a GeminiAPIError is raised.
        - Fallback hardcoded responses are ONLY used when NO API key is configured.
        - Never silently substitute fake output for a real Gemini response.
        """
        key_to_use = (api_key or self.api_key or "").strip()
        key_is_real = bool(key_to_use and key_to_use != "your_gemini_api_key_here")

        if key_is_real:
            last_error = None
            last_category = "unknown"
            for model in CANDIDATE_MODELS:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key_to_use}"
                contents = []
                if system_instruction:
                    contents.append({"role": "user", "parts": [{"text": f"System Instruction: {system_instruction}"}]})
                    contents.append({"role": "model", "parts": [{"text": "Understood. I will strictly follow these instructions."}]})

                contents.append({"role": "user", "parts": [{"text": prompt}]})

                payload = {
                    "contents": contents,
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 8192
                    }
                }
                if json_mode:
                    payload["generationConfig"]["responseMimeType"] = "application/json"

                try:
                    res = requests.post(url, json=payload, timeout=60)
                    if res.status_code == 200:
                        data = res.json()
                        # Validate response structure before returning
                        candidates = data.get("candidates", [])
                        if candidates and candidates[0].get("content", {}).get("parts"):
                            text = candidates[0]["content"]["parts"][0]["text"]
                            self.last_model_used = model
                            logger.info(f"Gemini API success with model {model}. Response length: {len(text)}")
                            return text
                        else:
                            # Safety block or empty response
                            finish_reason = candidates[0].get("finishReason", "UNKNOWN") if candidates else "NO_CANDIDATES"
                            last_error = f"Gemini returned empty or safety-blocked response (finishReason: {finish_reason}) from model {model}"
                            last_category = "safety_rejection" if finish_reason == "SAFETY" else "invalid_response"
                            logger.warning(last_error)
                            continue
                    elif res.status_code == 401 or res.status_code == 403:
                        last_category = "authentication_error"
                        last_error = f"Gemini API authentication error (HTTP {res.status_code})"
                        logger.error(f"{last_error} — stopping model retry loop")
                        # Auth errors won't be fixed by trying another model
                        raise GeminiAPIError(last_error, last_category)
                    elif res.status_code == 429:
                        last_category = "rate_limit"
                        last_error = f"Gemini API rate limit exceeded (HTTP 429) on model {model}"
                        logger.warning(last_error)
                        # Try next model
                        continue
                    elif res.status_code >= 500:
                        last_category = "server_error"
                        last_error = f"Gemini API server error (HTTP {res.status_code}) on model {model}"
                        logger.warning(last_error)
                        continue
                    else:
                        last_category = "model_error"
                        last_error = f"Gemini API returned HTTP {res.status_code} on model {model}"
                        logger.warning(last_error)
                        continue
                except GeminiAPIError:
                    raise
                except requests.exceptions.Timeout:
                    last_category = "timeout"
                    last_error = f"Gemini API request timed out on model {model}"
                    logger.error(last_error)
                    continue
                except requests.exceptions.ConnectionError:
                    last_category = "network_error"
                    last_error = f"Network error connecting to Gemini API on model {model}"
                    logger.error(last_error)
                    continue
                except Exception as e:
                    last_category = "unknown"
                    last_error = f"Unexpected error calling Gemini model {model}: {type(e).__name__}"
                    logger.error(f"{last_error}: {e}")
                    continue

            # All models failed — raise, do NOT fall back to hardcoded output
            error_msg = last_error or "All Gemini models failed. No fallback conversion was generated."
            logger.error(f"GeminiAPIError raised: {error_msg} (category: {last_category})")
            raise GeminiAPIError(error_msg, last_category)

        # ── No API key configured — allow fallback ONLY for non-conversion uses ──
        logger.warning("No Gemini API key configured. Operating in demo/fallback mode.")
        return self._fallback_completion(prompt, json_mode)

    def _fallback_completion(self, prompt: str, json_mode: bool = False) -> str:
        """
        Demo/fallback responses used ONLY when no API key is configured.
        NEVER called when a real API key is present.
        """
        prompt_lower = prompt.lower()

        # Chatbot fallback — transparent about unavailability
        if "user question:" in prompt_lower or "language rule" in prompt_lower:
            return "AI explanation unavailable. Gemini API is not configured or an error occurred. To enable AI answers, go to Settings and enter your Gemini API key."

        if "extract business logic" in prompt_lower or "spec_json" in prompt_lower or "legacy mumps routine" in prompt_lower:
            if json_mode:
                return json.dumps({
                    "summary": "Demo fallback: Gemini API not configured. Business logic extraction requires a real Gemini API key.",
                    "functions": [],
                    "business_rules": ["DEMO: Configure Gemini API key to extract real business rules."],
                    "globals_accessed": [],
                    "edge_cases": ["Gemini API key not configured"]
                }, indent=2)
            else:
                return "Demo fallback: Gemini API not configured. Configure an API key for real analysis."

        if json_mode:
            return json.dumps({"status": "demo", "message": "Gemini API not configured. This is a demo response."})
        return "Gemini API not configured. This is a demo response. Please configure your Gemini API key in Settings to enable real AI responses."


llm_provider = LLMProvider()
