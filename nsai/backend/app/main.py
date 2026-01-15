from fastapi import FastAPI
from app.config.redis import redis_client
from app.routes import health,authRoute
from app.middleware.cors import add_cors_middleware
from fastapi_limiter import FastAPILimiter

app=FastAPI(docs_url="/api/v1/docs",openapi_url="/api/v1/openapi.json",)
add_cors_middleware(app)
app.include_router(health.router,prefix="/api/v1")
app.include_router(authRoute.router, prefix="/api/v1")

@app.get("/health")
def health_main():
    return {"health":"ok"}

@app.get("/")
def entry():
    return {"main":"page"}

@app.on_event("startup")
async def startup():
    await FastAPILimiter.init(redis_client)