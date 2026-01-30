"""
Training Pipeline for Wekeza CNN Trading Model
Handles data collection, preprocessing, training, and evaluation
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from typing import List, Tuple, Optional, Dict
from datetime import datetime, timedelta
import json

from model import TradingCNN, create_model

# Training configuration
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_SAVE_PATH = 'models'
HISTORY_PATH = 'training_history'


class DataCollector:
    """Collect and preprocess historical data for training"""
    
    def __init__(self, api_key: str, secret_key: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = 'https://data.alpaca.markets'
        
    def fetch_bars(
        self, 
        symbol: str, 
        timeframe: str = '1Min',
        start: datetime = None,
        end: datetime = None,
        limit: int = 10000
    ) -> List[Dict]:
        """Fetch historical bars from Alpaca"""
        import requests
        
        if start is None:
            start = datetime.now() - timedelta(days=30)
        if end is None:
            end = datetime.now()
            
        url = f"{self.base_url}/v2/stocks/{symbol}/bars"
        params = {
            'timeframe': timeframe,
            'start': start.isoformat() + 'Z',
            'end': end.isoformat() + 'Z',
            'limit': limit,
        }
        headers = {
            'APCA-API-KEY-ID': self.api_key,
            'APCA-API-SECRET-KEY': self.secret_key,
        }
        
        bars = []
        next_page_token = None
        
        while True:
            if next_page_token:
                params['page_token'] = next_page_token
                
            response = requests.get(url, params=params, headers=headers)
            
            if response.status_code != 200:
                print(f"Error fetching bars: {response.text}")
                break
                
            data = response.json()
            bars.extend(data.get('bars', []))
            
            next_page_token = data.get('next_page_token')
            if not next_page_token:
                break
                
        return bars
    
    def bars_to_array(self, bars: List[Dict]) -> np.ndarray:
        """Convert bars to numpy array [timestamp, O, H, L, C, V]"""
        data = []
        for bar in bars:
            data.append([
                bar['o'],  # Open
                bar['h'],  # High
                bar['l'],  # Low
                bar['c'],  # Close
                bar['v'],  # Volume
            ])
        return np.array(data, dtype=np.float32)


class Trainer:
    """Training pipeline for CNN model"""
    
    def __init__(
        self,
        model: nn.Module,
        learning_rate: float = 0.001,
        weight_decay: float = 1e-5
    ):
        self.model = model.to(DEVICE)
        self.optimizer = optim.Adam(
            model.parameters(), 
            lr=learning_rate, 
            weight_decay=weight_decay
        )
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, 'min', patience=5, factor=0.5
        )
        self.criterion = nn.CrossEntropyLoss()
        self.history = {'train_loss': [], 'val_loss': [], 'val_accuracy': []}
        
    def create_windows(
        self, 
        data: np.ndarray, 
        window_size: int = 60,
        horizon: int = 5,
        threshold: float = 0.005
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Create sliding windows with labels"""
        
        # Normalize data
        price_min = data[:, :4].min()
        price_max = data[:, :4].max()
        vol_min = data[:, 4].min()
        vol_max = data[:, 4].max()
        
        normalized = data.copy()
        normalized[:, :4] = (data[:, :4] - price_min) / (price_max - price_min + 1e-8)
        normalized[:, 4] = (data[:, 4] - vol_min) / (vol_max - vol_min + 1e-8)
        
        windows = []
        labels = []
        
        for i in range(len(normalized) - window_size - horizon):
            window = normalized[i:i + window_size]
            windows.append(window)
            
            # Calculate label based on price change
            current_close = data[i + window_size - 1, 3]
            future_close = data[i + window_size + horizon - 1, 3]
            change = (future_close - current_close) / current_close
            
            if change < -threshold:
                labels.append(0)  # Down
            elif change > threshold:
                labels.append(2)  # Up
            else:
                labels.append(1)  # Neutral
                
        return np.array(windows, dtype=np.float32), np.array(labels, dtype=np.int64)
    
    def prepare_dataloaders(
        self,
        X: np.ndarray,
        y: np.ndarray,
        train_ratio: float = 0.8,
        batch_size: int = 32
    ) -> Tuple[DataLoader, DataLoader]:
        """Split data and create dataloaders"""
        
        # Time-series split (no shuffle to preserve temporal order)
        split_idx = int(len(X) * train_ratio)
        
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_train, y_val = y[:split_idx], y[split_idx:]
        
        # Balance classes in training set
        class_counts = np.bincount(y_train)
        min_count = class_counts.min()
        
        balanced_indices = []
        for cls in range(3):
            cls_indices = np.where(y_train == cls)[0]
            sampled = np.random.choice(cls_indices, min_count, replace=False)
            balanced_indices.extend(sampled)
            
        balanced_indices = np.array(balanced_indices)
        np.random.shuffle(balanced_indices)
        
        X_train_balanced = X_train[balanced_indices]
        y_train_balanced = y_train[balanced_indices]
        
        # Create tensors
        train_dataset = TensorDataset(
            torch.from_numpy(X_train_balanced),
            torch.from_numpy(y_train_balanced)
        )
        val_dataset = TensorDataset(
            torch.from_numpy(X_val),
            torch.from_numpy(y_val)
        )
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
        
        return train_loader, val_loader
    
    def train_epoch(self, train_loader: DataLoader) -> float:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0
        
        for X_batch, y_batch in train_loader:
            X_batch = X_batch.to(DEVICE)
            y_batch = y_batch.to(DEVICE)
            
            self.optimizer.zero_grad()
            outputs = self.model(X_batch)
            loss = self.criterion(outputs, y_batch)
            loss.backward()
            
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
            
            self.optimizer.step()
            total_loss += loss.item()
            
        return total_loss / len(train_loader)
    
    def validate(self, val_loader: DataLoader) -> Tuple[float, float]:
        """Validate model"""
        self.model.eval()
        total_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch = X_batch.to(DEVICE)
                y_batch = y_batch.to(DEVICE)
                
                outputs = self.model(X_batch)
                loss = self.criterion(outputs, y_batch)
                total_loss += loss.item()
                
                _, predicted = torch.max(outputs, 1)
                total += y_batch.size(0)
                correct += (predicted == y_batch).sum().item()
                
        avg_loss = total_loss / len(val_loader)
        accuracy = correct / total
        
        return avg_loss, accuracy
    
    def train(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 100,
        early_stopping_patience: int = 10
    ) -> Dict:
        """Full training loop"""
        
        best_val_loss = float('inf')
        patience_counter = 0
        best_model_state = None
        
        for epoch in range(epochs):
            train_loss = self.train_epoch(train_loader)
            val_loss, val_acc = self.validate(val_loader)
            
            self.scheduler.step(val_loss)
            
            self.history['train_loss'].append(train_loss)
            self.history['val_loss'].append(val_loss)
            self.history['val_accuracy'].append(val_acc)
            
            print(f"Epoch {epoch+1}/{epochs} - "
                  f"Train Loss: {train_loss:.4f}, "
                  f"Val Loss: {val_loss:.4f}, "
                  f"Val Acc: {val_acc:.4f}")
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                best_model_state = self.model.state_dict().copy()
            else:
                patience_counter += 1
                
            if patience_counter >= early_stopping_patience:
                print(f"Early stopping at epoch {epoch+1}")
                break
                
        # Load best model
        if best_model_state:
            self.model.load_state_dict(best_model_state)
            
        return self.history
    
    def save_model(self, symbol: str):
        """Save model and training history"""
        os.makedirs(MODEL_SAVE_PATH, exist_ok=True)
        os.makedirs(HISTORY_PATH, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Save PyTorch model
        model_path = os.path.join(MODEL_SAVE_PATH, f'{symbol}_{timestamp}.pt')
        torch.save(self.model.state_dict(), model_path)
        
        # Save weights as JSON for JavaScript
        weights_path = os.path.join(MODEL_SAVE_PATH, f'{symbol}_weights.json')
        with open(weights_path, 'w') as f:
            json.dump(self.model.get_weights_dict(), f)
            
        # Save history
        history_path = os.path.join(HISTORY_PATH, f'{symbol}_{timestamp}.json')
        with open(history_path, 'w') as f:
            json.dump(self.history, f)
            
        print(f"Model saved to {model_path}")
        return model_path


def train_model(
    symbol: str,
    api_key: str,
    secret_key: str,
    epochs: int = 50,
    window_size: int = 60
) -> Tuple[TradingCNN, Dict]:
    """Main training function"""
    
    print(f"Training model for {symbol}...")
    
    # Collect data
    collector = DataCollector(api_key, secret_key)
    bars = collector.fetch_bars(
        symbol, 
        timeframe='1Min',
        start=datetime.now() - timedelta(days=30)
    )
    
    if len(bars) < window_size + 100:
        raise ValueError(f"Insufficient data: {len(bars)} bars (need {window_size + 100}+)")
        
    print(f"Collected {len(bars)} bars")
    
    # Prepare data
    data = collector.bars_to_array(bars)
    
    # Create model and trainer
    model = create_model('cnn', window_size=window_size)
    trainer = Trainer(model)
    
    # Create windows and dataloaders
    X, y = trainer.create_windows(data, window_size=window_size)
    print(f"Created {len(X)} training samples")
    print(f"Class distribution: {np.bincount(y)}")
    
    train_loader, val_loader = trainer.prepare_dataloaders(X, y)
    
    # Train
    history = trainer.train(train_loader, val_loader, epochs=epochs)
    
    # Save
    trainer.save_model(symbol)
    
    return model, history


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    api_key = os.getenv('ALPACA_API_KEY')
    secret_key = os.getenv('ALPACA_SECRET_KEY')
    
    if api_key and secret_key:
        model, history = train_model('SPY', api_key, secret_key, epochs=20)
        print(f"Final accuracy: {history['val_accuracy'][-1]:.4f}")
    else:
        print("Set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables")
