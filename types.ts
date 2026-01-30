export enum AgentRole {
  MarketData = 'MarketData',
  OrderFlow = 'OrderFlow',
  VolumeProfile = 'VolumeProfile',
  TechnicalAnalysis = 'TechnicalAnalysis',
  Sentiment = 'Sentiment',
  MacroEconomic = 'MacroEconomic',
  RiskManagement = 'RiskManagement',
  Portfolio = 'Portfolio',
  Execution = 'Execution',
  Compliance = 'Compliance',
  StrategyOrchestrator = 'StrategyOrchestrator',
  LLMGateway = 'LLMGateway'
}

export enum AgentStatus {
  Idle = 'Idle',
  Processing = 'Processing',
  Transmitting = 'Transmitting',
  Error = 'Error'
}

export interface AgentState {
  id: string;
  role: AgentRole;
  status: AgentStatus;
  lastMessage: string;
  confidence: number; // 0-100
  latency: number; // ms
  signal?: SignalDirection; // Agent's current trading signal
  weight?: number; // Weight in voting system (0-1)
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: number;
  agentId: string;
  pnl?: number;
  leeReadyClassification?: 'buyer-initiated' | 'seller-initiated';
}

export interface MarketMetric {
  name: string;
  value: string | number;
  change: number;
  isPositive: boolean;
}

export interface PortfolioHistory {
  timestamp: string;
  equity: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  type: 'bid' | 'ask';
}

// ===== Footprint Tensor Types =====
export interface FootprintCell {
  price: number;
  time: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  tradeCount: number;
  bidDepth: number;
  askDepth: number;
  delta: number; // buyVolume - sellVolume
  imbalance: number; // delta / totalVolume
}

export interface FootprintRow {
  priceLevel: number;
  cells: FootprintCell[];
}

export interface FootprintTensor {
  symbol: string;
  startTime: number;
  endTime: number;
  priceMin: number;
  priceMax: number;
  rows: FootprintRow[];
  vpoc: number; // Volume Point of Control
  valueAreaHigh: number;
  valueAreaLow: number;
}

// ===== Risk Management Types =====
export interface RiskMetrics {
  portfolioValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  valueAtRisk: number; // 99% VaR
  valueAtRiskPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  currentDrawdown: number;
  currentDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  beta: number;
  exposure: ExposureMetrics;
  limits: RiskLimits;
  stressTests: StressTestResult[];
}

export interface ExposureMetrics {
  grossExposure: number;
  netExposure: number;
  longExposure: number;
  shortExposure: number;
  sectorExposures: { sector: string; exposure: number; limit: number }[];
  assetExposures: { asset: string; exposure: number; limit: number }[];
}

export interface RiskLimits {
  maxDailyLoss: number;
  currentDailyLoss: number;
  maxDrawdown: number;
  maxLeverage: number;
  currentLeverage: number;
  maxPositionSize: number;
  circuitBreakerTriggered: boolean;
}

export interface StressTestResult {
  scenario: string;
  impact: number;
  impactPercent: number;
  status: 'pass' | 'warning' | 'fail';
}

export interface KellyCriterionResult {
  optimalFraction: number;
  halfKelly: number;
  quarterKelly: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  recommendedPosition: number;
}

// ===== Trading Signal Types =====
export type SignalDirection = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export interface AgentSignal {
  agentId: string;
  agentRole: AgentRole;
  signal: SignalDirection;
  confidence: number;
  weight: number;
  reasoning: string;
  timestamp: number;
}

export interface ConsensusSignal {
  direction: SignalDirection;
  strength: number; // -100 to 100
  confidence: number; // 0-100
  agentSignals: AgentSignal[];
  votingBreakdown: {
    strongBuy: number;
    buy: number;
    neutral: number;
    sell: number;
    strongSell: number;
  };
  recommendation: string;
  timestamp: number;
}

// ===== Sentiment Analysis Types =====
export interface SentimentData {
  overallScore: number; // -1 to 1
  magnitude: number; // 0 to 1
  trend: 'improving' | 'stable' | 'deteriorating';
  sources: SentimentSource[];
  keywords: KeywordSentiment[];
  lastUpdated: number;
}

export interface SentimentSource {
  id: string;
  type: 'news' | 'earnings' | 'social' | 'analyst';
  title: string;
  source: string;
  sentiment: number; // -1 to 1
  magnitude: number;
  timestamp: number;
  keywords: string[];
}

export interface KeywordSentiment {
  keyword: string;
  count: number;
  sentiment: number;
  trend: 'up' | 'stable' | 'down';
}

// ===== Volume Profile Types =====
export interface VolumeProfileLevel {
  priceLevel: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isVPOC: boolean;
  isValueArea: boolean;
}

export interface VolumeProfile {
  symbol: string;
  session: string;
  levels: VolumeProfileLevel[];
  vpoc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolume: number;
}

// ===== System Status Types =====
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  latency: number;
  activeConnections: number;
  dataFreshness: number;
  agents: {
    total: number;
    active: number;
    processing: number;
    error: number;
  };
  lastHeartbeat: number;
}