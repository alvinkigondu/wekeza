import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import AgentNetwork from './components/AgentStatus';
import MarketMicrostructure from './components/MarketMicrostructure';
import RiskManagement from './components/RiskManagement';
import TradingSignals from './components/TradingSignals';
import SentimentAnalysis from './components/SentimentAnalysis';
import Settings from './components/Settings';
import { AgentState, AgentStatus } from './types';
import { mockWebSocketService } from './services/mockWebSocket';
import { dataService } from './services/dataService';

// Initial Portfolio Data for the chart structure
const INITIAL_PORTFOLIO = [
  { timestamp: '09:30', equity: 1240000 },
  { timestamp: '10:00', equity: 1241500 },
  { timestamp: '10:30', equity: 1241200 },
  { timestamp: '11:00', equity: 1243000 },
  { timestamp: '11:30', equity: 1242800 },
  { timestamp: '12:00', equity: 1244500 },
  { timestamp: '12:30', equity: 1245892 },
];

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [agents, setAgents] = useState<AgentState[]>(mockWebSocketService.getInitialAgents());
  const [dataSource] = useState(dataService.getDataSource());
  const [isRealData] = useState(dataService.isRealDataEnabled());

  useEffect(() => {
    // Connect to the "WebSocket"
    mockWebSocketService.connect();

    // Check if we are using real data
    if (dataService.isRealDataEnabled()) {
        mockWebSocketService.enableRealDataMode();
        
        // Subscribe to real data stream (e.g. SPY as proxy for overall market state)
        // In a real app, this would be dynamic based on user selection
        const symbol = 'SPY'; 
        
        dataService.subscribeMarketData(symbol, (data) => {
            // Inject real data into the mock service to drive agents/risk
            // dataService provides price/vwap/etc.
            mockWebSocketService.updateMarketData(data.price, data.price); // Using price as VWAP approx if needed
        });
    }

    // Subscribe to agent updates
    const handleAgentUpdate = (updatedAgents: AgentState[]) => {
      setAgents(updatedAgents);
    };

    mockWebSocketService.on('agentUpdate', handleAgentUpdate);

    // Cleanup
    return () => {
      mockWebSocketService.off('agentUpdate', handleAgentUpdate);
      mockWebSocketService.disconnect();
      dataService.destroy();
    };
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard portfolioHistory={INITIAL_PORTFOLIO} agents={agents} />;
      case 'agents':
        return <AgentNetwork agents={agents} />;
      case 'microstructure':
        return <MarketMicrostructure />;
      case 'risk':
        return <RiskManagement />;
      case 'signals':
        return <TradingSignals />;
      case 'sentiment':
        return <SentimentAnalysis />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard portfolioHistory={INITIAL_PORTFOLIO} agents={agents} />;
    }
  };

  // Calculate active agent count
  const activeAgentCount = agents.filter(a => a.status !== AgentStatus.Error).length;

  return (
    <div className="flex h-screen bg-background text-slate-100 overflow-hidden font-sans">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-surface/50 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <span className="text-xs font-mono text-slate-500">SESSION: <span className="text-white">NY_OPEN</span></span>
            <span className="text-xs font-mono text-slate-500">SERVER: <span className="text-primary">US-EAST-1</span></span>
            <span className="text-xs font-mono text-slate-500">AGENTS: <span className="text-primary">{activeAgentCount}/12</span></span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center px-3 py-1 bg-slate-800 rounded-full border border-slate-700">
              <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${isRealData ? 'bg-primary' : 'bg-accent'}`}></div>
              <span className="text-xs font-medium text-slate-300">{dataSource}</span>
            </div>
            <div className="flex items-center px-3 py-1 bg-secondary/20 rounded-full border border-secondary/50">
              <span className="text-xs font-medium text-secondary">MCP Active</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative gradient-mesh">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
