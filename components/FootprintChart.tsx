import React, { useState, useEffect } from 'react';
import { FootprintCell } from '../types';
import { mockWebSocketService } from '../services/mockWebSocket';

interface FootprintChartProps {
    height?: number;
}

const FootprintChart: React.FC<FootprintChartProps> = ({ height = 300 }) => {
    const [footprintData, setFootprintData] = useState<FootprintCell[][]>([]);
    const [hoveredCell, setHoveredCell] = useState<FootprintCell | null>(null);

    useEffect(() => {
        const handleFootprintUpdate = (cells: FootprintCell[]) => {
            setFootprintData(prev => {
                const newData = [...prev, cells];
                // Keep last 20 time periods
                if (newData.length > 20) newData.shift();
                return newData;
            });
        };

        mockWebSocketService.on('footprintUpdate', handleFootprintUpdate);

        return () => {
            mockWebSocketService.off('footprintUpdate', handleFootprintUpdate);
        };
    }, []);

    const getImbalanceColor = (imbalance: number) => {
        const intensity = Math.min(Math.abs(imbalance), 1);
        if (imbalance > 0) {
            // Green for buy pressure
            return `rgba(16, 185, 129, ${0.2 + intensity * 0.8})`;
        } else {
            // Red for sell pressure
            return `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`;
        }
    };

    const formatVolume = (vol: number) => {
        if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
        return vol.toString();
    };

    if (footprintData.length === 0) {
        return (
            <div className="bg-surface rounded-lg border border-slate-800 p-4" style={{ height }}>
                <h3 className="text-sm font-semibold text-slate-400 mb-4">Footprint Chart (Price × Time Tensor)</h3>
                <div className="flex items-center justify-center h-full">
                    <div className="text-slate-500 animate-pulse">Initializing footprint tensor...</div>
                </div>
            </div>
        );
    }

    // Get unique price levels across all time periods
    const allPrices = new Set<number>();
    footprintData.forEach(cells => {
        cells.forEach(cell => allPrices.add(cell.price));
    });
    const priceLevels = Array.from(allPrices).sort((a, b) => b - a);

    return (
        <div className="bg-surface rounded-lg border border-slate-800 p-4" style={{ minHeight: height }}>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-400">Footprint Chart (Price × Time Tensor)</h3>
                <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded bg-primary/60 mr-2" />
                        <span className="text-slate-400">Buy Pressure</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-3 h-3 rounded bg-danger/60 mr-2" />
                        <span className="text-slate-400">Sell Pressure</span>
                    </div>
                </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
                <div className="absolute z-50 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl text-xs pointer-events-none">
                    <div className="font-mono text-white mb-2">Price: {hoveredCell.price.toFixed(2)}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <span className="text-slate-400">Buy Vol:</span>
                        <span className="text-primary font-mono">{formatVolume(hoveredCell.buyVolume)}</span>
                        <span className="text-slate-400">Sell Vol:</span>
                        <span className="text-danger font-mono">{formatVolume(hoveredCell.sellVolume)}</span>
                        <span className="text-slate-400">Delta:</span>
                        <span className={`font-mono ${hoveredCell.delta > 0 ? 'text-primary' : 'text-danger'}`}>
                            {hoveredCell.delta > 0 ? '+' : ''}{formatVolume(hoveredCell.delta)}
                        </span>
                        <span className="text-slate-400">Trades:</span>
                        <span className="text-white font-mono">{hoveredCell.tradeCount}</span>
                    </div>
                </div>
            )}

            {/* Footprint Grid */}
            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Time headers */}
                    <div className="flex mb-1">
                        <div className="w-16 flex-shrink-0" /> {/* Price column spacer */}
                        {footprintData.map((_, timeIdx) => (
                            <div
                                key={timeIdx}
                                className="w-16 flex-shrink-0 text-center text-xs text-slate-600 font-mono"
                            >
                                T-{footprintData.length - 1 - timeIdx}
                            </div>
                        ))}
                    </div>

                    {/* Price rows */}
                    {priceLevels.map(price => (
                        <div key={price} className="flex items-center h-8">
                            {/* Price label */}
                            <div className="w-16 flex-shrink-0 text-right pr-2 text-xs text-slate-500 font-mono">
                                {price.toFixed(0)}
                            </div>

                            {/* Cells for each time period */}
                            {footprintData.map((cells, timeIdx) => {
                                const cell = cells.find(c => c.price === price);
                                if (!cell) {
                                    return (
                                        <div
                                            key={timeIdx}
                                            className="w-16 h-7 flex-shrink-0 mx-0.5 bg-slate-800/30 rounded"
                                        />
                                    );
                                }

                                return (
                                    <div
                                        key={timeIdx}
                                        className="w-16 h-7 flex-shrink-0 mx-0.5 rounded cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-white/30 flex items-center justify-center relative overflow-hidden"
                                        style={{ backgroundColor: getImbalanceColor(cell.imbalance) }}
                                        onMouseEnter={() => setHoveredCell(cell)}
                                        onMouseLeave={() => setHoveredCell(null)}
                                    >
                                        {/* Buy/Sell split display */}
                                        <div className="flex items-center justify-between w-full px-1 text-xs font-mono">
                                            <span className="text-primary/80">{formatVolume(cell.buyVolume)}</span>
                                            <span className="text-slate-600">×</span>
                                            <span className="text-danger/80">{formatVolume(cell.sellVolume)}</span>
                                        </div>

                                        {/* Delta indicator */}
                                        {Math.abs(cell.imbalance) > 0.3 && (
                                            <div
                                                className={`absolute bottom-0 left-0 right-0 h-0.5 ${cell.imbalance > 0 ? 'bg-primary' : 'bg-danger'}`}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <div>
                    <span className="text-primary">Green</span> = Net Buying (Buyer-initiated trades) •
                    <span className="text-danger ml-1">Red</span> = Net Selling (Seller-initiated trades)
                </div>
                <div className="text-slate-600">
                    Lee-Ready Classification Active
                </div>
            </div>
        </div>
    );
};

export default FootprintChart;
