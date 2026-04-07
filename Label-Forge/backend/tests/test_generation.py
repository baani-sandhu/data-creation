import pytest
from fastapi import HTTPException
from unittest.mock import patch

from app.services.llm_service import extract_pairs
from app.services.prompt_builder import build_system_prompt, build_user_message
from app.routers.generation import add_example

MOCK_PAIRS = [
    {
        "input": "How do I reset my password?",
        "output": "Go to settings and click forgot password.",
        "confidence": 0.95,
        "reasoning": "Clear Q&A pair present in text",
    }
]


def test_extract_pairs_returns_list_on_valid_json():
    valid_json = '[{"input":"test","output":"answer","confidence":0.9,"reasoning":"good"}]'
    with patch("app.services.llm_service.client") as mock_client:
        mock_response = type("R", (), {
            "text": valid_json
        })()
        mock_client.models.generate_content.return_value = mock_response
        result = extract_pairs("system prompt", "user message")
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["input"] == "test"


def test_extract_pairs_returns_empty_on_invalid_json():
    with patch("app.services.llm_service.client") as mock_client:
        mock_response = type("R", (), {
            "text": "This is not JSON at all"
        })()
        mock_client.models.generate_content.return_value = mock_response
        result = extract_pairs("system prompt", "user message")
        assert result == []


def test_extract_pairs_handles_markdown_fences():
    json_in_fence = '```json\n[{"input":"q","output":"a","confidence":0.8,"reasoning":"ok"}]\n```'
    with patch("app.services.llm_service.client") as mock_client:
        mock_response = type("R", (), {
            "text": json_in_fence
        })()
        mock_client.models.generate_content.return_value = mock_response
        result = extract_pairs("system", "user")
        assert len(result) == 1
        assert result[0]["input"] == "q"


@pytest.mark.asyncio
async def test_add_example_normalizes_schema_and_blocks_duplicates(monkeypatch):
    job = {
        "_id": "job-1",
        "user_id": "test-user-123",
        "fields": ["input", "output"],
        "examples": [
            {
                "input": "Chunk text",
                "output": {"input": "question", "output": "answer"},
            }
        ],
    }
    result = {
        "_id": "result-1",
        "job_id": "job-1",
        "chunk_id": "chunk-1",
        "pair": {"input": "question", "output": "answer"},
        "discarded": False,
    }
    chunk = {"_id": "chunk-1", "job_id": "job-1", "text": "Chunk text"}

    async def mock_get_owned_job(job_id, user):
        return dict(job)

    async def mock_find_one(query):
        if query == {"_id": "result-1", "job_id": "job-1"}:
            return dict(result)
        if query == {"_id": "chunk-1", "job_id": "job-1"}:
            return dict(chunk)
        return None

    async def mock_update_one(query, update):
        return None

    monkeypatch.setattr("app.routers.generation.get_owned_job", mock_get_owned_job)
    monkeypatch.setattr("app.routers.generation.results_col.find_one", mock_find_one)
    monkeypatch.setattr("app.routers.generation.chunks_col.find_one", mock_find_one)
    monkeypatch.setattr("app.routers.generation.jobs_col.update_one", mock_update_one)
    monkeypatch.setattr("app.routers.generation.results_col.update_one", mock_update_one)

    with pytest.raises(HTTPException) as exc_info:
        await add_example("job-1", "result-1", {"uid": "test-user-123"})

    assert exc_info.value.status_code == 400

    job["examples"] = []
    updated_examples = {}

    async def capture_update(query, update):
        updated_examples["examples"] = update["$set"]["examples"]
        return None

    monkeypatch.setattr("app.routers.generation.jobs_col.update_one", capture_update)

    response = await add_example("job-1", "result-1", {"uid": "test-user-123"})

    assert response["added"] is True
    assert updated_examples["examples"] == [
        {
            "input": "Chunk text",
            "output": {"input": "question", "output": "answer"},
        }
    ]
