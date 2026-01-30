import { RiskMetrics, KellyCriterionResult, StressTestResult, Trade } from '../types';

// Risk calculation utilities for the RiskManagement agent
export class RiskService {
    private trades: Trade[] = [];
    private peakEquity: number = 0;
    private initialEquity: number = 1000000;

    constructor(initialEquity: number = 1000000) {
        this.initialEquity = initialEquity;
        this.peakEquity = initialEquity;
    }

    // Calculate Value at Risk (Historical VaR)
    calculateVaR(returns: number[], confidence: number = 0.99): number {
        if (returns.length === 0) return 0;

        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return Math.abs(sortedReturns[index] || 0);
    }

    // Calculate Sharpe Ratio
    calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const excessReturn = avgReturn - (riskFreeRate / 252); // Daily risk-free rate

        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        if (stdDev === 0) return 0;
        return (excessReturn / stdDev) * Math.sqrt(252); // Annualized
    }

    // Calculate Sortino Ratio (downside deviation only)
    calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
        if (returns.length === 0) return 0;

        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const excessReturn = avgReturn - (riskFreeRate / 252);

        const negativeReturns = returns.filter(r => r < 0);
        if (negativeReturns.length === 0) return 10; // Cap at 10 if no negative returns

        const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
        const downsideDev = Math.sqrt(downsideVariance);

        if (downsideDev === 0) return 10;
        return (excessReturn / downsideDev) * Math.sqrt(252);
    }

    // Calculate Maximum Drawdown
    calculateMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; maxDrawdownPercent: number } {
        if (equityCurve.length === 0) return { maxDrawdown: 0, maxDrawdownPercent: 0 };

        let peak = equityCurve[0];
        let maxDrawdown = 0;
        let maxDrawdownPercent = 0;

        for (const equity of equityCurve) {
            if (equity > peak) {
                peak = equity;
            }
            const drawdown = peak - equity;
            const drawdownPercent = (drawdown / peak) * 100;

            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
                maxDrawdownPercent = drawdownPercent;
            }
        }

        return { maxDrawdown, maxDrawdownPercent };
    }

    // Calculate Kelly Criterion for position sizing
    calculateKellyCriterion(trades: Trade[]): KellyCriterionResult {
        const closedTrades = trades.filter(t => t.pnl !== undefined);

        if (closedTrades.length < 10) {
            return {
                optimalFraction: 0,
                halfKelly: 0,
                quarterKelly: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                recommendedPosition: 0
            };
        }

        const wins = closedTrades.filter(t => (t.pnl || 0) > 0);
        const losses = closedTrades.filter(t => (t.pnl || 0) <= 0);

        const winRate = wins.length / closedTrades.length;
        const avgWin = wins.length > 0
            ? wins.reduce((sum, t) => sum + (t.pnl || 0), 0) / wins.length
            : 0;
        const avgLoss = losses.length > 0
            ? Math.abs(losses.reduce((sum, t) => sum + (t.pnl || 0), 0) / losses.length)
            : 1;

        // Kelly Formula: f* = (bp - q) / b
        // where b = avgWin/avgLoss, p = winRate, q = 1-p
        const b = avgWin / avgLoss;
        const p = winRate;
        const q = 1 - p;

        const optimalFraction = Math.max(0, Math.min(1, (b * p - q) / b));

        return {
            optimalFraction,
            halfKelly: optimalFraction / 2,
            quarterKelly: optimalFraction / 4,
            winRate,
            avgWin,
            avgLoss,
            recommendedPosition: optimalFraction / 2 // Conservative half-Kelly
        };
    }

    // Run stress tests
    runStressTests(portfolioValue: number): StressTestResult[] {
        return [
            {
                scenario: '2008 Financial Crisis',
                impact: -portfolioValue * 0.35,
                impactPercent: -35,
                status: portfolioValue * 0.35 < portfolioValue * 0.5 ? 'pass' : 'fail'
            },
            {
                scenario: '2020 COVID Crash',
                impact: -portfolioValue * 0.25,
                impactPercent: -25,
                status: 'pass'
            },
            {
                scenario: 'Flash Crash (-10% in minutes)',
                impact: -portfolioValue * 0.10,
                impactPercent: -10,
                status: 'pass'
            },
            {
                scenario: 'Interest Rate Shock (+2%)',
                impact: -portfolioValue * 0.15,
                impactPercent: -15,
                status: portfolioValue * 0.15 < portfolioValue * 0.2 ? 'pass' : 'warning'
            },
            {
                scenario: 'Currency Crisis',
                impact: -portfolioValue * 0.20,
                impactPercent: -20,
                status: 'warning'
            }
        ];
    }

    // Generate mock risk metrics for simulation
    generateMockRiskMetrics(currentEquity: number): RiskMetrics {
        const dailyPnL = (Math.random() - 0.4) * 5000;
        const dailyPnLPercent = (dailyPnL / currentEquity) * 100;

        // Track peak for drawdown
        if (currentEquity > this.peakEquity) {
            this.peakEquity = currentEquity;
        }

        const currentDrawdown = this.peakEquity - currentEquity;
        const currentDrawdownPercent = (currentDrawdown / this.peakEquity) * 100;

        return {
            portfolioValue: currentEquity,
            dailyPnL,
            dailyPnLPercent,
            valueAtRisk: currentEquity * 0.025, // 2.5% VaR
            valueAtRiskPercent: 2.5,
            maxDrawdown: currentEquity * 0.042,
            maxDrawdownPercent: 4.2,
            currentDrawdown,
            currentDrawdownPercent,
            sharpeRatio: 2.34 + (Math.random() - 0.5) * 0.2,
            sortinoRatio: 3.12 + (Math.random() - 0.5) * 0.3,
            beta: 0.85 + (Math.random() - 0.5) * 0.1,
            exposure: {
                grossExposure: currentEquity * 1.2,
                netExposure: currentEquity * 0.65,
                longExposure: currentEquity * 0.75,
                shortExposure: currentEquity * 0.10,
                sectorExposures: [
                    { sector: 'Technology', exposure: 35, limit: 40 },
                    { sector: 'Financials', exposure: 25, limit: 35 },
                    { sector: 'Healthcare', exposure: 15, limit: 25 },
                    { sector: 'Energy', exposure: 10, limit: 20 },
                    { sector: 'Consumer', exposure: 15, limit: 25 }
                ],
                assetExposures: [
                    { asset: 'ES_F', exposure: 45, limit: 50 },
                    { asset: 'NQ_F', exposure: 30, limit: 40 },
                    { asset: 'BTC-PERP', exposure: 15, limit: 20 },
                    { asset: 'GC_F', exposure: 10, limit: 15 }
                ]
            },
            limits: {
                maxDailyLoss: currentEquity * 0.02,
                currentDailyLoss: Math.max(0, -dailyPnL),
                maxDrawdown: 15,
                maxLeverage: 3.0,
                currentLeverage: 1.2,
                maxPositionSize: currentEquity * 0.1,
                circuitBreakerTriggered: false
            },
            stressTests: this.runStressTests(currentEquity)
        };
    }
}

export const riskService = new RiskService();
