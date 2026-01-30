"""
CrewAI Orchestration
Coordinates all agents to work together on trading analysis
"""

import os
import sys
from typing import Dict, List, Optional
from datetime import datetime
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Optional CrewAI import
try:
    from crewai import Crew, Process
    CREWAI_AVAILABLE = True
except ImportError:
    Crew = None
    Process = None
    CREWAI_AVAILABLE = False

from .tape_reader import TapeReaderAgent, get_tape_reader
from .chartist import ChartistAgent, get_chartist
from .macro_economist import MacroEconomistAgent, get_macro_economist
from .portfolio_manager import PortfolioManagerAgent, get_portfolio_manager


class TradingCrew:
    """
    The Trading Crew - Orchestrates all 4 agents to analyze and trade
    
    Agents:
    1. Tape Reader - Order flow analysis
    2. Chartist - Volume profile and structure
    3. Macro Economist - News and sentiment
    4. Portfolio Manager - Final decisions and risk
    """
    
    def __init__(self, groq_api_key: str = None):
        self.groq_api_key = groq_api_key or os.getenv('GROQ_API_KEY')
        
        # Initialize all agents
        self.tape_reader = get_tape_reader(self.groq_api_key)
        self.chartist = get_chartist(self.groq_api_key)
        self.macro_economist = get_macro_economist(self.groq_api_key)
        self.portfolio_manager = get_portfolio_manager(self.groq_api_key)
        
        # Analysis cache
        self.last_analysis = {}
    
    async def _analyze_symbol_async(self, symbol: str, news: List[str] = None) -> Dict:
        """Helper to run agent analyses in parallel"""
        # Run independent agents concurrently
        # We use asyncio.to_thread for synchronous agent methods
        tasks = [
            asyncio.to_thread(self.tape_reader.analyze_symbol, symbol),
            asyncio.to_thread(self.chartist.analyze_symbol, symbol),
            asyncio.to_thread(self.macro_economist.analyze_symbol, symbol, news)
        ]
        
        results = await asyncio.gather(*tasks)
        return {
            'tape_reader': results[0],
            'chartist': results[1],
            'macro_economist': results[2]
        }

    def analyze_symbol(self, symbol: str, news: List[str] = None) -> Dict:
        """
        Run complete multi-agent analysis for a symbol (optimized version)
        """
        analysis_start = datetime.now()
        
        print(f"🕵️  Multi-agent analysis started for {symbol}...")
        
        # Step 1-3: Run agents in parallel
        loop = asyncio.get_event_loop()
        agent_results = loop.run_until_complete(self._analyze_symbol_async(symbol, news))
        
        # Step 4: Portfolio Manager makes final decision
        print(f"💼 Portfolio Manager making final decision...")
        decision = self.portfolio_manager.make_trade_decision(
            symbol,
            agent_results['tape_reader'],
            agent_results['chartist'],
            agent_results['macro_economist']
        )
        
        analysis_time = (datetime.now() - analysis_start).total_seconds()
        
        result = {
            'symbol': symbol,
            'timestamp': datetime.now().isoformat(),
            'analysis_time_seconds': analysis_time,
            'agents': agent_results,
            'decision': decision,
            'summary': self._generate_summary(decision, agent_results['tape_reader'], agent_results['chartist'])
        }
        
        self.last_analysis[symbol] = result
        return result
    
    def analyze_multiple(self, symbols: List[str], news_by_symbol: Dict = None) -> Dict[str, Dict]:
        """
        Analyze multiple symbols
        
        Args:
            symbols: List of symbols to analyze
            news_by_symbol: Optional dict mapping symbol to news list
        
        Returns:
            Dictionary mapping symbol to analysis results
        """
        results = {}
        news_by_symbol = news_by_symbol or {}
        
        for symbol in symbols:
            print(f"\n{'='*50}")
            print(f"Analyzing {symbol}...")
            print('='*50)
            
            news = news_by_symbol.get(symbol, [])
            results[symbol] = self.analyze_symbol(symbol, news)
        
        return results
    
    def _generate_summary(
        self,
        decision: Dict,
        tape_reader: Dict,
        chartist: Dict
    ) -> str:
        """Generate a human-readable summary of the analysis"""
        
        action = decision.get('action', 'NO_TRADE')
        confidence = decision.get('confidence', 0)
        
        if action == 'NO_TRADE':
            reason = decision.get('reason', 'Signals not aligned')
            return f"❌ NO TRADE: {reason}"
        
        direction = "bullish 📈" if action == 'BUY' else "bearish 📉"
        
        # Get key details
        entry = decision.get('entry_price', 0)
        stop = decision.get('stop_loss', 0)
        pos = decision.get('position', {})
        units = pos.get('units', 0)
        risk = pos.get('risk_amount', 0)
        
        # Order flow context
        of_signal = tape_reader.get('signal', {}).get('description', '')
        
        # Volume profile context
        regime = chartist.get('htf', {}).get('regime', 'unknown')
        
        summary = f"""
✅ {action} SIGNAL ({confidence:.0%} confidence)

📊 Market Context:
   • Direction: {direction}
   • Regime: {regime.replace('_', ' ').title()}
   • Order Flow: {of_signal}

💰 Trade Parameters:
   • Entry: ${entry:.2f}
   • Stop Loss: ${stop:.2f}
   • Units: {units:,}
   • Risk: ${risk:.0f}

🤖 Agent Agreement: {decision.get('agent_agreement', 'N/A')}
"""
        return summary.strip()
    
    def get_all_status(self) -> Dict:
        """Get status of all agents"""
        return {
            'tape_reader': self.tape_reader.get_agent_status(),
            'chartist': self.chartist.get_agent_status(),
            'macro_economist': self.macro_economist.get_agent_status(),
            'portfolio_manager': self.portfolio_manager.get_agent_status()
        }
    
    def get_portfolio_summary(self) -> Dict:
        """Get portfolio summary from Portfolio Manager"""
        return self.portfolio_manager.get_agent_status()['portfolio_summary']


# Global crew instance
_trading_crew = None

def get_trading_crew(groq_api_key: str = None) -> TradingCrew:
    """Get or create the trading crew singleton"""
    global _trading_crew
    if _trading_crew is None:
        _trading_crew = TradingCrew(groq_api_key)
    return _trading_crew


def run_analysis(symbol: str, news: List[str] = None) -> Dict:
    """
    Quick function to run analysis on a symbol
    
    Args:
        symbol: Trading symbol
        news: Optional news headlines
    
    Returns:
        Complete analysis result
    """
    crew = get_trading_crew()
    return crew.analyze_symbol(symbol, news)


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    print("="*60)
    print("WEKEZA MULTI-AGENT TRADING SYSTEM")
    print("="*60)
    
    # Initialize crew
    crew = TradingCrew()
    
    print("\n📋 Agent Status:")
    for name, status in crew.get_all_status().items():
        print(f"  {name}: {status['status']} (LLM: {'✅' if status['llm_enabled'] else '❌'})")
    
    # Test analysis
    print("\n" + "="*60)
    print("Starting Analysis on SPY...")
    print("="*60)
    
    result = crew.analyze_symbol('SPY')
    
    print("\n" + "="*60)
    print("ANALYSIS SUMMARY")
    print("="*60)
    print(result['summary'])
    
    print(f"\n⏱️ Analysis completed in {result['analysis_time_seconds']:.2f} seconds")
