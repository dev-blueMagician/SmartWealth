import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Question {
  id: number;
  text: string;
  options: { label: string; value: number }[];
}

const questions: Question[] = [
  {
    id: 1,
    text: "What is your main investment objective?",
    options: [
      { label: "Preserve Capital", value: 1 },
      { label: "Moderate Growth", value: 3 },
      { label: "Aggressive Growth", value: 5 },
    ]
  },
  {
    id: 2,
    text: "How would you react to a 20% drop in your portfolio?",
    options: [
      { label: "Sell everything immediately", value: 1 },
      { label: "Do nothing, stay the course", value: 3 },
      { label: "Invest more to take advantage", value: 5 },
    ]
  },
  {
    id: 3,
    text: "What is your investment time horizon?",
    options: [
      { label: "Less than 3 years", value: 1 },
      { label: "3 to 10 years", value: 3 },
      { label: "More than 10 years", value: 5 },
    ]
  }
];

export const RiskQuestionnaire = ({ onComplete }: { onComplete: (score: number) => void }) => {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const handleSelect = (value: number) => {
    const newScores = [...scores, value];
    if (step < questions.length - 1) {
      setScores(newScores);
      setStep(step + 1);
    } else {
      const total = newScores.reduce((a, b) => a + b, 0);
      onComplete(total);
    }
  };

  const progress = ((step + 1) / questions.length) * 100;

  return (
    <div className="space-y-8 py-2">
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">Risk & Suitability</h2>
          <span className="text-xs font-bold text-slate-400">Step {step + 1} of {questions.length}</span>
        </div>
        <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
           <motion.div 
             initial={{ width: 0 }} 
             animate={{ width: `${progress}%` }} 
             className="h-full bg-indigo-500" 
           />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <p className="text-lg font-medium text-slate-800">{questions[step].text}</p>
          <div className="space-y-3">
            {questions[step].options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleSelect(opt.value)}
                className="w-full p-5 text-left bg-white border border-slate-200 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group flex items-center justify-between"
              >
                <span className="font-semibold text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
         <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
         <p className="text-xs text-amber-800 leading-relaxed">
           Your profile determines the range of investment options and strategies we can recommend to ensure your financial security.
         </p>
      </div>
    </div>
  );
};
