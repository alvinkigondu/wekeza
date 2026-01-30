"""
Agent C: The Macro Economist
News, Sentiment & Economic Event Analyst

This agent analyzes macro economic factors, news sentiment,
and creates volatility filters around major events.
"""

import os
import sys
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json

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


class MacroEconomistAgent:
    """
    The Macro Economist Agent - Specialized in Fundamental Analysis
    
    Responsibilities:
    - Monitor economic calendar (FOMC, CPI, NFP, etc.)
    - Analyze news sentiment for trading symbols
    - Create volatility filters around major events
    - Provide macro context for trading decisions
    - Track sector rotation and market themes
    """
    
    def __init__(self, groq_api_key: str = None):
        self.groq_api_key = groq_api_key or os.getenv('GROQ_API_KEY')
        self.llm = None
        self.agent = None
        self._initialize_llm()
        self._create_agent()
        
        # Economic calendar cache
        self.economic_events = []
        
        # Major events that cause volatility
        self.high_impact_events = [
            "FOMC", "Fed", "Interest Rate",
            "CPI", "Inflation", "PPI",
            "NFP", "Non-Farm", "Employment", "Jobs",
            "GDP", "Earnings", "IPO"
        ]
    
    def _initialize_llm(self):
        """Initialize the Groq LLM"""
        if not GROQ_AVAILABLE or not ChatGroq:
            return
        
        if self.groq_api_key and self.groq_api_key != 'your_groq_api_key_here':
            try:
                self.llm = ChatGroq(
                    groq_api_key=self.groq_api_key,
                    model_name="llama-3.1-70b-versatile",
                    temperature=0.2
                )
            except Exception as e:
                print(f"Warning: Could not initialize Groq LLM: {e}")
                self.llm = None
    
    def _create_agent(self):
        """Create the CrewAI agent"""
        if not CREWAI_AVAILABLE or not Agent:
            return
        
        self.agent = Agent(
            role="Macro Economist",
            goal="Analyze macroeconomic factors and news to provide trading context and identify event-driven opportunities and risks",
            backstory="""You are a macro economist and financial analyst who spent 
            15 years at Goldman Sachs before becoming a quantitative strategist. 
            You have a deep understanding of how economic events, central bank policy, 
            and geopolitical factors affect asset prices across stocks, forex, crypto, 
            and commodities. You know that trading around major events like FOMC 
            and CPI requires caution due to increased volatility and potential 
            for gap moves.""",
            verbose=True,
            allow_delegation=False,
            llm=self.llm
        )
    
    async def analyze_sentiment_with_llm(self, symbol: str, news_headlines: List[str]) -> Dict:
        """
        Use LLM to analyze news sentiment
        
        Args:
            symbol: Trading symbol
            news_headlines: List of news headlines
        
        Returns:
            Sentiment analysis results
        """
        if not self.llm or not news_headlines:
            return {
                "sentiment": 0,
                "magnitude": 0,
                "summary": "No LLM available or no headlines to analyze"
            }
        
        try:
            prompt = f"""Analyze the following news headlines for {symbol} and provide:
1. Sentiment score from -1 (very bearish) to +1 (very bullish)
2. Key themes or concerns mentioned
3. Short-term trading implication

Headlines:
{chr(10).join(f'- {h}' for h in news_headlines[:10])}

Respond in JSON format:
{{"sentiment": <float>, "themes": [<str>], "implication": "<str>", "summary": "<str>"}}"""

            response = await self.llm.ainvoke(prompt)
            content = response.content
            
            # Try to parse JSON from response
            try:
                # Find JSON in response
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    result = json.loads(content[start:end])
                    return result
            except json.JSONDecodeError:
                pass
            
            return {
                "sentiment": 0,
                "themes": [],
                "summary": content[:200]
            }
            
        except Exception as e:
            return {
                "sentiment": 0,
                "error": str(e)
            }
    
    def analyze_basic_sentiment(self, headlines: List[str]) -> Dict:
        """
        Basic sentiment analysis without LLM (fallback)
        Uses simple keyword matching
        """
        if not headlines:
            return {"sentiment": 0, "magnitude": 0}
        
        bullish_keywords = [
            'surge', 'rally', 'bullish', 'growth', 'beat', 'exceeds',
            'strong', 'gains', 'rises', 'jumps', 'soars', 'upgrade',
            'outperform', 'breakout', 'record', 'positive'
        ]
        
        bearish_keywords = [
            'drop', 'fall', 'bearish', 'decline', 'miss', 'weak',
            'losses', 'tumbles', 'plunges', 'downgrade', 'crash',
            'concern', 'fear', 'negative', 'slump', 'cuts'
        ]
        
        bullish_count = 0
        bearish_count = 0
        
        for headline in headlines:
            headline_lower = headline.lower()
            bullish_count += sum(1 for word in bullish_keywords if word in headline_lower)
            bearish_count += sum(1 for word in bearish_keywords if word in headline_lower)
        
        total = bullish_count + bearish_count
        if total == 0:
            return {"sentiment": 0, "magnitude": 0}
        
        sentiment = (bullish_count - bearish_count) / total
        magnitude = min(1.0, total / (len(headlines) * 2))
        
        return {
            "sentiment": sentiment,
            "magnitude": magnitude,
            "bullish_signals": bullish_count,
            "bearish_signals": bearish_count
        }
    
    def check_volatility_filter(self, minutes_buffer: int = 30) -> Dict:
        """
        Check if we should avoid trading due to upcoming high-impact events
        
        Args:
            minutes_buffer: Minutes before/after event to filter
        
        Returns:
            Dictionary with filter status and event info
        """
        now = datetime.now()
        
        # Check for any high-impact events within buffer
        for event in self.economic_events:
            event_time = event.get('datetime')
            if event_time:
                time_to_event = (event_time - now).total_seconds() / 60
                
                if abs(time_to_event) <= minutes_buffer:
                    return {
                        "filter_active": True,
                        "reason": f"Near high-impact event: {event.get('name')}",
                        "event": event.get('name'),
                        "minutes_to_event": time_to_event,
                        "recommendation": "AVOID_TRADING"
                    }
        
        return {
            "filter_active": False,
            "reason": "No imminent high-impact events",
            "recommendation": "TRADING_ALLOWED"
        }
    
    def get_market_context(self) -> Dict:
        """
        Get overall macro market context
        
        Returns current market themes and macro factors
        """
        # In a real implementation, this would fetch from economic APIs
        # For demo, we'll provide reasonable defaults
        
        context = {
            "risk_appetite": "neutral",
            "volatility_regime": "normal",
            "key_themes": [
                "Fed policy outlook",
                "Inflation concerns",
                "Earnings season"
            ],
            "sector_rotation": {
                "leading": ["Technology", "Financials"],
                "lagging": ["Utilities", "Consumer Staples"]
            },
            "correlation_alert": False,
            "recommendation": "Normal trading conditions"
        }
        
        return context
    
    def analyze_symbol(self, symbol: str, news: List[str] = None) -> Dict:
        """
        Complete macro analysis for a symbol
        
        Args:
            symbol: Trading symbol
            news: Optional list of news headlines
        
        Returns:
            Dictionary with macro analysis
        """
        try:
            # Basic sentiment if no news provided
            if not news:
                news = []  # Would fetch from API in production
            
            sentiment = self.analyze_basic_sentiment(news)
            volatility_filter = self.check_volatility_filter()
            market_context = self.get_market_context()
            
            # Determine macro signal
            if volatility_filter['filter_active']:
                macro_signal = "avoid"
                confidence = 0.9
            elif sentiment['sentiment'] > 0.3:
                macro_signal = "bullish"
                confidence = min(0.8, 0.5 + abs(sentiment['sentiment']))
            elif sentiment['sentiment'] < -0.3:
                macro_signal = "bearish"
                confidence = min(0.8, 0.5 + abs(sentiment['sentiment']))
            else:
                macro_signal = "neutral"
                confidence = 0.5
            
            return {
                "symbol": symbol,
                "status": "success",
                "agent": "macro_economist",
                "timestamp": datetime.now().isoformat(),
                "sentiment": sentiment,
                "volatility_filter": volatility_filter,
                "market_context": market_context,
                "macro_signal": {
                    "direction": macro_signal,
                    "confidence": confidence,
                    "trading_allowed": not volatility_filter['filter_active']
                }
            }
            
        except Exception as e:
            return {
                "symbol": symbol,
                "status": "error",
                "message": str(e),
                "agent": "macro_economist"
            }
    
    def get_agent_status(self) -> Dict:
        """Get current agent status"""
        return {
            "name": "Macro Economist",
            "role": "Fundamental Analyst",
            "status": "active" if self.llm else "limited",
            "llm_enabled": self.llm is not None,
            "capabilities": [
                "sentiment_analysis",
                "economic_calendar",
                "volatility_filter",
                "sector_rotation",
                "market_context"
            ]
        }
    
    def create_analysis_task(self, symbol: str, news: List[str] = None) -> Task:
        """Create a CrewAI task for macro analysis"""
        news_context = f"Recent headlines: {', '.join(news[:5])}" if news else "No recent news available"
        
        return Task(
            description=f"""Analyze the macro environment for {symbol}.
            
            {news_context}
            
            Consider:
            1. Overall market sentiment
            2. Sector performance and rotation
            3. Upcoming economic events
            4. Volatility conditions
            
            Should any volatility filter be active? Is trading recommended?""",
            agent=self.agent,
            expected_output="Macro analysis with sentiment, event risk, and trading recommendation"
        )


