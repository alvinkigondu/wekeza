"""
Backtesting Engine
Tests the multi-agent trading strategy on historical data
"""

import os
import sys
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@dataclass
class Trade:
    """Represents a single trade"""
    symbol: str
    entry_time: datetime
    entry_price: float
    direction: str  # 'long' or 'short'
    units: int
    stop_loss: float
    take_profit: Optional[float] = None
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    pnl: float = 0
    pnl_pct: float = 0
    exit_reason: str = ''


@dataclass
class BacktestResult:
    """Results from a backtest run"""
    symbol: str
    start_date: datetime
    end_date: datetime
    initial_capital: float
    final_capital: float
    total_return: float
    total_return_pct: float
    
    # Trade statistics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    
    # Risk metrics
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    
    # Time series
    equity_curve: List[float] = field(default_factory=list)
    drawdown_curve: List[float] = field(default_factory=list)
    trades: List[Trade] = field(default_factory=list)


class BacktestEngine:
    """
    Backtesting engine for the multi-agent trading strategy
    
    Features:
    - Historical data simulation
    - Transaction costs
    - Slippage modeling
    - Detailed performance metrics
    - Comparison with benchmarks
    """
    
    def __init__(
        self,
        initial_capital: float = 100000,
        commission: float = 0.001,  # 0.1%
        slippage: float = 0.0005,   # 0.05%
        risk_per_trade: float = 0.02  # 2%
    ):
        self.initial_capital = initial_capital
        self.commission = commission
        self.slippage = slippage
        self.risk_per_trade = risk_per_trade
        
        # State
        self.capital = initial_capital
        self.equity_history = [initial_capital]
        self.trades: List[Trade] = []
        self.open_positions: Dict[str, Trade] = {}
    
    def reset(self):
        """Reset the backtest state"""
        self.capital = self.initial_capital
        self.equity_history = [self.initial_capital]
        self.trades = []
        self.open_positions = {}
    
    def run_backtest(
        self,
        symbol: str,
        data: pd.DataFrame,
        strategy_func,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> BacktestResult:
        """
        Run a backtest on historical data
        
        Args:
            symbol: Trading symbol
            data: OHLCV DataFrame with columns [timestamp, open, high, low, close, volume]
            strategy_func: Function that takes data window and returns signal dict
            start_date: Start date for backtest
            end_date: End date for backtest
        
        Returns:
            BacktestResult with performance metrics
        """
        self.reset()
        
        # Filter data by date if specified
        if 'timestamp' in data.columns and start_date:
            data = data[data['timestamp'] >= start_date.timestamp() * 1000]
        if 'timestamp' in data.columns and end_date:
            data = data[data['timestamp'] <= end_date.timestamp() * 1000]
        
        if len(data) < 100:
            raise ValueError("Insufficient data for backtest (need at least 100 bars)")
        
        print(f"Running backtest on {symbol} with {len(data)} bars...")
        
        # Window size for strategy
        window_size = 60
        
        # Iterate through data
        for i in range(window_size, len(data)):
            window = data.iloc[i-window_size:i]
            current_bar = data.iloc[i]
            current_price = current_bar['close']
            
            # Check open positions
            self._check_stops(symbol, current_bar)
            
            # Get strategy signal
            try:
                signal = strategy_func(window)
            except Exception as e:
                signal = {'action': 'NO_TRADE'}
            
            # Process signal
            if signal.get('action') in ['BUY', 'SELL']:
                self._execute_signal(symbol, signal, current_bar)
            
            # Update equity
            self._update_equity(current_price)
        
        # Close any remaining positions
        if symbol in self.open_positions:
            last_bar = data.iloc[-1]
            self._close_position(symbol, last_bar['close'], 'end_of_backtest')
        
        # Calculate metrics
        return self._calculate_results(
            symbol,
            data.iloc[0]['timestamp'] if 'timestamp' in data.columns else datetime.now(),
            data.iloc[-1]['timestamp'] if 'timestamp' in data.columns else datetime.now()
        )
    
    def _execute_signal(self, symbol: str, signal: Dict, bar: pd.Series):
        """Execute a trading signal"""
        
        # Don't open if already have position
        if symbol in self.open_positions:
            return
        
        action = signal['action']
        entry_price = bar['close']
        
        # Apply slippage
        if action == 'BUY':
            entry_price *= (1 + self.slippage)
            direction = 'long'
        else:
            entry_price *= (1 - self.slippage)
            direction = 'short'
        
        # Calculate position size
        stop_loss = signal.get('stop_loss', entry_price * (0.98 if action == 'BUY' else 1.02))
        stop_distance = abs(entry_price - stop_loss)
        
        risk_amount = self.capital * self.risk_per_trade
        if stop_distance > 0:
            units = int(risk_amount / stop_distance)
        else:
            units = int(self.capital * 0.1 / entry_price)
        
        # Cap at available capital
        position_value = units * entry_price * (1 + self.commission)
        if position_value > self.capital * 0.9:
            units = int(self.capital * 0.9 / (entry_price * (1 + self.commission)))
        
        if units <= 0:
            return
        
        # Create trade
        trade = Trade(
            symbol=symbol,
            entry_time=datetime.now(),  # Would use bar timestamp in real data
            entry_price=entry_price,
            direction=direction,
            units=units,
            stop_loss=stop_loss,
            take_profit=signal.get('take_profit')
        )
        
        self.open_positions[symbol] = trade
        
        # Deduct commission
        self.capital -= units * entry_price * self.commission
    
    def _check_stops(self, symbol: str, bar: pd.Series):
        """Check and execute stop losses"""
        if symbol not in self.open_positions:
            return
        
        trade = self.open_positions[symbol]
        
        # Check stop loss
        if trade.direction == 'long':
            if bar['low'] <= trade.stop_loss:
                self._close_position(symbol, trade.stop_loss, 'stop_loss')
        else:
            if bar['high'] >= trade.stop_loss:
                self._close_position(symbol, trade.stop_loss, 'stop_loss')
        
        # Check take profit
        if trade.take_profit:
            if trade.direction == 'long':
                if bar['high'] >= trade.take_profit:
                    self._close_position(symbol, trade.take_profit, 'take_profit')
            else:
                if bar['low'] <= trade.take_profit:
                    self._close_position(symbol, trade.take_profit, 'take_profit')
    
    def _close_position(self, symbol: str, exit_price: float, reason: str):
        """Close an open position"""
        if symbol not in self.open_positions:
            return
        
        trade = self.open_positions[symbol]
        
        # Apply slippage
        if trade.direction == 'long':
            exit_price *= (1 - self.slippage)
        else:
            exit_price *= (1 + self.slippage)
        
        # Calculate PnL
        if trade.direction == 'long':
            pnl = (exit_price - trade.entry_price) * trade.units
        else:
            pnl = (trade.entry_price - exit_price) * trade.units
        
        # Deduct commission
        pnl -= exit_price * trade.units * self.commission
        
        trade.exit_time = datetime.now()
        trade.exit_price = exit_price
        trade.pnl = pnl
        trade.pnl_pct = pnl / (trade.entry_price * trade.units) * 100
        trade.exit_reason = reason
        
        self.capital += pnl
        self.trades.append(trade)
        del self.open_positions[symbol]
    
    def _update_equity(self, current_price: float):
        """Update equity curve"""
        # Calculate unrealized PnL
        unrealized = 0
        for trade in self.open_positions.values():
            if trade.direction == 'long':
                unrealized += (current_price - trade.entry_price) * trade.units
            else:
                unrealized += (trade.entry_price - current_price) * trade.units
        
        equity = self.capital + unrealized
        self.equity_history.append(equity)
    
    def _calculate_results(
        self,
        symbol: str,
        start_ts,
        end_ts
    ) -> BacktestResult:
        """Calculate performance metrics"""
        
        if isinstance(start_ts, (int, float)):
            start_date = datetime.fromtimestamp(start_ts / 1000)
            end_date = datetime.fromtimestamp(end_ts / 1000)
        else:
            start_date = start_ts
            end_date = end_ts
        
        equity = np.array(self.equity_history)
        
        # Basic metrics
        final_capital = equity[-1]
        total_return = final_capital - self.initial_capital
        total_return_pct = (total_return / self.initial_capital) * 100
        
        # Trade statistics
        total_trades = len(self.trades)
        if total_trades == 0:
            return BacktestResult(
                symbol=symbol,
                start_date=start_date,
                end_date=end_date,
                initial_capital=self.initial_capital,
                final_capital=final_capital,
                total_return=total_return,
                total_return_pct=total_return_pct,
                total_trades=0,
                winning_trades=0,
                losing_trades=0,
                win_rate=0,
                avg_win=0,
                avg_loss=0,
                profit_factor=0,
                max_drawdown=0,
                max_drawdown_pct=0,
                sharpe_ratio=0,
                sortino_ratio=0,
                calmar_ratio=0,
                equity_curve=self.equity_history,
                trades=self.trades
            )
        
        wins = [t for t in self.trades if t.pnl > 0]
        losses = [t for t in self.trades if t.pnl <= 0]
        
        winning_trades = len(wins)
        losing_trades = len(losses)
        win_rate = winning_trades / total_trades * 100
        
        avg_win = np.mean([t.pnl for t in wins]) if wins else 0
        avg_loss = abs(np.mean([t.pnl for t in losses])) if losses else 0
        
        total_wins = sum(t.pnl for t in wins)
        total_losses = abs(sum(t.pnl for t in losses))
        profit_factor = total_wins / total_losses if total_losses > 0 else float('inf')
        
        # Drawdown calculation
        peak = np.maximum.accumulate(equity)
        drawdown = equity - peak
        max_drawdown = abs(np.min(drawdown))
        max_drawdown_pct = (max_drawdown / np.max(peak)) * 100
        
        # Sharpe ratio (assuming 252 trading days)
        returns = np.diff(equity) / equity[:-1]
        if len(returns) > 0 and np.std(returns) > 0:
            sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252)
        else:
            sharpe_ratio = 0
        
        # Sortino ratio (using downside deviation)
        negative_returns = returns[returns < 0]
        if len(negative_returns) > 0 and np.std(negative_returns) > 0:
            sortino_ratio = np.mean(returns) / np.std(negative_returns) * np.sqrt(252)
        else:
            sortino_ratio = sharpe_ratio
        
        # Calmar ratio
        if max_drawdown_pct > 0:
            annual_return = total_return_pct * (252 / len(equity))
            calmar_ratio = annual_return / max_drawdown_pct
        else:
            calmar_ratio = 0
        
        return BacktestResult(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            initial_capital=self.initial_capital,
            final_capital=final_capital,
            total_return=total_return,
            total_return_pct=total_return_pct,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            max_drawdown=max_drawdown,
            max_drawdown_pct=max_drawdown_pct,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            calmar_ratio=calmar_ratio,
            equity_curve=self.equity_history,
            drawdown_curve=drawdown.tolist(),
            trades=self.trades
        )
    
    def compare_with_buy_and_hold(
        self,
        data: pd.DataFrame,
        result: BacktestResult
    ) -> Dict:
        """Compare strategy with buy and hold benchmark"""
        
        if data.empty:
            return {}
        
        start_price = data.iloc[0]['close']
        end_price = data.iloc[-1]['close']
        
        bh_return = (end_price - start_price) / start_price * 100
        
        # Calculate buy and hold equity curve
        bh_units = self.initial_capital / start_price
        bh_equity = data['close'] * bh_units
        
        # Buy and hold metrics
        bh_peak = np.maximum.accumulate(bh_equity)
        bh_drawdown = (bh_equity - bh_peak) / bh_peak * 100
        bh_max_dd = abs(np.min(bh_drawdown))
        
        bh_returns = np.diff(bh_equity) / bh_equity[:-1]
        bh_sharpe = np.mean(bh_returns) / np.std(bh_returns) * np.sqrt(252) if len(bh_returns) > 0 else 0
        
        return {
            'strategy': {
                'return_pct': result.total_return_pct,
                'max_drawdown_pct': result.max_drawdown_pct,
                'sharpe_ratio': result.sharpe_ratio,
                'total_trades': result.total_trades,
                'win_rate': result.win_rate
            },
            'buy_and_hold': {
                'return_pct': bh_return,
                'max_drawdown_pct': bh_max_dd,
                'sharpe_ratio': bh_sharpe,
                'total_trades': 1,
                'win_rate': 100 if bh_return > 0 else 0
            },
            'outperformance': {
                'return_diff': result.total_return_pct - bh_return,
                'sharpe_diff': result.sharpe_ratio - bh_sharpe,
                'drawdown_diff': bh_max_dd - result.max_drawdown_pct
            }
        }


