"""
Portfolio Schemas - Request/Response models for portfolio data
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class HoldingBase(BaseModel):
    asset: str
    asset_type: str
    symbol: str
    quantity: float
    avg_price: float


class HoldingCreate(HoldingBase):
    pass


class HoldingResponse(HoldingBase):
    id: int
    current_price: float
    total_value: float
    profit_loss: float
    profit_percent: float
    
    class Config:
        from_attributes = True


class AllocationResponse(BaseModel):
    crypto: float
    stocks: float
    forex: float
    commodities: float
    cash: float


class PortfolioResponse(BaseModel):
    id: int
    total_value: float
    allocation: AllocationResponse
    holdings: List[HoldingResponse]
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PerformanceDataPoint(BaseModel):
    date: str
    value: float


class PerformanceResponse(BaseModel):
    period: str
    data: List[PerformanceDataPoint]
    total_return: float
    percent_change: float
