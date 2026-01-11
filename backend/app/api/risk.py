"""
Risk Management API Routes
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio
from app.schemas.user import RiskSettings

router = APIRouter()


@router.get("/settings", response_model=RiskSettings)
async def get_risk_settings(current_user: User = Depends(get_current_user)):
    """Get user's risk settings"""
    return RiskSettings(**current_user.risk_settings)


@router.put("/settings", response_model=RiskSettings)
async def update_risk_settings(
    settings: RiskSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's risk settings"""
    current_user.risk_settings = settings.model_dump()
    db.commit()
    db.refresh(current_user)
    return RiskSettings(**current_user.risk_settings)


@router.get("/exposure")
async def get_risk_exposure(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current risk exposure breakdown"""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    
    if not portfolio or not portfolio.holdings:
        return {
            "total_exposure": 0,
            "exposure_by_type": {
                "crypto": 0,
                "stocks": 0,
                "forex": 0,
                "commodities": 0,
                "cash": 100
            },
            "warnings": []
        }
    
    # Calculate exposure
    type_totals = {"Crypto": 0, "Stock": 0, "Forex": 0, "Commodity": 0}
    total_value = 0
    
    for holding in portfolio.holdings:
        value = holding.quantity * holding.current_price
        total_value += value
        if holding.asset_type in type_totals:
            type_totals[holding.asset_type] += value
    
    # Calculate percentages
    exposure = {}
    for asset_type, value in type_totals.items():
        pct = round(value / total_value * 100, 1) if total_value > 0 else 0
        exposure[asset_type.lower()] = pct
    
    # Check for warnings based on risk settings
    warnings = []
    max_position = current_user.risk_settings.get("max_position_size", 10)
    
    for asset_type, pct in exposure.items():
        if pct > max_position * 3:  # 3x max position = warning
            warnings.append({
                "type": "high_concentration",
                "asset_type": asset_type,
                "current": pct,
                "recommended_max": max_position * 3,
                "message": f"High concentration in {asset_type}: {pct}%"
            })
    
    return {
        "total_exposure": total_value,
        "exposure_by_type": exposure,
        "warnings": warnings
    }


@router.get("/metrics")
async def get_risk_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get risk metrics (VaR, Sharpe, etc.) - mock data for now"""
    # In production, these would be calculated from historical data
    return {
        "value_at_risk": {
            "daily_var_95": 2.5,
            "weekly_var_95": 5.8,
            "level": "low"
        },
        "sharpe_ratio": 1.45,
        "max_drawdown": -12.3,
        "volatility": 18.5,
        "beta": 0.85
    }
