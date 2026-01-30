"""
Multi-Asset Data Fetcher
Supports stocks, FX, commodities, and crypto from various free sources
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import os


class AssetClass(Enum):
    STOCK = "stock"
    ETF = "etf"
    FOREX = "forex"
    CRYPTO = "crypto"
    COMMODITY = "commodity"


@dataclass
class AssetInfo:
    """Information about a tradeable asset"""
    symbol: str
    name: str
    asset_class: AssetClass
    yfinance_symbol: str  # Symbol for yfinance
    alpaca_symbol: Optional[str] = None  # Symbol for Alpaca
    ccxt_symbol: Optional[str] = None  # Symbol for CCXT (crypto)
    exchange: str = "US"


# Define supported assets
ASSETS = {
    # US Stocks
    "SPY": AssetInfo("SPY", "S&P 500 ETF", AssetClass.ETF, "SPY", "SPY"),
    "AAPL": AssetInfo("AAPL", "Apple Inc", AssetClass.STOCK, "AAPL", "AAPL"),
    "MSFT": AssetInfo("MSFT", "Microsoft", AssetClass.STOCK, "MSFT", "MSFT"),
    "NVDA": AssetInfo("NVDA", "NVIDIA", AssetClass.STOCK, "NVDA", "NVDA"),
    "TSLA": AssetInfo("TSLA", "Tesla", AssetClass.STOCK, "TSLA", "TSLA"),
    "AMD": AssetInfo("AMD", "AMD", AssetClass.STOCK, "AMD", "AMD"),
    "GOOGL": AssetInfo("GOOGL", "Alphabet", AssetClass.STOCK, "GOOGL", "GOOGL"),
    
    # Kenya Stocks
    "SCOM": AssetInfo("SCOM", "Safaricom", AssetClass.STOCK, "SCOM.NR", None, None, "NSE"),
    
    # Forex Pairs
    "EURUSD": AssetInfo("EURUSD", "EUR/USD", AssetClass.FOREX, "EURUSD=X"),
    "GBPUSD": AssetInfo("GBPUSD", "GBP/USD", AssetClass.FOREX, "GBPUSD=X"),
    "USDJPY": AssetInfo("USDJPY", "USD/JPY", AssetClass.FOREX, "JPY=X"),
    "AUDUSD": AssetInfo("AUDUSD", "AUD/USD", AssetClass.FOREX, "AUDUSD=X"),
    
    # Commodities
    "GOLD": AssetInfo("GOLD", "Gold", AssetClass.COMMODITY, "GC=F"),
    "XAUUSD": AssetInfo("XAUUSD", "Gold Spot", AssetClass.COMMODITY, "XAUUSD=X"),
    "SILVER": AssetInfo("SILVER", "Silver", AssetClass.COMMODITY, "SI=F"),
    "XAGUSD": AssetInfo("XAGUSD", "Silver Spot", AssetClass.COMMODITY, "XAGUSD=X"),
    
    # Crypto
    "BTCUSD": AssetInfo("BTCUSD", "Bitcoin", AssetClass.CRYPTO, "BTC-USD", None, "BTC/USDT"),
    "ETHUSD": AssetInfo("ETHUSD", "Ethereum", AssetClass.CRYPTO, "ETH-USD", None, "ETH/USDT"),
}


class MultiAssetDataFetcher:
    """
    Unified data fetcher for multiple asset classes
    Uses yfinance for most data, CCXT for crypto, and Alpaca for real-time
    """
    
    def __init__(self, alpaca_key: str = None, alpaca_secret: str = None):
        self.alpaca_key = alpaca_key or os.getenv('ALPACA_API_KEY')
        self.alpaca_secret = alpaca_secret or os.getenv('ALPACA_SECRET_KEY')
        self._yf = None
        self._ccxt_binance = None
        
    @property
    def yf(self):
        """Lazy load yfinance"""
        if self._yf is None:
            import yfinance as yf
            self._yf = yf
        return self._yf
    
    @property
    def ccxt_binance(self):
        """Lazy load CCXT Binance"""
        if self._ccxt_binance is None:
            try:
                import ccxt
                self._ccxt_binance = ccxt.binance()
            except:
                self._ccxt_binance = None
        return self._ccxt_binance
    
    def get_asset_info(self, symbol: str) -> Optional[AssetInfo]:
        """Get asset information"""
        return ASSETS.get(symbol.upper())
    
    def get_available_assets(self) -> Dict[str, List[str]]:
        """Get all available assets grouped by class"""
        grouped = {}
        for symbol, info in ASSETS.items():
            class_name = info.asset_class.value
            if class_name not in grouped:
                grouped[class_name] = []
            grouped[class_name].append({
                'symbol': symbol,
                'name': info.name
            })
        return grouped
    
    def fetch_bars(
        self,
        symbol: str,
        period: str = "5d",
        interval: str = "1m",
        start: datetime = None,
        end: datetime = None
    ) -> pd.DataFrame:
        """
        Fetch OHLCV bars for any supported asset
        
        Args:
            symbol: Asset symbol (e.g., 'SPY', 'EURUSD', 'BTCUSD')
            period: yfinance period string ('1d', '5d', '1mo', etc.)
            interval: Bar interval ('1m', '5m', '15m', '1h', '1d')
            start: Start datetime (optional, overrides period)
            end: End datetime (optional)
        
        Returns:
            DataFrame with columns [timestamp, open, high, low, close, volume]
        """
        asset = self.get_asset_info(symbol)
        if asset is None:
            raise ValueError(f"Unknown symbol: {symbol}")
        
        # Try different sources based on asset class
        if asset.asset_class == AssetClass.CRYPTO and self.ccxt_binance:
            return self._fetch_ccxt(asset, interval, start, end)
        else:
            return self._fetch_yfinance(asset, period, interval, start, end)
    
    def _fetch_yfinance(
        self,
        asset: AssetInfo,
        period: str,
        interval: str,
        start: datetime,
        end: datetime
    ) -> pd.DataFrame:
        """Fetch data using yfinance"""
        ticker = self.yf.Ticker(asset.yfinance_symbol)
        
        if start and end:
            df = ticker.history(start=start, end=end, interval=interval)
        else:
            df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            return pd.DataFrame()
        
        # Standardize columns
        df = df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        
        # Rename datetime column
        if 'datetime' in df.columns:
            df = df.rename(columns={'datetime': 'timestamp'})
        elif 'date' in df.columns:
            df = df.rename(columns={'date': 'timestamp'})
        
        # Keep only needed columns
        columns_map = {
            'timestamp': 'timestamp',
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'volume': 'volume'
        }
        
        result_df = pd.DataFrame()
        for new_col, old_col in columns_map.items():
            if old_col in df.columns:
                result_df[new_col] = df[old_col]
            else:
                result_df[new_col] = 0
        
        # Convert timestamp to milliseconds
        if 'timestamp' in result_df.columns:
            result_df['timestamp'] = pd.to_datetime(result_df['timestamp']).astype(np.int64) // 10**6
        
        return result_df
    
    def _fetch_ccxt(
        self,
        asset: AssetInfo,
        interval: str,
        start: datetime,
        end: datetime
    ) -> pd.DataFrame:
        """Fetch crypto data using CCXT"""
        if not self.ccxt_binance or not asset.ccxt_symbol:
            # Fallback to yfinance
            return self._fetch_yfinance(asset, "5d", interval, start, end)
        
        # Map interval to CCXT format
        interval_map = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1h',
            '4h': '4h',
            '1d': '1d'
        }
        ccxt_interval = interval_map.get(interval, '1h')
        
        try:
            since = int(start.timestamp() * 1000) if start else None
            ohlcv = self.ccxt_binance.fetch_ohlcv(
                asset.ccxt_symbol,
                timeframe=ccxt_interval,
                since=since,
                limit=1000
            )
            
            df = pd.DataFrame(
                ohlcv,
                columns=['timestamp', 'open', 'high', 'low', 'close', 'volume']
            )
            return df
        except Exception as e:
            print(f"CCXT fetch failed: {e}, falling back to yfinance")
            return self._fetch_yfinance(asset, "5d", interval, start, end)
    
    def fetch_multiple(
        self,
        symbols: List[str],
        period: str = "5d",
        interval: str = "1h"
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch data for multiple symbols
        
        Args:
            symbols: List of symbols
            period: yfinance period string
            interval: Bar interval
        
        Returns:
            Dictionary mapping symbol to DataFrame
        """
        result = {}
        for symbol in symbols:
            try:
                result[symbol] = self.fetch_bars(symbol, period, interval)
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
                result[symbol] = pd.DataFrame()
        return result
    
    def get_latest_price(self, symbol: str) -> Optional[Dict]:
        """Get the latest price for a symbol"""
        try:
            df = self.fetch_bars(symbol, period="1d", interval="1m")
            if df.empty:
                return None
            
            latest = df.iloc[-1]
            prev_close = df.iloc[-2]['close'] if len(df) > 1 else latest['close']
            
            return {
                'symbol': symbol,
                'price': float(latest['close']),
                'change': float(latest['close'] - prev_close),
                'change_pct': float((latest['close'] - prev_close) / prev_close * 100),
                'high': float(latest['high']),
                'low': float(latest['low']),
                'volume': float(latest['volume']),
                'timestamp': int(latest['timestamp'])
            }
        except Exception as e:
            print(f"Error getting price for {symbol}: {e}")
            return None
    
    def get_correlation_matrix(
        self,
        symbols: List[str],
        period: str = "1mo",
        interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Calculate correlation matrix for multiple assets
        
        Args:
            symbols: List of symbols
            period: Period for correlation calculation
            interval: Data interval
        
        Returns:
            Correlation matrix DataFrame
        """
        data = self.fetch_multiple(symbols, period, interval)
        
        # Get close prices
        prices = pd.DataFrame()
        for symbol, df in data.items():
            if not df.empty:
                prices[symbol] = df.set_index('timestamp')['close']
        
        # Calculate returns
        returns = prices.pct_change().dropna()
        
        return returns.corr()


# Global instance
data_fetcher = MultiAssetDataFetcher()


def get_all_assets_data(interval: str = "1h") -> Dict[str, Dict]:
    """
    Get data for all supported assets
    
    Returns:
        Dictionary with asset data and metadata
    """
    all_data = {}
    
    for symbol, info in ASSETS.items():
        try:
            df = data_fetcher.fetch_bars(symbol, period="5d", interval=interval)
            if not df.empty:
                all_data[symbol] = {
                    'info': {
                        'name': info.name,
                        'class': info.asset_class.value,
                        'exchange': info.exchange
                    },
                    'data': df.to_dict('records'),
                    'latest': {
                        'price': float(df['close'].iloc[-1]),
                        'change': float(df['close'].iloc[-1] - df['open'].iloc[0]),
                        'volume': float(df['volume'].sum())
                    }
                }
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
    
    return all_data


if __name__ == "__main__":
    # Test the fetcher
    fetcher = MultiAssetDataFetcher()
    
    print("Available Assets:")
    for asset_class, assets in fetcher.get_available_assets().items():
        print(f"\n{asset_class.upper()}:")
        for asset in assets:
            print(f"  - {asset['symbol']}: {asset['name']}")
    
    print("\n\nFetching sample data...")
    
    # Test each asset class
    test_symbols = ['SPY', 'EURUSD', 'GOLD', 'BTCUSD', 'SCOM']
    
    for symbol in test_symbols:
        print(f"\n{symbol}:")
        try:
            price = fetcher.get_latest_price(symbol)
            if price:
                print(f"  Price: ${price['price']:.2f}")
                print(f"  Change: {price['change_pct']:.2f}%")
        except Exception as e:
            print(f"  Error: {e}")
    
    # Test correlation
    print("\n\nCorrelation Matrix (SPY, AAPL, MSFT, NVDA):")
    corr = fetcher.get_correlation_matrix(['SPY', 'AAPL', 'MSFT', 'NVDA'])
    print(corr.round(3))
