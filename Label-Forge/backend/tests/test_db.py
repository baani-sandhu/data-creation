import pytest

from app.database import jobs_col


async def test_mongodb_operations():
    # --- connection check ---
    test_id = "test_connection_check"
    await jobs_col.insert_one({"_id": test_id, "test": True})

    doc = await jobs_col.find_one({"_id": test_id})
    assert doc is not None
    assert doc["test"] is True

    await jobs_col.delete_one({"_id": test_id})
    doc = await jobs_col.find_one({"_id": test_id})
    assert doc is None

    # --- insert many check ---
    docs = [{"_id": f"test_bulk_{i}", "index": i} for i in range(5)]
    result = await jobs_col.insert_many(docs)
    assert len(result.inserted_ids) == 5

    count = await jobs_col.count_documents(
        {"_id": {"$regex": "^test_bulk_"}}
    )
    assert count == 5

    await jobs_col.delete_many({"_id": {"$regex": "^test_bulk_"}})
