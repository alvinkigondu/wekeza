"""
Agent B: The Chartist
Volume Profile & Market Structure Analyst

This agent analyzes HTF/MTF/STF context through volume profile,
determining market regime and identifying key structural levels.
"""

import os
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime

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

from data.volume_profile import (
    get_volume_profile_analysis,
    build_volume_profile,
    MarketRegime
)
from data.multi_asset import data_fetcher


class ChartistAgent:
    """
    The Chartist Agent - Specialized in Volume Profile & Structure Analysis
    
    Responsibilities:
    - Build and analyze Volume Profiles (POC, VAH, VAL)
    - Identify High Volume Nodes (HVN) as support/resistance
    - Identify Low Volume Nodes (LVN) as fast-move zones
    - Determine market regime (trending vs ranging)
    - Detect Break & Retest patterns at key levels
    - Provide HTF context for trade direction
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
                    model_name="llama-3.1-70b-versatile",
                    temperature=0.1
                )
            except Exception as e:
                print(f"Warning: Could not initialize Groq LLM: {e}")
                self.llm = None
    
    def _create_agent(self):
        """Create the CrewAI agent"""
        if not CREWAI_AVAILABLE or not Agent:
            return
        
        self.agent = Agent(
            role="Volume Profile Analyst",
            goal="Analyze market structure through volume profile to identify key levels and determine trading context",
            backstory="""You are a senior market structure analyst with expertise in 
            Volume Profile trading. You've spent years studying how institutional 
            order flow creates value areas and volume nodes. You understand that 
            markets rotate between value areas and that HVN act as magnets for price 
            while LVN represent fast-move zones. You use multi-timeframe analysis 
            (HTF for direction, MTF for setup, STF for entry) to provide complete 
            market context.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    def analyze_symbol(
        self, 
        symbol: str, 
        htf_interval: str = "1d",
        mtf_interval: str = "1h",
        stf_interval: str = "5m"
    ) -> Dict:
        """
        Perform multi-timeframe volume profile analysis
        
        Args:
            symbol: Trading symbol
            htf_interval: High timeframe interval (daily)
            mtf_interval: Medium timeframe interval (hourly)
            stf_interval: Short timeframe interval (5-15 min)
        
        Returns:
            Dictionary with complete volume profile analysis
        """
        try:
            # Fetch data for each timeframe
            htf_data = data_fetcher.fetch_bars(symbol, period="1mo", interval=htf_interval)
            mtf_data = data_fetcher.fetch_bars(symbol, period="5d", interval=mtf_interval)
            stf_data = data_fetcher.fetch_bars(symbol, period="1d", interval=stf_interval)
            
            if htf_data.empty:
                return {
                    "symbol": symbol,
                    "status": "error",
                    "message": "No HTF data available"
                }
            
            # Analyze each timeframe
            htf_analysis = get_volume_profile_analysis(htf_data) if not htf_data.empty else None
            mtf_analysis = get_volume_profile_analysis(mtf_data) if not mtf_data.empty else None
            stf_analysis = get_volume_profile_analysis(stf_data) if not stf_data.empty else None
            
            # Get current price
            current_price = stf_data['close'].iloc[-1] if not stf_data.empty else htf_data['close'].iloc[-1]
            
            # Determine trading context
            context = self._determine_context(htf_analysis, mtf_analysis, stf_analysis, current_price)
            
            return {
                "symbol": symbol,
                "status": "success",
                "agent": "chartist",
                "timestamp": datetime.now().isoformat(),
                "current_price": float(current_price),
                "htf": {
                    "timeframe": htf_interval,
                    "poc": htf_analysis['poc'] if htf_analysis else None,
                    "vah": htf_analysis['vah'] if htf_analysis else None,
                    "val": htf_analysis['val'] if htf_analysis else None,
                    "regime": htf_analysis['regime'] if htf_analysis else None
                },
                "mtf": {
                    "timeframe": mtf_interval,
                    "poc": mtf_analysis['poc'] if mtf_analysis else None,
                    "vah": mtf_analysis['vah'] if mtf_analysis else None,
                    "val": mtf_analysis['val'] if mtf_analysis else None,
                    "regime": mtf_analysis['regime'] if mtf_analysis else None
                },
                "stf": {
                    "timeframe": stf_interval,
                    "poc": stf_analysis['poc'] if stf_analysis else None,
                    "position": stf_analysis['current_position'] if stf_analysis else None
                },
                "key_levels": self._get_key_levels(htf_analysis, mtf_analysis),
                "context": context
            }
            
        except Exception as e:
            return {
                "symbol": symbol,
                "status": "error",
                "message": str(e),
                "agent": "chartist"
            }
    
    def _determine_context(
        self, 
        htf: Optional[Dict], 
        mtf: Optional[Dict], 
        stf: Optional[Dict],
        current_price: float
    ) -> Dict:
        """Determine the overall trading context from multi-timeframe analysis"""
        
        if not htf:
            return {
                "direction": "neutral",
                "strength": 0,
                "description": "Insufficient data"
            }
        
        # HTF determines overall direction
        htf_regime = htf.get('regime', 'ranging')
        htf_position = htf.get('current_position', 'in_value')
        
        # MTF provides setup context
        mtf_regime = mtf.get('regime', 'ranging') if mtf else 'ranging'
        mtf_position = mtf.get('current_position', 'in_value') if mtf else 'in_value'
        
        # Determine direction
        if htf_regime == 'trending_up':
            direction = "bullish"
            strength = 0.7
        elif htf_regime == 'trending_down':
            direction = "bearish"
            strength = 0.7
        elif htf_regime == 'breakout':
            # Determine breakout direction
            if htf_position == 'above_vah':
                direction = "bullish_breakout"
                strength = 0.85
            else:
                direction = "bearish_breakout"
                strength = 0.85
        else:
            direction = "neutral"
            strength = 0.5
        
        # Adjust based on MTF alignment
        if mtf_regime == htf_regime:
            strength = min(1.0, strength + 0.15)  # Aligned = stronger
        elif mtf_regime in ['trending_up', 'trending_down'] and htf_regime == 'ranging':
            direction = "bullish" if mtf_regime == 'trending_up' else "bearish"
            strength = 0.55  # MTF trend in ranging HTF
        
        # Generate description
        if htf and htf.get('poc'):
            poc = htf['poc']
            if current_price > poc * 1.01:
                price_context = f"Price is above HTF POC (${poc:.2f})"
            elif current_price < poc * 0.99:
                price_context = f"Price is below HTF POC (${poc:.2f})"
            else:
                price_context = f"Price is near HTF POC (${poc:.2f})"
        else:
            price_context = "POC not available"
        
        description = f"{htf_regime.replace('_', ' ').title()} market on HTF. {price_context}."
        
        # Determine action
        if direction in ['bullish', 'bullish_breakout'] and strength >= 0.6:
            action = "look_for_longs"
        elif direction in ['bearish', 'bearish_breakout'] and strength >= 0.6:
            action = "look_for_shorts"
        else:
            action = "wait_for_clarity"
        
        return {
            "direction": direction,
            "strength": strength,
            "htf_regime": htf_regime,
            "mtf_regime": mtf_regime,
            "price_position": htf_position,
            "action": action,
            "description": description
        }
    
    def _get_key_levels(self, htf: Optional[Dict], mtf: Optional[Dict]) -> List[Dict]:
        """Extract key levels from all timeframes"""
        levels = []
        
        if htf:
            if htf.get('poc'):
                levels.append({
                    "price": htf['poc'],
                    "type": "poc",
                    "timeframe": "daily",
                    "importance": "high"
                })
            if htf.get('vah'):
                levels.append({
                    "price": htf['vah'],
                    "type": "vah",
                    "timeframe": "daily",
                    "importance": "high"
                })
            if htf.get('val'):
                levels.append({
                    "price": htf['val'],
                    "type": "val",
                    "timeframe": "daily",
                    "importance": "high"
                })
            for hvn in htf.get('hvn', [])[:3]:
                levels.append({
                    "price": hvn,
                    "type": "hvn",
                    "timeframe": "daily",
                    "importance": "medium"
                })
        
        if mtf:
            if mtf.get('poc'):
                levels.append({
                    "price": mtf['poc'],
                    "type": "poc",
                    "timeframe": "hourly",
                    "importance": "medium"
                })
        
        # Sort by importance and price
        levels.sort(key=lambda x: (0 if x['importance'] == 'high' else 1, x['price']))
        
        return levels
    
    def get_agent_status(self) -> Dict:
        """Get current agent status"""
        return {
            "name": "Chartist",
            "role": "Volume Profile Analyst",
            "status": "active" if self.llm else "limited",
            "llm_enabled": self.llm is not None,
            "capabilities": [
                "volume_profile_analysis",
                "poc_vah_val_calculation",
                "hvn_lvn_detection",
                "regime_determination",
                "multi_timeframe_analysis"
            ]
        }
    
    def create_analysis_task(self, symbol: str) -> Task:
        """Create a CrewAI task for symbol analysis"""
        return Task(
            description=f"""Analyze the market structure for {symbol} using Volume Profile.
            
            Consider:
            1. HTF (Daily) - Overall direction and major value areas
            2. MTF (Hourly) - Setup context and intermediate levels
            3. STF (5-15min) - Entry timing and local structure
            
            Identify:
            - Point of Control (POC) - fair value level
            - Value Area High (VAH) and Low (VAL)
            - High Volume Nodes (HVN) - support/resistance
            - Market regime (trending or ranging)
            
            Provide trading context: Should we look for longs, shorts, or wait?""",
            agent=self.agent,
            expected_output="Market structure analysis with key levels and trading context"
        )


