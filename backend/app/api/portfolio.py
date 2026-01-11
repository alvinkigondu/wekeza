"""
Portfolio API Routes - Holdings and performance data
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
import random

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.portfolio import Portfolio, Holding
from app.schemas.portfolio import (
    PortfolioResponse,
    HoldingCreate,
    HoldingResponse,
    PerformanceResponse,
    PerformanceDataPoint,
    AllocationResponse
)

router = APIRouter()


def calculate_holding_response(holding: Holding) -> dict:
    """Calculate derived fields for holding response"""
    total_value = holding.quantity * holding.current_price
    investment = holding.quantity * holding.avg_price
    profit_loss = total_value - investment
    profit_percent = (profit_loss / investment * 100) if investment > 0 else 0
    
    return {
        "id": holding.id,
        "asset": holding.asset,
        "asset_type": holding.asset_type,
        "symbol": holding.symbol,
        "quantity": holding.quantity,
        "avg_price": holding.avg_price,
        "current_price": holding.current_price,
        "total_value": total_value,
        "profit_loss": profit_loss,
        "profit_percent": profit_percent
    }


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's portfolio with all holdings"""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    
    if not portfolio:
        # Create empty portfolio if doesn't exist
        portfolio = Portfolio(user_id=current_user.id)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    
    # Calculate holdings with derived fields
    holdings_data = [calculate_holding_response(h) for h in portfolio.holdings]
    
    # Calculate total value
    total_value = sum(h["total_value"] for h in holdings_data)
    
    return {
        "id": portfolio.id,
        "total_value": total_value,
        "allocation": portfolio.allocation,
        "holdings": holdings_data,
        "updated_at": portfolio.updated_at
    }


@router.post("/holdings", response_model=HoldingResponse, status_code=status.HTTP_201_CREATED)
async def add_holding(
    holding_data: HoldingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new holding to portfolio"""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    
    if not portfolio:
        portfolio = Portfolio(user_id=current_user.id)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    
    new_holding = Holding(
        portfolio_id=portfolio.id,
        asset=holding_data.asset,
        asset_type=holding_data.asset_type,
        symbol=holding_data.symbol,
        quantity=holding_data.quantity,
        avg_price=holding_data.avg_price,
        current_price=holding_data.avg_price  # Initial current = avg
    )
    db.add(new_holding)
    db.commit()
    db.refresh(new_holding)
    
    return calculate_holding_response(new_holding)


@router.delete("/holdings/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_holding(
    holding_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a holding from portfolio"""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    holding = db.query(Holding).filter(
        Holding.id == holding_id,
        Holding.portfolio_id == portfolio.id
    ).first()
    
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    db.delete(holding)
    db.commit()


@router.get("/performance", response_model=PerformanceResponse)
async def get_performance(
    period: str = "6m",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get portfolio performance data (mock data for now)"""
    # In production, this would query historical data
    # For now, generate mock data
    
    periods = {
        "1w": 7,
        "1m": 30,
        "3m": 90,
        "6m": 180,
        "1y": 365
    }
    
    days = periods.get(period, 180)
    base_value = 100000
    data_points = []
    current_value = base_value
    
    for i in range(0, days, max(days // 30, 1)):  # ~30 data points
        date = (datetime.now() - timedelta(days=days - i)).strftime("%Y-%m-%d")
        # Simulate growth with some volatility
        change = random.uniform(-0.02, 0.03)
        current_value = current_value * (1 + change)
        data_points.append(PerformanceDataPoint(date=date, value=round(current_value, 2)))
    
    # Ensure last point is today
    data_points.append(PerformanceDataPoint(
        date=datetime.now().strftime("%Y-%m-%d"),
        value=round(current_value, 2)
    ))
    
    total_return = current_value - base_value
    percent_change = (total_return / base_value) * 100
    
    return PerformanceResponse(
        period=period,
        data=data_points,
        total_return=round(total_return, 2),
        percent_change=round(percent_change, 2)
    )


@router.get("/allocation", response_model=AllocationResponse)
async def get_allocation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get portfolio allocation breakdown"""
    portfolio = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).first()
    
    if not portfolio:
        return AllocationResponse(
            crypto=0, stocks=0, forex=0, commodities=0, cash=100
        )
    
    # Calculate allocation from holdings
    type_totals = {"Crypto": 0, "Stock": 0, "Forex": 0, "Commodity": 0}
    total_value = 0
    
    for holding in portfolio.holdings:
        value = holding.quantity * holding.current_price
        total_value += value
        if holding.asset_type in type_totals:
            type_totals[holding.asset_type] += value
    
    if total_value == 0:
        return AllocationResponse(
            crypto=0, stocks=0, forex=0, commodities=0, cash=100
        )
    
    return AllocationResponse(
        crypto=round(type_totals["Crypto"] / total_value * 100, 1),
        stocks=round(type_totals["Stock"] / total_value * 100, 1),
        forex=round(type_totals["Forex"] / total_value * 100, 1),
        commodities=round(type_totals["Commodity"] / total_value * 100, 1),
        cash=0  # Cash would be tracked separately
    )
