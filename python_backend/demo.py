#!/usr/bin/env python3
"""
Wekeza Multi-Agent Trading Demo
Run this to test the full trading system locally

This demo:
1. Initializes all 4 trading agents
2. Analyzes multiple assets (stocks, FX, crypto, commodities)
3. Runs backtests to verify strategy performance
4. Shows real-time analysis results
"""

import os
import sys
from datetime import datetime

# Add paths
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text):
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.END}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.END}\n")


def print_section(text):
    print(f"\n{Colors.CYAN}{Colors.BOLD}▶ {text}{Colors.END}")
    print(f"{Colors.CYAN}{'-'*50}{Colors.END}")


def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")


def print_error(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")


def print_signal(action, confidence, symbol):
    if action == 'BUY':
        color = Colors.GREEN
        icon = '📈'
    elif action == 'SELL':
        color = Colors.RED
        icon = '📉'
    else:
        color = Colors.YELLOW
        icon = '⏸️'
    
    print(f"{color}{icon} {action} {symbol} (Confidence: {confidence:.0%}){Colors.END}")


def main():
    print_header("WEKEZA MULTI-AGENT TRADING SYSTEM")
    print(f"🕐 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check for API keys
    print_section("Checking API Keys")
    
    groq_key = os.getenv('GROQ_API_KEY')
    alpaca_key = os.getenv('ALPACA_API_KEY')
    
    if groq_key and groq_key != 'your_groq_api_key_here':
        print_success("Groq API key found - LLM agents enabled")
    else:
        print_warning("No Groq API key - running in limited mode")
        print("       Get your free key at: https://console.groq.com/")
    
    if alpaca_key:
        print_success("Alpaca API key found - real-time data enabled")
    else:
        print_warning("No Alpaca key - using yfinance for data")
    
    # Initialize agents
    print_section("Initializing Trading Agents")
    
    from agents import get_trading_crew
    crew = get_trading_crew()
    
    print_success("Trading Crew initialized with 4 agents:")
    for name, status in crew.get_all_status().items():
        llm_status = "✅" if status['llm_enabled'] else "❌"
        print(f"       • {status['name']}: {status['status']} (LLM: {llm_status})")
    
    # Test assets
    print_section("Testing Multi-Asset Data Fetch")
    
    from data import data_fetcher, ASSETS
    
    test_symbols = ['SPY', 'EURUSD', 'BTCUSD', 'GOLD']
    
    for symbol in test_symbols:
        try:
            price = data_fetcher.get_latest_price(symbol)
            if price:
                change_color = Colors.GREEN if price['change_pct'] >= 0 else Colors.RED
                print(f"  {symbol}: ${price['price']:.2f} ({change_color}{price['change_pct']:+.2f}%{Colors.END})")
            else:
                print(f"  {symbol}: No data available")
        except Exception as e:
            print_error(f"  {symbol}: {str(e)[:50]}")
    
    # Run full analysis on SPY
    print_section("Running Full Multi-Agent Analysis on SPY")
    
    print("  This may take 10-20 seconds...\n")
    
    try:
        result = crew.analyze_symbol('SPY')
        
        print("  📊 Analysis Complete!")
        print(f"  ⏱️  Analysis time: {result['analysis_time_seconds']:.2f}s\n")
        
        # Print agent signals
        print("  Agent Signals:")
        agents = result.get('agents', {})
        
        # Tape Reader
        tr = agents.get('tape_reader', {})
        tr_signal = tr.get('signal', {})
        print(f"    • Tape Reader: {tr_signal.get('type', 'N/A')} ({tr_signal.get('confidence', 0):.0%})")
        print(f"      └─ {tr_signal.get('description', 'N/A')[:60]}...")
        
        # Chartist
        ch = agents.get('chartist', {})
        ch_context = ch.get('context', {})
        print(f"    • Chartist: {ch_context.get('direction', 'N/A')} ({ch_context.get('strength', 0):.0%})")
        print(f"      └─ {ch_context.get('description', 'N/A')[:60]}...")
        
        # Macro
        macro = agents.get('macro_economist', {})
        macro_signal = macro.get('macro_signal', {})
        print(f"    • Macro Economist: {macro_signal.get('direction', 'N/A')} ({macro_signal.get('confidence', 0):.0%})")
        
        # Final Decision
        decision = result.get('decision', {})
        print(f"\n  💼 Portfolio Manager Decision:")
        print_signal(decision.get('action', 'NO_TRADE'), decision.get('confidence', 0), 'SPY')
        
        if decision.get('action') != 'NO_TRADE':
            print(f"      Entry: ${decision.get('entry_price', 0):.2f}")
            print(f"      Stop Loss: ${decision.get('stop_loss', 0):.2f}")
            pos = decision.get('position', {})
            print(f"      Position: {pos.get('units', 0)} units (${pos.get('position_value', 0):,.0f})")
        
    except Exception as e:
        print_error(f"Analysis failed: {str(e)}")
    
    # Run backtest
    print_section("Running Backtest (30 days)")
    
    try:
        from backtesting import BacktestEngine, print_backtest_results
        from data import analyze_orderflow
        
        # Fetch data
        bars = data_fetcher.fetch_bars('SPY', period='1mo', interval='1h')
        
        if not bars.empty and len(bars) >= 100:
            print(f"  Data: {len(bars)} hourly bars\n")
            
            # Simple strategy
            def strategy(window):
                try:
                    analysis = analyze_orderflow(window)
                    signal = analysis.get('signal', {})
                    if signal.get('type') == 'bullish' and signal.get('confidence', 0) > 0.65:
                        return {'action': 'BUY', 'stop_loss': window['close'].iloc[-1] * 0.98}
                    elif signal.get('type') == 'bearish' and signal.get('confidence', 0) > 0.65:
                        return {'action': 'SELL', 'stop_loss': window['close'].iloc[-1] * 1.02}
                    return {'action': 'NO_TRADE'}
                except:
                    return {'action': 'NO_TRADE'}
            
            engine = BacktestEngine(initial_capital=100000)
            result = engine.run_backtest('SPY', bars, strategy)
            comparison = engine.compare_with_buy_and_hold(bars, result)
            
            print(f"  📈 Strategy Performance:")
            print(f"      Total Return: {result.total_return_pct:+.2f}%")
            print(f"      Sharpe Ratio: {result.sharpe_ratio:.2f}")
            print(f"      Max Drawdown: {result.max_drawdown_pct:.1f}%")
            print(f"      Win Rate: {result.win_rate:.1f}%")
            print(f"      Total Trades: {result.total_trades}")
            
            print(f"\n  📊 vs Buy & Hold:")
            bh = comparison['buy_and_hold']
            outperf = comparison['outperformance']
            print(f"      B&H Return: {bh['return_pct']:.2f}%")
            outperf_color = Colors.GREEN if outperf['return_diff'] > 0 else Colors.RED
            print(f"      Outperformance: {outperf_color}{outperf['return_diff']:+.2f}%{Colors.END}")
        else:
            print_warning("Insufficient data for backtest")
            
    except Exception as e:
        print_error(f"Backtest failed: {str(e)}")
    
    # API info
    print_section("API Server")
    print("  To start the API server, run:")
    print(f"  {Colors.CYAN}cd python_backend && uvicorn api:app --reload{Colors.END}")
    print("\n  API Endpoints:")
    print("    • GET  /health          - Health check")
    print("    • GET  /agents/status   - Agent status")
    print("    • GET  /agents/analyze/{symbol} - Full analysis")
    print("    • GET  /orderflow/{symbol}      - Order flow")
    print("    • GET  /volumeprofile/{symbol}  - Volume profile")
    print("    • POST /backtest               - Run backtest")
    
    print_header("DEMO COMPLETE")
    print(f"🕐 Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("\n📚 Next steps:")
    print("   1. Add your Groq API key to .env")
    print("   2. Start the API: uvicorn api:app --reload")
    print("   3. Start the frontend: npm run dev")
    print("   4. Open http://localhost:5173 to see the dashboard")
    print()


if __name__ == "__main__":
    main()
