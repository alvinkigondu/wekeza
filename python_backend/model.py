"""
Wekeza CNN Trading Model
PyTorch implementation for price direction prediction
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Optional
import numpy as np


class TradingCNN(nn.Module):
    """
    1D Convolutional Neural Network for trading signal prediction.
    
    Architecture:
    - Input: (batch, window_size, features) = (batch, 60, 5)
    - Conv1D blocks with batch normalization
    - Global average pooling
    - Fully connected layers with dropout
    - Output: 3-class softmax (down, neutral, up)
    """
    
    def __init__(
        self, 
        window_size: int = 60,
        n_features: int = 5,
        n_classes: int = 3,
        dropout: float = 0.3
    ):
        super(TradingCNN, self).__init__()
        
        self.window_size = window_size
        self.n_features = n_features
        
        # Convolutional layers
        self.conv1 = nn.Conv1d(n_features, 32, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(32)
        
        self.conv2 = nn.Conv1d(32, 64, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(64)
        
        self.conv3 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(128)
        
        self.conv4 = nn.Conv1d(128, 256, kernel_size=3, padding=1)
        self.bn4 = nn.BatchNorm1d(256)
        
        # Pooling
        self.pool = nn.MaxPool1d(2)
        self.global_pool = nn.AdaptiveAvgPool1d(1)
        
        # Fully connected layers
        self.fc1 = nn.Linear(256, 128)
        self.fc2 = nn.Linear(128, 64)
        self.fc3 = nn.Linear(64, n_classes)
        
        # Dropout
        self.dropout = nn.Dropout(dropout)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass
        
        Args:
            x: Input tensor of shape (batch, window_size, features)
            
        Returns:
            Output tensor of shape (batch, n_classes)
        """
        # Transpose to (batch, features, window_size) for Conv1d
        x = x.transpose(1, 2)
        
        # Conv blocks
        x = self.pool(F.relu(self.bn1(self.conv1(x))))
        x = self.pool(F.relu(self.bn2(self.conv2(x))))
        x = self.pool(F.relu(self.bn3(self.conv3(x))))
        x = F.relu(self.bn4(self.conv4(x)))
        
        # Global pooling
        x = self.global_pool(x)
        x = x.view(x.size(0), -1)
        
        # Fully connected
        x = self.dropout(F.relu(self.fc1(x)))
        x = self.dropout(F.relu(self.fc2(x)))
        x = self.fc3(x)
        
        return F.softmax(x, dim=1)
    
    def predict(self, x: torch.Tensor) -> Tuple[int, float, np.ndarray]:
        """
        Make prediction with confidence score
        
        Args:
            x: Input tensor of shape (1, window_size, features)
            
        Returns:
            Tuple of (predicted_class, confidence, probabilities)
        """
        self.eval()
        with torch.no_grad():
            probs = self.forward(x)
            confidence, predicted = torch.max(probs, 1)
            return (
                predicted.item(),
                confidence.item(),
                probs.cpu().numpy().flatten()
            )
    
    def get_weights_dict(self) -> dict:
        """Export weights as dictionary for JavaScript inference"""
        weights = {}
        for name, param in self.named_parameters():
            weights[name] = param.cpu().detach().numpy().tolist()
        return weights
    
    def load_weights_dict(self, weights: dict):
        """Load weights from dictionary"""
        state_dict = {}
        for name, value in weights.items():
            state_dict[name] = torch.tensor(value)
        self.load_state_dict(state_dict)


class AttentionCNN(nn.Module):
    """
    CNN with self-attention for improved sequence modeling.
    Better for capturing long-range dependencies in price data.
    """
    
    def __init__(
        self,
        window_size: int = 60,
        n_features: int = 5,
        n_classes: int = 3,
        n_heads: int = 4,
        dropout: float = 0.3
    ):
        super(AttentionCNN, self).__init__()
        
        # Convolutional feature extraction
        self.conv1 = nn.Conv1d(n_features, 64, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        
        # Multi-head self-attention
        self.attention = nn.MultiheadAttention(
            embed_dim=128, 
            num_heads=n_heads, 
            dropout=dropout,
            batch_first=True
        )
        
        # Output layers
        self.fc1 = nn.Linear(128, 64)
        self.fc2 = nn.Linear(64, n_classes)
        self.dropout = nn.Dropout(dropout)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, features)
        x = x.transpose(1, 2)  # (batch, features, seq_len)
        
        # Convolutions
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        
        # Prepare for attention
        x = x.transpose(1, 2)  # (batch, seq_len, channels)
        
        # Self-attention
        attn_output, _ = self.attention(x, x, x)
        
        # Global average pooling
        x = attn_output.mean(dim=1)
        
        # Output
        x = self.dropout(F.relu(self.fc1(x)))
        x = self.fc2(x)
        
        return F.softmax(x, dim=1)


def create_model(model_type: str = 'cnn', **kwargs) -> nn.Module:
    """Factory function to create models"""
    if model_type == 'cnn':
        return TradingCNN(**kwargs)
    elif model_type == 'attention':
        return AttentionCNN(**kwargs)
    else:
        raise ValueError(f"Unknown model type: {model_type}")


if __name__ == "__main__":
    # Test model
    model = TradingCNN()
    print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Test forward pass
    x = torch.randn(32, 60, 5)  # batch of 32, 60 time steps, 5 features
    y = model(x)
    print(f"Input shape: {x.shape}")
    print(f"Output shape: {y.shape}")
    print(f"Output probabilities: {y[0].detach().numpy()}")
