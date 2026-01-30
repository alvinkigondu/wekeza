import {
  AgentState,
  AgentRole,
  AgentStatus,
  OrderBookLevel,
  Trade,
  SignalDirection,
  ConsensusSignal,
  AgentSignal,
  SentimentData,
  SentimentSource,
  RiskMetrics,
  FootprintCell
} from '../types';
import { riskService } from './riskService';

type Listener = (data: any) => void;

class MockWebSocketService {
  private listeners: Map<string, Listener[]> = new Map();
  private intervalIds: number[] = [];
  private isConnected = false;
  private isUsingRealData = false;

  // Simulation State
  private currentPrice = 4150.00;
  private currentEquity = 1245892.45;
  private priceHistory: { time: number; price: number; vwap: number }[] = [];
  private recentTrades: Trade[] = [];

  // Agent weights for voting system
  private agentWeights: Map<AgentRole, number> = new Map([
    [AgentRole.OrderFlow, 0.20],
    [AgentRole.VolumeProfile, 0.15],
    [AgentRole.TechnicalAnalysis, 0.10],
    [AgentRole.Sentiment, 0.15],
    [AgentRole.MacroEconomic, 0.10],
    [AgentRole.RiskManagement, 0.15],
    [AgentRole.Portfolio, 0.05],
    [AgentRole.Execution, 0.05],
    [AgentRole.Compliance, 0.05],
  ]);

  // Mock Agents Configuration
  private agents: AgentState[] = [
    { id: '1', role: AgentRole.MarketData, status: AgentStatus.Processing, lastMessage: 'Ingesting Tick Data', confidence: 99, latency: 5, signal: 'NEUTRAL', weight: 0 },
    { id: '2', role: AgentRole.OrderFlow, status: AgentStatus.Processing, lastMessage: 'Calculating Buy Imbalance', confidence: 85, latency: 12, signal: 'BUY', weight: 0.20 },
    { id: '3', role: AgentRole.VolumeProfile, status: AgentStatus.Idle, lastMessage: 'Value Area Updated', confidence: 92, latency: 0, signal: 'NEUTRAL', weight: 0.15 },
    { id: '4', role: AgentRole.TechnicalAnalysis, status: AgentStatus.Processing, lastMessage: 'RSI Divergence Detected', confidence: 78, latency: 25, signal: 'SELL', weight: 0.10 },
    { id: '5', role: AgentRole.Sentiment, status: AgentStatus.Idle, lastMessage: 'News Feed Clean', confidence: 60, latency: 0, signal: 'NEUTRAL', weight: 0.15 },
    { id: '6', role: AgentRole.MacroEconomic, status: AgentStatus.Idle, lastMessage: 'Monitoring FOMC', confidence: 100, latency: 0, signal: 'NEUTRAL', weight: 0.10 },
    { id: '7', role: AgentRole.RiskManagement, status: AgentStatus.Processing, lastMessage: 'Checking VaR Limits', confidence: 99, latency: 2, signal: 'NEUTRAL', weight: 0.15 },
    { id: '8', role: AgentRole.Portfolio, status: AgentStatus.Idle, lastMessage: 'Rebalancing Scheduled', confidence: 100, latency: 0, signal: 'NEUTRAL', weight: 0.05 },
    { id: '9', role: AgentRole.Execution, status: AgentStatus.Transmitting, lastMessage: 'Routing Order', confidence: 98, latency: 15, signal: 'NEUTRAL', weight: 0.05 },
    { id: '10', role: AgentRole.Compliance, status: AgentStatus.Processing, lastMessage: 'Audit Log OK', confidence: 100, latency: 1, signal: 'NEUTRAL', weight: 0.05 },
    { id: '11', role: AgentRole.StrategyOrchestrator, status: AgentStatus.Processing, lastMessage: 'Synthesizing Signals', confidence: 94, latency: 45, signal: 'BUY', weight: 0 },
    { id: '12', role: AgentRole.LLMGateway, status: AgentStatus.Idle, lastMessage: 'Model Ready (Gemini-2.5)', confidence: 100, latency: 0, signal: 'NEUTRAL', weight: 0 },
  ];

