import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, Activity, CheckCircle, XCircle, Gauge } from 'lucide-react';
import { RiskMetrics, StressTestResult } from '../types';
import { mockWebSocketService } from '../services/mockWebSocket';

const RiskManagement: React.FC = () => {
    const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);

    useEffect(() => {
        const handleRiskUpdate = (metrics: RiskMetrics) => {
            setRiskMetrics(metrics);
        };

        mockWebSocketService.on('riskUpdate', handleRiskUpdate);

        return () => {
            mockWebSocketService.off('riskUpdate', handleRiskUpdate);
        };
    }, []);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    };

    const formatPercent = (val: number) => {
        return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
    };

    const getVaRColor = (varPercent: number) => {
        if (varPercent < 2) return 'text-primary';
        if (varPercent < 3) return 'text-accent';
        return 'text-danger';
    };

    const getStressTestColor = (status: StressTestResult['status']) => {
        switch (status) {
            case 'pass': return 'text-primary bg-primary/10';
            case 'warning': return 'text-accent bg-accent/10';
            case 'fail': return 'text-danger bg-danger/10';
        }
    };

    if (!riskMetrics) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Loading risk metrics...</div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <Shield className="w-7 h-7 text-primary mr-3" />
                        Risk Management Console
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Real-time portfolio risk monitoring and VaR analysis</p>
                </div>
                <div className="flex items-center space-x-3">
                    {riskMetrics.limits.circuitBreakerTriggered ? (
                        <div className="flex items-center px-4 py-2 bg-danger/20 rounded-lg border border-danger/50">
                            <AlertTriangle className="w-5 h-5 text-danger mr-2" />
                            <span className="text-danger font-medium">Circuit Breaker Active</span>
                        </div>
                    ) : (
                        <div className="flex items-center px-4 py-2 bg-primary/20 rounded-lg border border-primary/50">
                            <CheckCircle className="w-5 h-5 text-primary mr-2" />
                            <span className="text-primary font-medium">Systems Normal</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* VaR Card */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5 card-hover">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-slate-400 text-sm">Value at Risk (99%)</span>
                        <Gauge className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${getVaRColor(riskMetrics.valueAtRiskPercent)}`}>
                        {formatCurrency(riskMetrics.valueAtRisk)}
                    </div>
                    <div className="text-sm text-slate-400">
                        {riskMetrics.valueAtRiskPercent.toFixed(2)}% of portfolio
                    </div>
                </div>

                {/* Sharpe Ratio */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5 card-hover">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-slate-400 text-sm">Sharpe Ratio</span>
                        <TrendingUp className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${riskMetrics.sharpeRatio > 2 ? 'text-primary' : 'text-accent'}`}>
                        {riskMetrics.sharpeRatio.toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-400">
                        Target: &gt; 2.0 {riskMetrics.sharpeRatio > 2 ? '✓' : ''}
                    </div>
                </div>

                {/* Max Drawdown */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5 card-hover">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-slate-400 text-sm">Max Drawdown</span>
                        <Activity className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${riskMetrics.maxDrawdownPercent < 15 ? 'text-primary' : 'text-danger'}`}>
                        {riskMetrics.maxDrawdownPercent.toFixed(1)}%
                    </div>
                    <div className="text-sm text-slate-400">
                        Limit: &lt; 15% {riskMetrics.maxDrawdownPercent < 15 ? '✓' : '⚠'}
                    </div>
                </div>

                {/* Current Leverage */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5 card-hover">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-slate-400 text-sm">Current Leverage</span>
                        <Shield className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${riskMetrics.limits.currentLeverage < 2 ? 'text-primary' : 'text-accent'}`}>
                        {riskMetrics.limits.currentLeverage.toFixed(2)}x
                    </div>
                    <div className="text-sm text-slate-400">
                        Max: {riskMetrics.limits.maxLeverage.toFixed(1)}x
                    </div>
                </div>
            </div>

            {/* Exposure & Limits */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Exposure Breakdown */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center">
                        <Activity className="w-5 h-5 text-primary mr-2" />
                        Exposure Breakdown
                    </h3>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Gross Exposure</span>
                            <span className="text-white font-mono">{formatCurrency(riskMetrics.exposure.grossExposure)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400">Net Exposure</span>
                            <span className="text-white font-mono">{formatCurrency(riskMetrics.exposure.netExposure)}</span>
                        </div>

                        <div className="border-t border-slate-800 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-primary">Long</span>
                                <span className="text-primary font-mono">{formatCurrency(riskMetrics.exposure.longExposure)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: `${(riskMetrics.exposure.longExposure / riskMetrics.portfolioValue) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-danger">Short</span>
                                <span className="text-danger font-mono">{formatCurrency(riskMetrics.exposure.shortExposure)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-danger transition-all duration-500"
                                    style={{ width: `${(riskMetrics.exposure.shortExposure / riskMetrics.portfolioValue) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sector Exposure */}
                <div className="bg-surface rounded-lg border border-slate-800 p-5">
                    <h3 className="text-white font-semibold mb-4">Sector Concentration</h3>

                    <div className="space-y-3">
                        {riskMetrics.exposure.sectorExposures.map((sector) => (
                            <div key={sector.sector}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-slate-300 text-sm">{sector.sector}</span>
                                    <span className={`text-sm font-mono ${sector.exposure > sector.limit * 0.9 ? 'text-accent' : 'text-slate-400'}`}>
                                        {sector.exposure}% / {sector.limit}%
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
                                    <div
                                        className={`h-full transition-all duration-500 ${sector.exposure > sector.limit * 0.9 ? 'bg-accent' : 'bg-secondary'}`}
                                        style={{ width: `${(sector.exposure / sector.limit) * 100}%` }}
                                    />
                                    <div
                                        className="absolute top-0 right-0 h-full w-0.5 bg-slate-500"
                                        style={{ left: `${100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stress Tests */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                    <AlertTriangle className="w-5 h-5 text-accent mr-2" />
                    Stress Test Results
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {riskMetrics.stressTests.map((test) => (
                        <div
                            key={test.scenario}
                            className={`p-4 rounded-lg border ${test.status === 'pass' ? 'border-primary/30 bg-primary/5' :
                                    test.status === 'warning' ? 'border-accent/30 bg-accent/5' :
                                        'border-danger/30 bg-danger/5'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStressTestColor(test.status)}`}>
                                    {test.status.toUpperCase()}
                                </span>
                                {test.status === 'pass' ? (
                                    <CheckCircle className="w-4 h-4 text-primary" />
                                ) : test.status === 'warning' ? (
                                    <AlertTriangle className="w-4 h-4 text-accent" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-danger" />
                                )}
                            </div>
                            <div className="text-sm text-slate-300 mb-2">{test.scenario}</div>
                            <div className={`text-lg font-bold ${test.status === 'pass' ? 'text-primary' :
                                    test.status === 'warning' ? 'text-accent' : 'text-danger'
                                }`}>
                                {test.impactPercent}%
                            </div>
                            <div className="text-xs text-slate-500">
                                {formatCurrency(test.impact)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Loss Limit */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4">Daily Loss Limit Monitor</h3>

                <div className="flex items-center space-x-6">
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-400">Current Daily P&L</span>
                            <span className={`font-mono font-bold ${riskMetrics.dailyPnL >= 0 ? 'text-primary' : 'text-danger'}`}>
                                {formatCurrency(riskMetrics.dailyPnL)} ({formatPercent(riskMetrics.dailyPnLPercent)})
                            </span>
                        </div>
                        <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden relative">
                            {/* Loss limit line */}
                            <div
                                className="absolute top-0 h-full w-1 bg-danger z-10"
                                style={{ left: '80%' }}
                            />
                            {/* Current position */}
                            <div
                                className={`h-full transition-all duration-500 ${riskMetrics.dailyPnL >= 0 ? 'bg-primary' : 'bg-danger'
                                    }`}
                                style={{
                                    width: `${Math.min(100, Math.abs(riskMetrics.limits.currentDailyLoss / riskMetrics.limits.maxDailyLoss) * 80)}%`,
                                    marginLeft: riskMetrics.dailyPnL >= 0 ? '50%' : `${50 - Math.abs(riskMetrics.limits.currentDailyLoss / riskMetrics.limits.maxDailyLoss) * 50}%`
                                }}
                            />
                            {/* Center line */}
                            <div className="absolute top-0 left-1/2 h-full w-0.5 bg-slate-600" />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>-{formatCurrency(riskMetrics.limits.maxDailyLoss)}</span>
                            <span>$0</span>
                            <span>+{formatCurrency(riskMetrics.limits.maxDailyLoss)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RiskManagement;
