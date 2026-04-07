import io
import json

import pytest
from fastapi import HTTPException
from httpx import AsyncClient


async def test_health_endpoint(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


async def test_create_job_without_auth_returns_401(client, sample_txt_bytes):
    response = await client.post(
        "/jobs/",
        files={"files": ("test.txt", sample_txt_bytes, "text/plain")},
        data={
            "fields": "input,output",
            "task_prompt": "Extract pairs",
            "output_format": "jsonl",
        },
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401


async def test_get_job_not_found(client, mock_auth_header, monkeypatch):
    async def mock_get_owned_job(job_id, user):
        raise HTTPException(status_code=404, detail="Job not found")

    monkeypatch.setattr("app.routers.jobs.get_owned_job", mock_get_owned_job)
    response = await client.get(
        "/jobs/00000000-0000-0000-0000-000000000000",
        headers=mock_auth_header,
    )
    assert response.status_code == 404


async def test_get_chunks_not_found(client, mock_auth_header, monkeypatch):
    async def mock_get_owned_job(job_id, user):
        raise HTTPException(status_code=404, detail="Job not found")

    monkeypatch.setattr("app.routers.jobs.get_owned_job", mock_get_owned_job)
    response = await client.get(
        "/jobs/00000000-0000-0000-0000-000000000000/chunks",
        headers=mock_auth_header,
    )
    assert response.status_code == 404


async def test_create_job_unsupported_file_type(
    client, mock_auth_header
):
    response = await client.post(
        "/jobs/",
        files={"files": ("test.exe", b"binary data", "application/octet-stream")},
        data={
            "fields": "input,output",
            "task_prompt": "Extract pairs",
            "output_format": "jsonl",
        },
        headers=mock_auth_header,
    )
    # should either reject or report file error
    assert response.status_code in [400, 200]
    if response.status_code == 200:
        data = response.json()
        assert data["files_failed"] == 1


async def test_create_job_missing_fields(client, mock_auth_header, sample_txt_bytes):
    response = await client.post(
        "/jobs/",
        files={"files": ("test.txt", sample_txt_bytes, "text/plain")},
        data={
            "fields": "input",  # only 1 field, needs at least 2
            "task_prompt": "Extract pairs",
            "output_format": "jsonl",
        },
        headers=mock_auth_header,
    )
    assert response.status_code == 400


async def test_create_job_stores_examples_inside_job(
    client, mock_auth_header, sample_txt_bytes, monkeypatch
):
    inserted = {}

    class DummyAiofilesContext:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def write(self, data):
            return None

    async def mock_insert_many(docs):
        inserted["chunks"] = docs

    async def mock_insert_one(doc):
        inserted["job"] = doc

    monkeypatch.setattr("app.routers.jobs.extract", lambda file_bytes, ext: "alpha\nbeta")
    monkeypatch.setattr("app.routers.jobs.chunk", lambda text, strategy="auto": ["chunk 1"])
    monkeypatch.setattr("app.routers.jobs.aiofiles.open", lambda *args, **kwargs: DummyAiofilesContext())
    monkeypatch.setattr("app.routers.jobs.chunks_col.insert_many", mock_insert_many)
    monkeypatch.setattr("app.routers.jobs.jobs_col.insert_one", mock_insert_one)

    response = await client.post(
        "/jobs/",
        files={"files": ("test.txt", sample_txt_bytes, "text/plain")},
        data={
            "fields": "input,output",
            "task_prompt": "Extract pairs",
            "output_format": "jsonl",
            "examples": json.dumps(
                [{"input": "hello", "output": {"output": "world"}}]
            ),
        },
        headers=mock_auth_header,
    )

    assert response.status_code == 200
    assert inserted["job"]["examples"] == [
        {"input": "hello", "output": {"output": "world"}}
    ]
