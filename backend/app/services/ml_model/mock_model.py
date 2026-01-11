"""
Mock ML Model Implementation

This provides simulated trading signals for development and testing.
Replace with the real model when ready.
"""

import random
from typing import Dict, Any, List

from app.services.ml_model.interface import (
    ModelInterface, 
    TradingSignal, 
    RiskAssessment,
    Signal
)


class MockModel(ModelInterface):
    """
    Mock implementation that returns random but realistic signals.
    
    Used for:
    - Development without the real model
    - Testing the API endpoints
    - Demo purposes
    """
    
    def __init__(self):
        self._is_real = False
        
        # Simulated market sentiment per asset
        self._sentiments = {
            "BTC": 0.6,   # Slightly bullish
            "ETH": 0.55,
            "TSLA": 0.45,
            "AAPL": 0.65,
            "GOOGL": 0.5,
            "EUR/USD": 0.48,
            "XAU": 0.52,
        }
    
    @property
    def is_real_model(self) -> bool:
        return self._is_real
    
    async def predict(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate mock prediction from market data"""
        # Simulate processing
        return {
            "prediction": random.uniform(-5, 5),
            "confidence": random.uniform(0.5, 0.95),
            "features_used": ["price_momentum", "volume", "rsi", "macd"],
            "model_version": "mock-1.0"
        }
    
    async def get_signal(self, asset: str) -> TradingSignal:
        """Generate a mock trading signal for an asset"""
        base_sentiment = self._sentiments.get(asset.upper(), 0.5)
        
        # Add some randomness
        adjusted = base_sentiment + random.uniform(-0.2, 0.2)
        adjusted = max(0, min(1, adjusted))  # Clamp to 0-1
        
        # Determine signal based on adjusted sentiment
        if adjusted > 0.7:
            signal = Signal.STRONG_BUY
            reasoning = f"Strong bullish momentum detected for {asset}"
        elif adjusted > 0.55:
            signal = Signal.BUY
            reasoning = f"Positive trend indicators for {asset}"
        elif adjusted > 0.45:
            signal = Signal.HOLD
            reasoning = f"Mixed signals, recommend holding {asset}"
        elif adjusted > 0.3:
            signal = Signal.SELL
            reasoning = f"Bearish indicators emerging for {asset}"
        else:
            signal = Signal.STRONG_SELL
            reasoning = f"Strong sell signal for {asset}"
        
        predicted_change = (adjusted - 0.5) * 10  # -5% to +5%
        
        return TradingSignal(
            asset=asset,
            signal=signal,
            confidence=round(abs(adjusted - 0.5) * 2, 2),  # 0-1 scale
            predicted_change=round(predicted_change, 2),
            reasoning=reasoning
        )
    
    async def get_risk_score(self, portfolio: Dict[str, Any]) -> RiskAssessment:
        """Generate a mock risk assessment"""
        # Simulate risk based on portfolio concentration
        holdings = portfolio.get("holdings", [])
        
        if not holdings:
            return RiskAssessment(
                risk_score=0,
                var_95=0,
                recommendations=["Add holdings to your portfolio"]
            )
        
        # Mock calculation
        concentration = 100 / max(len(holdings), 1)  # Higher if fewer holdings
        volatility_factor = random.uniform(0.8, 1.2)
        
        risk_score = min(100, concentration * volatility_factor)
        var_95 = risk_score * 0.025  # Rough VaR estimate
        
        recommendations = []
        if risk_score > 70:
            recommendations.append("Consider diversifying your portfolio")
        if risk_score > 50:
            recommendations.append("Review position sizes")
        if len(holdings) < 5:
            recommendations.append("Add more asset classes for diversification")
        
        return RiskAssessment(
            risk_score=round(risk_score, 1),
            var_95=round(var_95, 2),
            recommendations=recommendations
        )
    
    async def batch_predict(self, assets: List[str]) -> Dict[str, TradingSignal]:
        """Get signals for multiple assets"""
        signals = {}
        for asset in assets:
            signals[asset] = await self.get_signal(asset)
        return signals
