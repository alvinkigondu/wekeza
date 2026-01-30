"""
Volume Profile Analysis Module
Calculates POC, Value Area, HVN/LVN for market structure analysis
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class MarketRegime(Enum):
    TRENDING_UP = "trending_up"
    TRENDING_DOWN = "trending_down"
    RANGING = "ranging"
    BREAKOUT = "breakout"


@dataclass
class VolumeProfileResult:
    """Contains volume profile analysis results"""
    poc: float  # Point of Control
    vah: float  # Value Area High
    val: float  # Value Area Low
    hvn: List[float]  # High Volume Nodes
    lvn: List[float]  # Low Volume Nodes
    profile: Dict[float, float]  # Price -> Volume mapping
    regime: MarketRegime
    current_position: str  # 'above_vah', 'in_value', 'below_val'


def build_volume_profile(
    bars: pd.DataFrame,
    bins: int = 100,
    value_area_pct: float = 0.70
) -> VolumeProfileResult:
    """
    Build a Volume Profile from OHLCV data
    
    Args:
        bars: DataFrame with OHLCV columns
        bins: Number of price bins
        value_area_pct: Percentage of volume for value area (default 70%)
    
    Returns:
        VolumeProfileResult with POC, VAH, VAL, and profile data
    """
    if bars.empty:
        return VolumeProfileResult(
            poc=0, vah=0, val=0, hvn=[], lvn=[],
            profile={}, regime=MarketRegime.RANGING,
            current_position='in_value'
        )
    
    # Get price range
    price_min = bars['low'].min()
    price_max = bars['high'].max()
    price_range = price_max - price_min
    
    if price_range == 0:
        price_range = price_min * 0.01  # Use 1% of price as minimum range
    
    # Create price bins
    bin_size = price_range / bins
    price_bins = np.linspace(price_min, price_max, bins + 1)
    
    # Vectorized volume distribution
    # Calculate start and end bins for all bars at once
    l_vals = bars['low'].values
    h_vals = bars['high'].values
    v_vals = bars['volume'].values
    
    start_bins = np.clip(((l_vals - price_min) / bin_size).astype(int), 0, bins - 1)
    end_bins = np.clip(((h_vals - price_min) / bin_size).astype(int), 0, bins - 1)
    
    volume_profile = np.zeros(bins)
    
    # Use a vectorized loop for speed where possible, but still handle bin-ranges
    # For many bars, iterating over bars is slow. If price range is small, 
    # we can use a different approach, but most robust is to use np.add.at if ranges were single.
    # Since ranges can span multiple bins, we use a slightly more optimized loop or broadcasting.
    
    # Optimized loop using numpy slicing
    for s, e, v in zip(start_bins, end_bins, v_vals):
        bins_touched = e - s + 1
        volume_profile[s:e + 1] += v / bins_touched
    
    # Find POC (highest volume price level)
    poc_bin = np.argmax(volume_profile)
    poc = price_bins[poc_bin] + bin_size / 2
    
    # Calculate Value Area (70% of volume around POC)
    vah, val = calculate_value_area(
        volume_profile, price_bins, bin_size, value_area_pct
    )
    
    # Find High Volume Nodes and Low Volume Nodes
    hvn = find_hvn(volume_profile, price_bins, bin_size)
    lvn = find_lvn(volume_profile, price_bins, bin_size)
    
    # Create profile dictionary
    profile_dict = {
        price_bins[i] + bin_size / 2: volume_profile[i]
        for i in range(bins)
    }
    
    # Determine market regime
    regime = determine_regime(bars, poc, vah, val)
    
    # Determine current position relative to value area
    current_price = bars['close'].iloc[-1]
    if current_price > vah:
        current_position = 'above_vah'
    elif current_price < val:
        current_position = 'below_val'
    else:
        current_position = 'in_value'
    
    return VolumeProfileResult(
        poc=poc,
        vah=vah,
        val=val,
        hvn=hvn,
        lvn=lvn,
        profile=profile_dict,
        regime=regime,
        current_position=current_position
    )


def calculate_value_area(
    volume_profile: np.ndarray,
    price_bins: np.ndarray,
    bin_size: float,
    value_area_pct: float = 0.70
) -> Tuple[float, float]:
    """
    Calculate Value Area High and Low
    
    The value area contains 70% of the traded volume,
    expanding outward from the POC
    
    Args:
        volume_profile: Array of volumes per bin
        price_bins: Array of price levels
        bin_size: Size of each bin
        value_area_pct: Percentage for value area
    
    Returns:
        Tuple of (VAH, VAL)
    """
    total_volume = volume_profile.sum()
    target_volume = total_volume * value_area_pct
    
    # Start from POC
    poc_bin = np.argmax(volume_profile)
    
    # Expand outward from POC
    current_volume = volume_profile[poc_bin]
    low_bin = poc_bin
    high_bin = poc_bin
    
    while current_volume < target_volume:
        # Look at volume above and below
        vol_above = volume_profile[high_bin + 1] if high_bin + 1 < len(volume_profile) else 0
        vol_below = volume_profile[low_bin - 1] if low_bin - 1 >= 0 else 0
        
        # Expand in direction of higher volume
        if vol_above >= vol_below and high_bin + 1 < len(volume_profile):
            high_bin += 1
            current_volume += vol_above
        elif low_bin - 1 >= 0:
            low_bin -= 1
            current_volume += vol_below
        else:
            break
    
    val = price_bins[low_bin]
    vah = price_bins[high_bin] + bin_size
    
    return vah, val


def find_hvn(
    volume_profile: np.ndarray,
    price_bins: np.ndarray,
    bin_size: float,
    threshold: float = 1.5
) -> List[float]:
    """
    Find High Volume Nodes (HVN)
    
    HVN are price levels with volume significantly above average
    These act as support/resistance and attract price
    
    Args:
        volume_profile: Array of volumes per bin
        price_bins: Array of price levels
        bin_size: Size of each bin
        threshold: Multiple of average volume to consider HVN
    
    Returns:
        List of HVN price levels
    """
    avg_volume = volume_profile.mean()
    hvn_threshold = avg_volume * threshold
    
    hvn = []
    for i, vol in enumerate(volume_profile):
        if vol >= hvn_threshold:
            # Check if it's a local maximum
            is_local_max = True
            if i > 0 and volume_profile[i-1] >= vol:
                is_local_max = False
            if i < len(volume_profile) - 1 and volume_profile[i+1] >= vol:
                is_local_max = False
            
            if is_local_max or vol >= avg_volume * 2:
                hvn.append(price_bins[i] + bin_size / 2)
    
    return hvn


def find_lvn(
    volume_profile: np.ndarray,
    price_bins: np.ndarray,
    bin_size: float,
    threshold: float = 0.5
) -> List[float]:
    """
    Find Low Volume Nodes (LVN)
    
    LVN are price levels with volume significantly below average
    Price tends to move quickly through these levels
    
    Args:
        volume_profile: Array of volumes per bin
        price_bins: Array of price levels
        bin_size: Size of each bin
        threshold: Fraction of average volume to consider LVN
    
    Returns:
        List of LVN price levels
    """
    avg_volume = volume_profile.mean()
    lvn_threshold = avg_volume * threshold
    
    lvn = []
    for i, vol in enumerate(volume_profile):
        if vol <= lvn_threshold and vol > 0:
            # Check if it's a local minimum
            is_local_min = True
            if i > 0 and volume_profile[i-1] <= vol:
                is_local_min = False
            if i < len(volume_profile) - 1 and volume_profile[i+1] <= vol:
                is_local_min = False
            
            if is_local_min:
                lvn.append(price_bins[i] + bin_size / 2)
    
    return lvn


def determine_regime(
    bars: pd.DataFrame,
    poc: float,
    vah: float,
    val: float
) -> MarketRegime:
    """
    Determine the current market regime
    
    Args:
        bars: OHLCV data
        poc: Point of Control
        vah: Value Area High
        val: Value Area Low
    
    Returns:
        MarketRegime enum
    """
    if len(bars) < 20:
        return MarketRegime.RANGING
    
    # Calculate trend using recent closes
    recent_closes = bars['close'].tail(20)
    first_half = recent_closes.head(10).mean()
    second_half = recent_closes.tail(10).mean()
    
    trend_strength = (second_half - first_half) / first_half
    current_price = bars['close'].iloc[-1]
    
    # Check for breakout
    if current_price > vah * 1.005:  # 0.5% above VAH
        return MarketRegime.BREAKOUT
    elif current_price < val * 0.995:  # 0.5% below VAL
        return MarketRegime.BREAKOUT
    
    # Check for trending
    if trend_strength > 0.005:  # 0.5% up
        return MarketRegime.TRENDING_UP
    elif trend_strength < -0.005:  # 0.5% down
        return MarketRegime.TRENDING_DOWN
    
    return MarketRegime.RANGING


def analyze_break_and_retest(
    bars: pd.DataFrame,
    key_level: float,
    tolerance: float = 0.002
) -> Optional[Dict]:
    """
    Detect Break and Retest patterns
    
    1. Price breaks above/below a key level
    2. Price returns to retest the level
    3. Level acts as new support/resistance
    
    Args:
        bars: OHLCV data
        key_level: Price level to analyze
        tolerance: Percentage tolerance for level touch
    
    Returns:
        Dict with break and retest analysis, or None
    """
    if len(bars) < 10:
        return None
    
    recent = bars.tail(20)
    
    # Find where price was relative to level historically
    was_above = recent['close'].head(5).mean() > key_level
    
    # Check for break
    broke_level = False
    retest_found = False
    
    for i, (_, bar) in enumerate(recent.iterrows()):
        # Check for break
        if was_above and bar['close'] < key_level * (1 - tolerance):
            broke_level = True
            break_direction = 'down'
        elif not was_above and bar['close'] > key_level * (1 + tolerance):
            broke_level = True
            break_direction = 'up'
        
        # Check for retest after break
        if broke_level:
            price_at_level = abs(bar['close'] - key_level) / key_level < tolerance
            if price_at_level:
                retest_found = True
    
    if broke_level and retest_found:
        return {
            'pattern': 'break_and_retest',
            'level': key_level,
            'direction': break_direction,
            'signal': 'bullish' if break_direction == 'up' else 'bearish',
            'confidence': 0.75
        }
    
    return None


def get_volume_profile_analysis(bars: pd.DataFrame) -> Dict:
    """
    Complete volume profile analysis for API response
    
    Args:
        bars: OHLCV DataFrame
    
    Returns:
        Dictionary with full volume profile analysis
    """
    vp = build_volume_profile(bars)
    
    # Check for break and retest at POC
    poc_retest = analyze_break_and_retest(bars, vp.poc)
    
    return {
        'poc': vp.poc,
        'vah': vp.vah,
        'val': vp.val,
        'value_area_width': vp.vah - vp.val,
        'hvn': vp.hvn[:5],  # Top 5 HVN
        'lvn': vp.lvn[:5],  # Top 5 LVN
        'regime': vp.regime.value,
        'current_position': vp.current_position,
        'break_and_retest': poc_retest,
        'profile': {
            'prices': list(vp.profile.keys()),
            'volumes': list(vp.profile.values())
        }
    }


if __name__ == "__main__":
    # Test with sample data
    import yfinance as yf
    
    # Fetch sample data
    spy = yf.download('SPY', period='5d', interval='1h')
    spy = spy.reset_index()
    spy.columns = ['timestamp', 'open', 'high', 'low', 'close', 'adj_close', 'volume']
    
    # Analyze
    result = get_volume_profile_analysis(spy)
    
    print("Volume Profile Analysis Results:")
    print(f"  POC: ${result['poc']:.2f}")
    print(f"  Value Area: ${result['val']:.2f} - ${result['vah']:.2f}")
    print(f"  Value Area Width: ${result['value_area_width']:.2f}")
    print(f"  Market Regime: {result['regime']}")
    print(f"  Current Position: {result['current_position']}")
    print(f"  High Volume Nodes: {[f'${x:.2f}' for x in result['hvn']]}")
    print(f"  Low Volume Nodes: {[f'${x:.2f}' for x in result['lvn']]}")
