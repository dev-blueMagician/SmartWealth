/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Send,
  Paperclip,
  Cpu,
  Target,
  ChevronRight,
  X,
  FileText,
  Zap,
  Bot,
  Sparkles,
  Search,
  CheckCircle2,
  MoreHorizontal,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';

type Mode = 'AGENT' | 'PLANNER';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: Mode;
  attachments?: string[];
  status?: 'thinking' | 'done';
}

function userInitials(username: string | undefined): string {
  if (!username) return '—';
  const cleaned = username.replace(/[^a-zA-Z0-9]/g, '');
  if (cleaned.length >= 2) return cleaned.slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function shortDisplayName(username: string | undefined): string {
  if (!username) return 'there';
  const part = username.split(/[@._\s]/)[0];
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : username;
}

export function CopilotChat() {
  const { auth } = useAuth();
  const displayName = shortDisplayName(auth?.username);
  const initials = userInitials(auth?.username);

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('AGENT');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Welcome back, **${displayName}**. I have analyzed the recent market volatility. Would you like to check for **portfolio drift** across your UHNW client base or **draft a new strategy**?`,
        status: 'done',
      },
    ]);
  }, [displayName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: attachments.map((f) => f.name),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsThinking(true);

    window.setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        mode,
        content:
          mode === 'AGENT'
            ? `I've analyzed the attached documents. Based on the **current AUM trends**, I recommend increasing the liquidity buffer for the Anderson Case (#9923). Would you like me to trigger a **Discovery Check**?`
            : `I am initializing a new **Investment Strategy Plan**. I have incorporated the risk profile data from the discovery phase. Drafting asset allocation recommendations now...`,
        status: 'done',
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsThinking(false);
    }, 2000);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 antialiased">
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden relative">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex p-1 bg-zinc-200/50 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('AGENT')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2',
                  mode === 'AGENT' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                )}
              >
                <Bot className="w-3 h-3" /> Advice Agent
              </button>
              <button
                type="button"
                onClick={() => setMode('PLANNER')}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2',
                  mode === 'PLANNER' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
                )}
              >
                <Target className="w-3 h-3" /> Strategy Planner
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">NEXUS-L40-PRO</span>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex gap-4', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border',
                  msg.role === 'assistant'
                    ? 'bg-zinc-900 text-blue-400 border-zinc-800'
                    : 'bg-white text-zinc-400 border-zinc-200',
                )}
              >
                {msg.role === 'assistant' ? (
                  <Cpu className="w-4 h-4" />
                ) : (
                  <div className="text-[10px] font-bold">{initials}</div>
                )}
              </div>
              <div className={cn('space-y-2 max-w-[80%]', msg.role === 'user' ? 'text-right' : 'text-left')}>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 justify-end">
                    {msg.attachments.map((name, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-600"
                      >
                        <FileText className="w-3 h-3" /> {name}
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className={cn(
                    'p-4 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'assistant'
                      ? 'bg-zinc-50 border border-zinc-100 text-zinc-800 markdown-body'
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-600/10',
                  )}
                >
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </motion.div>
          ))}
          {isThinking && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-xl bg-zinc-900 text-blue-400 flex items-center justify-center shrink-0 border border-zinc-800">
                <Cpu className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 border border-zinc-100 rounded-2xl italic text-xs text-zinc-400">
                Nexus is generating a {mode.toLowerCase()} response...
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-100 bg-white sticky bottom-0">
          <div className="max-w-4xl mx-auto space-y-4">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <div
                    key={i}
                    className="group relative px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200"
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium text-zinc-600">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2 bg-zinc-50 border border-zinc-200 rounded-2xl shadow-inner focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
                placeholder={
                  mode === 'AGENT'
                    ? 'Ask the Advice Agent anything about cases or clients...'
                    : 'Describe your strategy goals to the Planner...'
                }
                className="w-full bg-transparent border-none outline-none p-3 text-sm text-zinc-900 placeholder:text-zinc-400 resize-none h-24"
              />
              <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50">
                <div className="flex items-center gap-1">
                  <label className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg transition-all cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(e) =>
                        e.target.files && setAttachments((prev) => [...prev, ...Array.from(e.target.files!)])
                      }
                    />
                    <Paperclip className="w-4 h-4" />
                  </label>
                  <button
                    type="button"
                    className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  className={cn(
                    'px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
                    input.trim() || attachments.length > 0
                      ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/10'
                      : 'bg-zinc-100 text-zinc-400',
                  )}
                >
                  Send Command
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400 text-center font-medium">
              Nexus AI can make mistakes. Always verify strategy outputs with compliance.
            </p>
          </div>
        </div>
      </div>

      <div className="w-80 space-y-6 shrink-0">
        <section className="bg-zinc-900 rounded-3xl p-6 text-white border border-zinc-800 shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
          <h3 className="font-serif italic text-lg mb-6 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" /> Active Context
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Selected Session</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white leading-none mb-1">Global Discovery</p>
                  <p className="text-[10px] text-zinc-500">Wealth Case Portfolio</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Workflow Index</p>
              <div className="space-y-2">
                {['risk-matching', 'portfolio-drift', 'kyc-integrity'].map((idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-xs text-zinc-300 font-mono italic">{idx}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-4">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-tight flex items-center justify-between">
            History
            <MoreHorizontal className="w-4 h-4 text-zinc-400" />
          </h3>
          <div className="space-y-3">
            {['Drafting Strategy Q3', 'Anderson Risk Analysis', 'Portfolio Rebalance Prep'].map((item, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-1 rounded-full bg-zinc-300 group-hover:bg-blue-500" />
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-900 transition-colors">{item}</span>
                </div>
                <ChevronRight className="w-3 h-3 text-zinc-300 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
