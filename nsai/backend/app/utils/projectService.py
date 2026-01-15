from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException, status
from app.config.db import db
from app.routes.schemas.projectSchema import project_schema, ProjectStatus

class ProjectService():
    def __init__(self):
        self.collection= db["projects"]
    
    def create(self, user_id: ObjectId, payload: dict):
        project = project_schema({
            "user_id": user_id,
            **payload
        })
        self.collection.insert_one(project)
        return project
    
    def list(
        self,
        user_id: ObjectId,
        page: int,
        limit: int,
        status: str | None,
        sort: str,
        order: int
    ):
        query = {"user_id": user_id}
        if status:
            query["status"] = status

        skip = (page - 1) * limit

        cursor = (
            self.collection
            .find(query)
            .sort(sort, order)
            .skip(skip)
            .limit(limit)
        )

        items = list(cursor)
        total = self.collection.count_documents(query)

        return {
            "items": items,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }
