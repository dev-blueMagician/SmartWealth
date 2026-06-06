import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, User, Briefcase, Target, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  wealthApi,
  type WorkflowCreateCaseOption,
  type WorkflowCreateClientOption,
} from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';
import { getAccessToken } from '../../auth/session';
import { getMobileClientId, setMobileClientId } from '../../lib/mobileClientSession';

type Step = 'PROFILE' | 'ASSETS' | 'GOALS' | 'RISK' | 'SUCCESS';

export const MobileOnboardingPage = () => {
  const [step, setStep] = useState<Step>('PROFILE');
  const [progress, setProgress] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [clientOptions, setClientOptions] = useState<WorkflowCreateClientOption[]>([]);
  const [caseOptions, setCaseOptions] = useState<WorkflowCreateCaseOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(() => getMobileClientId() ?? '');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [profileName, setProfileName] = useState('Nguyen Van A');
  const [residency, setResidency] = useState('VN');
  const [riskProfile, setRiskProfile] = useState('BALANCED');
  const [assetType, setAssetType] = useState('CASH');
  const [assetValue, setAssetValue] = useState('150000000');
  const [goalType, setGoalType] = useState('RETIREMENT');
  const [goalTargetAmount, setGoalTargetAmount] = useState('5000000000');
  const [deviceId, setDeviceId] = useState('iphone-demo-001');
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedClientId.trim()) {
      setMobileClientId(selectedClientId.trim());
    }
  }, [selectedClientId]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (!getAccessToken()) {
          const saved = getMobileClientId();
          if (saved) {
            setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
            setSelectedClientId(saved);
            setCaseOptions([]);
          }
          return;
        }

        const options = await wealthApi.listWorkflowCreateOptions();
        let nextCases = options.cases;
        let nextClients = options.clients;

        if (nextCases.length === 0) {
          const fallbackCases = await wealthApi.listCases();
          nextCases = fallbackCases
            .filter((item) => (item.id || item.caseId) && item.clientId)
            .map((item) => ({
              caseId: item.id || item.caseId || '',
              clientId: item.clientId || '',
              caseName: item.type || 'Service Case',
              clientName: item.clientName,
              type: item.type,
              status: item.status,
              createdAt: item.createdAt,
            }));
        }

        if (nextClients.length === 0) {
          const clientMap = new Map<string, WorkflowCreateClientOption>();
          nextCases.forEach((item) => {
            if (!item.clientId) return;
            clientMap.set(item.clientId, {
              clientId: item.clientId,
              clientName: item.clientName,
            });
          });
          nextClients = Array.from(clientMap.values());
        }

        setCaseOptions(nextCases);
        setClientOptions(nextClients);

        if (nextClients.length > 0) {
          const saved = getMobileClientId();
          const initialClientId =
            saved && nextClients.some((c) => c.clientId === saved) ? saved : nextClients[0].clientId;
          setSelectedClientId(initialClientId);
          const initialCase = nextCases.find((item) => item.clientId === initialClientId);
          setSelectedCaseId(initialCase?.caseId ?? '');
        }
      } catch (err) {
        const saved = getMobileClientId();
        if (saved) {
          setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
          setSelectedClientId((prev) => (prev.trim() ? prev : saved));
          setCaseOptions([]);
          setError(null);
        } else {
          setError(toApiError(err));
        }
      }
    };
    void loadOptions();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedCaseId('');
      return;
    }
    const matchedCase = caseOptions.find((item) => item.clientId === selectedClientId);
    setSelectedCaseId(matchedCase?.caseId ?? '');
  }, [selectedClientId, caseOptions]);

  const submitOnboarding = async () => {
    if (!selectedClientId) {
      setError(toApiError(new Error('Please select a client first.')));
      return;
    }
    const parsedAssetValue = Number(assetValue);
    const parsedGoalTargetAmount = Number(goalTargetAmount);
    if (!Number.isFinite(parsedAssetValue) || parsedAssetValue <= 0) {
      setError(toApiError(new Error('Asset value must be a positive number.')));
      return;
    }
    if (!Number.isFinite(parsedGoalTargetAmount) || parsedGoalTargetAmount <= 0) {
      setError(toApiError(new Error('Goal target amount must be a positive number.')));
      return;
    }

    setSubmitting(true);
    try {
      await wealthApi.registerMobile({
        clientId: selectedClientId,
        deviceId,
      });
      await wealthApi.updateProfile(selectedClientId, {
        name: profileName,
        riskProfile,
        residency,
      });
      await wealthApi.createAsset(selectedClientId, {
        assetType,
        value: parsedAssetValue,
      });
      await wealthApi.createGoal(selectedClientId, {
        goalType,
        targetAmount: parsedGoalTargetAmount,
      });

      if (selectedCaseId) {
        await wealthApi.checkDiscovery(selectedCaseId);
      }

      setSuccessMessage('Onboarding submitted successfully. Case is now ready for planning.');
      setStep('SUCCESS');
      setProgress(100);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    switch (step) {
      case 'PROFILE': setStep('ASSETS'); setProgress(50); break;
      case 'ASSETS': setStep('GOALS'); setProgress(75); break;
      case 'GOALS': setStep('RISK'); setProgress(100); break;
      case 'RISK': void submitOnboarding(); break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case 'ASSETS': setStep('PROFILE'); setProgress(25); break;
      case 'GOALS': setStep('ASSETS'); setProgress(50); break;
      case 'RISK': setStep('GOALS'); setProgress(75); break;
    }
  };

  return (
    <div className="min-h-full flex flex-col pt-4">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
      {/* Step Header */}
      {step !== 'SUCCESS' && (
        <div className="px-1 mb-8">
          <div className="space-y-2 mb-5">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Client</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-5 py-3 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none"
            >
              {clientOptions.length === 0 && <option value="">No client available</option>}
              {clientOptions.map((item) => (
                <option key={item.clientId} value={item.clientId}>
                  {item.clientName ?? item.clientId}
                </option>
              ))}
            </select>
            <p className="text-[10px] font-mono text-zinc-400">Case: {selectedCaseId || 'No case linked'}</p>
          </div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">
              {step === 'PROFILE' && 'Basic Profiling'}
              {step === 'ASSETS' && 'Asset Declaration'}
              {step === 'GOALS' && 'Future Objectives'}
              {step === 'RISK' && 'Risk Tolerance'}
            </h2>
            <p className="text-xs font-bold text-zinc-400 font-mono">{progress}% Complete</p>
          </div>
          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }} 
               animate={{ width: `${progress}%` }} 
               className="h-full bg-blue-600" 
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
           key={step}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           className="flex-1"
        >
          {step === 'PROFILE' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm">
                    <User className="w-6 h-6" />
                 </div>
                 <p className="text-sm font-medium text-zinc-600 leading-relaxed italic pr-4">
                    "We'll start by gathering your personal details to personalize your financial advice."
                 </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Legal Full Name</label>
                   <input
                     type="text"
                     value={profileName}
                     onChange={(e) => setProfileName(e.target.value)}
                     placeholder="Sara Anderson"
                     className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Residency</label>
                   <select
                     value={residency}
                     onChange={(e) => setResidency(e.target.value)}
                     className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                   >
                      <option value="VN">Vietnam</option>
                      <option value="SG">Singapore</option>
                      <option value="US">United States</option>
                   </select>
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Device ID</label>
                  <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 'ASSETS' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm">
                    <Briefcase className="w-6 h-6" />
                 </div>
                 <p className="text-sm font-medium text-zinc-600 leading-relaxed italic pr-4">
                    "List your current holdings to help us calculate your net worth and asset drift."
                 </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Asset type</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                >
                  <option value="CASH">CASH</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="BOND">BOND</option>
                  <option value="PROPERTY">PROPERTY</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Asset value</label>
                <input
                  type="number"
                  value={assetValue}
                  onChange={(e) => setAssetValue(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 'GOALS' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm">
                    <Target className="w-6 h-6" />
                 </div>
                 <p className="text-sm font-medium text-zinc-600 leading-relaxed italic pr-4">
                    "Capture your objective so we can align advice with measurable targets."
                 </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Goal type</label>
                <select
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                >
                  <option value="RETIREMENT">RETIREMENT</option>
                  <option value="EDUCATION">EDUCATION</option>
                  <option value="HOME_PURCHASE">HOME_PURCHASE</option>
                  <option value="LEGACY">LEGACY</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Target amount</label>
                <input
                  type="number"
                  value={goalTargetAmount}
                  onChange={(e) => setGoalTargetAmount(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 'RISK' && (
            <div className="space-y-6">
              <div className="p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-900 shadow-sm">
                    <ShieldCheck className="w-6 h-6" />
                 </div>
                 <p className="text-sm font-medium text-zinc-600 leading-relaxed italic pr-4">
                    "Choose your risk profile. We will submit onboarding and run discovery readiness."
                 </p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Risk Profile</label>
                <select
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                >
                  <option value="CONSERVATIVE">CONSERVATIVE</option>
                  <option value="BALANCED">BALANCED</option>
                  <option value="GROWTH">GROWTH</option>
                  <option value="AGGRESSIVE">AGGRESSIVE</option>
                </select>
              </div>
            </div>
          )}

          {step === 'SUCCESS' && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-8">
               <motion.div 
                 initial={{ scale: 0 }} 
                 animate={{ scale: 1 }} 
                 className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center"
               >
                 <CheckCircle2 className="w-12 h-12" />
               </motion.div>
               <div className="space-y-2">
                 <h2 className="text-2xl font-bold text-zinc-900">Success!</h2>
                 <p className="text-zinc-500 text-sm max-w-[240px] leading-relaxed">
                   Your profile has been submitted for professional review. We'll notify you once AI discovery is complete.
                 </p>
               </div>
               <button 
                 onClick={() => navigate('/mobile')}
                 className="w-full max-w-[200px] py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10"
               >
                 Back to Dashboard
               </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Button Rail */}
      {step !== 'SUCCESS' && (
        <div className="mt-auto pt-8 flex gap-4">
          {step !== 'PROFILE' && (
            <button 
              onClick={prevStep}
              className="w-20 h-16 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center text-zinc-400 active:bg-zinc-50 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <button 
            onClick={nextStep}
            disabled={submitting}
            className="flex-1 h-16 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 active:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/10"
          >
            {submitting ? 'Submitting...' : 'Continue'}
            <ChevronRight className="w-5 h-5 opacity-50" />
          </button>
        </div>
      )}
    </div>
  );
};

// Internal-use only for icons in the file
const TrendingUp = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
);

const Plus = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
