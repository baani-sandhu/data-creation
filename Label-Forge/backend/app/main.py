from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, jobs, examples, prompts, generation, export, documents, augmentation
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter
from app.database import create_indexes
import os

app = FastAPI(title="LabelForge")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173,http://124.123.18.150")
allow_origins = [o.strip() for o in origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(examples.router) 
app.include_router(prompts.router)
app.include_router(generation.router)
app.include_router(export.router)
app.include_router(documents.router)
app.include_router(augmentation.router)
app.include_router(auth.router)

@app.on_event("startup")
async def startup_event():
    await create_indexes()

@app.get("/health")
async def health():
    return {"status": "ok"}
