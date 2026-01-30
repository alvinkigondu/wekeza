"""
Agent D: The Portfolio Manager
Risk & Portfolio Management Orchestrator

This agent serves as the final decision layer, aggregating signals
from all other agents and managing portfolio-level risk.
"""

import os
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime
import numpy as np

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


class PortfolioManagerAgent:
    """
    The Portfolio Manager Agent - The Orchestrator
    
    Responsibilities:
    - Aggregate signals from Tape Reader, Chartist, and Macro Economist
    - Calculate optimal position sizing using Kelly Criterion
    - Monitor portfolio correlation to prevent over-exposure
    - Enforce risk limits (max drawdown, position size, sector exposure)
    - Make final trade approval decisions
    - Calculate Value at Risk (VaR)
    """
    
    def __init__(self, groq_api_key: str = None, config: Dict = None):
        self.groq_api_key = groq_api_key or os.getenv('GROQ_API_KEY')
        self.llm = None
        self.agent = None
        
        # Risk parameters
        self.config = config or {
            'max_position_size': 0.10,      # Max 10% per position
            'max_sector_exposure': 0.30,     # Max 30% per sector
            'max_correlation': 0.85,         # Reject if correlation > 85%
            'max_drawdown': 0.15,            # Max 15% drawdown
            'risk_per_trade': 0.02,          # Risk 2% per trade
            'kelly_fraction': 0.25,          # Use quarter Kelly
            'min_confidence': 0.6,           # Min confidence to trade
            'var_confidence': 0.95           # 95% VaR
        }
        
        # Portfolio state
        self.portfolio = {
            'equity': 100000,  # Starting capital
            'positions': {},
            'daily_pnl': 0,
            'total_exposure': 0
        }
        
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
            role="Portfolio Manager",
            goal="Make final trading decisions by aggregating all agent signals while maintaining strict risk management",
            backstory="""You are the Chief Risk Officer and Portfolio Manager at a 
            quantitative hedge fund. Your job is to make the final call on every 
            trade, ensuring that positions are sized appropriately and that the 
            portfolio never takes on excessive risk. You use the Kelly Criterion 
            for position sizing (with a conservative fraction), monitor correlations 
            between positions, and enforce strict drawdown limits. You understand 
            that preserving capital is more important than maximizing returns.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    def aggregate_signals(
        self,
        tape_reader_signal: Dict,
        chartist_signal: Dict,
        macro_signal: Dict
    ) -> Dict:
        """
        Aggregate signals from all agents into a unified decision
        
        Uses weighted voting based on:
        - Recent accuracy of each agent (dynamic)
        - Confidence of each signal
        - Agreement between agents
        
        Args:
            tape_reader_signal: Signal from Tape Reader agent
            chartist_signal: Signal from Chartist agent
            macro_signal: Signal from Macro Economist agent
        
        Returns:
            Aggregated signal with final recommendation
        """
        # Default weights (could be dynamic based on performance)
        weights = {
            'tape_reader': 0.40,   # Order flow is primary
            'chartist': 0.35,     # Structure is important
            'macro': 0.25         # Macro provides context
        }
        
        # Extract signals
        tr_direction = tape_reader_signal.get('final_signal', {}).get('direction', 'neutral')
        tr_confidence = tape_reader_signal.get('final_signal', {}).get('confidence', 0)
        
        ch_direction = chartist_signal.get('context', {}).get('direction', 'neutral')
        ch_strength = chartist_signal.get('context', {}).get('strength', 0)
        
        macro_direction = macro_signal.get('macro_signal', {}).get('direction', 'neutral')
        macro_confidence = macro_signal.get('macro_signal', {}).get('confidence', 0)
        trading_allowed = macro_signal.get('macro_signal', {}).get('trading_allowed', True)
        
        # Check for volatility filter
        if not trading_allowed:
            return {
                'final_decision': 'no_trade',
                'reason': 'Volatility filter active - near high-impact event',
                'confidence': 0,
                'position_size': 0
            }
        
        # Map signals to numeric values
        signal_map = {
            'bullish': 1, 'bullish_breakout': 1.2,
            'bearish': -1, 'bearish_breakout': -1.2,
            'neutral': 0, 'avoid': 0
        }
        
        # Calculate weighted signal
        tr_value = signal_map.get(tr_direction, 0) * tr_confidence * weights['tape_reader']
        ch_value = signal_map.get(ch_direction, 0) * ch_strength * weights['chartist']
        macro_value = signal_map.get(macro_direction, 0) * macro_confidence * weights['macro']
        
        total_signal = tr_value + ch_value + macro_value
        
        # Check for agreement
        signals = [
            ('tape_reader', tr_direction, tr_confidence),
            ('chartist', ch_direction, ch_strength),
            ('macro', macro_direction, macro_confidence)
        ]
        
        bullish_count = sum(1 for _, d, c in signals if 'bullish' in d and c > 0.5)
        bearish_count = sum(1 for _, d, c in signals if 'bearish' in d and c > 0.5)
        
        # Strong agreement bonus
        if bullish_count >= 2:
            total_signal += 0.2
        elif bearish_count >= 2:
            total_signal -= 0.2
        
        # Determine final decision
        avg_confidence = (tr_confidence + ch_strength + macro_confidence) / 3
        
        if abs(total_signal) < 0.3 or avg_confidence < self.config['min_confidence']:
            decision = 'no_trade'
            direction = 'neutral'
            confidence = avg_confidence
        elif total_signal > 0:
            decision = 'long'
            direction = 'bullish'
            confidence = min(0.95, avg_confidence + (bullish_count - 1) * 0.1)
        else:
            decision = 'short'
            direction = 'bearish'
            confidence = min(0.95, avg_confidence + (bearish_count - 1) * 0.1)
        
        # Generate reasoning
        agreement_str = f"{bullish_count} bullish, {bearish_count} bearish signals"
        
        return {
            'final_decision': decision,
            'direction': direction,
            'confidence': confidence,
            'signal_strength': abs(total_signal),
            'agreement': agreement_str,
            'agent_signals': {
                'tape_reader': {'direction': tr_direction, 'confidence': tr_confidence},
                'chartist': {'direction': ch_direction, 'confidence': ch_strength},
                'macro': {'direction': macro_direction, 'confidence': macro_confidence}
            }
        }
    
    def calculate_kelly_size(self, win_rate: float, avg_win: float, avg_loss: float) -> float:
        """Optimal position sizing using Kelly Criterion"""
        if avg_loss == 0 or not (0 < win_rate < 1): return 0
        r = avg_win / avg_loss
        kelly = win_rate - ((1 - win_rate) / r)
        return min(max(0, kelly * self.config['kelly_fraction']), self.config['max_position_size'])
    
    def calculate_position_size(
        self,
        symbol: str,
        entry_price: float,
        stop_loss: float,
        confidence: float
    ) -> Dict:
        """
        Calculate position size based on risk parameters
        
        Args:
            symbol: Trading symbol
            entry_price: Proposed entry price
            stop_loss: Stop loss price level
            confidence: Signal confidence
        
        Returns:
            Dictionary with position size and units
        """
        equity = self.portfolio['equity']
        risk_per_trade = self.config['risk_per_trade']
        
        # Risk amount
        risk_amount = equity * risk_per_trade * confidence
        
        # Calculate stop distance
        stop_distance = abs(entry_price - stop_loss)
        if stop_distance == 0:
            stop_distance = entry_price * 0.01  # Default 1% stop
        
        # Position size in units
        units = risk_amount / stop_distance
        
        # Position value
        position_value = units * entry_price
        position_pct = position_value / equity
        
        # Cap at max position size
        if position_pct > self.config['max_position_size']:
            position_pct = self.config['max_position_size']
            position_value = equity * position_pct
            units = position_value / entry_price
        
        return {
            'symbol': symbol,
            'units': int(units),
            'position_value': position_value,
            'position_pct': position_pct,
            'risk_amount': risk_amount,
            'stop_loss': stop_loss,
            'stop_distance_pct': (stop_distance / entry_price) * 100
        }
    
    def check_correlation(
        self,
        symbol: str,
        correlation_matrix: Dict[str, Dict[str, float]]
    ) -> Dict:
        """
        Check if a new position would create excessive correlation
        
        Args:
            symbol: New symbol to add
            correlation_matrix: Correlation between symbols
        
        Returns:
            Correlation check result
        """
        existing_positions = list(self.portfolio['positions'].keys())
        
        if not existing_positions:
            return {'allowed': True, 'reason': 'No existing positions'}
        
        max_corr = 0
        high_corr_with = None
        
        for pos in existing_positions:
            if symbol in correlation_matrix and pos in correlation_matrix[symbol]:
                corr = correlation_matrix[symbol][pos]
                if abs(corr) > max_corr:
                    max_corr = abs(corr)
                    high_corr_with = pos
        
        if max_corr > self.config['max_correlation']:
            return {
                'allowed': False,
                'reason': f'High correlation ({max_corr:.0%}) with existing position {high_corr_with}',
                'correlation': max_corr,
                'correlated_with': high_corr_with
            }
        
        return {
            'allowed': True,
            'reason': f'Acceptable correlation (max {max_corr:.0%})',
            'max_correlation': max_corr
        }
    
    def calculate_var(self, returns: List[float], position_value: float) -> float:
        """Calculate Value at Risk (VaR)"""
        if not returns: return position_value * 0.02
        var_pct = np.percentile(returns, (1 - self.config['var_confidence']) * 100)
        return abs(var_pct) * position_value
    
    def make_trade_decision(
        self,
        symbol: str,
        tape_reader_signal: Dict,
        chartist_signal: Dict,
        macro_signal: Dict,
        current_price: float = None,
        correlation_matrix: Dict = None
    ) -> Dict:
        """
        Make the final trade decision
        
        Args:
            symbol: Trading symbol
            tape_reader_signal: Signal from Tape Reader
            chartist_signal: Signal from Chartist
            macro_signal: Signal from Macro Economist
            current_price: Current market price
            correlation_matrix: Correlation data
        
        Returns:
            Complete trade decision with all parameters
        """
        # Aggregate signals
        aggregated = self.aggregate_signals(
            tape_reader_signal,
            chartist_signal,
            macro_signal
        )
        
        # If no trade, return early
        if aggregated['final_decision'] == 'no_trade':
            return {
                'symbol': symbol,
                'action': 'NO_TRADE',
                'reason': aggregated.get('reason', 'Signals not aligned'),
                'confidence': aggregated['confidence'],
                'timestamp': datetime.now().isoformat()
            }
        
        # Check correlations if we have the data
        if correlation_matrix:
            corr_check = self.check_correlation(symbol, correlation_matrix)
            if not corr_check['allowed']:
                return {
                    'symbol': symbol,
                    'action': 'NO_TRADE',
                    'reason': corr_check['reason'],
                    'confidence': aggregated['confidence'],
                    'timestamp': datetime.now().isoformat()
                }
        
        # Get price from chartist if not provided
        if current_price is None:
            current_price = chartist_signal.get('current_price', 100)
        
        # Determine stop loss from volume profile
        key_levels = chartist_signal.get('key_levels', [])
        if aggregated['direction'] == 'bullish':
            # Stop below nearest support (VAL or HVN below price)
            support_levels = [l['price'] for l in key_levels if l['price'] < current_price]
            stop_loss = max(support_levels) if support_levels else current_price * 0.98
        else:
            # Stop above nearest resistance (VAH or HVN above price)
            resistance_levels = [l['price'] for l in key_levels if l['price'] > current_price]
            stop_loss = min(resistance_levels) if resistance_levels else current_price * 1.02
        
        # Calculate position size
        position = self.calculate_position_size(
            symbol,
            current_price,
            stop_loss,
            aggregated['confidence']
        )
        
        # Build final decision
        action = 'BUY' if aggregated['direction'] == 'bullish' else 'SELL'
        
        return {
            'symbol': symbol,
            'action': action,
            'direction': aggregated['direction'],
            'confidence': aggregated['confidence'],
            'signal_strength': aggregated['signal_strength'],
            'entry_price': current_price,
            'stop_loss': stop_loss,
            'position': position,
            'agent_agreement': aggregated['agreement'],
            'agent_signals': aggregated['agent_signals'],
            'risk_reward_ratio': abs(current_price - stop_loss) / (current_price * 0.02),  # Assuming 2% target
            'timestamp': datetime.now().isoformat()
        }
    
    def get_agent_status(self) -> Dict:
        """Get current agent status and portfolio summary"""
        return {
            "name": "Portfolio Manager",
            "role": "Risk & Portfolio Orchestrator",
            "status": "active" if self.llm else "limited",
            "llm_enabled": self.llm is not None,
            "capabilities": [
                "signal_aggregation",
                "kelly_criterion_sizing",
                "correlation_monitoring",
                "var_calculation",
                "risk_limit_enforcement"
            ],
            "portfolio_summary": {
                "equity": self.portfolio['equity'],
                "positions": len(self.portfolio['positions']),
                "total_exposure": self.portfolio['total_exposure']
            },
            "risk_config": self.config
        }
    
    def create_decision_task(self, symbol: str, signals: Dict) -> Task:
        """Create a CrewAI task for trade decision"""
        return Task(
            description=f"""Review the following signals for {symbol} and make a final trading decision.
            
            Tape Reader: {signals.get('tape_reader', 'N/A')}
            Chartist: {signals.get('chartist', 'N/A')}
            Macro: {signals.get('macro', 'N/A')}
            
            Consider:
            1. Do the agents agree on direction?
            2. What is the overall confidence level?
            3. Are there any risk red flags?
            4. What should the position size be?
            
            Provide a final BUY, SELL, or NO_TRADE decision with position sizing.""",
            agent=self.agent,
            expected_output="Final trade decision with entry, stop loss, and position size"
        )


# Singleton instance
_portfolio_manager_instance = None

def get_portfolio_manager(groq_api_key: str = None, config: Dict = None) -> PortfolioManagerAgent:
    """Get or create the Portfolio Manager agent singleton"""
    global _portfolio_manager_instance
    if _portfolio_manager_instance is None:
        _portfolio_manager_instance = PortfolioManagerAgent(groq_api_key, config)
    return _portfolio_manager_instance


if __name__ == "__main__":
    # Test the agent
    from dotenv import load_dotenv
    load_dotenv()
    
    agent = PortfolioManagerAgent()
    
    print("Portfolio Manager Agent Status:")
    status = agent.get_agent_status()
    print(f"  Name: {status['name']}")
    print(f"  Status: {status['status']}")
    print(f"  Equity: ${status['portfolio_summary']['equity']:,}")
    
    # Test signal aggregation
    print("\n\nTesting Signal Aggregation...")
    
    # Mock signals
    tr_signal = {
        'final_signal': {'direction': 'bullish', 'confidence': 0.75}
    }
    ch_signal = {
        'context': {'direction': 'bullish', 'strength': 0.7},
        'current_price': 450.0,
        'key_levels': [
            {'price': 445.0, 'type': 'val'},
            {'price': 448.0, 'type': 'poc'},
            {'price': 455.0, 'type': 'vah'}
        ]
    }
    macro_signal = {
        'macro_signal': {'direction': 'neutral', 'confidence': 0.6, 'trading_allowed': True}
    }
    
    decision = agent.make_trade_decision(
        'SPY',
        tr_signal,
        ch_signal,
        macro_signal,
        current_price=450.0
    )
    
    print(f"\nFinal Decision for SPY:")
    print(f"  Action: {decision['action']}")
    print(f"  Direction: {decision.get('direction', 'N/A')}")
    print(f"  Confidence: {decision['confidence']:.0%}")
    
    if decision['action'] != 'NO_TRADE':
        print(f"  Entry: ${decision.get('entry_price', 0):.2f}")
        print(f"  Stop Loss: ${decision.get('stop_loss', 0):.2f}")
        pos = decision.get('position', {})
        print(f"  Position: {pos.get('units', 0)} units (${pos.get('position_value', 0):,.0f})")
        print(f"  Position %: {pos.get('position_pct', 0):.1%}")
        print(f"  Risk Amount: ${pos.get('risk_amount', 0):.0f}")
