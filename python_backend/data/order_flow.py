"""
Order Flow Analysis Module
Implements Delta calculations, absorption, exhaustion, and imbalance detection
Based on the Delta X Price Cheat Sheet methodology
"""

import numpy as np
import pandas as pd
from typing import Tuple, List, Dict, Optional
from dataclasses import dataclass
from enum import Enum


class SignalType(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class PatternType(Enum):
    ABSORPTION = "absorption"
    EXHAUSTION = "exhaustion"
    CONTINUATION = "continuation"
    IMBALANCE = "imbalance"


@dataclass
class OrderFlowSignal:
    """Represents an order flow signal"""
    signal_type: SignalType
    pattern: PatternType
    confidence: float
    delta: float
    cumulative_delta: float
    description: str
    timestamp: int


def calculate_trade_direction(price: np.ndarray, bid: np.ndarray, ask: np.ndarray) -> np.ndarray:
    """
    Vectorized Lee-Ready Algorithm: Infer trade direction from price relative to bid-ask
    
    Returns:
        Array with +1 for buyer-initiated, -1 for seller-initiated, 0 for neutral
    """
    mid = (bid + ask) / 2
    direction = np.zeros_like(price, dtype=int)
    direction[price > mid] = 1
    direction[price < mid] = -1
    return direction


def calculate_delta(trades: pd.DataFrame) -> pd.Series:
    """
    Vectorized Delta calculation
    """
    if trades.empty:
        return pd.Series([0])
    
    # Vectorized direction calculation
    direction = calculate_trade_direction(
        trades['price'].values, 
        trades['bid'].values, 
        trades['ask'].values
    )
    signed_volume = trades['volume'].values * direction
    
    if 'bar_time' in trades.columns:
        return pd.Series(signed_volume, index=trades.index).groupby(trades['bar_time']).sum()
    return pd.Series(signed_volume, index=trades.index)


def calculate_cumulative_delta(bars: pd.DataFrame) -> pd.Series:
    """
    Calculate Cumulative Delta (running sum of delta)
    
    Args:
        bars: DataFrame with OHLCV data and delta column
        
    Returns:
        Series of cumulative delta values
    """
    if 'delta' not in bars.columns:
        # Estimate delta from candle structure
        # If close > open, assume positive delta proportional to body
        bars = bars.copy()
        body = bars['close'] - bars['open']
        range_size = bars['high'] - bars['low']
        bars['delta'] = (body / range_size.replace(0, 1)) * bars['volume']
    
    return bars['delta'].cumsum()


def estimate_delta_from_ohlcv(bars: pd.DataFrame) -> pd.DataFrame:
    """
    Estimate delta when we don't have tick data
    Uses candle structure to infer buying/selling pressure
    
    Args:
        bars: DataFrame with OHLCV columns
    
    Returns:
        DataFrame with estimated delta metrics
    """
    bars = bars.copy()
    
    # Calculate candle body and wicks
    bars['body'] = bars['close'] - bars['open']
    bars['upper_wick'] = bars['high'] - bars[['open', 'close']].max(axis=1)
    bars['lower_wick'] = bars[['open', 'close']].min(axis=1) - bars['low']
    bars['range'] = bars['high'] - bars['low']
    
    # Estimate delta based on candle structure
    # Strong closes indicate delta direction
    bars['body_ratio'] = bars['body'] / bars['range'].replace(0, 1)
    bars['estimated_delta'] = bars['body_ratio'] * bars['volume']
    
    # Calculate cumulative delta
    bars['cumulative_delta'] = bars['estimated_delta'].cumsum()
    
    # Classify delta strength
    delta_std = bars['estimated_delta'].std()
    bars['delta_strength'] = pd.cut(
        bars['estimated_delta'].abs(),
        bins=[0, delta_std * 0.5, delta_std * 1.5, float('inf')],
        labels=['weak', 'moderate', 'strong']
    )
    
    return bars


def analyze_effort_vs_result(
    delta: float, 
    candle_type: str, 
    delta_strength: str = 'moderate'
) -> OrderFlowSignal:
    """
    Implement the Delta X Price Cheat Sheet logic
    Analyzes the relationship between Delta (effort) and Price (result)
    
    Args:
        delta: The delta value (positive = buying, negative = selling)
        candle_type: 'bullish' or 'bearish' based on close vs open
        delta_strength: 'weak', 'moderate', or 'strong'
    
    Returns:
        OrderFlowSignal with interpretation
    """
    is_bullish_delta = delta > 0
    is_bearish_delta = delta < 0
    is_bullish_candle = candle_type == 'bullish'
    is_bearish_candle = candle_type == 'bearish'
    
    # ABSORPTION PATTERNS (Effort not matching result)
    # Strong selling (bearish delta) but bullish candle = Buyers absorbing sellers
    if is_bearish_delta and is_bullish_candle and delta_strength == 'strong':
        return OrderFlowSignal(
            signal_type=SignalType.BULLISH,
            pattern=PatternType.ABSORPTION,
            confidence=0.85,
            delta=delta,
            cumulative_delta=0,  # Will be set by caller
            description="BULLISH: Strong seller absorption - buyers absorbing all sell orders",
            timestamp=0
        )
    
    # Strong buying (bullish delta) but bearish candle = Sellers absorbing buyers
    if is_bullish_delta and is_bearish_candle and delta_strength == 'strong':
        return OrderFlowSignal(
            signal_type=SignalType.BEARISH,
            pattern=PatternType.ABSORPTION,
            confidence=0.85,
            delta=delta,
            cumulative_delta=0,
            description="BEARISH: Strong buyer absorption - sellers absorbing all buy orders",
            timestamp=0
        )
    
    # CONTINUATION PATTERNS (Effort matching result)
    # Bullish delta + bullish candle = Healthy uptrend
    if is_bullish_delta and is_bullish_candle:
        return OrderFlowSignal(
            signal_type=SignalType.BULLISH,
            pattern=PatternType.CONTINUATION,
            confidence=0.65,
            delta=delta,
            cumulative_delta=0,
            description="BULLISH CONTINUATION: Buying pressure confirmed by price",
            timestamp=0
        )
    
    # Bearish delta + bearish candle = Healthy downtrend
    if is_bearish_delta and is_bearish_candle:
        return OrderFlowSignal(
            signal_type=SignalType.BEARISH,
            pattern=PatternType.CONTINUATION,
            confidence=0.65,
            delta=delta,
            cumulative_delta=0,
            description="BEARISH CONTINUATION: Selling pressure confirmed by price",
            timestamp=0
        )
    
    # WEAK/NEUTRAL signals
    return OrderFlowSignal(
        signal_type=SignalType.NEUTRAL,
        pattern=PatternType.CONTINUATION,
        confidence=0.3,
        delta=delta,
        cumulative_delta=0,
        description="NEUTRAL: Weak or mixed signals",
        timestamp=0
    )


def detect_delta_exhaustion(
    cumulative_delta: pd.Series, 
    price: pd.Series,
    lookback: int = 10
) -> Optional[OrderFlowSignal]:
    """
    Detect Delta Exhaustion (divergence between delta and price)
    
    Bearish Exhaustion: Price making higher highs but delta declining
    Bullish Exhaustion: Price making lower lows but delta rising
    
    Args:
        cumulative_delta: Series of cumulative delta values
        price: Series of close prices
        lookback: Number of bars to analyze
    
    Returns:
        OrderFlowSignal if exhaustion detected, None otherwise
    """
    if len(cumulative_delta) < lookback:
        return None
    
    recent_delta = cumulative_delta.tail(lookback)
    recent_price = price.tail(lookback)
    
    # Calculate trends
    delta_trend = recent_delta.iloc[-1] - recent_delta.iloc[0]
    price_trend = recent_price.iloc[-1] - recent_price.iloc[0]
    
    # Bearish exhaustion: price up, delta down
    if price_trend > 0 and delta_trend < 0:
        divergence_strength = abs(delta_trend) / (abs(price_trend) + 1e-10)
        if divergence_strength > 0.5:
            return OrderFlowSignal(
                signal_type=SignalType.BEARISH,
                pattern=PatternType.EXHAUSTION,
                confidence=min(0.9, 0.5 + divergence_strength * 0.4),
                delta=recent_delta.iloc[-1],
                cumulative_delta=cumulative_delta.iloc[-1],
                description="BEARISH EXHAUSTION: Price rising but buying pressure fading",
                timestamp=0
            )
    
    # Bullish exhaustion: price down, delta up
    if price_trend < 0 and delta_trend > 0:
        divergence_strength = abs(delta_trend) / (abs(price_trend) + 1e-10)
        if divergence_strength > 0.5:
            return OrderFlowSignal(
                signal_type=SignalType.BULLISH,
                pattern=PatternType.EXHAUSTION,
                confidence=min(0.9, 0.5 + divergence_strength * 0.4),
                delta=recent_delta.iloc[-1],
                cumulative_delta=cumulative_delta.iloc[-1],
                description="BULLISH EXHAUSTION: Price falling but selling pressure fading",
                timestamp=0
            )
    
    return None


def detect_stacked_imbalances(
    bid_volume: np.ndarray,
    ask_volume: np.ndarray,
    price_levels: np.ndarray,
    threshold: float = 3.0,
    min_stack: int = 3
) -> List[Dict]:
    """
    Detect Stacked Imbalances (3+ consecutive imbalances at price levels)
    
    An imbalance occurs when bid volume significantly exceeds ask volume
    (or vice versa) at a price level
    
    Args:
        bid_volume: Array of bid volumes at each price level
        ask_volume: Array of ask volumes at each price level
        price_levels: Array of price levels
        threshold: Minimum ratio for imbalance (e.g., 3.0 = 300%)
        min_stack: Minimum consecutive imbalances to trigger signal
    
    Returns:
        List of imbalance signals with price levels and direction
    """
    imbalances = []
    
    # Calculate imbalance ratio at each level
    ratios = bid_volume / (ask_volume + 1e-10)
    
    # Find buy imbalances (bid >> ask)
    buy_imbalance_mask = ratios >= threshold
    
    # Find sell imbalances (ask >> bid)
    sell_imbalance_mask = (1 / ratios) >= threshold
    
    # Find stacked buy imbalances
    buy_stacks = find_consecutive_true(buy_imbalance_mask, min_stack)
    for start, end in buy_stacks:
        imbalances.append({
            'type': 'buy_imbalance',
            'start_price': price_levels[start],
            'end_price': price_levels[end],
            'levels': end - start + 1,
            'signal': SignalType.BULLISH,
            'description': f'Stacked BUY imbalances: {end - start + 1} levels'
        })
    
    # Find stacked sell imbalances
    sell_stacks = find_consecutive_true(sell_imbalance_mask, min_stack)
    for start, end in sell_stacks:
        imbalances.append({
            'type': 'sell_imbalance',
            'start_price': price_levels[start],
            'end_price': price_levels[end],
            'levels': end - start + 1,
            'signal': SignalType.BEARISH,
            'description': f'Stacked SELL imbalances: {end - start + 1} levels'
        })
    
    return imbalances


def find_consecutive_true(mask: np.ndarray, min_count: int) -> List[Tuple[int, int]]:
    """Find runs of consecutive True values of at least min_count length"""
    runs = []
    start = None
    count = 0
    
    for i, val in enumerate(mask):
        if val:
            if start is None:
                start = i
            count += 1
        else:
            if count >= min_count:
                runs.append((start, i - 1))
            start = None
            count = 0
    
    # Check final run
    if count >= min_count:
        runs.append((start, len(mask) - 1))
    
    return runs


def create_footprint_tensor(
    trades: pd.DataFrame,
    price_bins: int = 50,
    time_bins: int = 60
) -> np.ndarray:
    """
    Vectorized Footprint Tensor creation for CNN analysis
    """
    if trades.empty:
        return np.zeros((time_bins, price_bins, 6))
    
    # Prices and Timestamps
    p_vals = trades['price'].values
    t_vals = trades['timestamp'].values
    v_vals = trades['volume'].values
    
    p_min, p_max = p_vals.min(), p_vals.max()
    t_min, t_max = t_vals.min(), t_vals.max()
    
    p_range = max(1e-8, p_max - p_min)
    t_range = max(1e-8, t_max - t_min)
    
    # Map to bins
    p_indices = ((p_vals - p_min) / p_range * (price_bins - 1)).astype(int).clip(0, price_bins - 1)
    t_indices = ((t_vals - t_min) / t_range * (time_bins - 1)).astype(int).clip(0, time_bins - 1)
    
    # Direction
    direction = calculate_trade_direction(p_vals, trades.get('bid', p_vals).values, trades.get('ask', p_vals).values)
    
    tensor = np.zeros((time_bins, price_bins, 6))
    
    # Vectorized accumulation using np.add.at for efficiency
    np.add.at(tensor, (t_indices, p_indices, 0), v_vals)  # Total volume
    
    buy_mask = direction > 0
    sell_mask = direction < 0
    np.add.at(tensor, (t_indices[buy_mask], p_indices[buy_mask], 1), v_vals[buy_mask])  # Buy volume
    np.add.at(tensor, (t_indices[sell_mask], p_indices[sell_mask], 2), v_vals[sell_mask])  # Sell volume
    np.add.at(tensor, (t_indices, p_indices, 3), 1)  # Trade count
    
    # Depth (using last seen for the bin)
    if 'bid_size' in trades.columns:
        tensor[t_indices, p_indices, 4] = trades['bid_size'].values
    if 'ask_size' in trades.columns:
        tensor[t_indices, p_indices, 5] = trades['ask_size'].values
    
    return tensor


def analyze_orderflow(bars: pd.DataFrame) -> Dict:
    """
    Main function to analyze order flow from OHLCV data
    
    Args:
        bars: DataFrame with OHLCV columns
    
    Returns:
        Dictionary with complete order flow analysis
    """
    # Estimate delta from OHLCV
    bars = estimate_delta_from_ohlcv(bars)
    
    # Get latest bar info
    latest = bars.iloc[-1]
    candle_type = 'bullish' if latest['close'] > latest['open'] else 'bearish'
    delta_strength = str(latest['delta_strength']) if pd.notna(latest['delta_strength']) else 'moderate'
    
    # Analyze effort vs result
    signal = analyze_effort_vs_result(
        delta=latest['estimated_delta'],
        candle_type=candle_type,
        delta_strength=delta_strength
    )
    signal.cumulative_delta = latest['cumulative_delta']
    
    # Check for exhaustion
    exhaustion = detect_delta_exhaustion(
        bars['cumulative_delta'],
        bars['close'],
        lookback=10
    )
    
    return {
        'current_delta': latest['estimated_delta'],
        'cumulative_delta': latest['cumulative_delta'],
        'delta_strength': delta_strength,
        'candle_type': candle_type,
        'signal': {
            'type': signal.signal_type.value,
            'pattern': signal.pattern.value,
            'confidence': signal.confidence,
            'description': signal.description
        },
        'exhaustion': {
            'detected': exhaustion is not None,
            'type': exhaustion.signal_type.value if exhaustion else None,
            'confidence': exhaustion.confidence if exhaustion else 0,
            'description': exhaustion.description if exhaustion else None
        },
        'delta_history': bars['estimated_delta'].tolist()[-20:],
        'cumulative_delta_history': bars['cumulative_delta'].tolist()[-20:]
    }


if __name__ == "__main__":
    # Test with sample data
    import yfinance as yf
    
    # Fetch sample data
    spy = yf.download('SPY', period='5d', interval='1m')
    spy = spy.reset_index()
    spy.columns = ['timestamp', 'open', 'high', 'low', 'close', 'adj_close', 'volume']
    
    # Analyze
    result = analyze_orderflow(spy)
    
    print("Order Flow Analysis Results:")
    print(f"  Current Delta: {result['current_delta']:.2f}")
    print(f"  Cumulative Delta: {result['cumulative_delta']:.2f}")
    print(f"  Signal: {result['signal']['type']} ({result['signal']['pattern']})")
    print(f"  Confidence: {result['signal']['confidence']:.2%}")
    print(f"  Description: {result['signal']['description']}")
    if result['exhaustion']['detected']:
        print(f"  EXHAUSTION DETECTED: {result['exhaustion']['description']}")
