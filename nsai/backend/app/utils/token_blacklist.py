from app.config.redis import redis_client

BLACKLIST_PREFIX = "blacklist:refresh:"

async def blacklist_token(token_id: str, expires_in: int):
    await redis_client.setex(
        f"{BLACKLIST_PREFIX}{token_id}",
        expires_in,
        "revoked"
    )

async def is_token_blacklisted(token_id: str) -> bool:
    return await redis_client.exists(f"{BLACKLIST_PREFIX}{token_id}") == 1