def print_backtest_results(result: BacktestResult, comparison: Dict = None):
    """Pretty print backtest results"""
    print("\n" + "="*60)
    print(f"BACKTEST RESULTS: {result.symbol}")
    print("="*60)
    
    print(f"\n📅 Period: {result.start_date} to {result.end_date}")
    
    print(f"\n💰 Returns:")
    print(f"   Initial Capital: ${result.initial_capital:,.2f}")
    print(f"   Final Capital:   ${result.final_capital:,.2f}")
    print(f"   Total Return:    ${result.total_return:,.2f} ({result.total_return_pct:.2f}%)")
    
    print(f"\n📊 Trade Statistics:")
    print(f"   Total Trades:    {result.total_trades}")
    print(f"   Winning Trades:  {result.winning_trades}")
    print(f"   Losing Trades:   {result.losing_trades}")
    print(f"   Win Rate:        {result.win_rate:.1f}%")
    print(f"   Avg Win:         ${result.avg_win:,.2f}")
    print(f"   Avg Loss:        ${result.avg_loss:,.2f}")
    print(f"   Profit Factor:   {result.profit_factor:.2f}")
    
    print(f"\n⚠️ Risk Metrics:")
    print(f"   Max Drawdown:    ${result.max_drawdown:,.2f} ({result.max_drawdown_pct:.1f}%)")
    print(f"   Sharpe Ratio:    {result.sharpe_ratio:.2f}")
    print(f"   Sortino Ratio:   {result.sortino_ratio:.2f}")
    print(f"   Calmar Ratio:    {result.calmar_ratio:.2f}")
    
    if comparison:
        print(f"\n📈 vs Buy & Hold:")
        print(f"   B&H Return:      {comparison['buy_and_hold']['return_pct']:.2f}%")
        print(f"   B&H Max DD:      {comparison['buy_and_hold']['max_drawdown_pct']:.1f}%")
        print(f"   B&H Sharpe:      {comparison['buy_and_hold']['sharpe_ratio']:.2f}")
        print(f"   Outperformance:  {comparison['outperformance']['return_diff']:+.2f}%")


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    print("Testing Backtest Engine...")
    
    # Import data fetcher and order flow analysis
    from data.multi_asset import data_fetcher
    from data.order_flow import analyze_orderflow
    
    # Fetch data
    print("\nFetching SPY data...")
    data = data_fetcher.fetch_bars('SPY', period='1mo', interval='1h')
    
    if data.empty:
        print("No data available")
    else:
        print(f"Got {len(data)} bars")
        
        # Define simple strategy using order flow
        def simple_strategy(window: pd.DataFrame) -> Dict:
            """Simple order flow based strategy"""
            try:
                analysis = analyze_orderflow(window)
                signal = analysis.get('signal', {})
                
                if signal.get('type') == 'bullish' and signal.get('confidence', 0) > 0.7:
                    return {
                        'action': 'BUY',
                        'stop_loss': window['close'].iloc[-1] * 0.98
                    }
                elif signal.get('type') == 'bearish' and signal.get('confidence', 0) > 0.7:
                    return {
                        'action': 'SELL',
                        'stop_loss': window['close'].iloc[-1] * 1.02
                    }
                else:
                    return {'action': 'NO_TRADE'}
            except:
                return {'action': 'NO_TRADE'}
        
        # Run backtest
        engine = BacktestEngine(initial_capital=100000)
        result = engine.run_backtest('SPY', data, simple_strategy)
        
        # Compare with buy and hold
        comparison = engine.compare_with_buy_and_hold(data, result)
        
        # Print results
        print_backtest_results(result, comparison)
