import asyncio
from pathlib import Path

import pytest
from fastapi import HTTPException, Request
from httpx import ASGITransport, AsyncClient

from app.auth import get_current_user
from app.main import app

try:
    from app.auth import get_current_user_flexible
except ImportError:
    get_current_user_flexible = None

TEST_USER = {"uid": "test-user-123", "email": "test@test.com"}
TEST_USER_2 = {"uid": "test-user-456", "email": "test2@test.com"}


async def override_get_current_user(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth == "Bearer test-token":
        return TEST_USER
    if auth == "Bearer test-token-2":
        return TEST_USER_2
    raise HTTPException(status_code=401, detail="Unauthorized")


async def override_get_current_user_flexible(request: Request):
    auth = request.headers.get("Authorization", "")
    api_key = request.headers.get("X-API-Key", "")
    if auth == "Bearer test-token":
        return TEST_USER
    if auth == "Bearer test-token-2":
        return TEST_USER_2
    if api_key == "test-api-key":
        return TEST_USER
    raise HTTPException(status_code=401, detail="Unauthorized")


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


@pytest.fixture
def sample_pdf_bytes():
    sample_path = Path(__file__).parent / "tests" / "sample.pdf"
    with sample_path.open("rb") as f:
        return f.read()


@pytest.fixture
def sample_txt_bytes():
    return (
        b"This is a test document. It contains multiple sentences. Each sentence can "
        b"become a training pair. The document is about customer service."
    )


@pytest.fixture
def mock_auth_header():
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
def mock_auth_header_2():
    return {"Authorization": "Bearer test-token-2"}


@pytest.fixture(autouse=True)
def mock_firebase_auth():
    app.dependency_overrides[get_current_user] = override_get_current_user
    if get_current_user_flexible is not None:
        app.dependency_overrides[get_current_user_flexible] = (
            override_get_current_user_flexible
        )
    yield
    app.dependency_overrides.clear()


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    yield

    async def _cleanup():
        from motor.motor_asyncio import AsyncIOMotorClient
        from pymongo.errors import PyMongoError

        from app.database import MONGO_URI

        client = AsyncIOMotorClient(MONGO_URI)
        db = client["labelforge"]
        try:
            try:
                await db["jobs"].delete_many({"_id": {"$regex": "^test_"}})
                await db["chunks"].delete_many({"job_id": {"$regex": "^test_"}})
                await db["results"].delete_many({"job_id": {"$regex": "^test_"}})
            except PyMongoError:
                pass
        finally:
            client.close()

    asyncio.run(_cleanup())
