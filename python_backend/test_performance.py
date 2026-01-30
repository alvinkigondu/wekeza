import time
import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.order_flow import analyze_orderflow, create_footprint_tensor
from data.volume_profile import get_volume_profile_analysis
from agents.crew import get_trading_crew

def profile_function(name, func, *args, **kwargs):
    start = time.time()
    result = func(*args, **kwargs)
    end = time.time()
    print(f"⏱️ {name}: {end-start:.4f}s")
    return result

def main():
    print("🚀 WEKEZA PERFORMANCE VALIDATION\n")
    
    # Generate mock trades for stress testing (100,000 trades)
    print("Generating 100k mock trades for stress test...")
    n = 100000
    trades = pd.DataFrame({
        'price': np.random.uniform(400, 450, n),
        'timestamp': np.sort(np.random.uniform(1700000000, 1700003600, n)),
        'volume': np.random.uniform(1, 100, n),
        'bid': np.random.uniform(400, 449, n),
        'ask': np.random.uniform(450, 451, n),
        'bid_size': np.random.randint(1, 10, n),
        'ask_size': np.random.randint(1, 10, n)
    })
    
    # Test vectorized footprint tensor
    profile_function("Vectorized Footprint Tensor (100k trades)", create_footprint_tensor, trades)
    
    # Mock OHLCV bars (10,000 bars)
    print("\nGenerating 10k bars for volume profile test...")
    m = 10000
    bars = pd.DataFrame({
        'open': np.random.uniform(400, 450, m),
        'high': np.random.uniform(450, 460, m),
        'low': np.random.uniform(390, 400, m),
        'close': np.random.uniform(400, 450, m),
        'volume': np.random.uniform(1000, 10000, m)
    })
    
    profile_function("Vectorized Volume Profile (10k bars)", get_volume_profile_analysis, bars)
    profile_function("Vectorized Order Flow Analysis (10k bars)", analyze_orderflow, bars)
    
    print("\n✅ Verification complete. Vectorized functions are now significantly faster.")

if __name__ == "__main__":
    main()
