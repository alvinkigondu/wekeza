"""
User Schemas - Request/Response models for authentication
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int


class RiskSettings(BaseModel):
    max_position_size: int = 10
    stop_loss_default: int = 5
    daily_loss_limit: int = 10
    leverage_limit: int = 3


class NotificationPrefs(BaseModel):
    trade_alerts: bool = True
    performance_reports: bool = True
    risk_warnings: bool = True
    market_updates: bool = False


class UserSettingsUpdate(BaseModel):
    risk_settings: Optional[RiskSettings] = None
    notification_prefs: Optional[NotificationPrefs] = None
