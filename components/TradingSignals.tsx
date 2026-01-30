import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle } from 'lucide-react';
import { ConsensusSignal, AgentSignal, SignalDirection, AgentRole } from '../types';
import { mockWebSocketService } from '../services/mockWebSocket';

const TradingSignals: React.FC = () => {
    const [consensus, setConsensus] = useState<ConsensusSignal | null>(null);

    useEffect(() => {
        const handleConsensusUpdate = (data: ConsensusSignal) => {
            setConsensus(data);
        };

        mockWebSocketService.on('consensusUpdate', handleConsensusUpdate);

        return () => {
            mockWebSocketService.off('consensusUpdate', handleConsensusUpdate);
        };
    }, []);

    const getSignalIcon = (signal: SignalDirection) => {
        switch (signal) {
            case 'STRONG_BUY':
            case 'BUY':
                return <TrendingUp className="w-5 h-5" />;
            case 'STRONG_SELL':
            case 'SELL':
                return <TrendingDown className="w-5 h-5" />;
            default:
                return <Minus className="w-5 h-5" />;
        }
    };

    const getSignalColor = (signal: SignalDirection) => {
        switch (signal) {
            case 'STRONG_BUY': return 'text-primary bg-primary/20 border-primary/50';
            case 'BUY': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'NEUTRAL': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
            case 'SELL': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
            case 'STRONG_SELL': return 'text-danger bg-danger/20 border-danger/50';
        }
    };

    const getSignalTextColor = (signal: SignalDirection) => {
        switch (signal) {
            case 'STRONG_BUY': return 'text-primary';
            case 'BUY': return 'text-emerald-400';
            case 'NEUTRAL': return 'text-slate-400';
            case 'SELL': return 'text-orange-400';
            case 'STRONG_SELL': return 'text-danger';
        }
    };

    const formatAgentRole = (role: AgentRole) => {
        return role.replace(/([A-Z])/g, ' $1').trim();
    };

    const getStrengthGradient = (strength: number) => {
        if (strength > 0) {
            return `linear-gradient(90deg, transparent 50%, rgba(16, 185, 129, ${Math.abs(strength) / 100}) 100%)`;
        } else {
            return `linear-gradient(90deg, rgba(239, 68, 68, ${Math.abs(strength) / 100}) 0%, transparent 50%)`;
        }
    };

    if (!consensus) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Aggregating agent signals...</div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <Target className="w-7 h-7 text-secondary mr-3" />
                        Trading Signals
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Multi-agent weighted consensus system</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-500">Last Updated</div>
                    <div className="text-sm text-slate-300 font-mono">
                        {new Date(consensus.timestamp).toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Main Consensus Signal */}
            <div className={`bg-surface rounded-xl border-2 p-8 ${consensus.direction.includes('BUY') ? 'border-primary/50' :
                    consensus.direction.includes('SELL') ? 'border-danger/50' : 'border-slate-700'
                } relative overflow-hidden`}>
                {/* Background gradient based on strength */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{ background: getStrengthGradient(consensus.strength) }}
                />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${getSignalColor(consensus.direction)} border-2 animate-pulse-glow`}>
                            {getSignalIcon(consensus.direction)}
                            <span className="text-3xl ml-1">{getSignalIcon(consensus.direction)}</span>
                        </div>

                        <div>
                            <div className="text-sm text-slate-400 mb-1">Consensus Signal</div>
                            <div className={`text-4xl font-bold ${getSignalTextColor(consensus.direction)}`}>
                                {consensus.direction.replace('_', ' ')}
                            </div>
                            <div className="text-slate-400 mt-2">
                                Confidence: <span className="text-white font-medium">{consensus.confidence.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Signal Strength Gauge */}
                    <div className="text-center">
                        <div className="text-sm text-slate-400 mb-2">Signal Strength</div>
                        <div className="relative w-48 h-4 bg-slate-800 rounded-full overflow-hidden">
                            <div className="absolute inset-0 flex">
                                <div className="w-1/2 bg-gradient-to-l from-transparent to-danger/30" />
                                <div className="w-1/2 bg-gradient-to-r from-transparent to-primary/30" />
                            </div>
                            <div
                                className="absolute top-0 h-full w-2 bg-white rounded shadow-lg transform -translate-x-1/2 transition-all duration-500"
                                style={{ left: `${(consensus.strength + 100) / 2}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>Strong Sell</span>
                            <span className="text-white font-mono">{consensus.strength.toFixed(0)}</span>
                            <span>Strong Buy</span>
                        </div>
                    </div>
                </div>

                {/* Recommendation */}
                <div className="relative z-10 mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="flex items-start space-x-3">
                        <AlertCircle className="w-5 h-5 text-secondary mt-0.5" />
                        <div>
                            <div className="text-sm text-slate-400 mb-1">Orchestrator Recommendation</div>
                            <div className="text-slate-200">{consensus.recommendation}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Voting Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vote Distribution */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5">
                    <h3 className="text-white font-semibold mb-4">Vote Distribution</h3>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-primary mr-3" />
                                <span className="text-slate-300">Strong Buy</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-32 h-2 bg-slate-800 rounded-full mx-4 overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${(consensus.votingBreakdown.strongBuy / consensus.agentSignals.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-white font-mono w-6 text-right">{consensus.votingBreakdown.strongBuy}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-400 mr-3" />
                                <span className="text-slate-300">Buy</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-32 h-2 bg-slate-800 rounded-full mx-4 overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-400 transition-all duration-500"
                                        style={{ width: `${(consensus.votingBreakdown.buy / consensus.agentSignals.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-white font-mono w-6 text-right">{consensus.votingBreakdown.buy}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-slate-500 mr-3" />
                                <span className="text-slate-300">Neutral</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-32 h-2 bg-slate-800 rounded-full mx-4 overflow-hidden">
                                    <div
                                        className="h-full bg-slate-500 transition-all duration-500"
                                        style={{ width: `${(consensus.votingBreakdown.neutral / consensus.agentSignals.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-white font-mono w-6 text-right">{consensus.votingBreakdown.neutral}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-orange-400 mr-3" />
                                <span className="text-slate-300">Sell</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-32 h-2 bg-slate-800 rounded-full mx-4 overflow-hidden">
                                    <div
                                        className="h-full bg-orange-400 transition-all duration-500"
                                        style={{ width: `${(consensus.votingBreakdown.sell / consensus.agentSignals.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-white font-mono w-6 text-right">{consensus.votingBreakdown.sell}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-danger mr-3" />
                                <span className="text-slate-300">Strong Sell</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-32 h-2 bg-slate-800 rounded-full mx-4 overflow-hidden">
                                    <div
                                        className="h-full bg-danger transition-all duration-500"
                                        style={{ width: `${(consensus.votingBreakdown.strongSell / consensus.agentSignals.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-white font-mono w-6 text-right">{consensus.votingBreakdown.strongSell}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agent Weight Visualization */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5">
                    <h3 className="text-white font-semibold mb-4">Agent Weights in Consensus</h3>

                    <div className="space-y-2">
                        {consensus.agentSignals
                            .filter(s => s.weight > 0)
                            .sort((a, b) => b.weight - a.weight)
                            .map((signal) => (
                                <div key={signal.agentId} className="flex items-center space-x-3">
                                    <div className="w-24 text-sm text-slate-400 truncate">{formatAgentRole(signal.agentRole)}</div>
                                    <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden relative">
                                        <div
                                            className={`h-full transition-all duration-500 ${signal.signal.includes('BUY') ? 'bg-primary' :
                                                    signal.signal.includes('SELL') ? 'bg-danger' : 'bg-slate-600'
                                                }`}
                                            style={{ width: `${signal.weight * signal.confidence}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-2">
                                            <span className="text-xs font-mono text-white drop-shadow">
                                                {signal.signal.replace('_', ' ')} ({signal.weight * 100}% × {signal.confidence}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* Individual Agent Signals */}
            <div className="bg-surface rounded-lg border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                    <h3 className="font-bold text-white">Individual Agent Signals</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-slate-500 bg-slate-950/50">
                            <tr>
                                <th className="px-6 py-3 text-left font-medium">Agent</th>
                                <th className="px-6 py-3 text-left font-medium">Signal</th>
                                <th className="px-6 py-3 text-left font-medium">Confidence</th>
                                <th className="px-6 py-3 text-left font-medium">Weight</th>
                                <th className="px-6 py-3 text-left font-medium">Reasoning</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {consensus.agentSignals.map((signal) => (
                                <tr key={signal.agentId} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-200">
                                        {formatAgentRole(signal.agentRole)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSignalColor(signal.signal)}`}>
                                            {getSignalIcon(signal.signal)}
                                            <span className="ml-1">{signal.signal.replace('_', ' ')}</span>
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-16 h-1.5 bg-slate-800 rounded-full mr-2 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${signal.confidence > 80 ? 'bg-primary' : signal.confidence > 50 ? 'bg-accent' : 'bg-danger'}`}
                                                    style={{ width: `${signal.confidence}%` }}
                                                />
                                            </div>
                                            <span className="text-slate-300 font-mono">{signal.confidence}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 font-mono">
                                        {(signal.weight * 100).toFixed(0)}%
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs max-w-xs truncate">
                                        {signal.reasoning}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TradingSignals;
