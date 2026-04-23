'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

export default function TrainingSimulatorPage() {
  const [opponent, setOpponent] = useState('Phil Weiser');
  const [messages, setMessages] = useState<{ role: 'ai' | 'user', content: string }[]>([{
    role: 'ai',
    content: "I am ready. State your opening argument or policy position, and I will dismantle it. Do not hold back."
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opponent,
          history: messages,
          message: userMsg
        })
      });

      if (!res.ok) throw new Error('Simulation failed');
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', content: "[SYSTEM ERROR: Unable to reach Anthropic/OpenAI API]" }]);
    } finally {
      setLoading(false);
    }
  };

  const opponents = ['Phil Weiser', 'Barbara Kirkmeyer', 'Michael Bennet', 'Generic Hostile Journalist'];

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6" style={{ background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Training · Red team"
        title={<><Bot className="w-7 h-7 text-blue-400 inline-block mr-2 align-middle" />Debate Simulator <InfoTooltip text="Practice debate responses against an AI that adopts the persona of your political opponents. Select a competitor and test your messaging in real-time." /></>}
        subtitle="Spar against an AI engineered to adopt the exact persona, strategies, and facts of your opponent."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:h-[75vh]">
        
        {/* Left Sidebar - Settings */}
        <div className="col-span-1 flex flex-col gap-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-gray-400 flex items-center gap-1.5">Simulator Settings <InfoTooltip text="Choose which opponent the AI will role-play as. The AI uses public data and known positions to simulate realistic debate responses." /></h3>
            
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>SELECT OPPONENT</label>
              <div className="relative">
                <select 
                  value={opponent}
                  onChange={(e) => {
                    setOpponent(e.target.value);
                    setMessages([{ role: 'ai', content: `I am simulating ${e.target.value}. Make your opening statement.` }]);
                  }}
                  className="w-full appearance-none bg-transparent border rounded-md px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  {opponents.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div className="mb-4 rounded-lg p-3 border border-red-900/30 bg-red-900/10">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <p className="text-xs text-red-200">
                  Warning: This AI is instructed to be highly aggressive, pedantic, and unforgiving in debates. It will use established opposition research to attack weaknesses.
                </p>
              </div>
            </div>

            <button 
              onClick={() => setMessages([{ role: 'ai', content: "Simulation reset. Make your opening statement." }])}
              className="w-full flex items-center justify-center gap-2 py-2 border rounded-md text-sm transition transition-hover"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Restart Session
            </button>
          </div>
        </div>

        {/* Right - Chat Interface */}
        <div className="col-span-1 lg:col-span-3 flex flex-col rounded-xl overflow-hidden h-[70vh] lg:h-auto" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
          {/* Header */}
          <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex flex-center items-center justify-center border border-red-500/50">
                <Bot className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold">Opponent: {opponent}</p>
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  Hostile Persona Active
                </p>
              </div>
            </div>
            <div className="px-3 py-1 bg-black/50 border rounded-md text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
              Model: GPT-4o
            </div>
          </div>

          {/* Chat log */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-blue-600' : 'bg-red-900/50 border border-red-500/30'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-red-300" />}
                </div>
                <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'rounded-tl-none'
                }`} style={msg.role === 'ai' ? { background: 'var(--surface-2)', border: '1px solid var(--border-color)' } : {}}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-4 w-full">
                <div className="w-8 h-8 shrink-0 rounded-full bg-red-900/50 border border-red-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-red-300" />
                </div>
                <div className="p-4 rounded-xl rounded-tl-none text-sm bg-surface-2 border border-border-color flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--border-color)', background: 'var(--surface-2)' }}>
            <div className="relative flex items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`Draft your response to ${opponent}...`}
                className="flex-1 max-h-32 min-h-[50px] p-3 rounded-lg resize-none text-sm focus:outline-none"
                style={{ background: 'var(--surface-0)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-3 rounded-lg bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Press Enter to send, Shift+Enter for newline.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
