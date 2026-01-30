import { config } from '../config';

export interface PolygonBar {
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap: number;
    timestamp: number;
    transactions: number;
}

export interface PolygonNews {
    id: string;
    title: string;
    description: string;
    author: string;
    publishedUtc: string;
    articleUrl: string;
    imageUrl?: string;
    tickers: string[];
    keywords: string[];
    source: string;
}

export interface PolygonTicker {
    symbol: string;
    name: string;
    market: string;
    locale: string;
    primaryExchange: string;
    type: string;
    currencyName: string;
}

class PolygonService {
    private baseUrl = config.polygon.baseUrl;
    private apiKey = config.polygon.apiKey;

    async getAggregates(
        symbol: string,
        multiplier: number = 1,
        timespan: 'minute' | 'hour' | 'day' = 'minute',
        from: string,
        to: string
    ): Promise<PolygonBar[]> {
        if (!config.polygon.enabled) return [];

        try {
            const response = await fetch(
                `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&apiKey=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.status !== 'OK' || !data.results) return [];

            return data.results.map((bar: any) => ({
                symbol,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
                timestamp: bar.t,
                transactions: bar.n,
            }));
        } catch (error) {
            console.error('Failed to fetch Polygon aggregates:', error);
            return [];
        }
    }

    async getPreviousClose(symbol: string): Promise<PolygonBar | null> {
        if (!config.polygon.enabled) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.status !== 'OK' || !data.results?.[0]) return null;

            const bar = data.results[0];
            return {
                symbol,
                open: bar.o,
                high: bar.h,
                low: bar.l,
                close: bar.c,
                volume: bar.v,
                vwap: bar.vw,
                timestamp: bar.t,
                transactions: bar.n,
            };
        } catch (error) {
            console.error('Failed to fetch previous close:', error);
            return null;
        }
    }

    async getNews(
        ticker?: string,
        limit: number = 10
    ): Promise<PolygonNews[]> {
        if (!config.polygon.enabled) return [];

        try {
            let url = `${this.baseUrl}/v2/reference/news?limit=${limit}&order=desc&sort=published_utc&apiKey=${this.apiKey}`;

            if (ticker) {
                url += `&ticker=${ticker}`;
            }

            const response = await fetch(url);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.status !== 'OK' || !data.results) return [];

            return data.results.map((article: any) => ({
                id: article.id,
                title: article.title,
                description: article.description || '',
                author: article.author || 'Unknown',
                publishedUtc: article.published_utc,
                articleUrl: article.article_url,
                imageUrl: article.image_url,
                tickers: article.tickers || [],
                keywords: article.keywords || [],
                source: article.publisher?.name || 'Unknown',
            }));
        } catch (error) {
            console.error('Failed to fetch news:', error);
            return [];
        }
    }

    async getMarketStatus(): Promise<{ market: string; serverTime: string; exchanges: any } | null> {
        if (!config.polygon.enabled) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/v1/marketstatus/now?apiKey=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            return {
                market: data.market,
                serverTime: data.serverTime,
                exchanges: data.exchanges,
            };
        } catch (error) {
            console.error('Failed to fetch market status:', error);
            return null;
        }
    }

    async getTickerDetails(symbol: string): Promise<PolygonTicker | null> {
        if (!config.polygon.enabled) return null;

        try {
            const response = await fetch(
                `${this.baseUrl}/v3/reference/tickers/${symbol}?apiKey=${this.apiKey}`
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            if (data.status !== 'OK' || !data.results) return null;

            return {
                symbol: data.results.ticker,
                name: data.results.name,
                market: data.results.market,
                locale: data.results.locale,
                primaryExchange: data.results.primary_exchange,
                type: data.results.type,
                currencyName: data.results.currency_name,
            };
        } catch (error) {
            console.error('Failed to fetch ticker details:', error);
            return null;
        }
    }

    isEnabled() {
        return config.polygon.enabled;
    }
}

export const polygonService = new PolygonService();
