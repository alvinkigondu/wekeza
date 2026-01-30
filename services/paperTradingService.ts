// Paper Trading Service
// Executes paper trades via Alpaca API and tracks portfolio performance

import { config } from '../config';
import { PredictionResult } from './cnnModelService';

export interface Position {
    symbol: string;
    qty: number;
    side: 'long' | 'short';
    entryPrice: number;
    currentPrice: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
    entryTime: number;
}

export interface Trade {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    qty: number;
    price: number;
    timestamp: number;
    reason: string;
    prediction?: PredictionResult;
}

export interface PortfolioMetrics {
    equity: number;
    cash: number;
    buyingPower: number;
    totalPL: number;
    totalPLPercent: number;
    dayPL: number;
    dayPLPercent: number;
    positions: Position[];
    openOrders: number;
}

export interface RiskParams {
    maxPositionSize: number;      // Max % of portfolio per position
    maxDailyLoss: number;         // Max daily loss before stopping
    stopLossPercent: number;      // Stop loss per trade
    takeProfitPercent: number;    // Take profit per trade
    minConfidence: number;        // Min prediction confidence to trade
}

class PaperTradingService {
    private isConnected: boolean = false;
    private positions: Map<string, Position> = new Map();
    private trades: Trade[] = [];
    private portfolioMetrics: PortfolioMetrics = {
        equity: 100000,
        cash: 100000,
        buyingPower: 200000,
        totalPL: 0,
        totalPLPercent: 0,
        dayPL: 0,
        dayPLPercent: 0,
        positions: [],
        openOrders: 0,
    };
    private riskParams: RiskParams = {
        maxPositionSize: 0.10,     // 10% max per position
        maxDailyLoss: 0.02,        // 2% max daily loss
        stopLossPercent: 0.02,     // 2% stop loss
        takeProfitPercent: 0.05,   // 5% take profit
        minConfidence: 0.6,        // 60% min confidence
    };
    private tradeCallbacks: ((trade: Trade) => void)[] = [];
    private positionCallbacks: ((positions: Position[]) => void)[] = [];

    constructor() {
        if (config.alpaca.enabled) {
            this.initialize();
        }
    }

    private async initialize() {
        console.log('Paper Trading Service: Initializing...');
        await this.fetchAccountInfo();
        await this.fetchPositions();
        this.isConnected = true;
        console.log('Paper Trading Service: Connected to Alpaca paper trading');
    }

