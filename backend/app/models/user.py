"""
User Model - Stores user accounts and settings
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    # Settings stored as JSON for flexibility
    risk_settings = Column(JSON, default={
        "max_position_size": 10,
        "stop_loss_default": 5,
        "daily_loss_limit": 10,
        "leverage_limit": 3
    })
    notification_prefs = Column(JSON, default={
        "trade_alerts": True,
        "performance_reports": True,
        "risk_warnings": True,
        "market_updates": False
    })
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    agents = relationship("Agent", back_populates="owner")
    portfolio = relationship("Portfolio", back_populates="user", uselist=False)
    trades = relationship("Trade", back_populates="user")
    logs = relationship("SystemLog", back_populates="user")
