"""
Log Schemas - Request/Response models for system logs
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class LogLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"


class LogCategory(str, Enum):
    AUTH = "auth"
    TRADE = "trade"
    AGENT = "agent"
    SYSTEM = "system"
    RISK = "risk"


class LogCreate(BaseModel):
    level: LogLevel
    category: LogCategory
    message: str
    details: Optional[str] = None


class LogResponse(BaseModel):
    id: int
    level: LogLevel
    category: LogCategory
    message: str
    details: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    logs: List[LogResponse]
    total: int
    page: int
    per_page: int
