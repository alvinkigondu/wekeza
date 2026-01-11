"""
Agents API Routes - Trading bot management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentStatus as DBAgentStatus, AgentStrategy as DBAgentStrategy
from app.models.system_log import SystemLog, LogLevel, LogCategory
from app.schemas.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentListResponse,
    AgentStatus
)
from app.services.ml_model import get_model

router = APIRouter()


def generate_agent_id(db: Session) -> str:
    """Generate unique agent ID like AGT-001"""
    last_agent = db.query(Agent).order_by(Agent.id.desc()).first()
    next_num = 1 if not last_agent else last_agent.id + 1
    return f"AGT-{next_num:03d}"


@router.get("", response_model=AgentListResponse)
async def list_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all agents for current user"""
    agents = db.query(Agent).filter(Agent.owner_id == current_user.id).all()
    active_count = sum(1 for a in agents if a.status == DBAgentStatus.RUNNING)
    
    return AgentListResponse(
        agents=agents,
        total=len(agents),
        active_count=active_count
    )


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent_data: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new trading agent"""
    new_agent = Agent(
        agent_id=generate_agent_id(db),
        name=agent_data.name,
        strategy=DBAgentStrategy(agent_data.strategy.value),
        config=agent_data.config.model_dump() if agent_data.config else {},
        owner_id=current_user.id
    )
    db.add(new_agent)
    
    # Log the creation
    log = SystemLog(
        level=LogLevel.SUCCESS,
        category=LogCategory.AGENT,
        message=f"Agent {new_agent.agent_id} created",
        user_id=current_user.id
    )
    db.add(log)
    
    db.commit()
    db.refresh(new_agent)
    return new_agent


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific agent by ID"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: int,
    agent_data: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update agent configuration"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    if agent_data.name:
        agent.name = agent_data.name
    if agent_data.strategy:
        agent.strategy = DBAgentStrategy(agent_data.strategy.value)
    if agent_data.config:
        agent.config = agent_data.config.model_dump()
    
    db.commit()
    db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an agent"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    db.delete(agent)
    db.commit()


@router.post("/{agent_id}/start", response_model=AgentResponse)
async def start_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start an agent (set to running)"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    agent.status = DBAgentStatus.RUNNING
    agent.last_active = datetime.utcnow()
    
    # Log the start
    log = SystemLog(
        level=LogLevel.INFO,
        category=LogCategory.AGENT,
        message=f"Agent {agent.agent_id} started",
        user_id=current_user.id,
        agent_id=agent.id
    )
    db.add(log)
    
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/{agent_id}/pause", response_model=AgentResponse)
async def pause_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Pause an agent"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    agent.status = DBAgentStatus.PAUSED
    
    # Log the pause
    log = SystemLog(
        level=LogLevel.INFO,
        category=LogCategory.AGENT,
        message=f"Agent {agent.agent_id} paused",
        user_id=current_user.id,
        agent_id=agent.id
    )
    db.add(log)
    
    db.commit()
    db.refresh(agent)
    return agent


@router.get("/{agent_id}/signal")
async def get_agent_signal(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ML model trading signal for agent (uses abstraction layer)"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.owner_id == current_user.id
    ).first()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get signal from ML model abstraction layer
    model = get_model()
    target_assets = agent.config.get("target_assets", ["BTC"])
    signals = {}
    
    for asset in target_assets:
        signal = await model.get_signal(asset)
        signals[asset] = signal
    
    return {
        "agent_id": agent.agent_id,
        "signals": signals,
        "model_type": "mock" if not model.is_real_model else "production"
    }
