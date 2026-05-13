def build_system_prompt(task_prompt: str, fields: list[str], has_examples: bool = True) -> str:
    """
    Builds the system prompt along
    with the few-shot examples and the chunk to label.
    """
    fields_str = ", ".join(fields)
    fields_json = ", ".join([f'"{f}": "..."' for f in fields])

    no_examples_note = ""
    if not has_examples:
        no_examples_note = "\nNote: No labeled examples are provided. Use the task description and field definitions to determine what constitutes a good training pair."

    return f"""You are a training data extraction assistant.

TASK: {task_prompt}

Your job is to read the provided text and extract structured training pairs from it.
Each pair must have these fields: {fields_str}

EXTRACTION APPROACH:
Work through the text systematically in multiple passes:
1. First extract the explicit, clearly stated pairs
2. Then look for implicit pairs — information that is present but less directly stated
3. Then look for pairs that can be formed by combining closely related sentences
Do not stop after finding the first few obvious pairs.

RULES:
- Be exhaustive — missing a valid pair is worse than extracting a borderline one
- Every field value must be directly supported by the text — no hallucination
- Do not invent, infer beyond what the text supports, or add outside knowledge
- Only extract pairs where ALL fields are clearly supported
- Identical or near-identical pairs should not be repeated
{no_examples_note}

RESPONSE FORMAT:
Return ONLY a valid JSON array. No explanation, no markdown, no preamble.
[
  {{
    {fields_json},
    "confidence": 0.95,
    "reasoning": "one sentence explaining why this is a good pair"
  }}
]

If no good pairs can be extracted, return an empty array: []"""

def build_user_message(chunk: str, examples: list[dict]) -> str:
    """
    Builds the user message containing:
    1. The few-shot examples the human labeled
    2. The chunk to extract pairs from
    """
    examples_block = _format_examples(examples)

    return f"""Here are some examples of the pairs I want extracted:

{examples_block}

Now extract similar pairs from this text:

---
{chunk}
---"""

def build_zero_shot_user_message(
    chunk: str,
    fields: list[str],
) -> str:
    fields_block = "\n".join(["FIELDS TO EXTRACT:"] + [f"- {field}" for field in fields])

    return f"""No examples are provided for this task.
Use the field definitions below to guide extraction.

{fields_block}

Extract as many high quality pairs as you can find.
Every pair must contain all fields listed above.
Only extract pairs clearly supported by the text.

Now extract pairs from this text:

---
{chunk}
---"""

def _format_examples(examples: list[dict]) -> str:
    """
    Formats the human-labeled examples into a readable
    few-shot block.
    Each example looks like:
    {{
        "pair": {{"input": "...", "output": "..."}}
    }}
    """
    if not examples:
        return "No examples provided."

    lines = []
    for i, ex in enumerate(examples, 1):
        pair = ex["pair"]
        lines.append(f"Example {i}:")
        for field, value in pair.items():
            lines.append(f"  {field}: {value}")
        lines.append("")

    return "\n".join(lines)


def build_mode2_generation_system_prompt(task_prompt: str, fields: list[str]) -> str:
    fields_str = ", ".join(fields)
    fields_json = ", ".join([f'"{f}": "..."' for f in fields])

    return f"""You are a training data extraction assistant.

TASK: {task_prompt}

You must generate NEW structured pairs from the chunk.
Each pair must include these fields: {fields_str}

STRICT RULES:
- Use ONLY information supported by the chunk text.
- Generate pairs that are not already covered by the provided existing pairs.
- Do not duplicate or trivially rephrase existing covered pairs.
- Every output pair must contain all required fields.
- Keep field values concise and faithful to the chunk.

RESPONSE FORMAT:
Return ONLY a valid JSON array. No explanation, no markdown, no preamble.
[
  {{
    {fields_json},
    "confidence": 0.95,
    "reasoning": "one sentence explaining why this is a valid new pair"
  }}
]

If no valid NEW pairs can be generated, return: []"""


