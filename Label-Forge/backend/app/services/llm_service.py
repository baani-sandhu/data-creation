import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

SYSTEM_INSTRUCTION = """You are a prompt engineer helping
users describe what training data they want to extract
from documents.

The user will give you a rough description of their
extraction task. Your job is to rewrite it as a clear,
specific, one or two sentence task description.

STRICT RULES:
- Return ONLY the refined task description
- Do NOT mention JSON, CSV, arrays, or any output format
- Do NOT mention field names, keys, or data structure
- Do NOT add numbered lists, bullet points or formatting
- Do NOT redefine what fields to extract or how to label them
- Keep it concise — one to two sentences maximum
- Focus only on WHAT to extract and from WHAT kind of content

Example input:
"extract questions and answers from customer service docs"

Example output:
"Extract distinct customer questions and their corresponding
agent responses from customer service documentation, focusing
on common support scenarios and resolution steps."

Example input:
"get the situations and scripts for sales agents"

Example output:
"Extract specific sales situations that agents may encounter
and the recommended response scripts or action plans
associated with each situation."
"""

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is not set")

client = genai.Client(api_key=api_key)


def _strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        # Remove the first and last fence lines, including optional language tag.
        lines = stripped.splitlines()
        if len(lines) >= 2:
            return "\n".join(lines[1:-1]).strip()
    return stripped


def refine_prompt(prompt: str) -> str:
    instruction = f"{SYSTEM_INSTRUCTION}\n\n{prompt}".strip()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=instruction,
    )
    text = getattr(response, "text", None) or ""
    return text.strip()


def extract_pairs(system_prompt: str, user_message: str) -> list[dict]:
    prompt = f"{system_prompt}\n\n{user_message}".strip()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = getattr(response, "text", None) or ""
    cleaned = _strip_code_fences(text)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        return []
    return []
