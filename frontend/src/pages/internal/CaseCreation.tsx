import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ChevronLeft, Briefcase, Zap, Info, ShieldAlert } from 'lucide-react';
import { wealthApi } from '../../services/wealthApi';
import { cn } from '../../lib/utils';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { useT } from '../../i18n';

export const CaseCreationPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const t = useT();
  const [formData, setFormData] = useState({
    clientName: '',
    type: 'Investment Allocation',
    rmId: 'John Doe',
    urgency: 'Medium',
    rmNotes: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const rmNote = `[${formData.type}] RM: ${formData.rmId} | Urgency: ${formData.urgency} | ${formData.rmNotes || 'No notes'}`;
      const caseId = await wealthApi.createCase(formData.clientName, rmNote);
      if (caseId) navigate(`/internal/cases/${caseId}`);
    } catch (err) {
      console.error(err);
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <Link to="/internal/cases" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-900 transition-colors text-xs font-bold uppercase tracking-widest">
         <ChevronLeft className="w-4 h-4" /> {t.caseCreation.backToPortfolio}
      </Link>

      <div className="flex justify-between items-end">
        <div>
           <h1 className="text-3xl font-serif italic text-zinc-900">{t.caseCreation.title}</h1>
           <p className="text-zinc-500 text-sm mt-1">{t.caseCreation.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm space-y-6">
             <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{t.caseCreation.clientName}</label>
                   <input 
                     value={formData.clientName}
                     onChange={e => setFormData({...formData, clientName: e.target.value})}
                     className="w-full px-5 py-3 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500/10"
                     placeholder={t.caseCreation.clientNamePlaceholder}
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{t.caseCreation.caseType}</label>
                   <select 
                     value={formData.type}
                     onChange={e => setFormData({...formData, type: e.target.value})}
                     className="w-full px-5 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all appearance-none"
                   >
                     <option value="Investment Allocation">{t.caseCreation.typeInvestment}</option>
                     <option value="Legacy & Succession">{t.caseCreation.typeLegacy}</option>
                     <option value="Tax Optimization">{t.caseCreation.typeTax}</option>
                     <option value="Comprehensive Wealth">{t.caseCreation.typeComprehensive}</option>
                   </select>
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{t.caseCreation.urgencyLevel}</label>
                <div className="flex gap-4">
                   {([
                     { value: 'Low', label: t.caseCreation.urgencyLow },
                     { value: 'Medium', label: t.caseCreation.urgencyMedium },
                     { value: 'High', label: t.caseCreation.urgencyHigh },
                     { value: 'Critical', label: t.caseCreation.urgencyCritical },
                   ]).map(({ value, label }) => (
                     <button
                       key={value}
                       type="button"
                       onClick={() => setFormData({...formData, urgency: value})}
                       className={cn(
                         "flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl border transition-all",
                         formData.urgency === value
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/10"
                          : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                       )}
                     >
                       {label}
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">{t.caseCreation.rmNotes}</label>
                <textarea 
                  placeholder={t.caseCreation.rmNotesPlaceholder}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/10 transition-all h-32 resize-none"
                  value={formData.rmNotes}
                  onChange={e => setFormData({...formData, rmNotes: e.target.value})}
                />
             </div>
          </div>

          <div className="flex justify-end gap-4">
             <button type="button" onClick={() => navigate(-1)} className="px-8 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">{t.caseCreation.discard}</button>
             <button 
               type="submit" 
               disabled={loading || !formData.clientName.trim()}
               className={cn(
                 "px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold transition-all shadow-lg shadow-zinc-900/10 flex items-center gap-2",
                 loading || !formData.clientName.trim() ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
               )}
             >
                {loading ? t.caseCreation.initializing : t.caseCreation.confirm}
                <Zap className={cn("w-4 h-4 text-blue-400", loading && "animate-pulse")} />
             </button>
          </div>
        </form>

        <div className="space-y-6 text-zinc-400">
           <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-4">
              <div className="flex items-center gap-2 text-zinc-900">
                 <Info className="w-5 h-5 text-blue-500" />
                 <h3 className="text-sm font-bold uppercase tracking-tight">Flow Context</h3>
              </div>
              <p className="text-xs leading-relaxed italic font-serif">
                 By initializing this case, you trigger the **Wealth Lifecycle Engine**. An onboarding invitation will be automatically dispatched to the client's mobile app.
              </p>
           </div>
           
           <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 space-y-4">
              <div className="flex items-center gap-2 text-rose-900">
                 <ShieldAlert className="w-5 h-5" />
                 <h3 className="text-sm font-bold uppercase tracking-tight">Compliance Rule</h3>
              </div>
              <p className="text-xs leading-relaxed text-rose-700 italic font-serif">
                 "Cases exceeding $5M AUM require secondary IM (Investment Manager) approval at the Planning phase."
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};
