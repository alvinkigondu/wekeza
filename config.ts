// API Configuration
// These values are read from environment variables for security
// Create a .env.local file with your API keys

export const config = {
    // Alpaca API - Free paper trading account at https://alpaca.markets
    alpaca: {
        apiKey: import.meta.env.VITE_ALPACA_API_KEY || '',
        secretKey: import.meta.env.VITE_ALPACA_SECRET_KEY || '',
        baseUrl: 'https://paper-api.alpaca.markets', // Paper trading
        dataUrl: 'https://data.alpaca.markets',
        wsUrl: 'wss://stream.data.alpaca.markets/v2/iex',
        enabled: !!import.meta.env.VITE_ALPACA_API_KEY,
    },

    // Polygon.io API - Free tier at https://polygon.io
    polygon: {
        apiKey: import.meta.env.VITE_POLYGON_API_KEY || '',
        baseUrl: 'https://api.polygon.io',
        enabled: !!import.meta.env.VITE_POLYGON_API_KEY,
    },

    // Finnhub API - Free tier at https://finnhub.io
    finnhub: {
        apiKey: import.meta.env.VITE_FINNHUB_API_KEY || '',
        baseUrl: 'https://finnhub.io/api/v1',
        wsUrl: 'wss://ws.finnhub.io',
        enabled: !!import.meta.env.VITE_FINNHUB_API_KEY,
    },

    // Default symbols to track (ETFs + Stocks)
    defaultSymbols: ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMD', 'GOOGL'],

    // Crypto symbols (Alpaca supports these - real-time on free tier)
    cryptoSymbols: ['BTC/USD', 'ETH/USD'],

    // African stocks watchlist (requires alternative data source)
    africanStocks: ['SCOM.NR'], // Safaricom - Nairobi Stock Exchange

    // Update intervals (ms)
    intervals: {
        quotes: 1000,       // Real-time quotes
        bars: 60000,        // 1-minute bars
        news: 300000,       // News updates every 5 min
        sentiment: 60000,   // Sentiment calculation
    },

    // Feature flags
    features: {
        // Use real data if keys are present, unless explicitly disabled
        useRealData: import.meta.env.VITE_USE_REAL_DATA !== 'false' &&
            (!!import.meta.env.VITE_ALPACA_API_KEY ||
                !!import.meta.env.VITE_POLYGON_API_KEY ||
                !!import.meta.env.VITE_FINNHUB_API_KEY),
        useMockFallback: true,  // Fall back to mock data if APIs fail
        enableCrypto: true,
        enableCNN: true,        // Enable CNN model predictions
    },

    // CNN Model configuration
    cnnModel: {
        windowSize: 60,         // Number of time steps for input
        features: 5,            // OHLCV
        predictionHorizon: 5,   // Predict 5 bars ahead
        confidenceThreshold: 0.6,
        pythonBackendUrl: 'http://localhost:8000',
    },
};

// Check if any real data provider is configured
export const hasRealDataProvider = () => {
    return config.alpaca.enabled || config.polygon.enabled || config.finnhub.enabled;
};

// Get active data providers
export const getActiveProviders = () => {
    const providers: string[] = [];
    if (config.alpaca.enabled) providers.push('Alpaca');
    if (config.polygon.enabled) providers.push('Polygon');
    if (config.finnhub.enabled) providers.push('Finnhub');
    return providers;
};
