"""
Wekeza Multi-Agent Trading System API
FastAPI backend for model inference, agent coordination, and trading
"""

import os
import json
import torch
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

# Existing imports
from model import TradingCNN, create_model
from train import Trainer, DataCollector

# New multi-agent imports
from agents import get_trading_crew, TradingCrew
from agents.tape_reader import get_tape_reader
from agents.chartist import get_chartist
from agents.macro_economist import get_macro_economist
from agents.portfolio_manager import get_portfolio_manager
from data import (
    data_fetcher,
    analyze_orderflow,
    get_volume_profile_analysis,
    get_all_assets_data,
    ASSETS
)
from backtesting import BacktestEngine, print_backtest_results


# ========== Pydantic Models ==========

class PredictionRequest(BaseModel):
    symbol: str
    input: List[List[float]]


class PredictionResponse(BaseModel):
    symbol: str
    direction: str
    confidence: float
    probabilities: List[float]


class TrainingRequest(BaseModel):
    symbol: str
    inputs: List[List[List[float]]]
    labels: List[int]


class TrainingResponse(BaseModel):
    success: bool
    epochs: int
    final_accuracy: float
    message: str


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    agents_active: bool
    device: str
    timestamp: str


class AgentAnalysisRequest(BaseModel):
    symbol: str
    news: Optional[List[str]] = None


class AgentAnalysisResponse(BaseModel):
    symbol: str
    status: str
    decision: Dict[str, Any]
    agents: Dict[str, Any]
    summary: str
    analysis_time: float


class BacktestRequest(BaseModel):
    symbol: str
    days: int = 30
    interval: str = "1h"


class BacktestResponse(BaseModel):
    symbol: str
    total_return_pct: float
    sharpe_ratio: float
    max_drawdown_pct: float
    win_rate: float
    total_trades: int
    comparison: Dict[str, Any]


# ========== Global State ==========

models: dict[str, TradingCNN] = {}
trading_crew: Optional[TradingCrew] = None
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
MODEL_PATH = 'models'


def load_model(symbol: str) -> Optional[TradingCNN]:
    """Load a trained model for a symbol"""
    weights_path = os.path.join(MODEL_PATH, f'{symbol}_weights.json')
    
    if os.path.exists(weights_path):
        model = create_model('cnn')
        with open(weights_path, 'r') as f:
            weights = json.load(f)
        model.load_weights_dict(weights)
        model = model.to(DEVICE)
        model.eval()
        return model
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global trading_crew
    
    # Load existing models
    if os.path.exists(MODEL_PATH):
        for filename in os.listdir(MODEL_PATH):
            if filename.endswith('_weights.json'):
                symbol = filename.replace('_weights.json', '')
                model = load_model(symbol)
                if model:
                    models[symbol] = model
                    print(f"Loaded model for {symbol}")
    
    # Initialize trading crew
    groq_key = os.getenv('GROQ_API_KEY')
    if groq_key:
        trading_crew = get_trading_crew(groq_key)
        print("Trading crew initialized with Groq LLM")
    else:
        trading_crew = get_trading_crew()
        print("Trading crew initialized (limited mode - no LLM)")
    
    print(f"API started with {len(models)} models and 4 agents")
    yield
    
    # Cleanup
    models.clear()


# ========== Create FastAPI App ==========

app = FastAPI(
    title="Wekeza Multi-Agent Trading System API",
    description="AI-powered trading system with 4 collaborative agents for order flow analysis",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== Health & Status Endpoints ==========

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_loaded=len(models) > 0,
        agents_active=trading_crew is not None,
        device=str(DEVICE),
        timestamp=datetime.now().isoformat()
    )


@app.get("/agents/status")
async def get_agents_status():
    """Get status of all trading agents"""
    if not trading_crew:
        raise HTTPException(status_code=503, detail="Trading crew not initialized")
    
    return trading_crew.get_all_status()