    private async fetchAccountInfo() {
        if (!config.alpaca.enabled) return;

        try {
            const response = await fetch(`${config.alpaca.baseUrl}/v2/account`, {
                headers: {
                    'APCA-API-KEY-ID': config.alpaca.apiKey,
                    'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const account = await response.json();
            this.portfolioMetrics = {
                ...this.portfolioMetrics,
                equity: parseFloat(account.equity),
                cash: parseFloat(account.cash),
                buyingPower: parseFloat(account.buying_power),
            };
        } catch (error) {
            console.error('Paper Trading Service: Failed to fetch account', error);
        }
    }

    private async fetchPositions() {
        if (!config.alpaca.enabled) return;

        try {
            const response = await fetch(`${config.alpaca.baseUrl}/v2/positions`, {
                headers: {
                    'APCA-API-KEY-ID': config.alpaca.apiKey,
                    'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const positions = await response.json();
            this.positions.clear();

            for (const pos of positions) {
                this.positions.set(pos.symbol, {
                    symbol: pos.symbol,
                    qty: parseInt(pos.qty),
                    side: parseInt(pos.qty) > 0 ? 'long' : 'short',
                    entryPrice: parseFloat(pos.avg_entry_price),
                    currentPrice: parseFloat(pos.current_price),
                    unrealizedPL: parseFloat(pos.unrealized_pl),
                    unrealizedPLPercent: parseFloat(pos.unrealized_plpc) * 100,
                    entryTime: Date.now(),
                });
            }

            this.portfolioMetrics.positions = Array.from(this.positions.values());
        } catch (error) {
            console.error('Paper Trading Service: Failed to fetch positions', error);
        }
    }

    // Execute a trade based on prediction
    async executeSignal(prediction: PredictionResult, currentPrice: number): Promise<Trade | null> {
        if (!this.isConnected) {
            console.warn('Paper Trading Service: Not connected');
            return null;
        }

        // Check if confidence meets threshold
        if (prediction.confidence < this.riskParams.minConfidence) {
            console.log(`Paper Trading Service: Low confidence ${prediction.confidence.toFixed(2)}, skipping trade`);
            return null;
        }

        // Check daily loss limit
        if (this.portfolioMetrics.dayPLPercent <= -this.riskParams.maxDailyLoss * 100) {
            console.log('Paper Trading Service: Daily loss limit reached');
            return null;
        }

        // Determine trade direction
        if (prediction.direction === 'neutral') {
            return null;
        }

        const side = prediction.direction === 'up' ? 'buy' : 'sell';
        const existingPosition = this.positions.get(prediction.symbol);

        // Calculate position size
        const maxPositionValue = this.portfolioMetrics.equity * this.riskParams.maxPositionSize;
        const qty = Math.floor(maxPositionValue / currentPrice);

        if (qty < 1) {
            console.log('Paper Trading Service: Position size too small');
            return null;
        }

        // Check if we should close existing position or open new
        if (existingPosition) {
            if ((existingPosition.side === 'long' && side === 'sell') ||
                (existingPosition.side === 'short' && side === 'buy')) {
                return this.closePosition(prediction.symbol, 'Signal reversal');
            }
            // Already have position in same direction
            return null;
        }

        return this.submitOrder(prediction.symbol, side, qty, prediction);
    }

    private async submitOrder(
        symbol: string,
        side: 'buy' | 'sell',
        qty: number,
        prediction: PredictionResult
    ): Promise<Trade | null> {
        try {
            const response = await fetch(`${config.alpaca.baseUrl}/v2/orders`, {
                method: 'POST',
                headers: {
                    'APCA-API-KEY-ID': config.alpaca.apiKey,
                    'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol,
                    qty: qty.toString(),
                    side,
                    type: 'market',
                    time_in_force: 'day',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Paper Trading Service: Order rejected', error);
                return null;
            }

            const order = await response.json();

            const trade: Trade = {
                id: order.id,
                symbol,
                side,
                qty,
                price: 0, // Will be filled
                timestamp: Date.now(),
                reason: `CNN prediction: ${prediction.direction} (${(prediction.confidence * 100).toFixed(1)}%)`,
                prediction,
            };

            this.trades.push(trade);
            this.notifyTrade(trade);

            // Refresh positions after order
            setTimeout(() => this.fetchPositions(), 2000);

            return trade;
        } catch (error) {
            console.error('Paper Trading Service: Order error', error);
            return null;
        }
    }

    async closePosition(symbol: string, reason: string): Promise<Trade | null> {
        const position = this.positions.get(symbol);
        if (!position) return null;

        const side = position.side === 'long' ? 'sell' : 'buy';

        try {
            const response = await fetch(`${config.alpaca.baseUrl}/v2/positions/${symbol}`, {
                method: 'DELETE',
                headers: {
                    'APCA-API-KEY-ID': config.alpaca.apiKey,
                    'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                },
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const order = await response.json();

            const trade: Trade = {
                id: order.id,
                symbol,
                side,
                qty: Math.abs(position.qty),
                price: position.currentPrice,
                timestamp: Date.now(),
                reason,
            };

            this.trades.push(trade);
            this.positions.delete(symbol);
            this.notifyTrade(trade);

            return trade;
        } catch (error) {
            console.error('Paper Trading Service: Close position error', error);
            return null;
        }
    }

    // Get portfolio metrics
    getPortfolioMetrics(): PortfolioMetrics {
        return { ...this.portfolioMetrics };
    }

    // Get all positions
    getPositions(): Position[] {
        return Array.from(this.positions.values());
    }

    // Get trade history
    getTrades(): Trade[] {
        return [...this.trades];
    }

    // Get risk parameters
    getRiskParams(): RiskParams {
        return { ...this.riskParams };
    }

    // Update risk parameters
    setRiskParams(params: Partial<RiskParams>) {
        this.riskParams = { ...this.riskParams, ...params };
    }

    // Subscribe to trade events
    onTrade(callback: (trade: Trade) => void) {
        this.tradeCallbacks.push(callback);
    }

    // Subscribe to position updates
    onPositionUpdate(callback: (positions: Position[]) => void) {
        this.positionCallbacks.push(callback);
    }

    private notifyTrade(trade: Trade) {
        this.tradeCallbacks.forEach(cb => cb(trade));
    }

    // Check if connected
    isActive(): boolean {
        return this.isConnected;
    }

    // Update price for position P&L calculation
    updatePrice(symbol: string, price: number) {
        const position = this.positions.get(symbol);
        if (position) {
            position.currentPrice = price;
            position.unrealizedPL = (price - position.entryPrice) * position.qty;
            position.unrealizedPLPercent = ((price - position.entryPrice) / position.entryPrice) * 100;

            // Check stop loss / take profit
            if (position.unrealizedPLPercent <= -this.riskParams.stopLossPercent * 100) {
                this.closePosition(symbol, 'Stop loss triggered');
            } else if (position.unrealizedPLPercent >= this.riskParams.takeProfitPercent * 100) {
                this.closePosition(symbol, 'Take profit triggered');
            }

            this.positionCallbacks.forEach(cb => cb(this.getPositions()));
        }
    }
}

export const paperTradingService = new PaperTradingService();
