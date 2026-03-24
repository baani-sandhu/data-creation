from fastapi import FastAPI

app = FastAPI(title="LabelForge API")

@app.get("/health")
async def health():
    return {"status": "ok"}