# ========== CNN Model Endpoints (Existing) ==========

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Make a prediction using CNN model"""
    symbol = request.symbol
    
    if symbol not in models:
        models[symbol] = create_model('cnn').to(DEVICE)
        models[symbol].eval()
    
    model = models[symbol]
    
    try:
        input_tensor = torch.tensor([request.input], dtype=torch.float32).to(DEVICE)
        pred_class, confidence, probs = model.predict(input_tensor)
        
        directions = ['down', 'neutral', 'up']
        
        return PredictionResponse(
            symbol=symbol,
            direction=directions[pred_class],
            confidence=confidence,
            probabilities=probs.tolist()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train", response_model=TrainingResponse)
async def train_model(request: TrainingRequest):
    """Train a model with provided data"""
    symbol = request.symbol
    
    try:
        model = create_model('cnn')
        trainer = Trainer(model, learning_rate=0.001)
        
        X = np.array(request.inputs, dtype=np.float32)
        y = np.array(request.labels, dtype=np.int64)
        
        if len(X) < 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Need at least 100 samples, got {len(X)}"
            )
        
        train_loader, val_loader = trainer.prepare_dataloaders(X, y)
        history = trainer.train(train_loader, val_loader, epochs=30)
        trainer.save_model(symbol)
        
        models[symbol] = trainer.model
        
        return TrainingResponse(
            success=True,
            epochs=len(history['train_loss']),
            final_accuracy=history['val_accuracy'][-1],
            message=f"Model trained successfully for {symbol}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Multi-Agent Endpoints ==========

@app.post("/agents/analyze", response_model=AgentAnalysisResponse)
async def run_agent_analysis(request: AgentAnalysisRequest):
    """
    Run complete multi-agent analysis for a symbol
    
    This endpoint coordinates all 4 agents:
    - Tape Reader (order flow)
    - Chartist (volume profile)
    - Macro Economist (sentiment)
    - Portfolio Manager (final decision)
    """
    if not trading_crew:
        raise HTTPException(status_code=503, detail="Trading crew not initialized")
    
    try:
        result = trading_crew.analyze_symbol(request.symbol, request.news)
        
        return AgentAnalysisResponse(
            symbol=result['symbol'],
            status='success',
            decision=result['decision'],
            agents=result['agents'],
            summary=result['summary'],
            analysis_time=result['analysis_time_seconds']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agents/analyze/{symbol}")
async def quick_analysis(symbol: str):
    """Quick analysis endpoint (GET) for a symbol"""
    if not trading_crew:
        raise HTTPException(status_code=503, detail="Trading crew not initialized")
    
    try:
        result = trading_crew.analyze_symbol(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Order Flow Endpoints ==========

@app.get("/orderflow/{symbol}")
async def get_order_flow(symbol: str, interval: str = "5m"):
    """Get order flow analysis for a symbol"""
    try:
        # Fetch data
        bars = data_fetcher.fetch_bars(symbol, period="2d", interval=interval)
        
        if bars.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        # Analyze order flow
        analysis = analyze_orderflow(bars)
        analysis['symbol'] = symbol
        analysis['interval'] = interval
        
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Volume Profile Endpoints ==========

@app.get("/volumeprofile/{symbol}")
async def get_volume_profile(symbol: str, interval: str = "1h"):
    """Get volume profile analysis for a symbol"""
    try:
        bars = data_fetcher.fetch_bars(symbol, period="5d", interval=interval)
        
        if bars.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        analysis = get_volume_profile_analysis(bars)
        analysis['symbol'] = symbol
        analysis['interval'] = interval
        
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Market Data Endpoints ==========

@app.get("/assets")
async def get_available_assets():
    """Get list of all available assets"""
    return data_fetcher.get_available_assets()


@app.get("/price/{symbol}")
async def get_latest_price(symbol: str):
    """Get latest price for a symbol"""
    try:
        price = data_fetcher.get_latest_price(symbol)
        if not price:
            raise HTTPException(status_code=404, detail=f"No price for {symbol}")
        return price
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bars/{symbol}")
async def get_bars(symbol: str, period: str = "5d", interval: str = "1h"):
    """Get OHLCV bars for a symbol"""
    try:
        bars = data_fetcher.fetch_bars(symbol, period=period, interval=interval)
        if bars.empty:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        return {
            'symbol': symbol,
            'period': period,
            'interval': interval,
            'count': len(bars),
            'data': bars.to_dict('records')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/correlation")
async def get_correlation(symbols: str = "SPY,AAPL,MSFT,NVDA"):
    """Get correlation matrix for symbols"""
    try:
        symbol_list = [s.strip() for s in symbols.split(',')]
        corr = data_fetcher.get_correlation_matrix(symbol_list)
        
        return {
            'symbols': symbol_list,
            'matrix': corr.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Backtesting Endpoints ==========

@app.post("/backtest", response_model=BacktestResponse)
async def run_backtest(request: BacktestRequest):
    """Run backtest on historical data"""
    try:
        # Fetch data
        bars = data_fetcher.fetch_bars(
            request.symbol, 
            period=f"{request.days}d", 
            interval=request.interval
        )
        
        if bars.empty or len(bars) < 100:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data for {request.symbol}"
            )
        
        # Define strategy using order flow
        def strategy(window):
            try:
                analysis = analyze_orderflow(window)
                signal = analysis.get('signal', {})
                
                if signal.get('type') == 'bullish' and signal.get('confidence', 0) > 0.65:
                    return {
                        'action': 'BUY',
                        'stop_loss': window['close'].iloc[-1] * 0.98
                    }
                elif signal.get('type') == 'bearish' and signal.get('confidence', 0) > 0.65:
                    return {
                        'action': 'SELL',
                        'stop_loss': window['close'].iloc[-1] * 1.02
                    }
                return {'action': 'NO_TRADE'}
            except:
                return {'action': 'NO_TRADE'}
        
        # Run backtest
        engine = BacktestEngine(initial_capital=100000)
        result = engine.run_backtest(request.symbol, bars, strategy)
        comparison = engine.compare_with_buy_and_hold(bars, result)
        
        return BacktestResponse(
            symbol=request.symbol,
            total_return_pct=result.total_return_pct,
            sharpe_ratio=result.sharpe_ratio,
            max_drawdown_pct=result.max_drawdown_pct,
            win_rate=result.win_rate,
            total_trades=result.total_trades,
            comparison=comparison
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Paper Trading Endpoints ==========

@app.get("/portfolio")
async def get_portfolio():
    """Get current portfolio status"""
    if not trading_crew:
        raise HTTPException(status_code=503, detail="Trading crew not initialized")
    
    return trading_crew.get_portfolio_summary()


@app.post("/paper-trade/{symbol}")
async def execute_paper_trade(symbol: str, action: str, quantity: int = 100):
    """Execute a paper trade (demo)"""
    if action not in ['BUY', 'SELL']:
        raise HTTPException(status_code=400, detail="Action must be BUY or SELL")
    
    try:
        price = data_fetcher.get_latest_price(symbol)
        if not price:
            raise HTTPException(status_code=404, detail=f"No price for {symbol}")
        
        return {
            'status': 'executed',
            'symbol': symbol,
            'action': action,
            'quantity': quantity,
            'price': price['price'],
            'total_value': quantity * price['price'],
            'timestamp': datetime.now().isoformat(),
            'note': 'This is a paper trade (simulation only)'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== Model Weights Endpoints ==========

@app.get("/model/weights/{symbol}")
async def get_weights(symbol: str):
    """Get model weights for JavaScript inference"""
    if symbol not in models:
        model = load_model(symbol)
        if model:
            models[symbol] = model
        else:
            model = create_model('cnn')
            return model.get_weights_dict()
    
    return models[symbol].get_weights_dict()


@app.get("/model/weights")
async def get_default_weights():
    """Get default model weights"""
    if 'SPY' in models:
        return models['SPY'].get_weights_dict()
    elif models:
        return next(iter(models.values())).get_weights_dict()
    else:
        return create_model('cnn').get_weights_dict()


# ========== Full Analysis Endpoint (for Dashboard) ==========

@app.get("/dashboard/{symbol}")
async def get_dashboard_data(symbol: str):
    """
    Get complete dashboard data for a symbol (optimized)
    """
    if not trading_crew:
        raise HTTPException(status_code=503, detail="Trading crew not initialized")
    
    try:
        # Run the full multi-agent analysis (already parallelized)
        result = trading_crew.analyze_symbol(symbol)
        
        # Extract individual agent data for the dashboard
        agents = result.get('agents', {})
        tr_data = agents.get('tape_reader', {})
        ch_data = agents.get('chartist', {})
        
        return {
            'symbol': symbol,
            'timestamp': result.get('timestamp'),
            'price': ch_data.get('current_price'),
            'order_flow': tr_data,
            'volume_profile': ch_data,
            'agent_decision': result.get('decision'),
            'summary': result.get('summary'),
            'latency': result.get('analysis_time_seconds')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
