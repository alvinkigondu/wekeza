"""
ML Model Abstraction Layer

This module provides a plug-and-play interface for ML models.
To integrate your friend's model later:
1. Create a new class implementing ModelInterface
2. Update get_model() to return the new implementation

Example:
    # In tensor_model.py
    class TensorModel(ModelInterface):
        def __init__(self):
            self.model = load_your_model()
        
        async def predict(self, market_data):
            return self.model.predict(market_data)
    
    # In __init__.py, change:
    # return MockModel()  to  return TensorModel()
"""

from app.services.ml_model.interface import ModelInterface
from app.services.ml_model.mock_model import MockModel
from app.core.config import settings


def get_model() -> ModelInterface:
    """
    Factory function to get the appropriate ML model.
    
    Change this when the real model is ready:
        from app.services.ml_model.tensor_model import TensorModel
        return TensorModel()
    """
    if settings.USE_REAL_MODEL:
        # When your friend's model is ready, uncomment:
        # from app.services.ml_model.tensor_model import TensorModel
        # return TensorModel()
        pass
    
    # Default: use mock model
    return MockModel()
