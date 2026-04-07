from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, jobs, examples, prompts, generation, export

app = FastAPI(title="LabelForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(examples.router) 
app.include_router(prompts.router)
app.include_router(generation.router)
app.include_router(export.router)
app.include_router(auth.router)

@app.get("/health")
async def health():
    return {"status": "ok"}