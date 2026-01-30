import { config, hasRealDataProvider } from '../config';
import { alpacaService, AlpacaQuote, AlpacaTrade, AlpacaBar } from './alpacaService';
import { polygonService, PolygonNews } from './polygonService';
import { finnhubService, FinnhubNews } from './finnhubService';
import { mockWebSocketService } from './mockWebSocket';
import { SentimentData, SentimentSource } from '../types';

export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    volume: number;
    timestamp: number;
    source: 'alpaca' | 'polygon' | 'finnhub' | 'mock';
}

export interface UnifiedNews {
    id: string;
    title: string;
    summary: string;
    source: string;
    publishedAt: number;
    url: string;
    tickers: string[];
    sentiment: number;
    keywords: string[];
}

type MarketDataCallback = (data: MarketData) => void;
type NewsCallback = (news: UnifiedNews[]) => void;

class DataService {
    private marketDataCallbacks: Map<string, MarketDataCallback[]> = new Map();
    private newsCallbacks: NewsCallback[] = [];
    private cachedMarketData: Map<string, MarketData> = new Map();
    private cachedNews: UnifiedNews[] = [];
    private newsUpdateInterval: number | null = null;
    private isUsingRealData = false;

    constructor() {
        this.isUsingRealData = hasRealDataProvider() && config.features.useRealData;
        this.initialize();
    }

    private initialize() {
        if (this.isUsingRealData) {
            console.log('DataService: Using real market data providers');
            this.startNewsPolling();
        } else {
            console.log('DataService: Using mock data (configure API keys for real data)');
        }
    }

    // Subscribe to real-time market data
    subscribeMarketData(symbol: string, callback: MarketDataCallback) {
        if (!this.marketDataCallbacks.has(symbol)) {
            this.marketDataCallbacks.set(symbol, []);
            this.setupMarketDataStream(symbol);
        }
        this.marketDataCallbacks.get(symbol)!.push(callback);

        // Send cached data immediately if available
        const cached = this.cachedMarketData.get(symbol);
        if (cached) {
            callback(cached);
        }
    }

    private setupMarketDataStream(symbol: string) {
        if (this.isUsingRealData) {
            // Try Alpaca first
            if (config.alpaca.enabled) {
                alpacaService.subscribe([symbol]);
                alpacaService.onQuote(symbol, (quote) => {
                    this.handleQuote(quote);
                });
                alpacaService.onTrade(symbol, (trade) => {
                    this.handleTrade(trade);
                });
            }
            // Also set up Finnhub for redundancy
            else if (config.finnhub.enabled) {
                finnhubService.onPrice(symbol, (price) => {
                    this.updatePrice(symbol, price, 'finnhub');
                });
            }
        } else {
            // Use mock data - subscribe to mock WebSocket
            mockWebSocketService.on('marketUpdate', (tick: any) => {
                const data: MarketData = {
                    symbol: 'ES_F',
                    price: tick.price,
                    change: tick.price - tick.vwap,
                    changePercent: ((tick.price - tick.vwap) / tick.vwap) * 100,
                    high: tick.price + 2,
                    low: tick.price - 2,
                    open: tick.vwap,
                    volume: 0,
                    timestamp: tick.time,
                    source: 'mock',
                };
                this.emitMarketData(data);
            });
        }
    }

    private handleQuote(quote: AlpacaQuote) {
        const midPrice = (quote.bidPrice + quote.askPrice) / 2;
        const cached = this.cachedMarketData.get(quote.symbol);

        const data: MarketData = {
            symbol: quote.symbol,
            price: midPrice,
            change: cached ? midPrice - cached.open : 0,
            changePercent: cached ? ((midPrice - cached.open) / cached.open) * 100 : 0,
            high: cached?.high ? Math.max(cached.high, midPrice) : midPrice,
            low: cached?.low ? Math.min(cached.low, midPrice) : midPrice,
            open: cached?.open || midPrice,
            volume: cached?.volume || 0,
            timestamp: quote.timestamp,
            source: 'alpaca',
        };

        this.emitMarketData(data);
    }

    private handleTrade(trade: AlpacaTrade) {
        const cached = this.cachedMarketData.get(trade.symbol);

        const data: MarketData = {
            symbol: trade.symbol,
            price: trade.price,
            change: cached ? trade.price - cached.open : 0,
            changePercent: cached ? ((trade.price - cached.open) / cached.open) * 100 : 0,
            high: cached?.high ? Math.max(cached.high, trade.price) : trade.price,
            low: cached?.low ? Math.min(cached.low, trade.price) : trade.price,
            open: cached?.open || trade.price,
            volume: (cached?.volume || 0) + trade.size,
            timestamp: trade.timestamp,
            source: 'alpaca',
        };

        this.emitMarketData(data);
    }

    private updatePrice(symbol: string, price: number, source: 'finnhub') {
        const cached = this.cachedMarketData.get(symbol);

        const data: MarketData = {
            symbol,
            price,
            change: cached ? price - cached.open : 0,
            changePercent: cached ? ((price - cached.open) / cached.open) * 100 : 0,
            high: cached?.high ? Math.max(cached.high, price) : price,
            low: cached?.low ? Math.min(cached.low, price) : price,
            open: cached?.open || price,
            volume: cached?.volume || 0,
            timestamp: Date.now(),
            source,
        };

        this.emitMarketData(data);
    }

