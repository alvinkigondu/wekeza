import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { OrderBookLevel } from '../types';
import { mockWebSocketService } from '../services/mockWebSocket';
import { dataService, MarketData } from '../services/dataService';
import { config } from '../config';

const MarketMicrostructure: React.FC = () => {
  const [orderBook, setOrderBook] = useState<OrderBookLevel[]>([]);
  const [priceHistory, setPriceHistory] = useState<{ time: number, price: number, vwap: number }[]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [symbol, setSymbol] = useState<string>('SPY');
  const [isRealData, setIsRealData] = useState(false);
  const [dailyChange, setDailyChange] = useState<number>(0);
  const [dailyChangePercent, setDailyChangePercent] = useState<number>(0);

  // Subscribe to real-time feeds
  useEffect(() => {
    const isUsingRealData = dataService.isRealDataEnabled();
    setIsRealData(isUsingRealData);

    if (isUsingRealData) {
      // Subscribe to real market data
      dataService.subscribeMarketData(symbol, (data: MarketData) => {
        setLastPrice(data.price);
        setDailyChange(data.change);
        setDailyChangePercent(data.changePercent);

        setPriceHistory(prev => {
          const newPoint = {
            time: data.timestamp,
            price: data.price,
            vwap: data.open, // Use open as proxy for VWAP
          };
          const updated = [...prev, newPoint];
          if (updated.length > 100) updated.shift();
          return updated;
        });
      });
    } else {
      // Use mock data
      const handleMarketUpdate = (tick: { time: number, price: number, vwap: number }) => {
        setLastPrice(tick.price);
        setPriceHistory(prev => {
          const updated = [...prev, tick];
          if (updated.length > 50) updated.shift();
          return updated;
        });
      };

      const handleOrderBookUpdate = (data: OrderBookLevel[]) => {
        setOrderBook(data);
      };

      mockWebSocketService.on('marketUpdate', handleMarketUpdate);
      mockWebSocketService.on('orderBookUpdate', handleOrderBookUpdate);

      return () => {
        mockWebSocketService.off('marketUpdate', handleMarketUpdate);
        mockWebSocketService.off('orderBookUpdate', handleOrderBookUpdate);
      };
    }
  }, [symbol]);

  // Generate static volume profile for now (simulating session accumulation)
  const volumeProfileData = useMemo(() => {
    const basePrice = lastPrice || 450;
    return Array.from({ length: 20 }, (_, i) => ({
      priceLevel: Math.floor(basePrice - 10 + i).toString(),
      buyVol: Math.floor(Math.random() * 1000),
      sellVol: Math.floor(Math.random() * 1000),
    }));
  }, [lastPrice]);

  const availableSymbols = config.defaultSymbols;

  return (
    <div className="h-full p-6 flex flex-col space-y-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Microstructure Analysis</h2>
          <div className="flex space-x-2 text-sm text-slate-400 mt-1">
            {/* Symbol Selector */}
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-slate-800 px-2 py-0.5 rounded text-xs font-mono border border-slate-700 text-white"
            >
              {availableSymbols.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className={`px-2 py-0.5 rounded text-xs font-mono ${isRealData ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'}`}>
              {isRealData ? 'LIVE DATA' : 'SIMULATED'}
            </span>
            <span className="text-primary flex items-center text-xs font-mono px-2">
              <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Streaming
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold text-white">
            {lastPrice > 0 ? lastPrice.toFixed(2) : '---'}
          </div>
          <div className={`text-sm font-mono ${dailyChange >= 0 ? 'text-primary' : 'text-danger'}`}>
            {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)} ({dailyChangePercent >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%)
          </div>
          <div className="text-xs text-slate-400">LAST TRADED PRICE</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

        {/* Main Chart Area (Footprint simulation) */}
        <div className="col-span-8 bg-surface rounded-lg border border-slate-800 p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-400 mb-4">Price Action & VWAP</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#10b981' }}
                  labelFormatter={() => ''}
                  formatter={(value: number) => [value.toFixed(2), 'Price']}
                />
                <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
                <Area type="monotone" dataKey="vwap" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" fill="none" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Simulated Footprint Strip */}
          <div className="h-24 mt-4 border-t border-slate-800 pt-2">
            <h4 className="text-xs font-mono text-slate-500 mb-2">Order Flow Delta (Imbalance)</h4>
            <div className="flex space-x-1 h-12 overflow-hidden">
              {priceHistory.slice(-40).map((tick, i) => {
                // Deterministic visualization based on price movement
                const delta = (tick.price - tick.vwap);
                const color = delta > 0 ? 'bg-primary' : 'bg-danger';
                const opacity = Math.min(Math.abs(delta) * 2 + 0.3, 1);
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm ${color} transition-all duration-300`}
                    style={{ opacity }}
                  ></div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: DOM & Profile */}
        <div className="col-span-4 flex flex-col space-y-4">

          {/* Volume Profile */}
          <div className="h-1/2 bg-surface rounded-lg border border-slate-800 p-4 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Volume Profile (Session)</h3>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={volumeProfileData} barGap={0}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="priceLevel" type="category" width={40} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                  <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                  <Bar dataKey="buyVol" stackId="a" fill="#10b981" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="sellVol" stackId="a" fill="#ef4444" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Depth of Market (DOM) */}
          <div className="h-1/2 bg-surface rounded-lg border border-slate-800 p-4 overflow-hidden flex flex-col">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Depth of Market</h3>
            <div className="flex-1 overflow-y-auto font-mono text-xs no-scrollbar">
              <table className="w-full text-right">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">Size</th>
                    <th className="pb-2 text-center">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orderBook.map((level, idx) => (
                    <tr key={idx} className={level.type === 'ask' ? 'text-danger hover:bg-danger/10' : 'text-primary hover:bg-primary/10'}>
                      <td className="py-1 pr-4 relative">
                        <div
                          className={`absolute top-0 right-0 h-full opacity-20 ${level.type === 'ask' ? 'bg-danger' : 'bg-primary'}`}
                          style={{ width: `${Math.min(level.size / 5, 100)}%` }}
                        />
                        <span className="relative z-10 transition-all">{level.size}</span>
                      </td>
                      <td className={`py-1 text-center font-bold ${level.type === 'ask' ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {level.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {orderBook.length === 0 && (
                    <tr><td colSpan={2} className="text-center py-4 text-slate-600">Waiting for feed...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MarketMicrostructure;