def build_mode2_generation_user_message(
    *,
    chunk_text: str,
    fields: list[str],
    existing_pairs: list[dict],
    requested_count: int,
) -> str:
    fields_block = "\n".join([f"- {field}" for field in fields])
    existing_pairs_json = _format_json_pairs(existing_pairs)

    return f"""Generate exactly up to {requested_count} NEW pairs from the chunk below.

DO NOT generate pairs already covered by these existing pairs:
{existing_pairs_json}

Required fields:
{fields_block}

Chunk:
---
{chunk_text}
---"""


def _format_json_pairs(pairs: list[dict]) -> str:
    if not pairs:
        return "[]"
    import json
    return json.dumps(pairs, ensure_ascii=False, indent=2)


def build_mode1_paraphrase_system_prompt(task_prompt: str, fields: list[str]) -> str:
    fields_str = ", ".join(fields)
    fields_json = ", ".join([f'"{f}": "..."' for f in fields])

    return f"""You are a training data augmentation assistant.

TASK: {task_prompt}

You must paraphrase existing structured pairs using different wording while preserving meaning.
Each output pair must contain exactly these fields: {fields_str}

STRICT RULES:
- Preserve facts, intent, and meaning from the original pairs.
- Do NOT introduce any new information not supported by the chunk.
- Do NOT add or remove fields.
- Output paraphrased variants only for pairs provided in the input batch.
- Keep each field aligned with the original field semantics.

RESPONSE FORMAT:
Return ONLY a valid JSON array. No explanation, no markdown, no preamble.
[
  {{
    {fields_json},
    "source_pair_id": "original_pair_id",
    "confidence": 0.95,
    "reasoning": "one sentence explaining why this paraphrase is faithful"
  }}
]

If no valid paraphrases can be produced, return: []"""


def build_mode1_paraphrase_user_message(
    *,
    chunk_text: str,
    fields: list[str],
    pair_batch: list[dict],
    requested_count: int,
) -> str:
    fields_block = "\n".join([f"- {field}" for field in fields])
    pairs_json = _format_json_pairs(pair_batch)

    return f"""Produce exactly up to {requested_count} paraphrased pairs from the batch below.

Paraphrase the following pairs.

For each pair:
- Keep the same meaning and factual content
- Use different wording
- Keep only the defined fields
- Include source_pair_id from input in each output item

Fields:
{fields_block}

Input pairs:
{pairs_json}

Grounding chunk:
---
{chunk_text}
---"""


def build_paraphrase_prompt(pairs: list[dict], variants_per_pair: int, fields: list[str]) -> str:
    import json

    fields_str = ", ".join(fields)
    pairs_json = json.dumps(pairs, ensure_ascii=False, indent=2)
    return f"""You are a training data augmentation assistant.

Below are {len(pairs)} training pairs with fields: {fields_str}.
For each pair, generate exactly {variants_per_pair} paraphrased versions.

STRICT RULES:
- Both fields (all fields) must be rewritten together for each variant. Never rewrite fields independently.
- Preserve exact meaning and facts. Change wording, phrasing, and sentence structure.
- Do not add new facts or remove important meaning.
- Keep the same field schema exactly.
- Return exactly {variants_per_pair} variants for EACH input pair.

Return ONLY a valid JSON array. No markdown. No explanation.
Each item must follow:
{{
  "original_index": int,
  "variants": [
    {{{', '.join([f'"{field}": "..."' for field in fields])}}},
    ... exactly {variants_per_pair} items
  ]
}}

Input pairs:
{pairs_json}
"""


def build_generation_augmentation_prompt(
    chunk_text: str,
    existing_pairs: list[dict],
    fields: list[str],
) -> str:
    import json

    fields_str = ", ".join(fields)
    existing_pairs_json = json.dumps(existing_pairs, ensure_ascii=False, indent=2)
    return f"""You are a training data extraction assistant.

Task:
Extract as many new, unique, non-overlapping training pairs as possible from the source text.
Do not repeat or paraphrase existing pairs.

Required fields schema: {fields_str}

STRICT RULES:
- Use only facts directly supported by source text.
- Do not output any pair already represented by existing pairs.
- Do not output near-duplicates.
- Return as many valid new pairs as possible.

Return ONLY a JSON array of pairs with this schema:
[{{
  {', '.join([f'"{field}": "..."' for field in fields])}
}}]

Source text:
---
{chunk_text}
---

Existing pairs (must be excluded):
{existing_pairs_json}
"""
