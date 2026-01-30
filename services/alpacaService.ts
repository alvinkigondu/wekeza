import { config } from '../config';

export interface AlpacaQuote {
    symbol: string;
    bidPrice: number;
    bidSize: number;
    askPrice: number;
    askSize: number;
    timestamp: number;
}

export interface AlpacaTrade {
    symbol: string;
    price: number;
    size: number;
    timestamp: number;
    tradeId: string;
    exchange: string;
    conditions: string[];
}

export interface AlpacaBar {
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
    vwap: number;
    tradeCount: number;
}

type QuoteCallback = (quote: AlpacaQuote) => void;
type TradeCallback = (trade: AlpacaTrade) => void;
type BarCallback = (bar: AlpacaBar) => void;

class AlpacaService {
    private ws: WebSocket | null = null;
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private quoteCallbacks: Map<string, QuoteCallback[]> = new Map();
    private tradeCallbacks: Map<string, TradeCallback[]> = new Map();
    private barCallbacks: Map<string, BarCallback[]> = new Map();
    private subscribedSymbols: Set<string> = new Set();

    constructor() {
        if (config.alpaca.enabled) {
            this.connect();
        }
    }

    private connect() {
        if (!config.alpaca.enabled) {
            console.warn('Alpaca API not configured');
            return;
        }

        try {
            this.ws = new WebSocket(config.alpaca.wsUrl);

            this.ws.onopen = () => {
                console.log('Alpaca WebSocket connected');
                this.authenticate();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onerror = (error) => {
                console.error('Alpaca WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('Alpaca WebSocket closed');
                this.isConnected = false;
                this.attemptReconnect();
            };
        } catch (error) {
            console.error('Failed to create Alpaca WebSocket:', error);
        }
    }

    private authenticate() {
        if (!this.ws) return;

        const authMessage = {
            action: 'auth',
            key: config.alpaca.apiKey,
            secret: config.alpaca.secretKey,
        };

        this.ws.send(JSON.stringify(authMessage));
    }

    private handleMessage(data: any[]) {
        for (const msg of data) {
            switch (msg.T) {
                case 'success':
                    if (msg.msg === 'authenticated') {
                        console.log('Alpaca authenticated');
                        this.isConnected = true;
                        this.reconnectAttempts = 0;
                        this.resubscribe();
                    }
                    break;
                case 'q': // Quote
                    this.handleQuote(msg);
                    break;
                case 't': // Trade
                    this.handleTrade(msg);
                    break;
                case 'b': // Bar
                    this.handleBar(msg);
                    break;
                case 'error':
                    console.error('Alpaca error:', msg.msg);
                    break;
            }
        }
    }

    private handleQuote(msg: any) {
        const quote: AlpacaQuote = {
            symbol: msg.S,
            bidPrice: msg.bp,
            bidSize: msg.bs,
            askPrice: msg.ap,
            askSize: msg.as,
            timestamp: new Date(msg.t).getTime(),
        };

        const callbacks = this.quoteCallbacks.get(msg.S) || [];
        callbacks.forEach((cb) => cb(quote));
    }

    private handleTrade(msg: any) {
        const trade: AlpacaTrade = {
            symbol: msg.S,
            price: msg.p,
            size: msg.s,
            timestamp: new Date(msg.t).getTime(),
            tradeId: msg.i,
            exchange: msg.x,
            conditions: msg.c || [],
        };

        const callbacks = this.tradeCallbacks.get(msg.S) || [];
        callbacks.forEach((cb) => cb(trade));
    }

    private handleBar(msg: any) {
        const bar: AlpacaBar = {
            symbol: msg.S,
            open: msg.o,
            high: msg.h,
            low: msg.l,
            close: msg.c,
            volume: msg.v,
            timestamp: new Date(msg.t).getTime(),
            vwap: msg.vw,
            tradeCount: msg.n,
        };

        const callbacks = this.barCallbacks.get(msg.S) || [];
        callbacks.forEach((cb) => cb(bar));
    }

    private attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    private resubscribe() {
        if (this.subscribedSymbols.size > 0) {
            this.subscribe(Array.from(this.subscribedSymbols));
        }
    }

    subscribe(symbols: string[]) {
        if (!this.ws || !this.isConnected) {
            symbols.forEach((s) => this.subscribedSymbols.add(s));
            return;
        }

        const subscribeMessage = {
            action: 'subscribe',
            quotes: symbols,
            trades: symbols,
            bars: symbols,
        };

        this.ws.send(JSON.stringify(subscribeMessage));
        symbols.forEach((s) => this.subscribedSymbols.add(s));
    }

    unsubscribe(symbols: string[]) {
        if (!this.ws || !this.isConnected) return;

        const unsubscribeMessage = {
            action: 'unsubscribe',
            quotes: symbols,
            trades: symbols,
            bars: symbols,
        };

        this.ws.send(JSON.stringify(unsubscribeMessage));
        symbols.forEach((s) => this.subscribedSymbols.delete(s));
    }

    onQuote(symbol: string, callback: QuoteCallback) {
        if (!this.quoteCallbacks.has(symbol)) {
            this.quoteCallbacks.set(symbol, []);
        }
        this.quoteCallbacks.get(symbol)!.push(callback);
    }

    onTrade(symbol: string, callback: TradeCallback) {
        if (!this.tradeCallbacks.has(symbol)) {
            this.tradeCallbacks.set(symbol, []);
        }
        this.tradeCallbacks.get(symbol)!.push(callback);
    }

    onBar(symbol: string, callback: BarCallback) {
        if (!this.barCallbacks.has(symbol)) {
            this.barCallbacks.set(symbol, []);
        }
        this.barCallbacks.get(symbol)!.push(callback);
    }

    // REST API Methods
    async getLatestBars(symbols: string[], timeframe: string = '1Min'): Promise<AlpacaBar[]> {
        if (!config.alpaca.enabled) return [];

        try {
            const response = await fetch(
                `${config.alpaca.dataUrl}/v2/stocks/bars/latest?symbols=${symbols.join(',')}`,
                {
                    headers: {
                        'APCA-API-KEY-ID': config.alpaca.apiKey,
                        'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                    },
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return Object.entries(data.bars).map(([symbol, bar]: [string, any]) => ({
                symbol,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                timestamp: new Date(bar.t).getTime(),
                vwap: bar.vw,
                tradeCount: bar.n,
            }));
        } catch (error) {
            console.error('Failed to fetch Alpaca bars:', error);
            return [];
        }
    }

    async getHistoricalBars(
        symbol: string,
        timeframe: string = '1Min',
        start: Date,
        end: Date
    ): Promise<AlpacaBar[]> {
        if (!config.alpaca.enabled) return [];

        try {
            const response = await fetch(
                `${config.alpaca.dataUrl}/v2/stocks/${symbol}/bars?` +
                `timeframe=${timeframe}&start=${start.toISOString()}&end=${end.toISOString()}`,
                {
                    headers: {
                        'APCA-API-KEY-ID': config.alpaca.apiKey,
                        'APCA-API-SECRET-KEY': config.alpaca.secretKey,
                    },
                }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return data.bars.map((bar: any) => ({
                symbol,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                timestamp: new Date(bar.t).getTime(),
                vwap: bar.vw,
                tradeCount: bar.n,
            }));
        } catch (error) {
            console.error('Failed to fetch historical bars:', error);
            return [];
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isEnabled() {
        return config.alpaca.enabled;
    }

    getConnectionStatus() {
        return this.isConnected ? 'connected' : 'disconnected';
    }
}

export const alpacaService = new AlpacaService();
