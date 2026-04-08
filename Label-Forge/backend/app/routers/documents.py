import os
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import documents_col

router = APIRouter(prefix="/documents", tags=["documents"])

@router.get("/")
async def list_documents(user: dict = Depends(get_current_user)):
    cursor = documents_col.find({"user_id": user["uid"]}).sort("created_at", -1)
    documents = await cursor.to_list(length=500)
    for document in documents:
        document["_id"] = str(document["_id"])

    return {"documents": documents}

@router.delete("/{document_id}")
async def delete_document(document_id: str, user: dict = Depends(get_current_user)):
    document = await documents_col.find_one({"_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.get("user_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    file_path = document.get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    await documents_col.delete_one({"_id": document_id})
    return {"deleted": document_id}