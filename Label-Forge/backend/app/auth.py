import os
from fastapi import HTTPException, Request
import firebase_admin
from firebase_admin import auth, credentials
from google.auth.exceptions import TransportError
from dotenv import load_dotenv
from app.database import jobs_col

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))

credentials_path = (
    os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    or "firebase_service_account.json"
)
CREDENTIALS_PATH = (
    credentials_path
    if os.path.isabs(credentials_path)
    else os.path.abspath(os.path.join(BASE_DIR, credentials_path))
)

if not firebase_admin._apps:
    if not os.path.exists(CREDENTIALS_PATH):
        raise RuntimeError(f"Firebase service account file not found: {CREDENTIALS_PATH}")
    firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS_PATH))


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = auth_header.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        decoded = auth.verify_id_token(token)
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except (auth.InvalidIdTokenError, auth.RevokedIdTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid authorization token")
    except TransportError:
        raise HTTPException(status_code=401, detail="Unable to verify authorization token")

    return {
        "uid": decoded.get("uid"),
        "email": decoded.get("email"),
        "name": decoded.get("name"),
    }


async def get_owned_job(job_id: str, user: dict) -> dict:
    job = await jobs_col.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return job
