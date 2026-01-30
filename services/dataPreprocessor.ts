// Data Preprocessor for CNN Model
// Handles normalization, feature engineering, and sliding window creation

import { config } from '../config';

export interface OHLCVData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface ProcessedData {
    input: number[][];     // [windowSize, features]
    labels?: number[];     // For training: [direction] 0=down, 1=neutral, 2=up
    normParams: NormalizationParams;
}

export interface NormalizationParams {
    priceMin: number;
    priceMax: number;
    volumeMin: number;
    volumeMax: number;
}

export interface TechnicalIndicators {
    sma20: number;
    sma50: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    bbUpper: number;
    bbLower: number;
    atr14: number;
}

class DataPreprocessor {
    private windowSize: number;
    private features: number;

    constructor() {
        this.windowSize = config.cnnModel.windowSize;
        this.features = config.cnnModel.features;
    }

    // Normalize price data using min-max scaling
    normalize(data: OHLCVData[]): { normalized: number[][]; params: NormalizationParams } {
        if (data.length === 0) {
            return { normalized: [], params: { priceMin: 0, priceMax: 1, volumeMin: 0, volumeMax: 1 } };
        }

        // Find min/max for prices and volume
        let priceMin = Infinity, priceMax = -Infinity;
        let volumeMin = Infinity, volumeMax = -Infinity;

        for (const bar of data) {
            priceMin = Math.min(priceMin, bar.open, bar.high, bar.low, bar.close);
            priceMax = Math.max(priceMax, bar.open, bar.high, bar.low, bar.close);
            volumeMin = Math.min(volumeMin, bar.volume);
            volumeMax = Math.max(volumeMax, bar.volume);
        }

        const priceRange = priceMax - priceMin || 1;
        const volumeRange = volumeMax - volumeMin || 1;

        const normalized = data.map(bar => [
            (bar.open - priceMin) / priceRange,
            (bar.high - priceMin) / priceRange,
            (bar.low - priceMin) / priceRange,
            (bar.close - priceMin) / priceRange,
            (bar.volume - volumeMin) / volumeRange,
        ]);

        return {
            normalized,
            params: { priceMin, priceMax, volumeMin, volumeMax }
        };
    }

    // Create sliding windows for time series input
    createSlidingWindows(data: number[][], horizon: number = 5): { windows: number[][][]; labels: number[] } {
        const windows: number[][][] = [];
        const labels: number[] = [];

        for (let i = 0; i <= data.length - this.windowSize - horizon; i++) {
            const window = data.slice(i, i + this.windowSize);
            windows.push(window);

            // Label based on price direction after horizon
            const currentClose = data[i + this.windowSize - 1][3]; // Close price
            const futureClose = data[i + this.windowSize + horizon - 1][3];

            const change = (futureClose - currentClose) / currentClose;

            // 0 = down (< -0.5%), 1 = neutral, 2 = up (> 0.5%)
            if (change < -0.005) {
                labels.push(0);
            } else if (change > 0.005) {
                labels.push(2);
            } else {
                labels.push(1);
            }
        }

        return { windows, labels };
    }

    // Calculate technical indicators
    calculateIndicators(data: OHLCVData[]): TechnicalIndicators {
        const closes = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);

        return {
            sma20: this.sma(closes, 20),
            sma50: this.sma(closes, 50),
            rsi14: this.rsi(closes, 14),
            macd: this.macd(closes).macd,
            macdSignal: this.macd(closes).signal,
            bbUpper: this.bollingerBands(closes, 20).upper,
            bbLower: this.bollingerBands(closes, 20).lower,
            atr14: this.atr(highs, lows, closes, 14),
        };
    }

    // Simple Moving Average
    private sma(data: number[], period: number): number {
        if (data.length < period) return data[data.length - 1] || 0;
        const slice = data.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }

    // Relative Strength Index
    private rsi(data: number[], period: number): number {
        if (data.length < period + 1) return 50;

        let gains = 0, losses = 0;
        for (let i = data.length - period; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    // MACD
    private macd(data: number[]): { macd: number; signal: number } {
        const ema12 = this.ema(data, 12);
        const ema26 = this.ema(data, 26);
        const macdLine = ema12 - ema26;

        // Simplified signal line
        return { macd: macdLine, signal: macdLine * 0.9 };
    }

    // Exponential Moving Average
    private ema(data: number[], period: number): number {
        if (data.length === 0) return 0;
        const multiplier = 2 / (period + 1);
        let ema = data[0];

        for (let i = 1; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }

        return ema;
    }

    // Bollinger Bands
    private bollingerBands(data: number[], period: number): { upper: number; lower: number } {
        const sma = this.sma(data, period);
        const slice = data.slice(-period);
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        return {
            upper: sma + 2 * stdDev,
            lower: sma - 2 * stdDev,
        };
    }

    // Average True Range
    private atr(highs: number[], lows: number[], closes: number[], period: number): number {
        if (highs.length < 2) return 0;

        const trueRanges: number[] = [];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }

        return this.sma(trueRanges, period);
    }

    // Prepare data for model input
    prepareModelInput(data: OHLCVData[]): ProcessedData | null {
        if (data.length < this.windowSize) {
            console.warn(`Need at least ${this.windowSize} bars for model input`);
            return null;
        }

        const { normalized, params } = this.normalize(data);
        const window = normalized.slice(-this.windowSize);

        return {
            input: window,
            normParams: params,
        };
    }

    // Prepare training data
    prepareTrainingData(data: OHLCVData[]): { inputs: number[][][]; labels: number[] } | null {
        const horizon = config.cnnModel.predictionHorizon;
        const minRequired = this.windowSize + horizon;

        if (data.length < minRequired) {
            console.warn(`Need at least ${minRequired} bars for training data`);
            return null;
        }

        const { normalized } = this.normalize(data);
        const { windows, labels } = this.createSlidingWindows(normalized, horizon);

        return { inputs: windows, labels };
    }
}

export const dataPreprocessor = new DataPreprocessor();
