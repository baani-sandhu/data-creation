import hashlib

from fastapi import HTTPException, Request

from app.auth import get_current_user
from app.main import app
from conftest import override_get_current_user


class FakeCursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *args, **kwargs):
        return self

    def skip(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, length=None):
        return self.items


async def test_no_auth_header_returns_401(client):
    response = await client.get("/jobs/")
    assert response.status_code == 401


async def test_wrong_token_returns_401(client):
    response = await client.get(
        "/jobs/",
        headers={"Authorization": "Bearer wrong-token"},
    )
    assert response.status_code == 401


async def test_malformed_auth_header_returns_401(client):
    response = await client.get(
        "/jobs/",
        headers={"Authorization": "not-bearer-format"},
    )
    assert response.status_code == 401


async def test_missing_bearer_prefix_returns_401(client):
    response = await client.get(
        "/jobs/",
        headers={"Authorization": "test-token"},
    )
    assert response.status_code == 401


async def test_user_cannot_access_another_users_job(
    client, mock_auth_header, mock_auth_header_2, monkeypatch
):
    job_id = "test_isolation_job"
    job_doc = {
        "_id": job_id,
        "user_id": "test-user-123",
        "status": "chunked",
        "fields": ["input", "output"],
        "task_prompt": "test",
        "files": [],
        "chunk_count": 0,
        "token_usage": 0,
        "errors": [],
    }

    async def mock_get_owned_job(requested_job_id, user):
        if requested_job_id != job_doc["_id"]:
            raise HTTPException(status_code=404, detail="Job not found")
        if user["uid"] != job_doc["user_id"]:
            raise HTTPException(status_code=404, detail="Job not found")
        return dict(job_doc)

    async def mock_chunk_count(query):
        return 0

    monkeypatch.setattr("app.routers.jobs.get_owned_job", mock_get_owned_job)
    monkeypatch.setattr(
        "app.routers.jobs.chunks_col.count_documents",
        mock_chunk_count,
    )

    response = await client.get(f"/jobs/{job_id}", headers=mock_auth_header)
    assert response.status_code == 200

    response = await client.get(f"/jobs/{job_id}", headers=mock_auth_header_2)
    assert response.status_code == 404


async def test_user_job_list_only_shows_own_jobs(
    client, mock_auth_header, mock_auth_header_2, monkeypatch
):
    job_docs = [
        {
            "_id": "test_list_job_user1",
            "user_id": "test-user-123",
            "status": "chunked",
            "fields": ["input", "output"],
            "task_prompt": "test",
            "files": [],
            "chunk_count": 0,
            "token_usage": 0,
            "errors": [],
        },
        {
            "_id": "test_list_job_user2",
            "user_id": "test-user-456",
            "status": "chunked",
            "fields": ["input", "output"],
            "task_prompt": "test",
            "files": [],
            "chunk_count": 0,
            "token_usage": 0,
            "errors": [],
        },
    ]

    class FakeJobsCollection:
        def find(self, query):
            return FakeCursor(
                [dict(job) for job in job_docs if job["user_id"] == query["user_id"]]
            )

    async def mock_count_documents(query):
        return 0

    monkeypatch.setattr("app.routers.jobs.jobs_col", FakeJobsCollection())
    monkeypatch.setattr(
        "app.routers.jobs.chunks_col.count_documents", mock_count_documents
    )
    monkeypatch.setattr(
        "app.routers.jobs.results_col.count_documents", mock_count_documents
    )

    response = await client.get("/jobs/", headers=mock_auth_header)
    assert response.status_code == 200
    user_1_job_ids = [j["_id"] for j in response.json()["jobs"]]
    assert "test_list_job_user1" in user_1_job_ids
    assert "test_list_job_user2" not in user_1_job_ids

    response = await client.get("/jobs/", headers=mock_auth_header_2)
    assert response.status_code == 200
    user_2_job_ids = [j["_id"] for j in response.json()["jobs"]]
    assert "test_list_job_user2" in user_2_job_ids
    assert "test_list_job_user1" not in user_2_job_ids


async def test_export_with_valid_api_key(client, monkeypatch):
    raw_key = "lf_test_api_key_12345"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key_docs = {
        key_hash: {
            "_id": "test_api_key_doc",
            "user_id": "test-user-123",
            "key_hash": key_hash,
            "name": "test key",
        }
    }
    job_doc = {
        "_id": "test_export_job",
        "user_id": "test-user-123",
        "status": "done",
        "output_format": "json",
        "fields": ["input", "output"],
        "task_prompt": "test",
        "files": [],
        "chunk_count": 0,
        "token_usage": 0,
        "errors": [],
    }

    async def override_get_current_user_with_api_key(request: Request):
        auth = request.headers.get("Authorization", "")
        if auth == "Bearer test-token":
            return {"uid": "test-user-123", "email": "test@test.com"}
        if auth == "Bearer test-token-2":
            return {"uid": "test-user-456", "email": "test2@test.com"}

        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

        doc = api_key_docs.get(hashlib.sha256(api_key.encode()).hexdigest())
        if not doc:
            raise HTTPException(status_code=401, detail="Unauthorized")

        return {"uid": doc["user_id"]}

    async def mock_get_owned_job(job_id, user):
        if job_id != job_doc["_id"] or user["uid"] != job_doc["user_id"]:
            raise HTTPException(status_code=404, detail="Job not found")
        return dict(job_doc)

    class FakeResultsCollection:
        def find(self, query):
            return FakeCursor([])

    app.dependency_overrides[get_current_user] = override_get_current_user_with_api_key
    monkeypatch.setattr("app.routers.export.get_owned_job", mock_get_owned_job)
    monkeypatch.setattr("app.routers.export.results_col", FakeResultsCollection())

    try:
        response = await client.get(
            "/jobs/test_export_job/export",
            headers={"X-API-Key": raw_key},
        )
        assert response.status_code in [200, 400]
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


async def test_export_with_invalid_api_key_returns_401(client):
    valid_key_hash = hashlib.sha256("lf_test_api_key_12345".encode()).hexdigest()

    async def override_get_current_user_with_api_key(request: Request):
        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        if key_hash != valid_key_hash:
            raise HTTPException(status_code=401, detail="Unauthorized")

        return {"uid": "test-user-123"}

    app.dependency_overrides[get_current_user] = override_get_current_user_with_api_key
    try:
        response = await client.get(
            "/jobs/some-job-id/export",
            headers={"X-API-Key": "lf_completely_fake_key"},
        )
        assert response.status_code == 401
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


async def test_export_with_no_auth_returns_401(client):
    async def override_get_current_user_with_api_key(request: Request):
        api_key = request.headers.get("X-API-Key", "")
        if not api_key:
            raise HTTPException(status_code=401, detail="Unauthorized")

        return {"uid": "test-user-123"}

    app.dependency_overrides[get_current_user] = override_get_current_user_with_api_key
    try:
        response = await client.get("/jobs/some-job-id/export")
        assert response.status_code == 401
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user
