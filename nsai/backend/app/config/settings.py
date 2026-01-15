# from pydantic_settings import BaseSettings

# class Settings(BaseSettings):
#     MONGO_URI: str
#     MONGO_DB: str = "nsai"
#     JWT_PRIVATE_KEY: str
#     JWT_PUBLIC_KEY: str
#     JWT_ALGORITHM: str = "RS256"
#     ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
#     REFRESH_TOKEN_EXPIRE_DAYS: int = 7
#     REDIS_URL: str 
    
#     class Config():
#         env_file=".env"
# settings = Settings()
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    MONGO_URI: str
    MONGO_DB: str = "nsai"
    JWT_PRIVATE_KEY: str
    JWT_PUBLIC_KEY: str
    JWT_ALGORITHM: str = "RS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_URL: str 

    class Config():
        env_file = ".env"

    def __init__(self, **values):
        super().__init__(**values)
        
        def get_key_content(key_value: str):
            if key_value.startswith("./") or key_value.endswith(".pem"):
                base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                file_path = os.path.join(base_dir, key_value.lstrip("./"))
                with open(file_path, "r") as f:
                    return f.read()
            return key_value

        self.JWT_PRIVATE_KEY = get_key_content(self.JWT_PRIVATE_KEY)
        self.JWT_PUBLIC_KEY = get_key_content(self.JWT_PUBLIC_KEY)

settings = Settings()
