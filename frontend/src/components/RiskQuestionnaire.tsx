import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Shield } from 'lucide-react';
import { useT } from '../i18n';

interface Question {
  id: number;
  text: string;
  options: { label: string; value: number }[];
}

export const RiskQuestionnaire = ({ onComplete }: { onComplete: (score: number) => void }) => {
  const t = useT();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  const questions: Question[] = [
    {
      id: 1,
      text: t.riskQuiz.q1,
      options: [
        { label: t.riskQuiz.q1o1, value: 1 },
        { label: t.riskQuiz.q1o2, value: 3 },
        { label: t.riskQuiz.q1o3, value: 5 },
      ],
    },
    {
      id: 2,
      text: t.riskQuiz.q2,
      options: [
        { label: t.riskQuiz.q2o1, value: 1 },
        { label: t.riskQuiz.q2o2, value: 3 },
        { label: t.riskQuiz.q2o3, value: 5 },
      ],
    },
    {
      id: 3,
      text: t.riskQuiz.q3,
      options: [
        { label: t.riskQuiz.q3o1, value: 1 },
        { label: t.riskQuiz.q3o2, value: 3 },
        { label: t.riskQuiz.q3o3, value: 5 },
      ],
    },
  ];

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
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">{t.riskQuiz.title}</h2>
          <span className="text-xs font-bold text-slate-400">
            {t.riskQuiz.stepOf
              .replace('{current}', String(step + 1))
              .replace('{total}', String(questions.length))}
          </span>
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
           {t.riskQuiz.footer}
         </p>
      </div>
    </div>
  );
};
