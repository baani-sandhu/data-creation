import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import jobs_col

async def test():
    result = await jobs_col.insert_one({"test": True})
    print("Inserted:", result.inserted_id)
    doc = await jobs_col.find_one({"test": True})
    print("Found:", doc)
    await jobs_col.delete_one({"test": True})
    print("Cleaned up — Atlas connection works!")

asyncio.run(test())