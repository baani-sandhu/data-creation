from fastapi import FastAPI
from app.routes import health
from app.middleware.cors import add_cors_middleware

app=FastAPI()
add_cors_middleware(app)
app.include_router(health.router,prefix="/api/v1")

@app.get("/health")
def health_main():
    return {"health":"ok"}