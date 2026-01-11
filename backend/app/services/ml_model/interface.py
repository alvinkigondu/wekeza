"""
ML Model Interface - Abstract base class for all model implementations

Your friend should implement this interface for their TensorFlow/PyTorch model.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class Signal(str, Enum):
    """Trading signal types"""
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    HOLD = "hold"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


@dataclass
class TradingSignal:
    """Structured trading signal response"""
    asset: str
    signal: Signal
    confidence: float  # 0.0 to 1.0
    predicted_change: float  # Expected % change
    reasoning: str  # Explanation for the signal


@dataclass
class RiskAssessment:
    """Risk assessment for a portfolio"""
    risk_score: float  # 0-100
    var_95: float  # Value at Risk (95% confidence)
    recommendations: List[str]


class ModelInterface(ABC):
    """
    Abstract interface for ML models.
    
    Implement this class to integrate your own model.
    
    Example implementation:
    
        class MyTensorModel(ModelInterface):
            def __init__(self):
                self.model = tf.keras.models.load_model('my_model.h5')
                self._is_real = True
            
            @property
            def is_real_model(self):
                return self._is_real
            
            async def predict(self, market_data):
                return self.model.predict(market_data)
            
            async def get_signal(self, asset):
                # Your prediction logic here
                ...
    """
    
    @property
    @abstractmethod
    def is_real_model(self) -> bool:
        """Returns True if this is a production model, False for mock"""
        pass
    
    @abstractmethod
    async def predict(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a raw prediction from market data.
        
        Args:
            market_data: Dictionary containing:
                - prices: List of historical prices
                - volumes: List of historical volumes
                - indicators: Dict of technical indicators
        
        Returns:
            Dictionary with prediction results
        """
        pass
    
    @abstractmethod
    async def get_signal(self, asset: str) -> TradingSignal:
        """
        Get a trading signal for a specific asset.
        
        Args:
            asset: Asset symbol (e.g., "BTC", "TSLA")
        
        Returns:
            TradingSignal with recommendation
        """
        pass
    
    @abstractmethod
    async def get_risk_score(self, portfolio: Dict[str, Any]) -> RiskAssessment:
        """
        Assess risk for a portfolio.
        
        Args:
            portfolio: Dictionary with holdings and allocations
        
        Returns:
            RiskAssessment with score and recommendations
        """
        pass
    
    @abstractmethod
    async def batch_predict(self, assets: List[str]) -> Dict[str, TradingSignal]:
        """
        Get signals for multiple assets at once.
        
        Args:
            assets: List of asset symbols
        
        Returns:
            Dictionary mapping asset to TradingSignal
        """
        pass
