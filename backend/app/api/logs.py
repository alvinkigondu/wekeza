"""
System Logs API Routes
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.system_log import SystemLog, LogLevel, LogCategory
from app.schemas.log import LogListResponse, LogResponse

router = APIRouter()


@router.get("", response_model=LogListResponse)
async def get_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    level: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated system logs for current user"""
    query = db.query(SystemLog).filter(SystemLog.user_id == current_user.id)
    
    # Apply filters
    if level:
        try:
            query = query.filter(SystemLog.level == LogLevel(level))
        except ValueError:
            pass
    
    if category:
        try:
            query = query.filter(SystemLog.category == LogCategory(category))
        except ValueError:
            pass
    
    # Get total count
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * per_page
    logs = query.order_by(SystemLog.created_at.desc()).offset(offset).limit(per_page).all()
    
    return LogListResponse(
        logs=logs,
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/recent")
async def get_recent_logs(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get most recent logs (for dashboard)"""
    logs = db.query(SystemLog).filter(
        SystemLog.user_id == current_user.id
    ).order_by(SystemLog.created_at.desc()).limit(limit).all()
    
    return [LogResponse.model_validate(log) for log in logs]


@router.get("/stats")
async def get_log_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get log statistics"""
    base_query = db.query(SystemLog).filter(SystemLog.user_id == current_user.id)
    
    stats = {
        "total": base_query.count(),
        "by_level": {
            "info": base_query.filter(SystemLog.level == LogLevel.INFO).count(),
            "warning": base_query.filter(SystemLog.level == LogLevel.WARNING).count(),
            "error": base_query.filter(SystemLog.level == LogLevel.ERROR).count(),
            "success": base_query.filter(SystemLog.level == LogLevel.SUCCESS).count()
        },
        "by_category": {
            "auth": base_query.filter(SystemLog.category == LogCategory.AUTH).count(),
            "trade": base_query.filter(SystemLog.category == LogCategory.TRADE).count(),
            "agent": base_query.filter(SystemLog.category == LogCategory.AGENT).count(),
            "system": base_query.filter(SystemLog.category == LogCategory.SYSTEM).count(),
            "risk": base_query.filter(SystemLog.category == LogCategory.RISK).count()
        }
    }
    
    return stats
