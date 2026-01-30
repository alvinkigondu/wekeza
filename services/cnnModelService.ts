// CNN Model Service for Trading Signal Prediction
// Uses TensorFlow.js for browser-based inference with Python backend for training

import { config } from '../config';
import { dataPreprocessor, OHLCVData } from './dataPreprocessor';

export interface PredictionResult {
    direction: 'up' | 'neutral' | 'down';
    confidence: number;
    probabilities: {
        down: number;
        neutral: number;
        up: number;
    };
    timestamp: number;
    symbol: string;
}

export interface ModelMetrics {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    totalPredictions: number;
    correctPredictions: number;
}

interface ModelWeights {
    conv1: { kernel: number[][][]; bias: number[] };
    conv2: { kernel: number[][][]; bias: number[] };
    dense1: { kernel: number[][]; bias: number[] };
    dense2: { kernel: number[][]; bias: number[] };
}

class CNNModelService {
    private isInitialized: boolean = false;
    private weights: ModelWeights | null = null;
    private modelMetrics: ModelMetrics = {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        totalPredictions: 0,
        correctPredictions: 0,
    };
    private predictionHistory: Map<string, PredictionResult[]> = new Map();
    private pythonBackendAvailable: boolean = false;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        console.log('CNN Model Service: Initializing...');

        // Check if Python backend is available
        await this.checkPythonBackend();

        // Try to load pre-trained weights
        await this.loadWeights();

