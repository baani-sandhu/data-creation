import pytest

from app.services.prompt_builder import (
    build_system_prompt,
    build_user_message,
    build_zero_shot_user_message,
)

FIELDS = ["input", "output"]
TASK = "Extract question and answer pairs from customer service documents"
EXAMPLES = [
    {"pair": {"input": "How do I reset my password?", "output": "Go to settings."}},
    {"pair": {"input": "What are your hours?", "output": "9am to 6pm Monday-Friday."}},
]
CHUNK = "Customers often ask about delivery. Standard delivery takes 3-5 days."


def test_system_prompt_contains_task():
    prompt = build_system_prompt(TASK, FIELDS)
    assert TASK in prompt


def test_system_prompt_contains_fields():
    prompt = build_system_prompt(TASK, FIELDS)
    assert "input" in prompt
    assert "output" in prompt


def test_system_prompt_contains_json_instruction():
    prompt = build_system_prompt(TASK, FIELDS)
    assert "JSON" in prompt
    assert "confidence" in prompt


def test_user_message_contains_examples():
    msg = build_user_message(CHUNK, EXAMPLES)
    assert "reset my password" in msg
    assert "9am to 6pm" in msg


def test_user_message_contains_chunk():
    msg = build_user_message(CHUNK, EXAMPLES)
    assert "delivery" in msg


def test_user_message_no_examples():
    msg = build_user_message(CHUNK, [])
    assert "No examples provided" in msg
    assert "delivery" in msg


def test_zero_shot_message_contains_fields():
    msg = build_zero_shot_user_message(CHUNK, FIELDS)
    assert "input" in msg
    assert "output" in msg


def test_zero_shot_message_contains_chunk():
    msg = build_zero_shot_user_message(CHUNK, FIELDS)
    assert "delivery" in msg


def test_zero_shot_message_no_examples_mentioned():
    msg = build_zero_shot_user_message(CHUNK, FIELDS)
    assert "Example 1" not in msg
