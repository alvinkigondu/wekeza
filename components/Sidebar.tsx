import React from 'react';
import { LayoutDashboard, Network, CandlestickChart, Activity, Settings, Zap, Shield, Target, MessageSquare, TrendingUp } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
    { id: 'agents', icon: Network, label: 'Agent Mesh' },
    { id: 'microstructure', icon: CandlestickChart, label: 'Microstructure' },
    { id: 'signals', icon: Target, label: 'Trading Signals' },
    { id: 'sentiment', icon: MessageSquare, label: 'Sentiment' },
    { id: 'risk', icon: Shield, label: 'Risk Management' },
  ];

  return (
    <div className="w-20 lg:w-64 bg-surface border-r border-slate-800 flex flex-col h-full transition-all duration-300">
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-800">
        <Zap className="text-primary w-8 h-8" />
        <span className="hidden lg:block ml-3 font-bold text-xl tracking-tight">
          Wekeza
        </span>
      </div>

      <nav className="flex-1 py-6 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center px-4 lg:px-6 py-3 transition-colors duration-200 ${currentView === item.id
              ? 'bg-slate-800 border-r-2 border-primary text-primary'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden lg:block ml-4 font-medium text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* System Status */}
      <div className="p-4 border-t border-slate-800">
        <div className="hidden lg:block mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">System Status</span>
            <span className="flex items-center text-primary">
              <span className="w-2 h-2 rounded-full bg-primary mr-1.5 animate-pulse" />
              Operational
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Agents Active</span>
            <span className="text-slate-300 font-mono">12/12</span>
          </div>
        </div>

        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center justify-center lg:justify-start p-2 transition-colors rounded-lg ${currentView === 'settings'
              ? 'text-primary bg-slate-800'
              : 'text-slate-500 hover:text-white hover:bg-slate-800/50'
            }`}
        >
          <Settings className="w-5 h-5" />
          <span className="hidden lg:block ml-4 text-sm">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;