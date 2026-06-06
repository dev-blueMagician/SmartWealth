import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Filter, ChevronRight, Briefcase, Zap, Search as DiscoveryIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';
import { wealthApi } from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';

export const CaseListPage = () => {
  const { portalCaps } = useAuth();
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let mounted = true;
    wealthApi
      .listCases()
      .then((items) => {
        if (!mounted) return;
        setCases(items);
      })
      .catch((err) => {
        console.error('CaseList fetch error:', err);
        setError(toApiError(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif italic text-zinc-900">Case Portfolio</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage and track active service lifecycle cases.</p>
        </div>
        {portalCaps.canCreateCase && (
        <Link 
          to="/internal/cases/new" 
          className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10"
        >
          <Plus className="w-5 h-5" /> New Service Case
        </Link>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center gap-4 bg-zinc-50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Filter by ID, Client, or Owner..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
          <button className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 flex items-center gap-2 hover:bg-zinc-50">
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Case Identifier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Client Engagement</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Workflow Stage</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Primary Owner</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-4"><div className="h-12 bg-zinc-50 rounded-xl w-full"></div></td>
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                         <div className="p-4 bg-zinc-50 rounded-full">
                            <Briefcase className="w-8 h-8 text-zinc-300" />
                         </div>
                         <p className="text-sm font-medium text-zinc-400 italic font-serif">No active cases found in your viewport.</p>
                         {portalCaps.canCreateCase && (
                         <Link to="/internal/cases/new" className="text-blue-600 font-bold text-xs">Initialize First Case</Link>
                         )}
                      </div>
                   </td>
                </tr>
              ) : (
                cases.map((item) => (
                  <tr key={item.id} className="group hover:bg-zinc-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                       <Link to={`/internal/cases/${item.id}`} className="font-mono text-xs font-bold text-zinc-900 hover:text-blue-600">
                          {item.id.slice(0, 8).toUpperCase()}
                       </Link>
                       <p className="text-[10px] text-zinc-400 mt-0.5">{item.type}</p>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                             {(item.clientName || item.clientId || 'NA').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                             <p className="text-sm font-bold text-zinc-900">{item.clientName || 'Unknown Client'}</p>
                             <p className="text-[10px] text-zinc-400">ID: {item.clientId?.slice(0, 8) || '-'}</p>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={cn(
                          "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                          item.phase === 'ONBOARDING' ? "text-blue-600 bg-blue-50" :
                          item.phase === 'PLANNING' ? "text-amber-600 bg-amber-50" :
                          item.phase === 'EXECUTION' ? "text-emerald-600 bg-emerald-50" :
                          item.phase === 'MONITORING' ? "text-purple-600 bg-purple-50" :
                          "text-zinc-600 bg-zinc-100"
                       )}>
                          {item.phase || 'N/A'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600 font-medium">{item.rmId || 'RM'}</td>
                    <td className="px-6 py-4 text-right">
                       <Link to={`/internal/cases/${item.id}`} className="inline-flex items-center gap-1 text-zinc-400 group-hover:text-blue-600 transition-colors">
                          <span className="text-[10px] font-bold uppercase tracking-widest">Detail</span>
                          <ChevronRight className="w-4 h-4" />
                       </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
