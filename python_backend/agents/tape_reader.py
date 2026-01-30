"""
Agent A: The Tape Reader
Order Flow & Delta Analyst Agent

This agent monitors real-time order flow data and analyzes Delta patterns
to identify absorption, exhaustion, and imbalance signals.
"""

import os
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Optional imports for CrewAI and LangChain
try:
    from crewai import Agent, Task
    CREWAI_AVAILABLE = True
except ImportError:
    Agent = None
    Task = None
    CREWAI_AVAILABLE = False

try:
    from langchain_groq import ChatGroq
    GROQ_AVAILABLE = True
except ImportError:
    ChatGroq = None
    GROQ_AVAILABLE = False

from data.order_flow import (
    analyze_orderflow,
    detect_delta_exhaustion,
    SignalType,
    PatternType
)
from data.multi_asset import data_fetcher


class TapeReaderAgent:
    """
    The Tape Reader Agent - Specialized in Order Flow Analysis
    
    Responsibilities:
    - Monitor real-time order flow and delta
    - Identify absorption patterns (effort vs result divergence)
    - Detect delta exhaustion (divergence between price and delta trend)
    - Track stacked imbalances
    - Generate trading signals based on order flow
    """
    
    def __init__(self, groq_api_key: str = None):
        self.groq_api_key = groq_api_key or os.getenv('GROQ_API_KEY')
        self.llm = None
        self.agent = None
        self._initialize_llm()
        self._create_agent()
    
    def _initialize_llm(self):
        """Initialize the Groq LLM"""
        if not GROQ_AVAILABLE or not ChatGroq:
            return
        
        if self.groq_api_key and self.groq_api_key != 'your_groq_api_key_here':
            try:
                self.llm = ChatGroq(
                    groq_api_key=self.groq_api_key,
                    model_name="llama-3.1-70b-versatile",  # Fast and capable
                    temperature=0.1  # Low temperature for consistent analysis
                )
            except Exception as e:
                print(f"Warning: Could not initialize Groq LLM: {e}")
                self.llm = None
    
    def _create_agent(self):
        """Create the CrewAI agent"""
        if not CREWAI_AVAILABLE or not Agent:
            return
        
        self.agent = Agent(
            role="Order Flow Analyst",
            goal="Analyze market microstructure through delta and order flow patterns to identify high-probability trading setups",
            backstory="""You are an expert institutional order flow analyst with 15 years 
            of experience reading the tape at major trading firms. You specialize in 
            detecting when large players are accumulating or distributing positions by 
            analyzing the relationship between delta (buying vs selling pressure) and 
            price movement. You understand concepts like absorption, exhaustion, and 
            stacked imbalances from the Delta X Price methodology.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    def analyze_symbol(self, symbol: str, interval: str = "1m") -> Dict:
        """
        Perform complete order flow analysis for a symbol
        
        Args:
            symbol: Trading symbol (e.g., 'SPY', 'BTCUSD')
            interval: Data interval
        
        Returns:
            Dictionary with analysis results
        """
        try:
            # Fetch data
            bars = data_fetcher.fetch_bars(symbol, period="2d", interval=interval)
            
            if bars.empty:
                return {
                    "symbol": symbol,
                    "status": "error",
                    "message": "No data available"
                }
            
            # Run order flow analysis
            analysis = analyze_orderflow(bars)
            
            # Add symbol and timestamp
            analysis['symbol'] = symbol
            analysis['timestamp'] = datetime.now().isoformat()
            analysis['agent'] = 'tape_reader'
            analysis['status'] = 'success'
            
            # Calculate overall signal strength
            signal_confidence = analysis['signal']['confidence']
            exhaustion_confidence = analysis['exhaustion']['confidence'] if analysis['exhaustion']['detected'] else 0
            
            # Determine final signal
            if analysis['exhaustion']['detected']:
                # Exhaustion signals are strong reversal indicators
                final_signal = analysis['exhaustion']['type']
                final_confidence = max(signal_confidence, exhaustion_confidence)
                analysis['priority'] = 'high'
            elif analysis['signal']['pattern'] == 'absorption':
                # Absorption is also a strong signal
                final_signal = analysis['signal']['type']
                final_confidence = signal_confidence
                analysis['priority'] = 'high'
            else:
                # Continuation signals are lower priority
                final_signal = analysis['signal']['type']
                final_confidence = signal_confidence
                analysis['priority'] = 'medium' if signal_confidence > 0.6 else 'low'
            
            analysis['final_signal'] = {
                'direction': final_signal,
                'confidence': final_confidence,
                'action': self._determine_action(final_signal, final_confidence)
            }
            
            return analysis
            
        except Exception as e:
            return {
                "symbol": symbol,
                "status": "error",
                "message": str(e),
                "agent": "tape_reader"
            }
    
    def _determine_action(self, signal: str, confidence: float) -> str:
        """Determine trading action based on signal"""
        if confidence < 0.5:
            return "wait"
        elif signal == "bullish":
            return "consider_long" if confidence < 0.75 else "strong_long"
        elif signal == "bearish":
            return "consider_short" if confidence < 0.75 else "strong_short"
        else:
            return "wait"
    
    def analyze_multiple(self, symbols: List[str], interval: str = "1m") -> Dict[str, Dict]:
        """Analyze multiple symbols"""
        results = {}
        for symbol in symbols:
            results[symbol] = self.analyze_symbol(symbol, interval)
        return results
    
    def get_agent_status(self) -> Dict:
        """Get current agent status"""
        return {
            "name": "Tape Reader",
            "role": "Order Flow Analyst",
            "status": "active" if self.llm else "limited",
            "llm_enabled": self.llm is not None,
            "capabilities": [
                "delta_analysis",
                "absorption_detection",
                "exhaustion_detection",
                "imbalance_tracking"
            ]
        }
    
    def create_analysis_task(self, symbol: str) -> Task:
        """Create a CrewAI task for symbol analysis"""
        return Task(
            description=f"""Analyze the order flow for {symbol} and provide a trading recommendation.
            
            Consider:
            1. Current delta (buying vs selling pressure)
            2. Cumulative delta trend
            3. Absorption patterns (effort vs result divergence)
            4. Delta exhaustion signals
            
            Provide a clear BUY, SELL, or WAIT recommendation with confidence level.""",
            agent=self.agent,
            expected_output="A trading recommendation with signal type, confidence, and reasoning"
        )


# Singleton instance
_tape_reader_instance = None

def get_tape_reader(groq_api_key: str = None) -> TapeReaderAgent:
    """Get or create the Tape Reader agent singleton"""
    global _tape_reader_instance
    if _tape_reader_instance is None:
        _tape_reader_instance = TapeReaderAgent(groq_api_key)
    return _tape_reader_instance


if __name__ == "__main__":
    # Test the agent
    from dotenv import load_dotenv
    load_dotenv()
    
    agent = TapeReaderAgent()
    
    print("Tape Reader Agent Status:")
    print(agent.get_agent_status())
    
    print("\n\nAnalyzing SPY...")
    result = agent.analyze_symbol('SPY', '5m')
    
    print(f"\nSymbol: {result.get('symbol')}")
    print(f"Status: {result.get('status')}")
    
    if result.get('status') == 'success':
        print(f"Current Delta: {result.get('current_delta', 0):.2f}")
        print(f"Signal: {result.get('signal', {}).get('type')}")
        print(f"Pattern: {result.get('signal', {}).get('pattern')}")
        print(f"Confidence: {result.get('signal', {}).get('confidence', 0):.2%}")
        print(f"Description: {result.get('signal', {}).get('description')}")
        
        if result.get('exhaustion', {}).get('detected'):
            print(f"\n⚠️  EXHAUSTION DETECTED: {result['exhaustion']['description']}")
        
        print(f"\nFinal Recommendation: {result.get('final_signal', {}).get('action', 'N/A')}")