    private emitMarketData(data: MarketData) {
        this.cachedMarketData.set(data.symbol, data);
        const callbacks = this.marketDataCallbacks.get(data.symbol) || [];
        callbacks.forEach((cb) => cb(data));
    }

    // News Subscription
    subscribeNews(callback: NewsCallback) {
        this.newsCallbacks.push(callback);

        // Send cached news immediately
        if (this.cachedNews.length > 0) {
            callback(this.cachedNews);
        }
    }

    private startNewsPolling() {
        // Fetch immediately
        this.fetchNews();

        // Then poll periodically
        this.newsUpdateInterval = window.setInterval(() => {
            this.fetchNews();
        }, config.intervals.news);
    }

    private async fetchNews() {
        const news: UnifiedNews[] = [];

        // Try Polygon first
        if (config.polygon.enabled) {
            try {
                const polygonNews = await polygonService.getNews(undefined, 10);
                news.push(...polygonNews.map(this.convertPolygonNews));
            } catch (error) {
                console.error('Failed to fetch Polygon news:', error);
            }
        }

        // Then Finnhub
        if (config.finnhub.enabled && news.length < 10) {
            try {
                const finnhubNews = await finnhubService.getMarketNews();
                const converted = finnhubService.convertToSentimentSources(finnhubNews);
                news.push(...converted.map((s) => this.convertSentimentToNews(s)));
            } catch (error) {
                console.error('Failed to fetch Finnhub news:', error);
            }
        }

        // Update cache and notify subscribers
        if (news.length > 0) {
            this.cachedNews = news.slice(0, 15); // Keep top 15
            this.newsCallbacks.forEach((cb) => cb(this.cachedNews));
        }
    }

    private convertPolygonNews(article: PolygonNews): UnifiedNews {
        return {
            id: article.id,
            title: article.title,
            summary: article.description,
            source: article.source,
            publishedAt: new Date(article.publishedUtc).getTime(),
            url: article.articleUrl,
            tickers: article.tickers,
            sentiment: 0, // Will be calculated
            keywords: article.keywords,
        };
    }

    private convertSentimentToNews(source: SentimentSource): UnifiedNews {
        return {
            id: source.id,
            title: source.title,
            summary: '',
            source: source.source,
            publishedAt: source.timestamp,
            url: '',
            tickers: [],
            sentiment: source.sentiment,
            keywords: source.keywords,
        };
    }

    // Get aggregated sentiment data
    async getSentimentData(): Promise<SentimentData> {
        if (!this.isUsingRealData) {
            // Return mock sentiment data
            return new Promise((resolve) => {
                mockWebSocketService.on('sentimentUpdate', (data: SentimentData) => {
                    resolve(data);
                });
            });
        }

        // Calculate from real news
        const sources: SentimentSource[] = this.cachedNews.map((n) => ({
            id: n.id,
            type: 'news' as const,
            title: n.title,
            source: n.source,
            sentiment: n.sentiment,
            magnitude: 0.7,
            timestamp: n.publishedAt,
            keywords: n.keywords,
        }));

        const overallScore = sources.length > 0
            ? sources.reduce((sum, s) => sum + s.sentiment, 0) / sources.length
            : 0;

        return {
            overallScore,
            magnitude: 0.7,
            trend: overallScore > 0.2 ? 'improving' : overallScore < -0.2 ? 'deteriorating' : 'stable',
            sources,
            keywords: this.extractTopKeywords(sources),
            lastUpdated: Date.now(),
        };
    }

    private extractTopKeywords(sources: SentimentSource[]) {
        const keywordCounts: Map<string, { count: number; sentiment: number }> = new Map();

        sources.forEach((s) => {
            s.keywords.forEach((kw) => {
                const existing = keywordCounts.get(kw);
                if (existing) {
                    existing.count++;
                    existing.sentiment = (existing.sentiment + s.sentiment) / 2;
                } else {
                    keywordCounts.set(kw, { count: 1, sentiment: s.sentiment });
                }
            });
        });

        return Array.from(keywordCounts.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([keyword, data]) => ({
                keyword,
                count: data.count,
                sentiment: data.sentiment,
                trend: 'stable' as const,
            }));
    }

    // Status methods
    getDataSource(): string {
        if (!this.isUsingRealData) return 'Mock Data';

        const sources: string[] = [];
        if (config.alpaca.enabled) sources.push('Alpaca');
        if (config.polygon.enabled) sources.push('Polygon');
        if (config.finnhub.enabled) sources.push('Finnhub');

        return sources.join(' + ') || 'None';
    }

    isRealDataEnabled(): boolean {
        return this.isUsingRealData;
    }

    // Cleanup
    destroy() {
        if (this.newsUpdateInterval) {
            clearInterval(this.newsUpdateInterval);
        }
        alpacaService.disconnect();
        finnhubService.disconnect();
    }
}

export const dataService = new DataService();
