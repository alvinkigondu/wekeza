"""
Agent Schemas - Request/Response models for agent management
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AgentStatus(str, Enum):
    RUNNING = "running"
    IDLE = "idle"
    PAUSED = "paused"
    ERROR = "error"


class AgentStrategy(str, Enum):
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"
    ARBITRAGE = "arbitrage"
    TREND_FOLLOWING = "trend_following"
    CUSTOM = "custom"


class AgentConfig(BaseModel):
    risk_level: str = "medium"
    max_trades_per_day: int = 10
    target_assets: List[str] = ["BTC", "ETH"]


class AgentCreate(BaseModel):
    name: str
    strategy: AgentStrategy = AgentStrategy.MOMENTUM
    config: Optional[AgentConfig] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    strategy: Optional[AgentStrategy] = None
    config: Optional[AgentConfig] = None


class AgentResponse(BaseModel):
    id: int
    agent_id: str
    name: str
    strategy: AgentStrategy
    status: AgentStatus
    config: dict
    total_pnl: float
    win_rate: float
    total_trades: int
    created_at: datetime
    last_active: Optional[datetime]
    
    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    agents: List[AgentResponse]
    total: int
    active_count: int
