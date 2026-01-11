"""
Portfolio Model - User holdings and allocations
"""
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Total portfolio value (calculated)
    total_value = Column(Float, default=0.0)
    
    # Allocation percentages
    allocation = Column(JSON, default={
        "crypto": 0,
        "stocks": 0,
        "forex": 0,
        "commodities": 0,
        "cash": 100
    })
    
    # Relationship
    user = relationship("User", back_populates="portfolio")
    holdings = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Holding(Base):
    __tablename__ = "holdings"
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), nullable=False)
    
    asset = Column(String(50), nullable=False)  # e.g., "Bitcoin (BTC)"
    asset_type = Column(String(20), nullable=False)  # Crypto, Stock, Forex, Commodity
    symbol = Column(String(10), nullable=False)  # BTC, TSLA, EUR/USD
    quantity = Column(Float, nullable=False)
    avg_price = Column(Float, nullable=False)
    current_price = Column(Float, default=0.0)
    
    # Relationship
    portfolio = relationship("Portfolio", back_populates="holdings")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