  // Sentiment data
  private sentimentSources: SentimentSource[] = [
    { id: '1', type: 'news', title: 'Fed signals potential rate pause in January', source: 'Reuters', sentiment: 0.4, magnitude: 0.7, timestamp: Date.now() - 300000, keywords: ['fed', 'rates', 'dovish'] },
    { id: '2', type: 'earnings', title: 'NVDA beats Q3 estimates by 12%', source: 'Bloomberg', sentiment: 0.8, magnitude: 0.9, timestamp: Date.now() - 600000, keywords: ['nvidia', 'earnings', 'ai'] },
    { id: '3', type: 'news', title: 'China manufacturing PMI contracts', source: 'WSJ', sentiment: -0.5, magnitude: 0.6, timestamp: Date.now() - 900000, keywords: ['china', 'manufacturing', 'contraction'] },
    { id: '4', type: 'analyst', title: 'Goldman upgrades tech sector outlook', source: 'Goldman Sachs', sentiment: 0.6, magnitude: 0.8, timestamp: Date.now() - 1200000, keywords: ['tech', 'upgrade', 'bullish'] },
    { id: '5', type: 'social', title: 'Retail sentiment turns cautiously optimistic', source: 'Social Aggregate', sentiment: 0.2, magnitude: 0.4, timestamp: Date.now() - 1500000, keywords: ['retail', 'sentiment', 'options'] },
  ];

  constructor() {
    // Initialize some history
    let price = this.currentPrice;
    for (let i = 0; i < 50; i++) {
      price = price + (Math.random() - 0.5) * 2;
      this.priceHistory.push({
        time: Date.now() - (50 - i) * 1000,
        price: price,
        vwap: price + (Math.random() - 0.5),
      });
    }
    this.currentPrice = price;
  }

  connect() {
    if (this.isConnected) return;
    this.isConnected = true;

    // Fast updates: Price/Ticker (100ms)
    // Only run simulation if NOT using real data
    const marketInterval = window.setInterval(() => {
      if (!this.isUsingRealData) {
        this.simulateMarketData();
      }
    }, 100);

    // Medium updates: Order Book & Agents (1s)
    const agentInterval = window.setInterval(() => {
      this.simulateAgents();
      this.simulateOrderBook();
      this.simulateConsensusSignal();
    }, 1000);

    // Slow updates: Trades & Portfolio & Risk (2.5s)
    const tradeInterval = window.setInterval(() => {
      this.simulateTrade();
      this.simulateRiskMetrics();
    }, 2500);

    // Sentiment updates (5s)
    const sentimentInterval = window.setInterval(() => {
      this.simulateSentiment();
    }, 5000);

    // Footprint updates (2s)
    const footprintInterval = window.setInterval(() => {
      this.simulateFootprint();
    }, 2000);

    this.intervalIds.push(marketInterval, agentInterval, tradeInterval, sentimentInterval, footprintInterval);

    // Emit initial state immediately
    this.emit('agentUpdate', this.agents);
    this.emit('riskUpdate', riskService.generateMockRiskMetrics(this.currentEquity));
    this.simulateSentiment();
    this.simulateConsensusSignal();
  }

  disconnect() {
    this.intervalIds.forEach(id => clearInterval(id));
    this.intervalIds = [];
    this.isConnected = false;
  }

  on(event: string, callback: Listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);

