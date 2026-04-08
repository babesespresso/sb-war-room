'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ArrowUpRight, TrendingUp } from 'lucide-react';

export default function MarketOddsChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [readyMsg, setReadyMsg] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/markets');
        if (res.ok) {
          const json = await res.json();
          setData(json.data || []);
          setReadyMsg(json.platform_readiness || '');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center rounded-xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading prediction markets...</p>
      </div>
    );
  }

  // Custom colors for candidates
  const colors: Record<string, string> = {
    Bottoms: '#ef4444',     // red
    Marx: '#f97316',        // orange
    Kirkmeyer: '#f59e0b',   // amber
    Weiser: '#3b82f6',      // blue
    Bennet: '#8b5cf6',      // violet
    Lopez: '#10b981',       // green
  };

  return (
    <div className="rounded-xl overflow-hidden mb-8" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Prediction Market Odds
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Nomination Probability (%) — Colorado Governor 2026.{' '}
              {readyMsg && <span className={`ml-1 text-xs px-2 py-0.5 rounded border ${readyMsg.includes('LIVE') ? 'bg-green-900/40 text-green-300 border-green-800/50' : 'bg-blue-900/40 text-blue-300 border-blue-800/50'}`}>{readyMsg}</span>}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {Object.entries(colors).map(([name, col]) => (
              <div key={name} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: 'var(--surface-2)' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col }} />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 h-[400px]">
        {data.length > 0 ? (
           <ResponsiveContainer width="100%" height="100%">
           <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
             <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
             <XAxis 
               dataKey="date" 
               stroke="var(--text-muted)" 
               fontSize={12} 
               tickFormatter={(val) => {
                 const d = new Date(val);
                 return `${d.getMonth()+1}/${d.getDate()}`;
               }}
               tickMargin={10} 
             />
             <YAxis 
               stroke="var(--text-muted)" 
               fontSize={12} 
               domain={[0, 60]} 
               tickFormatter={(val) => `${val}%`}
               tickMargin={10}
             />
             <Tooltip 
               contentStyle={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
               itemStyle={{ color: 'var(--text-primary)', fontSize: '13px', paddingTop: '4px' }}
               labelStyle={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px' }}
               formatter={(value: number, name: string) => [`${value}%`, name]}
               labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
             />
             {Object.entries(colors).map(([name, color]) => (
               <Line 
                 key={name}
                 type="monotone" 
                 dataKey={name} 
                 stroke={color} 
                 strokeWidth={3}
                 dot={false}
                 activeDot={{ r: 6, strokeWidth: 0 }}
               />
             ))}
           </LineChart>
         </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <ArrowUpRight className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No market data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