# Singleton instance
_chartist_instance = None

def get_chartist(groq_api_key: str = None) -> ChartistAgent:
    """Get or create the Chartist agent singleton"""
    global _chartist_instance
    if _chartist_instance is None:
        _chartist_instance = ChartistAgent(groq_api_key)
    return _chartist_instance


if __name__ == "__main__":
    # Test the agent
    from dotenv import load_dotenv
    load_dotenv()
    
    agent = ChartistAgent()
    
    print("Chartist Agent Status:")
    print(agent.get_agent_status())
    
    print("\n\nAnalyzing SPY (Multi-Timeframe)...")
    result = agent.analyze_symbol('SPY')
    
    print(f"\nSymbol: {result.get('symbol')}")
    print(f"Status: {result.get('status')}")
    print(f"Current Price: ${result.get('current_price', 0):.2f}")
    
    if result.get('status') == 'success':
        htf = result.get('htf', {})
        print(f"\nHTF Analysis ({htf.get('timeframe')}):")
        print(f"  POC: ${htf.get('poc', 0):.2f}")
        print(f"  Value Area: ${htf.get('val', 0):.2f} - ${htf.get('vah', 0):.2f}")
        print(f"  Regime: {htf.get('regime')}")
        
        context = result.get('context', {})
        print(f"\nTrading Context:")
        print(f"  Direction: {context.get('direction')}")
        print(f"  Strength: {context.get('strength', 0):.0%}")
        print(f"  Action: {context.get('action')}")
        print(f"  Description: {context.get('description')}")
        
        print(f"\nKey Levels:")
        for level in result.get('key_levels', [])[:5]:
            print(f"  ${level['price']:.2f} - {level['type'].upper()} ({level['timeframe']})")
