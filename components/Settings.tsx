import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Wifi, WifiOff, Check, X, ExternalLink, Database, Zap } from 'lucide-react';
import { config, hasRealDataProvider, getActiveProviders } from '../config';
import { dataService } from '../services/dataService';

const Settings: React.FC = () => {
    const [activeProviders] = useState(getActiveProviders());
    const [dataSource] = useState(dataService.getDataSource());
    const [isRealData] = useState(dataService.isRealDataEnabled());

    return (
        <div className="p-6 h-full overflow-y-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center">
                    <SettingsIcon className="w-7 h-7 text-slate-400 mr-3" />
                    Settings & Configuration
                </h1>
                <p className="text-slate-400 text-sm mt-1">Manage API connections and data providers</p>
            </div>

            {/* Connection Status */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                    <Database className="w-5 h-5 text-primary mr-2" />
                    Data Source Status
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="text-sm text-slate-400 mb-2">Current Data Source</div>
                        <div className="text-xl font-bold text-white flex items-center">
                            {isRealData ? (
                                <>
                                    <Wifi className="w-5 h-5 text-primary mr-2" />
                                    {dataSource}
                                </>
                            ) : (
                                <>
                                    <Zap className="w-5 h-5 text-accent mr-2" />
                                    Mock Data (Simulated)
                                </>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-lg">
                        <div className="text-sm text-slate-400 mb-2">Active Providers</div>
                        <div className="text-xl font-bold text-white">
                            {activeProviders.length > 0 ? activeProviders.join(', ') : 'None configured'}
                        </div>
                    </div>
                </div>
            </div>

            {/* API Configuration */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center">
                    <Key className="w-5 h-5 text-accent mr-2" />
                    API Configuration
                </h3>

                <div className="space-y-4">
                    {/* Alpaca */}
                    <div className="p-4 border border-slate-700 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center">
                                    <h4 className="text-white font-medium">Alpaca Markets</h4>
                                    {config.alpaca.enabled ? (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full flex items-center">
                                            <Check className="w-3 h-3 mr-1" />
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded-full flex items-center">
                                            <X className="w-3 h-3 mr-1" />
                                            Not Configured
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-400 text-sm mt-1">Real-time quotes, trades, and historical bars</p>
                            </div>
                            <a
                                href="https://alpaca.markets"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-secondary hover:text-secondary/80 text-sm flex items-center"
                            >
                                Get API Key <ExternalLink className="w-4 h-4 ml-1" />
                            </a>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 font-mono">
                            VITE_ALPACA_API_KEY: {config.alpaca.enabled ? '••••••••' : 'Not set'}
                        </div>
                    </div>

                    {/* Polygon */}
                    <div className="p-4 border border-slate-700 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center">
                                    <h4 className="text-white font-medium">Polygon.io</h4>
                                    {config.polygon.enabled ? (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full flex items-center">
                                            <Check className="w-3 h-3 mr-1" />
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded-full flex items-center">
                                            <X className="w-3 h-3 mr-1" />
                                            Not Configured
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-400 text-sm mt-1">Market aggregates, news, and reference data</p>
                            </div>
                            <a
                                href="https://polygon.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-secondary hover:text-secondary/80 text-sm flex items-center"
                            >
                                Get API Key <ExternalLink className="w-4 h-4 ml-1" />
                            </a>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 font-mono">
                            VITE_POLYGON_API_KEY: {config.polygon.enabled ? '••••••••' : 'Not set'}
                        </div>
                    </div>

                    {/* Finnhub */}
                    <div className="p-4 border border-slate-700 rounded-lg">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center">
                                    <h4 className="text-white font-medium">Finnhub</h4>
                                    {config.finnhub.enabled ? (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full flex items-center">
                                            <Check className="w-3 h-3 mr-1" />
                                            Connected
                                        </span>
                                    ) : (
                                        <span className="ml-2 px-2 py-0.5 text-xs bg-slate-700 text-slate-400 rounded-full flex items-center">
                                            <X className="w-3 h-3 mr-1" />
                                            Not Configured
                                        </span>
                                    )}
                                </div>
                                <p className="text-slate-400 text-sm mt-1">News, sentiment, and company fundamentals</p>
                            </div>
                            <a
                                href="https://finnhub.io"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-secondary hover:text-secondary/80 text-sm flex items-center"
                            >
                                Get API Key <ExternalLink className="w-4 h-4 ml-1" />
                            </a>
                        </div>
                        <div className="mt-3 text-xs text-slate-500 font-mono">
                            VITE_FINNHUB_API_KEY: {config.finnhub.enabled ? '••••••••' : 'Not set'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Setup Instructions */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4">Setup Instructions</h3>

                <div className="space-y-4 text-sm">
                    <div className="p-4 bg-slate-800/50 rounded-lg">
                        <h4 className="text-white font-medium mb-2">1. Get Free API Keys</h4>
                        <ul className="text-slate-400 space-y-1 list-disc list-inside">
                            <li><strong>Alpaca:</strong> Create free paper trading account at alpaca.markets</li>
                            <li><strong>Polygon:</strong> Sign up for free tier at polygon.io</li>
                            <li><strong>Finnhub:</strong> Get free API key at finnhub.io</li>
                        </ul>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-lg">
                        <h4 className="text-white font-medium mb-2">2. Configure Environment</h4>
                        <p className="text-slate-400 mb-2">Create a <code className="text-accent">.env.local</code> file in the project root:</p>
                        <pre className="bg-slate-900 p-3 rounded text-xs overflow-x-auto">
                            {`VITE_ALPACA_API_KEY=your_alpaca_key
VITE_ALPACA_SECRET_KEY=your_alpaca_secret
VITE_POLYGON_API_KEY=your_polygon_key
VITE_FINNHUB_API_KEY=your_finnhub_key
VITE_USE_REAL_DATA=true`}
                        </pre>
                    </div>

                    <div className="p-4 bg-slate-800/50 rounded-lg">
                        <h4 className="text-white font-medium mb-2">3. Restart Development Server</h4>
                        <p className="text-slate-400">Stop and restart <code className="text-accent">npm run dev</code> to load the new environment variables.</p>
                    </div>
                </div>
            </div>

            {/* System Info */}
            <div className="bg-surface rounded-lg border border-slate-800 p-5">
                <h3 className="text-white font-semibold mb-4">System Information</h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-slate-500">Version</div>
                        <div className="text-white font-mono">1.0.0</div>
                    </div>
                    <div>
                        <div className="text-slate-500">Environment</div>
                        <div className="text-white font-mono">Development</div>
                    </div>
                    <div>
                        <div className="text-slate-500">Agents</div>
                        <div className="text-white font-mono">12 Active</div>
                    </div>
                    <div>
                        <div className="text-slate-500">Mode</div>
                        <div className="text-white font-mono">{isRealData ? 'Live' : 'Simulation'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
