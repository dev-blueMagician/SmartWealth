import { motion } from 'motion/react';
import { TrendingUp, AlertTriangle, ArrowRightLeft, ShieldCheck, PieChart } from 'lucide-react';
import { cn } from '../lib/utils';

const allocations = [
  { asset: 'Equities', current: 45, target: 55, color: 'bg-indigo-500' },
  { asset: 'Fixed Income', current: 40, target: 35, color: 'bg-emerald-500' },
  { asset: 'Cash', current: 15, target: 5, color: 'bg-amber-500' },
  { asset: 'Alternatives', current: 0, target: 5, color: 'bg-purple-500' },
];

export const InvestmentCockpit = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Current vs Target Allocation</h3>
                <p className="text-sm text-slate-500">Portfolio drift detected in Equities and Cash.</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Rebalance Portfolio
              </button>
            </div>

            <div className="space-y-8">
              {allocations.map((item, i) => (
                <div key={i} className="space-y-2">
                   <div className="flex justify-between items-end">
                     <span className="font-semibold text-slate-700">{item.asset}</span>
                     <div className="text-right">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Target {item.target}%</span>
                       <span className={cn(
                         "text-sm font-bold",
                         item.current > item.target ? "text-rose-500" : item.current < item.target ? "text-indigo-500" : "text-emerald-500"
                       )}>Current {item.current}%</span>
                     </div>
                   </div>
                   <div className="h-3 w-full bg-slate-100 rounded-full relative overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${item.current}%` }} 
                        className={cn("h-full absolute left-0 z-10", item.color)} 
                      />
                      <div 
                        className="absolute top-0 bottom-0 border-r-2 border-slate-900 z-20 transition-all" 
                        style={{ left: `${item.target}%` }}
                      />
                   </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Proposed Implementation</h3>
            <div className="space-y-3">
              {[
                { action: 'BUY', asset: 'Vanguard Total Stock Market (VTI)', amount: '$142,000', rationale: 'Increase US Equity exposure' },
                { action: 'SELL', asset: 'Cash (USD)', amount: '$135,000', rationale: 'Deploy idle capital' },
              ].map((trade, i) => (
                <div key={i} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs",
                      trade.action === 'BUY' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    )}>{trade.action}</div>
                    <div>
                      <p className="font-semibold text-slate-900">{trade.asset}</p>
                      <p className="text-xs text-slate-500">{trade.rationale}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">{trade.amount}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white text-center space-y-4">
            <div className="w-16 h-16 bg-white/10 rounded-full mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-bold text-lg">Suitability Pass</h4>
              <p className="text-slate-400 text-xs mt-1">Proposed allocation is within Michael's "Moderate Growth" profile constraints.</p>
            </div>
            <div className="pt-2">
              <button className="w-full py-3 bg-white text-slate-950 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all">Publish Advice</button>
            </div>
          </div>

          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 space-y-4">
            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" /> Liquidity Warning
            </div>
            <p className="text-xs text-amber-800/80 leading-relaxed">
              Proposed cash balance (5%) is approaching the minimum threshold required for upcoming tax liabilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
