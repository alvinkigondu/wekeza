import { config } from '../config';
import { SentimentSource } from '../types';

export interface FinnhubNews {
    category: string;
    datetime: number;
    headline: string;
    id: number;
    image: string;
    related: string;
    source: string;
    summary: string;
    url: string;
}

export interface FinnhubQuote {
    currentPrice: number;
    change: number;
    percentChange: number;
    highPrice: number;
    lowPrice: number;
    openPrice: number;
    previousClose: number;
    timestamp: number;
}

export interface FinnhubSentiment {
    buzz: {
        articlesInLastWeek: number;
        buzzScore: number;
        weeklyAverage: number;
    };
    companyNewsScore: number;
    sectorAverageBullishPercent: number;
    sectorAverageNewsScore: number;
    sentiment: {
        bearishPercent: number;
        bullishPercent: number;
    };
    symbol: string;
}

class FinnhubService {
    private baseUrl = config.finnhub.baseUrl;
    private apiKey = config.finnhub.apiKey;
    private ws: WebSocket | null = null;
    private isConnected = false;
    private priceCallbacks: Map<string, ((price: number) => void)[]> = new Map();
    private subscribedSymbols: Set<string> = new Set();

    constructor() {
        if (config.finnhub.enabled) {
            this.connectWebSocket();
        }
    }

    private connectWebSocket() {
        if (!config.finnhub.enabled) return;

        try {
            this.ws = new WebSocket(`${config.finnhub.wsUrl}?token=${this.apiKey}`);

            this.ws.onopen = () => {
                console.log('Finnhub WebSocket connected');
                this.isConnected = true;
                this.resubscribe();
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'trade' && data.data) {
                    for (const trade of data.data) {
                        const callbacks = this.priceCallbacks.get(trade.s) || [];
                        callbacks.forEach((cb) => cb(trade.p));
                    }
                }
            };

            this.ws.onerror = (error) => {
                console.error('Finnhub WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('Finnhub WebSocket closed');
                this.isConnected = false;
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (error) {
            console.error('Failed to create Finnhub WebSocket:', error);
        }
    }

    private resubscribe() {
        if (this.subscribedSymbols.size > 0) {
            this.subscribedSymbols.forEach((symbol) => {
                if (this.ws && this.isConnected) {
                    this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
                }
            });
        }
    }

    subscribe(symbol: string) {
        this.subscribedSymbols.add(symbol);
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({ type: 'subscribe', symbol }));
        }
    }

    unsubscribe(symbol: string) {
        this.subscribedSymbols.delete(symbol);
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol }));
        }
    }

    onPrice(symbol: string, callback: (price: number) => void) {
        if (!this.priceCallbacks.has(symbol)) {
            this.priceCallbacks.set(symbol, []);
            this.subscribe(symbol);
        }
        this.priceCallbacks.get(symbol)!.push(callback);
    }

    async getQuote(symbol: string): Promise<FinnhubQuote | null> {
        if (!config.finnhub.enabled) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/quote?symbol=${symbol}&token=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return {
                currentPrice: data.c,
                change: data.d,
                percentChange: data.dp,
                highPrice: data.h,
                lowPrice: data.l,
                openPrice: data.o,
                previousClose: data.pc,
                timestamp: data.t * 1000,
            };
        } catch (error) {
            console.error('Failed to fetch Finnhub quote:', error);
            return null;
        }
    }

    async getMarketNews(category: string = 'general'): Promise<FinnhubNews[]> {
        if (!config.finnhub.enabled) return [];

        try {
            const response = await fetch(
                `${this.baseUrl}/news?category=${category}&token=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return data.slice(0, 20); // Limit to 20 articles
        } catch (error) {
            console.error('Failed to fetch market news:', error);
            return [];
        }
    }

    async getCompanyNews(
        symbol: string,
        from: string,
        to: string
    ): Promise<FinnhubNews[]> {
        if (!config.finnhub.enabled) return [];

        try {
            const response = await fetch(
                `${this.baseUrl}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return data.slice(0, 20);
        } catch (error) {
            console.error('Failed to fetch company news:', error);
            return [];
        }
    }

    async getNewsSentiment(symbol: string): Promise<FinnhubSentiment | null> {
        if (!config.finnhub.enabled) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/news-sentiment?symbol=${symbol}&token=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error('Failed to fetch news sentiment:', error);
            return null;
        }
    }

    // Convert Finnhub news to our SentimentSource format
    convertToSentimentSources(news: FinnhubNews[]): SentimentSource[] {
        return news.map((article) => ({
            id: article.id.toString(),
            type: 'news' as const,
            title: article.headline,
            source: article.source,
            sentiment: this.estimateSentiment(article.headline + ' ' + article.summary),
            magnitude: 0.7,
            timestamp: article.datetime * 1000,
            keywords: this.extractKeywords(article.headline),
        }));
    }

    // Simple keyword-based sentiment estimation
    private estimateSentiment(text: string): number {
        const positiveWords = [
            'surge', 'jump', 'gain', 'rise', 'rally', 'bullish', 'growth', 'profit',
            'beat', 'exceed', 'strong', 'record', 'high', 'upgrade', 'positive', 'soar',
            'boom', 'optimism', 'breakthrough', 'success'
        ];

        const negativeWords = [
            'fall', 'drop', 'decline', 'plunge', 'crash', 'bearish', 'loss', 'miss',
            'weak', 'low', 'downgrade', 'negative', 'concern', 'fear', 'risk', 'crisis',
            'recession', 'inflation', 'layoff', 'cut'
        ];

        const lowerText = text.toLowerCase();
        let score = 0;

        positiveWords.forEach((word) => {
            if (lowerText.includes(word)) score += 0.15;
        });

        negativeWords.forEach((word) => {
            if (lowerText.includes(word)) score -= 0.15;
        });

        return Math.max(-1, Math.min(1, score));
    }

    private extractKeywords(text: string): string[] {
        const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'in', 'for', 'on', 'with'];
        const words = text.toLowerCase().split(/\W+/).filter((word) =>
            word.length > 3 && !stopWords.includes(word)
        );
        return [...new Set(words)].slice(0, 5);
    }

    isEnabled() {
        return config.finnhub.enabled;
    }

    getConnectionStatus() {
        return this.isConnected ? 'connected' : 'disconnected';
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export const finnhubService = new FinnhubService();
