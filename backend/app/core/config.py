"""
Application Configuration - Loads from environment variables
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/wekeza"
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5500"
    
    # ML Model Toggle
    USE_REAL_MODEL: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
