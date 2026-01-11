"""
SystemLog Model - Audit trails and error logging
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class LogLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    SUCCESS = "success"


class LogCategory(str, enum.Enum):
    AUTH = "auth"
    TRADE = "trade"
    AGENT = "agent"
    SYSTEM = "system"
    RISK = "risk"


class SystemLog(Base):
    __tablename__ = "system_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    level = Column(SQLEnum(LogLevel), default=LogLevel.INFO)
    category = Column(SQLEnum(LogCategory), default=LogCategory.SYSTEM)
    
    message = Column(String(500), nullable=False)
    details = Column(Text, nullable=True)
    
    # Optional user association
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="logs")
    
    # Optional agent association
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
