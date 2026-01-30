import React, { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, Shield, BrainCircuit, Terminal } from 'lucide-react';
import { AgentState, Trade } from '../types';
import { generateOrchestratorReport } from '../services/geminiService';
import { mockWebSocketService } from '../services/mockWebSocket';

interface DashboardProps {
  portfolioHistory: { timestamp: string; equity: number }[];
  agents: AgentState[];
}

const MetricCard: React.FC<{ title: string; value: string; subValue?: string; isPositive?: boolean; icon?: React.ReactNode }> = ({ title, value, subValue, isPositive, icon }) => (
  <div className="bg-surface p-5 rounded-lg border border-slate-800">
    <div className="flex justify-between items-start mb-2">
      <span className="text-slate-400 text-sm font-medium">{title}</span>
      {icon && <span className="text-slate-500">{icon}</span>}
    </div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    {subValue && (
      <div className={`flex items-center text-xs font-medium ${isPositive ? 'text-primary' : 'text-danger'}`}>
        {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
        {subValue}
      </div>
    )}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ portfolioHistory: initialPortfolioHistory, agents }) => {
  const [orchestratorThinking, setOrchestratorThinking] = useState(false);
  const [strategyReport, setStrategyReport] = useState<string | null>(null);
  
  // Real-time State
  const [equity, setEquity] = useState(1245892.45);
  const [pnlChange, setPnlChange] = useState(2.4);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [chartData, setChartData] = useState(initialPortfolioHistory);

  useEffect(() => {
    // Listen for WebSocket updates
    const handleTrade = (trade: Trade) => {
        setRecentTrades(prev => [trade, ...prev].slice(0, 10)); // Keep last 10
    };

    const handlePortfolio = (data: { timestamp: string, equity: number }) => {
        setEquity(data.equity);
        setChartData(prev => [...prev, data]);
        // Simple mock PnL calc based on random equity move
        setPnlChange(prev => prev + (Math.random() - 0.4) * 0.1); 
    };

    mockWebSocketService.on('tradeUpdate', handleTrade);
    mockWebSocketService.on('portfolioUpdate', handlePortfolio);

    return () => {
        mockWebSocketService.off('tradeUpdate', handleTrade);
        mockWebSocketService.off('portfolioUpdate', handlePortfolio);
    };
  }, []);

  const handleGenerateReport = async () => {
    setOrchestratorThinking(true);
    
    const report = await generateOrchestratorReport(
      "High volatility detected in Asian session. Order book imbalance leaning bearish on indices.",
      agents,
      recentTrades
    );
    
    setStrategyReport(report);
    setOrchestratorThinking(false);
  };

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio Overview</h1>
          <p className="text-slate-400 text-sm">Real-time risk-adjusted performance metrics.</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={handleGenerateReport}
            className="flex items-center px-4 py-2 bg-secondary hover:bg-secondary/90 text-white rounded-md text-sm font-medium transition-colors"
            disabled={orchestratorThinking}
          >
            {orchestratorThinking ? (
              <span className="flex items-center"><BrainCircuit className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</span>
            ) : (
              <span className="flex items-center"><BrainCircuit className="w-4 h-4 mr-2" /> Orchestrator Insight</span>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
            title="Total Equity" 
            value={formatCurrency(equity)} 
            subValue={`${pnlChange > 0 ? '+' : ''}${pnlChange.toFixed(2)}% (24h)`} 
            isPositive={pnlChange > 0} 
            icon={<Activity className="w-5 h-5" />} 
        />
        <MetricCard title="Sharpe Ratio" value="2.34" subValue="Target > 2.0" isPositive={true} icon={<Activity className="w-5 h-5" />} />
        <MetricCard title="Max Drawdown" value="4.2%" subValue="Limit < 15%" isPositive={true} icon={<Shield className="w-5 h-5" />} />
        <MetricCard title="Active Agents" value="12/12" subValue="Latency: 14ms" isPositive={true} icon={<BrainCircuit className="w-5 h-5" />} />
      </div>

      {/* Main Chart & Orchestrator Output */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96 min-h-[24rem]">
        
        {/* Equity Curve */}
        <div className="lg:col-span-2 bg-surface rounded-lg border border-slate-800 p-4 flex flex-col">
          <h3 className="text-slate-400 font-medium mb-4">Equity Curve (Live)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="timestamp" stroke="#64748b" tick={{fontSize: 12}} />
                <YAxis stroke="#64748b" tick={{fontSize: 12}} domain={['auto', 'auto']} />
                <ReTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#818cf8' }}
                  formatter={(value: number) => [formatCurrency(value), 'Equity']}
                />
                <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorEquity)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Strategy Terminal */}
        <div className="bg-surface rounded-lg border border-slate-800 p-4 flex flex-col relative overflow-hidden">
          <div className="flex items-center mb-3">
             <Terminal className="w-4 h-4 text-primary mr-2" />
             <h3 className="text-white font-medium">Orchestrator Log</h3>
          </div>
          
          <div className="flex-1 bg-slate-950 rounded p-3 font-mono text-xs overflow-y-auto text-slate-300 border border-slate-800/50">
            {strategyReport ? (
              <div className="typing-effect animate-fade-in">
                <span className="text-accent">{'>'}</span> {strategyReport}
              </div>
            ) : (
              <div className="flex flex-col space-y-2 opacity-50">
                <span>{'>'} Initializing StrategyOrchestrator...</span>
                <span>{'>'} Connecting to MarketDataAgent... OK</span>
                <span>{'>'} Verifying OrderFlow tensors... OK</span>
                <span>{'>'} Subscribed to real-time feed...</span>
                {recentTrades.length > 0 && (
                    <span className="text-primary">{'>'} New trade detected: {recentTrades[0].symbol} {recentTrades[0].side}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Decorative scan line */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-primary/5 to-transparent h-4 animate-scan opacity-20"></div>
        </div>
      </div>
      
      {/* Recent Trades Table (Real-time) */}
      <div className="bg-surface rounded-lg border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
           <h3 className="font-bold text-white">Recent Execution</h3>
        </div>
        <table className="w-full text-sm text-left">
            <thead className="text-slate-500 bg-slate-950/50">
                <tr>
                    <th className="px-6 py-3 font-medium">Symbol</th>
                    <th className="px-6 py-3 font-medium">Side</th>
                    <th className="px-6 py-3 font-medium">Price</th>
                    <th className="px-6 py-3 font-medium">Size</th>
                    <th className="px-6 py-3 font-medium">Agent</th>
                    <th className="px-6 py-3 font-medium text-right">PnL</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
                {recentTrades.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-slate-500">Waiting for execution...</td>
                    </tr>
                ) : (
                    recentTrades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-slate-800/50 transition-colors animate-fade-in">
                            <td className="px-6 py-3 font-medium text-white">{trade.symbol}</td>
                            <td className="px-6 py-3">
                                <span className={`${trade.side === 'BUY' ? 'text-primary bg-primary/10' : 'text-danger bg-danger/10'} px-2 py-0.5 rounded text-xs`}>
                                    {trade.side}
                                </span>
                            </td>
                            <td className="px-6 py-3">{trade.price.toFixed(2)}</td>
                            <td className="px-6 py-3">{trade.size}</td>
                            <td className="px-6 py-3 text-xs font-mono">{trade.agentId}</td>
                            <td className={`px-6 py-3 text-right ${trade.pnl && trade.pnl > 0 ? 'text-primary' : 'text-danger'}`}>
                                {trade.pnl ? (trade.pnl > 0 ? '+' : '') + formatCurrency(trade.pnl) : '-'}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
