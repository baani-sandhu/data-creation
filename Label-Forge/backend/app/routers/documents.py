import os
from fastapi import APIRouter, Depends, HTTPException, Response
from app.auth import get_current_user
from app.database import documents_col

router = APIRouter(prefix="/documents", tags=["documents"])

FILE_TYPE_TO_MEDIA_TYPE = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xls": "application/vnd.ms-excel",
    "txt": "text/plain",
    "md": "text/markdown",
    "csv": "text/csv",
}

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


@router.get("/{document_id}/file")
async def get_document_file(document_id: str, user: dict = Depends(get_current_user)):
    document = await documents_col.find_one({"_id": document_id})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.get("user_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    file_path = document.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file not found")

    with open(file_path, "rb") as source_file:
        file_bytes = source_file.read()

    file_type = str(document.get("file_type") or "").lower()
    original_filename = document.get("original_filename") or os.path.basename(file_path)
    media_type = FILE_TYPE_TO_MEDIA_TYPE.get(file_type, "application/octet-stream")

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{original_filename}"'},
    )