    // Send immediate initial data if available
    if (event === 'marketUpdate' && this.priceHistory.length > 0) {
      callback(this.priceHistory[this.priceHistory.length - 1]);
    }
  }

  off(event: string, callback: Listener) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(event, callbacks.filter(c => c !== callback));
    }
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // --- Simulation Logic ---

  private simulateMarketData() {
    // Random Walk
    const change = (Math.random() - 0.5) * 1.5;
    this.currentPrice += change;
    const vwap = this.currentPrice + (Math.random() - 0.5) * 0.5;

    const tick = {
      time: Date.now(),
      price: this.currentPrice,
      vwap: vwap
    };

    this.emit('marketUpdate', tick);
  }

  private simulateOrderBook() {
    const midPrice = this.currentPrice;
    const levels: OrderBookLevel[] = [];

    // Generate asymmetric depth based on trend
    const trend = Math.random() > 0.5 ? 1 : -1;

    // Bids
    for (let i = 1; i <= 10; i++) {
      const sizeBase = Math.floor(Math.random() * 200) + 50;
      levels.push({
        price: midPrice - i * 0.25,
        size: trend === 1 ? sizeBase * 1.5 : sizeBase, // More bids in uptrend
        total: 0,
        type: 'bid'
      });
    }
    // Asks
    for (let i = 1; i <= 10; i++) {
      const sizeBase = Math.floor(Math.random() * 200) + 50;
      levels.push({
        price: midPrice + i * 0.25,
        size: trend === -1 ? sizeBase * 1.5 : sizeBase, // More asks in downtrend
        total: 0,
        type: 'ask'
      });
    }

    this.emit('orderBookUpdate', levels.sort((a, b) => b.price - a.price));
  }

  private simulateAgents() {
    const signals: SignalDirection[] = ['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'];

    this.agents = this.agents.map(agent => {
      // 30% chance to update state
      if (Math.random() > 0.7) {
        const statuses = [AgentStatus.Processing, AgentStatus.Idle, AgentStatus.Transmitting];
        // Bias towards Processing
        const newStatus = Math.random() > 0.4 ? AgentStatus.Processing : statuses[Math.floor(Math.random() * statuses.length)];

        const latency = newStatus === AgentStatus.Idle ? 0 : Math.floor(Math.random() * 45) + 5;
        const confidence = Math.min(100, Math.max(60, agent.confidence + (Math.random() - 0.5) * 5));

        // Update signal occasionally
        let newSignal = agent.signal;
        if (Math.random() > 0.8) {
          newSignal = signals[Math.floor(Math.random() * signals.length)];
        }

        return {
          ...agent,
          status: newStatus,
          latency,
          confidence: Math.floor(confidence),
          signal: newSignal
        };
      }
      return agent;
    });

    this.emit('agentUpdate', this.agents);
  }

  private simulateTrade() {
    const isBuy = Math.random() > 0.5;
    const size = Math.floor(Math.random() * 10) + 1;
    const pnl = (Math.random() - 0.4) * 500; // Slightly biased towards profit

    this.currentEquity += pnl;

    const trade: Trade = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: Math.random() > 0.5 ? 'ES_F' : 'BTC-PERP',
      side: isBuy ? 'BUY' : 'SELL',
      price: this.currentPrice,
      size: size,
      timestamp: Date.now(),
      agentId: this.agents[Math.floor(Math.random() * this.agents.length)].id,
      pnl: pnl,
      leeReadyClassification: isBuy ? 'buyer-initiated' : 'seller-initiated'
    };

    this.recentTrades.push(trade);
    if (this.recentTrades.length > 100) this.recentTrades.shift();

    this.emit('tradeUpdate', trade);
    this.emit('portfolioUpdate', { timestamp: new Date().toLocaleTimeString(), equity: this.currentEquity });
  }

  private simulateRiskMetrics() {
    const metrics = riskService.generateMockRiskMetrics(this.currentEquity);
    this.emit('riskUpdate', metrics);
  }

  private simulateSentiment() {
    // Occasionally add new sentiment sources
    if (Math.random() > 0.7) {
      const headlines = [
        { title: 'Tech earnings season exceeds expectations', sentiment: 0.6 },
        { title: 'Inflation data comes in below forecast', sentiment: 0.4 },
        { title: 'Geopolitical tensions rise in key regions', sentiment: -0.5 },
        { title: 'Consumer spending shows resilience', sentiment: 0.3 },
        { title: 'Bond yields stabilize after volatility', sentiment: 0.1 },
        { title: 'Energy prices spike on supply concerns', sentiment: -0.4 },
        { title: 'AI sector sees continued investment', sentiment: 0.7 },
        { title: 'Central bank signals hawkish stance', sentiment: -0.3 },
      ];

      const headline = headlines[Math.floor(Math.random() * headlines.length)];
      const sources = ['Reuters', 'Bloomberg', 'WSJ', 'CNBC', 'FT'];

      this.sentimentSources.unshift({
        id: Math.random().toString(36).substr(2, 9),
        type: Math.random() > 0.5 ? 'news' : 'analyst',
        title: headline.title,
        source: sources[Math.floor(Math.random() * sources.length)],
        sentiment: headline.sentiment + (Math.random() - 0.5) * 0.2,
        magnitude: 0.5 + Math.random() * 0.5,
        timestamp: Date.now(),
        keywords: headline.title.toLowerCase().split(' ').slice(0, 3)
      });

      // Keep only last 10 sources
      this.sentimentSources = this.sentimentSources.slice(0, 10);
    }

    const avgSentiment = this.sentimentSources.reduce((sum, s) => sum + s.sentiment, 0) / this.sentimentSources.length;
    const avgMagnitude = this.sentimentSources.reduce((sum, s) => sum + s.magnitude, 0) / this.sentimentSources.length;

    const sentimentData: SentimentData = {
      overallScore: avgSentiment,
      magnitude: avgMagnitude,
      trend: avgSentiment > 0.2 ? 'improving' : avgSentiment < -0.2 ? 'deteriorating' : 'stable',
      sources: this.sentimentSources,
      keywords: [
        { keyword: 'fed', count: 12, sentiment: 0.3, trend: 'up' },
        { keyword: 'earnings', count: 8, sentiment: 0.6, trend: 'up' },
        { keyword: 'inflation', count: 6, sentiment: -0.2, trend: 'stable' },
        { keyword: 'ai', count: 15, sentiment: 0.7, trend: 'up' },
        { keyword: 'rates', count: 10, sentiment: -0.1, trend: 'down' },
      ],
      lastUpdated: Date.now()
    };

    this.emit('sentimentUpdate', sentimentData);
  }

  private simulateConsensusSignal() {
    const signalValues: { [key in SignalDirection]: number } = {
      'STRONG_BUY': 2,
      'BUY': 1,
      'NEUTRAL': 0,
      'SELL': -1,
      'STRONG_SELL': -2
    };

    const votingAgents = this.agents.filter(a =>
      a.role !== AgentRole.MarketData &&
      a.role !== AgentRole.StrategyOrchestrator &&
      a.role !== AgentRole.LLMGateway
    );

    const agentSignals: AgentSignal[] = votingAgents.map(agent => ({
      agentId: agent.id,
      agentRole: agent.role,
      signal: agent.signal || 'NEUTRAL',
      confidence: agent.confidence,
      weight: agent.weight || 0,
      reasoning: this.getAgentReasoning(agent.role, agent.signal || 'NEUTRAL'),
      timestamp: Date.now()
    }));

    // Calculate weighted vote
    let weightedSum = 0;
    let totalWeight = 0;
    const breakdown = { strongBuy: 0, buy: 0, neutral: 0, sell: 0, strongSell: 0 };

    agentSignals.forEach(signal => {
      weightedSum += signalValues[signal.signal] * signal.weight * (signal.confidence / 100);
      totalWeight += signal.weight;

      switch (signal.signal) {
        case 'STRONG_BUY': breakdown.strongBuy++; break;
        case 'BUY': breakdown.buy++; break;
        case 'NEUTRAL': breakdown.neutral++; break;
        case 'SELL': breakdown.sell++; break;
        case 'STRONG_SELL': breakdown.strongSell++; break;
      }
    });

    const normalizedScore = totalWeight > 0 ? (weightedSum / totalWeight) * 50 : 0;
    const strength = Math.max(-100, Math.min(100, normalizedScore));

    let direction: SignalDirection;
    if (strength > 60) direction = 'STRONG_BUY';
    else if (strength > 20) direction = 'BUY';
    else if (strength > -20) direction = 'NEUTRAL';
    else if (strength > -60) direction = 'SELL';
    else direction = 'STRONG_SELL';

    const avgConfidence = agentSignals.reduce((sum, s) => sum + s.confidence, 0) / agentSignals.length;

    const consensus: ConsensusSignal = {
      direction,
      strength,
      confidence: avgConfidence,
      agentSignals,
      votingBreakdown: breakdown,
      recommendation: this.getRecommendation(direction, strength),
      timestamp: Date.now()
    };

    this.emit('consensusUpdate', consensus);
  }

  private simulateFootprint() {
    // Generate footprint cells for the current price area
    const cells: FootprintCell[] = [];
    const basePrice = Math.floor(this.currentPrice);

    for (let i = -5; i <= 5; i++) {
      const price = basePrice + i;
      const buyVol = Math.floor(Math.random() * 500) + 50;
      const sellVol = Math.floor(Math.random() * 500) + 50;
      const totalVol = buyVol + sellVol;

      cells.push({
        price,
        time: Date.now(),
        buyVolume: buyVol,
        sellVolume: sellVol,
        totalVolume: totalVol,
        tradeCount: Math.floor(Math.random() * 50) + 10,
        bidDepth: Math.floor(Math.random() * 200) + 50,
        askDepth: Math.floor(Math.random() * 200) + 50,
        delta: buyVol - sellVol,
        imbalance: (buyVol - sellVol) / totalVol
      });
    }

    this.emit('footprintUpdate', cells);
  }

  private getAgentReasoning(role: AgentRole, signal: SignalDirection): string {
    const reasonings: { [key in AgentRole]?: { [key in SignalDirection]?: string } } = {
      [AgentRole.OrderFlow]: {
        'STRONG_BUY': 'Heavy aggressive buying detected at VWAP',
        'BUY': 'Net positive delta with absorption at support',
        'NEUTRAL': 'Order flow balanced, no clear direction',
        'SELL': 'Sellers aggressive at value area high',
        'STRONG_SELL': 'Massive selling pressure breaking support'
      },
      [AgentRole.VolumeProfile]: {
        'STRONG_BUY': 'Price above VPOC with high volume acceptance',
        'BUY': 'Testing value area low with buying response',
        'NEUTRAL': 'Price oscillating around VPOC',
        'SELL': 'Rejection at value area high',
        'STRONG_SELL': 'Breaking below value area with volume'
      },
      [AgentRole.Sentiment]: {
        'STRONG_BUY': 'Extremely bullish news flow and analyst upgrades',
        'BUY': 'Positive sentiment with improving trend',
        'NEUTRAL': 'Mixed sentiment signals',
        'SELL': 'Negative news flow emerging',
        'STRONG_SELL': 'Strong bearish sentiment shift'
      }
    };

    return reasonings[role]?.[signal] || `${role} analysis indicates ${signal.toLowerCase()} bias`;
  }

  private getRecommendation(direction: SignalDirection, strength: number): string {
    const absStrength = Math.abs(strength);

    if (direction === 'STRONG_BUY') {
      return `High conviction long entry. Agent consensus at ${absStrength.toFixed(0)}%. Consider full position size with stop below VPOC.`;
    } else if (direction === 'BUY') {
      return `Moderate bullish bias. Scale into long with half-Kelly sizing. Monitor order flow for confirmation.`;
    } else if (direction === 'NEUTRAL') {
      return `No clear direction. Maintain current exposure. Wait for stronger signal convergence.`;
    } else if (direction === 'SELL') {
      return `Moderate bearish bias. Consider reducing long exposure or initiating small short.`;
    } else {
      return `High conviction short entry. Agent consensus at ${absStrength.toFixed(0)}%. Consider full short position with stop above resistance.`;
    }
  }

  public getInitialAgents() {
    return this.agents;
  }

  public getCurrentEquity() {
    return this.currentEquity;
  }

  public enableRealDataMode() {
    this.isUsingRealData = true;
    console.log('MockWebSocket: Switched to Real Data Mode (External Price Injection)');
  }

  public updateMarketData(price: number, vwap: number) {
    if (!this.isUsingRealData) return;

    this.currentPrice = price;
    const tick = {
      time: Date.now(),
      price: price,
      vwap: vwap
    };
    
    // Add to history
    this.priceHistory.push(tick);
    if (this.priceHistory.length > 1000) this.priceHistory.shift();

    this.emit('marketUpdate', tick);
  }
}

export const mockWebSocketService = new MockWebSocketService();

