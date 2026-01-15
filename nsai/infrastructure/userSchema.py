User_collection_validation={
  "$jsonSchema": {
    "bsonType": "object",
    "required": [
      "email",
      "username",
      "password_hash",
      "first_name",
      "last_name",
      "role",
      "is_verified",
      "created_at",
      "updated_at"
    ],
    "properties": {
      "_id": { "bsonType": "objectId" },
      "email": { "bsonType": "string" },
      "username": { "bsonType": "string" },
      "password_hash": { "bsonType": "string" },
      "first_name": { "bsonType": "string" },
      "last_name": { "bsonType": "string" },
      "role": { "enum": ["user", "admin"] },
      "is_verified": { "bsonType": "bool" },
      "created_at": { "bsonType": "date" },
      "updated_at": { "bsonType": "date" },
      "last_login": { "bsonType": ["date", "null"] },
      "profile_image_url": { "bsonType": ["string", "null"] }
    }
  }
}
