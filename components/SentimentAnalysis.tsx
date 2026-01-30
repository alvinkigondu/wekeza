import React, { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, TrendingDown, Minus, Newspaper, BarChart3, Users, ExternalLink } from 'lucide-react';
import { SentimentData, SentimentSource, KeywordSentiment } from '../types';
import { mockWebSocketService } from '../services/mockWebSocket';
import { dataService } from '../services/dataService';

const SentimentAnalysis: React.FC = () => {
    const [sentiment, setSentiment] = useState<SentimentData | null>(null);
    const [isRealData, setIsRealData] = useState(false);

    useEffect(() => {
        const isUsingRealData = dataService.isRealDataEnabled();
        setIsRealData(isUsingRealData);

        if (isUsingRealData) {
            // Fetch real sentiment data
            const fetchSentiment = async () => {
                const data = await dataService.getSentimentData();
                setSentiment(data);
            };
            fetchSentiment();

            // Subscribe to news updates
            dataService.subscribeNews((news) => {
                // Update sentiment when news comes in
                fetchSentiment();
            });
        } else {
            // Use mock data
            const handleSentimentUpdate = (data: SentimentData) => {
                setSentiment(data);
            };

            mockWebSocketService.on('sentimentUpdate', handleSentimentUpdate);

            return () => {
                mockWebSocketService.off('sentimentUpdate', handleSentimentUpdate);
            };
        }
    }, []);

    const getSentimentColor = (score: number) => {
        if (score > 0.3) return 'text-primary';
        if (score > 0) return 'text-emerald-400';
        if (score > -0.3) return 'text-slate-400';
        if (score > -0.6) return 'text-orange-400';
        return 'text-danger';
    };

    const getSentimentBgColor = (score: number) => {
        if (score > 0.3) return 'bg-primary/20 border-primary/50';
        if (score > 0) return 'bg-emerald-500/10 border-emerald-500/30';
        if (score > -0.3) return 'bg-slate-500/10 border-slate-500/30';
        if (score > -0.6) return 'bg-orange-500/10 border-orange-500/30';
        return 'bg-danger/20 border-danger/50';
    };

    const getSentimentLabel = (score: number) => {
        if (score > 0.5) return 'Very Bullish';
        if (score > 0.2) return 'Bullish';
        if (score > -0.2) return 'Neutral';
        if (score > -0.5) return 'Bearish';
        return 'Very Bearish';
    };

    const getTrendIcon = (trend: 'up' | 'stable' | 'down') => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-primary" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-danger" />;
            default: return <Minus className="w-4 h-4 text-slate-400" />;
        }
    };

    const getSourceIcon = (type: SentimentSource['type']) => {
        switch (type) {
            case 'news': return <Newspaper className="w-4 h-4" />;
            case 'earnings': return <BarChart3 className="w-4 h-4" />;
            case 'social': return <Users className="w-4 h-4" />;
            case 'analyst': return <TrendingUp className="w-4 h-4" />;
        }
    };

    const formatTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    if (!sentiment) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-slate-400 animate-pulse">Processing sentiment data...</div>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <MessageSquare className="w-7 h-7 text-accent mr-3" />
                        Sentiment Analysis
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">FinBERT-powered NLP analysis of market sentiment</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-500">Last Analysis</div>
                    <div className="text-sm text-slate-300 font-mono">
                        {new Date(sentiment.lastUpdated).toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Main Sentiment Gauge */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Sentiment */}
                <div className={`lg:col-span-1 bg-surface rounded-xl border-2 p-6 ${getSentimentBgColor(sentiment.overallScore)}`}>
                    <div className="text-center">
                        <div className="text-sm text-slate-400 mb-4">Overall Market Sentiment</div>

                        {/* Semicircle Gauge */}
                        <div className="relative w-48 h-24 mx-auto mb-4">
                            <svg viewBox="0 0 200 100" className="w-full h-full">
                                {/* Background arc */}
                                <path
                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                    fill="none"
                                    stroke="#1e293b"
                                    strokeWidth="16"
                                    strokeLinecap="round"
                                />
                                {/* Sentiment arc */}
                                <path
                                    d="M 20 100 A 80 80 0 0 1 180 100"
                                    fill="none"
                                    stroke={sentiment.overallScore > 0 ? '#10b981' : '#ef4444'}
                                    strokeWidth="16"
                                    strokeLinecap="round"
                                    strokeDasharray={`${Math.abs(sentiment.overallScore) * 251} 251`}
                                    style={{
                                        transform: sentiment.overallScore < 0 ? 'scaleX(-1)' : 'none',
                                        transformOrigin: 'center'
                                    }}
                                />
                            </svg>

                            {/* Score Display */}
                            <div className="absolute inset-0 flex items-end justify-center pb-2">
                                <div className={`text-4xl font-bold ${getSentimentColor(sentiment.overallScore)}`}>
                                    {(sentiment.overallScore * 100).toFixed(0)}
                                </div>
                            </div>
                        </div>

                        <div className={`text-2xl font-bold mb-2 ${getSentimentColor(sentiment.overallScore)}`}>
                            {getSentimentLabel(sentiment.overallScore)}
                        </div>

                        <div className="flex items-center justify-center space-x-4 text-sm">
                            <div>
                                <span className="text-slate-400">Magnitude: </span>
                                <span className="text-white font-mono">{(sentiment.magnitude * 100).toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center">
                                <span className="text-slate-400 mr-2">Trend: </span>
                                {sentiment.trend === 'improving' && <TrendingUp className="w-4 h-4 text-primary" />}
                                {sentiment.trend === 'stable' && <Minus className="w-4 h-4 text-slate-400" />}
                                {sentiment.trend === 'deteriorating' && <TrendingDown className="w-4 h-4 text-danger" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Keyword Cloud / Themes */}
                <div className="lg:col-span-2 bg-surface rounded-lg border border-slate-800 p-5">
                    <h3 className="text-white font-semibold mb-4">Key Themes & Keywords</h3>

                    <div className="flex flex-wrap gap-3">
                        {sentiment.keywords.map((kw) => (
                            <div
                                key={kw.keyword}
                                className={`px-4 py-2 rounded-lg border ${getSentimentBgColor(kw.sentiment)} flex items-center space-x-2`}
                                style={{ fontSize: `${Math.min(20, 12 + kw.count / 2)}px` }}
                            >
                                <span className={getSentimentColor(kw.sentiment)}>#{kw.keyword}</span>
                                <span className="text-slate-500 text-xs">({kw.count})</span>
                                {getTrendIcon(kw.trend)}
                            </div>
                        ))}
                    </div>

                    {/* Sentiment Distribution Bar */}
                    <div className="mt-6">
                        <div className="text-sm text-slate-400 mb-2">Sentiment Distribution</div>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                            <div
                                className="bg-danger transition-all duration-500"
                                style={{ width: `${sentiment.sources.filter(s => s.sentiment < -0.3).length / sentiment.sources.length * 100}%` }}
                            />
                            <div
                                className="bg-orange-400 transition-all duration-500"
                                style={{ width: `${sentiment.sources.filter(s => s.sentiment >= -0.3 && s.sentiment < 0).length / sentiment.sources.length * 100}%` }}
                            />
                            <div
                                className="bg-slate-500 transition-all duration-500"
                                style={{ width: `${sentiment.sources.filter(s => s.sentiment >= 0 && s.sentiment < 0.3).length / sentiment.sources.length * 100}%` }}
                            />
                            <div
                                className="bg-emerald-400 transition-all duration-500"
                                style={{ width: `${sentiment.sources.filter(s => s.sentiment >= 0.3 && s.sentiment < 0.6).length / sentiment.sources.length * 100}%` }}
                            />
                            <div
                                className="bg-primary transition-all duration-500"
                                style={{ width: `${sentiment.sources.filter(s => s.sentiment >= 0.6).length / sentiment.sources.length * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>Bearish</span>
                            <span>Neutral</span>
                            <span>Bullish</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* News Feed */}
            <div className="bg-surface rounded-lg border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-white">Recent News & Analysis</h3>
                    <span className="text-xs text-slate-500">{sentiment.sources.length} sources analyzed</span>
                </div>

                <div className="divide-y divide-slate-800">
                    {sentiment.sources.map((source) => (
                        <div
                            key={source.id}
                            className="px-6 py-4 hover:bg-slate-800/50 transition-colors animate-fade-in"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-4">
                                    {/* Source Type Icon */}
                                    <div className={`p-2 rounded-lg ${getSentimentBgColor(source.sentiment)}`}>
                                        {getSourceIcon(source.type)}
                                    </div>

                                    <div>
                                        <div className="flex items-center space-x-2 mb-1">
                                            <span className="text-xs font-medium text-slate-500 uppercase">{source.type}</span>
                                            <span className="text-xs text-slate-600">•</span>
                                            <span className="text-xs text-slate-500">{source.source}</span>
                                            <span className="text-xs text-slate-600">•</span>
                                            <span className="text-xs text-slate-500">{formatTimeAgo(source.timestamp)}</span>
                                        </div>
                                        <h4 className="text-slate-200 font-medium">{source.title}</h4>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {source.keywords.map((kw, idx) => (
                                                <span key={idx} className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                                                    #{kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Sentiment Score */}
                                <div className="text-right">
                                    <div className={`text-lg font-bold ${getSentimentColor(source.sentiment)}`}>
                                        {source.sentiment > 0 ? '+' : ''}{(source.sentiment * 100).toFixed(0)}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Mag: {(source.magnitude * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FinBERT Model Info */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-semibold mb-1">FinBERT NLP Engine</h3>
                        <p className="text-slate-400 text-sm">Financial domain-specific language model for sentiment extraction</p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                        <div className="px-3 py-1 bg-primary/20 text-primary rounded-full">
                            Active
                        </div>
                        <div className="text-slate-400">
                            <span className="text-slate-500">Latency:</span> <span className="text-white font-mono">~120ms</span>
                        </div>
                        <div className="text-slate-400">
                            <span className="text-slate-500">Accuracy:</span> <span className="text-white font-mono">94.2%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SentimentAnalysis;