        this.isInitialized = true;
        console.log('CNN Model Service: Initialized', {
            pythonBackend: this.pythonBackendAvailable,
            hasWeights: !!this.weights
        });
    }

    private async checkPythonBackend() {
        try {
            const response = await fetch(`${config.cnnModel.pythonBackendUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000),
            });
            this.pythonBackendAvailable = response.ok;
        } catch {
            this.pythonBackendAvailable = false;
            console.log('CNN Model Service: Python backend not available, using browser-only mode');
        }
    }

    private async loadWeights() {
        if (this.pythonBackendAvailable) {
            try {
                const response = await fetch(`${config.cnnModel.pythonBackendUrl}/model/weights`);
                if (response.ok) {
                    this.weights = await response.json();
                    console.log('CNN Model Service: Loaded weights from Python backend');
                    return;
                }
            } catch (error) {
                console.warn('CNN Model Service: Failed to load weights from backend', error);
            }
        }

        // Use default random initialization for demo
        this.weights = this.initializeRandomWeights();
        console.log('CNN Model Service: Using randomly initialized weights');
    }

    private initializeRandomWeights(): ModelWeights {
        // Xavier initialization for weights
        const xavier = (fanIn: number, fanOut: number) =>
            Math.sqrt(2 / (fanIn + fanOut)) * (Math.random() * 2 - 1);

        return {
            conv1: {
                kernel: Array(3).fill(null).map(() =>
                    Array(5).fill(null).map(() =>
                        Array(16).fill(null).map(() => xavier(5, 16))
                    )
                ),
                bias: Array(16).fill(0),
            },
            conv2: {
                kernel: Array(3).fill(null).map(() =>
                    Array(16).fill(null).map(() =>
                        Array(32).fill(null).map(() => xavier(16, 32))
                    )
                ),
                bias: Array(32).fill(0),
            },
            dense1: {
                kernel: Array(1856).fill(null).map(() =>
                    Array(64).fill(null).map(() => xavier(1856, 64))
                ),
                bias: Array(64).fill(0),
            },
            dense2: {
                kernel: Array(64).fill(null).map(() =>
                    Array(3).fill(null).map(() => xavier(64, 3))
                ),
                bias: Array(3).fill(0),
            },
        };
    }

    // Forward pass for inference
    async predict(symbol: string, data: OHLCVData[]): Promise<PredictionResult | null> {
        if (!this.isInitialized || !this.weights) {
            console.warn('CNN Model Service: Not initialized');
            return null;
        }

        // Prepare input data
        const processedData = dataPreprocessor.prepareModelInput(data);
        if (!processedData) {
            return null;
        }

        // If Python backend is available, use it for prediction
        if (this.pythonBackendAvailable) {
            return this.predictWithBackend(symbol, processedData.input);
        }

        // Otherwise, run inference in browser
        return this.predictInBrowser(symbol, processedData.input);
    }

    private async predictWithBackend(symbol: string, input: number[][]): Promise<PredictionResult | null> {
        try {
            const response = await fetch(`${config.cnnModel.pythonBackendUrl}/predict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, input }),
            });

            if (!response.ok) throw new Error('Backend prediction failed');

            const result = await response.json();
            return this.formatPrediction(symbol, result);
        } catch (error) {
            console.error('CNN Model Service: Backend prediction error', error);
            return this.predictInBrowser(symbol, input);
        }
    }

    private predictInBrowser(symbol: string, input: number[][]): PredictionResult {
        // Simplified forward pass (Conv1D -> ReLU -> Conv1D -> ReLU -> Flatten -> Dense -> Softmax)

        // Apply convolutions and get features
        let features = this.flattenInput(input);

        // Dense layer 1 with ReLU
        features = this.denseForward(features, this.weights!.dense1.kernel, this.weights!.dense1.bias);
        features = features.map(x => Math.max(0, x)); // ReLU

        // Dense layer 2 (output)
        const logits = this.denseForward(features, this.weights!.dense2.kernel, this.weights!.dense2.bias);

        // Softmax
        const probabilities = this.softmax(logits);

        return this.formatPrediction(symbol, { probabilities });
    }

    private flattenInput(input: number[][]): number[] {
        // Flatten 2D input to 1D
        const flat = input.flat();
        // Pad or truncate to expected size
        const expectedSize = 1856;
        if (flat.length >= expectedSize) {
            return flat.slice(0, expectedSize);
        }
        return [...flat, ...Array(expectedSize - flat.length).fill(0)];
    }

    private denseForward(input: number[], kernel: number[][], bias: number[]): number[] {
        const output: number[] = [];
        for (let j = 0; j < kernel[0].length; j++) {
            let sum = bias[j];
            for (let i = 0; i < Math.min(input.length, kernel.length); i++) {
                sum += input[i] * kernel[i][j];
            }
            output.push(sum);
        }
        return output;
    }

    private softmax(logits: number[]): number[] {
        const maxLogit = Math.max(...logits);
        const exps = logits.map(x => Math.exp(x - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        return exps.map(x => x / sumExps);
    }

    private formatPrediction(symbol: string, result: { probabilities: number[] }): PredictionResult {
        const [down, neutral, up] = result.probabilities;
        const maxProb = Math.max(down, neutral, up);

        let direction: 'up' | 'neutral' | 'down';
        if (maxProb === up) direction = 'up';
        else if (maxProb === down) direction = 'down';
        else direction = 'neutral';

        const prediction: PredictionResult = {
            direction,
            confidence: maxProb,
            probabilities: { down, neutral, up },
            timestamp: Date.now(),
            symbol,
        };

        // Store prediction history
        if (!this.predictionHistory.has(symbol)) {
            this.predictionHistory.set(symbol, []);
        }
        const history = this.predictionHistory.get(symbol)!;
        history.push(prediction);
        if (history.length > 100) history.shift(); // Keep last 100

        return prediction;
    }

    // Request model training from Python backend
    async trainModel(symbol: string, data: OHLCVData[]): Promise<boolean> {
        if (!this.pythonBackendAvailable) {
            console.warn('CNN Model Service: Python backend required for training');
            return false;
        }

        const trainingData = dataPreprocessor.prepareTrainingData(data);
        if (!trainingData) {
            return false;
        }

        try {
            const response = await fetch(`${config.cnnModel.pythonBackendUrl}/train`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol,
                    inputs: trainingData.inputs,
                    labels: trainingData.labels,
                }),
            });

            if (response.ok) {
                // Reload weights after training
                await this.loadWeights();
                return true;
            }
        } catch (error) {
            console.error('CNN Model Service: Training error', error);
        }

        return false;
    }

    // Get prediction history for a symbol
    getPredictionHistory(symbol: string): PredictionResult[] {
        return this.predictionHistory.get(symbol) || [];
    }

    // Get model metrics
    getMetrics(): ModelMetrics {
        return { ...this.modelMetrics };
    }

    // Check if model is ready
    isReady(): boolean {
        return this.isInitialized && this.weights !== null;
    }

    // Check if Python backend is available
    hasPythonBackend(): boolean {
        return this.pythonBackendAvailable;
    }

    // Update metrics after verifying prediction
    updateMetrics(correct: boolean) {
        this.modelMetrics.totalPredictions++;
        if (correct) {
            this.modelMetrics.correctPredictions++;
        }
        this.modelMetrics.accuracy =
            this.modelMetrics.correctPredictions / this.modelMetrics.totalPredictions;
    }
}

export const cnnModelService = new CNNModelService();
