import React from 'react';
import { AgentState, AgentStatus } from '../types';
import { Cpu, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';

interface AgentStatusProps {
  agents: AgentState[];
}

const AgentStatusCard: React.FC<{ agent: AgentState }> = ({ agent }) => {
  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.Processing: return 'text-accent animate-pulse';
      case AgentStatus.Transmitting: return 'text-primary';
      case AgentStatus.Error: return 'text-danger';
      default: return 'text-slate-500';
    }
  };

  const getBorderColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.Processing: return 'border-accent/50';
      case AgentStatus.Transmitting: return 'border-primary/50';
      case AgentStatus.Error: return 'border-danger/50';
      default: return 'border-slate-800';
    }
  };

  return (
    <div className={`bg-surface border ${getBorderColor(agent.status)} p-4 rounded-lg shadow-sm transition-all duration-300 hover:shadow-md relative overflow-hidden`}>
      {/* Background Tech Line Decoration */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-3xl -mr-4 -mt-4 pointer-events-none" />
      
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <Cpu className={`w-5 h-5 ${getStatusColor(agent.status)}`} />
          <h3 className="font-semibold text-sm text-slate-200">{agent.role}</h3>
        </div>
        <div className={`text-xs font-mono px-2 py-0.5 rounded ${
          agent.status === AgentStatus.Error ? 'bg-danger/20 text-danger' : 'bg-slate-800 text-slate-400'
        }`}>
          {agent.status}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">Confidence</span>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                agent.confidence > 80 ? 'bg-primary' : agent.confidence > 50 ? 'bg-accent' : 'bg-danger'
              }`}
              style={{ width: `${agent.confidence}%` }}
            />
          </div>
          <span className="text-slate-300 w-8 text-right">{agent.confidence}%</span>
        </div>
        
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500">Latency</span>
          <span className="font-mono text-slate-300">{agent.latency}ms</span>
        </div>

        <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-400 truncate font-mono">
          <span className="text-slate-600 mr-1">{'>'}</span>
          {agent.lastMessage}
        </div>
      </div>
    </div>
  );
};

const AgentNetwork: React.FC<AgentStatusProps> = ({ agents }) => {
  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Multi-Agent Neural Mesh</h2>
          <p className="text-slate-400 text-sm">Real-time status of the 12-agent orchestration layer.</p>
        </div>
        <div className="flex space-x-4 text-xs font-mono">
          <div className="flex items-center"><CheckCircle className="w-4 h-4 text-primary mr-1" /> System Operational</div>
          <div className="flex items-center"><Wifi className="w-4 h-4 text-accent mr-1" /> MCP Connected</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map(agent => (
          <AgentStatusCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
};

export default AgentNetwork;