import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, AlertCircle, Clock, ChevronRight, FileText, UserCheck, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'ACTION_REQUIRED';
  category: 'IDENTITY' | 'DOCUMENT' | 'COMPLIANCE' | 'SYSTEM';
}

const items: ChecklistItem[] = [
  { id: '1', title: 'Identity Verification', description: 'Biometric scan and passport verification.', status: 'COMPLETED', category: 'IDENTITY' },
  { id: '2', title: 'Address Proof', description: 'Utility bill or bank statement (scan uploaded).', status: 'ACTION_REQUIRED', category: 'DOCUMENT' },
  { id: '3', title: 'AML/KYC Screening', description: 'Check against global watchlists.', status: 'IN_PROGRESS', category: 'COMPLIANCE' },
  { id: '4', title: 'Risk Suitability', description: 'Client questionnaire completion.', status: 'PENDING', category: 'SYSTEM' },
];

export const OnboardingChecklist = () => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Onboarding Progress</h3>
          <p className="text-sm text-slate-500">Emma Watson • Case #ONB-9921</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-indigo-600">65% Ready</p>
          <div className="h-1.5 w-32 bg-slate-200 rounded-full mt-1">
            <div className="h-full bg-indigo-500 rounded-full w-[65%]"></div>
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-slate-100">
        {items.map((item, i) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-all cursor-pointer group"
          >
            <div className="mt-1">
              {item.status === 'COMPLETED' && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              {item.status === 'IN_PROGRESS' && <Clock className="w-6 h-6 text-amber-500 animate-pulse" />}
              {item.status === 'PENDING' && <Circle className="w-6 h-6 text-slate-300" />}
              {item.status === 'ACTION_REQUIRED' && <AlertCircle className="w-6 h-6 text-rose-500" />}
            </div>
            
            <div className="flex-1 min-w-0">
               <div className="flex items-center gap-2 mb-1">
                 <span className={cn(
                   "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border",
                   item.category === 'IDENTITY' ? "text-blue-600 border-blue-100 bg-blue-50" :
                   item.category === 'DOCUMENT' ? "text-purple-600 border-purple-100 bg-purple-50" :
                   item.category === 'COMPLIANCE' ? "text-indigo-600 border-indigo-100 bg-indigo-50" :
                   "text-slate-600 border-slate-200 bg-slate-50"
                 )}>
                   {item.category}
                 </span>
                 <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors uppercase text-xs tracking-tight">{item.title}</h4>
               </div>
               <p className="text-sm text-slate-500 line-clamp-1">{item.description}</p>
            </div>
            
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform self-center" />
          </motion.div>
        ))}
      </div>
      
      <div className="p-4 bg-slate-50 flex gap-3">
        <button className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">Generate Review Pack</button>
        <button className="flex-1 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">Request Info</button>
      </div>
    </div>
  );
};