# Singleton instance
_macro_economist_instance = None

def get_macro_economist(groq_api_key: str = None) -> MacroEconomistAgent:
    """Get or create the Macro Economist agent singleton"""
    global _macro_economist_instance
    if _macro_economist_instance is None:
        _macro_economist_instance = MacroEconomistAgent(groq_api_key)
    return _macro_economist_instance


if __name__ == "__main__":
    # Test the agent
    from dotenv import load_dotenv
    load_dotenv()
    
    agent = MacroEconomistAgent()
    
    print("Macro Economist Agent Status:")
    print(agent.get_agent_status())
    
    # Test with sample headlines
    sample_news = [
        "Fed signals potential rate cut in 2024 amid cooling inflation",
        "Tech stocks surge on strong earnings from Microsoft and Apple",
        "Oil prices drop as demand concerns grow in China",
        "Bitcoin rallies past $45,000 on ETF approval hopes",
        "Nvidia stock jumps on AI chip demand outlook"
    ]
    
    print("\n\nAnalyzing market with sample news...")
    result = agent.analyze_symbol('SPY', sample_news)
    
    print(f"\nSymbol: {result.get('symbol')}")
    print(f"Status: {result.get('status')}")
    
    if result.get('status') == 'success':
        sentiment = result.get('sentiment', {})
        print(f"\nSentiment:")
        print(f"  Score: {sentiment.get('sentiment', 0):.2f}")
        print(f"  Magnitude: {sentiment.get('magnitude', 0):.2f}")
        
        vol_filter = result.get('volatility_filter', {})
        print(f"\nVolatility Filter:")
        print(f"  Active: {vol_filter.get('filter_active')}")
        print(f"  Reason: {vol_filter.get('reason')}")
        
        macro = result.get('macro_signal', {})
        print(f"\nMacro Signal:")
        print(f"  Direction: {macro.get('direction')}")
        print(f"  Confidence: {macro.get('confidence', 0):.0%}")
        print(f"  Trading Allowed: {macro.get('trading_allowed')}")
