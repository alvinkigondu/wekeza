"""
Agent Model - Trading bots/agents configuration and state
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Enum as SQLEnum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class AgentStatus(str, enum.Enum):
    RUNNING = "running"
    IDLE = "idle"
    PAUSED = "paused"
    ERROR = "error"


class AgentStrategy(str, enum.Enum):
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"
    ARBITRAGE = "arbitrage"
    TREND_FOLLOWING = "trend_following"
    CUSTOM = "custom"


class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(20), unique=True, index=True)  # e.g., "AGT-001"
    name = Column(String(100), nullable=False)  # e.g., "Momentum Trader"
    strategy = Column(SQLEnum(AgentStrategy), default=AgentStrategy.MOMENTUM)
    status = Column(SQLEnum(AgentStatus), default=AgentStatus.IDLE)
    
    # Strategy configuration (flexible JSON)
    config = Column(JSON, default={
        "risk_level": "medium",
        "max_trades_per_day": 10,
        "target_assets": ["BTC", "ETH", "TSLA"]
    })
    
    # Performance metrics
    total_pnl = Column(Float, default=0.0)
    win_rate = Column(Float, default=0.0)
    total_trades = Column(Integer, default=0)
    
    # Ownership
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="agents")
    
    # Related trades
    trades = relationship("Trade", back_populates="agent")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active = Column(DateTime, nullable=True)
