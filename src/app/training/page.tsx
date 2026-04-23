'use client';

/**
 * Debate Simulator — chat UI vs an AI role-playing a named opponent.
 *
 * Endpoint:
 *   POST /api/ai/simulator { opponent, history, message } → { reply }
 */

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';

type Msg = { role: 'ai' | 'user'; content: string };

const OPPONENTS = ['Phil Weiser', 'Barbara Kirkmeyer', 'Michael Bennet', 'Generic Hostile Journalist'];

export default function TrainingSimulatorPage() {
  const [opponent, setOpponent] = useState(OPPONENTS[0]);
  const [messages, setMessages] = useState<Msg[]>([{
    role: 'ai',
    content: 'I am ready. State your opening argument or policy position, and I will dismantle it. Do not hold back.',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
        body: JSON.stringify({ opponent, history: messages, message: userMsg }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'ai', content: '[SYSTEM ERROR: Unable to reach AI backend]' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Training · Red team"
        title={<>Debate simulator <InfoTooltip text="Practice debate responses against an AI that adopts an opponent's persona, positions, and rhetorical style." /></>}
        subtitle="Spar against an AI engineered to adopt the persona, strategies, and facts of your opponent."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" style={{ minHeight: '70vh' }}>
        {/* Settings sidebar */}
        <div className="lg:col-span-1" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="wb-panel" style={{ padding: 18 }}>
            <h3 className="wb-eyebrow" style={{ margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
              Simulator settings <InfoTooltip text="Choose which opponent the AI role-plays as." />
            </h3>

            <label className="wb-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Select opponent</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <select
                value={opponent}
                onChange={(e) => {
                  setOpponent(e.target.value);
                  setMessages([{ role: 'ai', content: `I am simulating ${e.target.value}. Make your opening statement.` }]);
                }}
                style={{
                  width: '100%', appearance: 'none', background: 'var(--bg-2)',
                  border: '1px solid var(--line)', borderRadius: 8,
                  padding: '8px 30px 8px 12px', fontSize: 13, color: 'var(--ink-1)',
                }}
              >
                {OPPONENTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-2)', pointerEvents: 'none' }} />
            </div>

            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#fecaca', lineHeight: 1.5 }}>
                  This AI is instructed to be highly aggressive and unforgiving in debates. It will use opposition research to attack weaknesses.
                </p>
              </div>
            </div>

            <button
              onClick={() => setMessages([{ role: 'ai', content: 'Simulation reset. Make your opening statement.' }])}
              className="wb-btn"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <RefreshCw size={13} /> Restart session
            </button>
          </div>
        </div>

        {/* Chat */}
        <div className="lg:col-span-3 wb-panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: 14, borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={16} style={{ color: '#f87171' }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Opponent: {opponent}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }} className="animate-pulse" />
                  Hostile persona active
                </p>
              </div>
            </div>
            <div style={{ padding: '4px 10px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 10, color: 'var(--ink-2)', fontFamily: 'ui-monospace, SF Mono, monospace' }}>
              Model: claude-sonnet-4
            </div>
          </div>

          {/* Log */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 18, minHeight: 320 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, maxWidth: '85%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                marginLeft: msg.role === 'user' ? 'auto' : 0,
              }}>
                <div style={{
                  width: 32, height: 32, flexShrink: 0, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: msg.role === 'user' ? 'var(--accent)' : 'rgba(220,38,38,0.15)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(239,68,68,0.3)',
                }}>
                  {msg.role === 'user' ? <User size={14} style={{ color: 'white' }} /> : <Bot size={14} style={{ color: '#fca5a5' }} />}
                </div>
                <div style={{
                  padding: 14, fontSize: 13, lineHeight: 1.55, borderRadius: 12,
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-2)',
                  color: msg.role === 'user' ? 'white' : 'var(--ink-1)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--line)',
                  borderTopRightRadius: msg.role === 'user' ? 0 : 12,
                  borderTopLeftRadius: msg.role === 'user' ? 12 : 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={14} style={{ color: '#fca5a5' }} />
                </div>
                <div style={{ padding: 14, borderRadius: 12, borderTopLeftRadius: 0, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0, 150, 300].map(d => (
                    <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: `bounce 1s infinite ${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 14, borderTop: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={`Draft your response to ${opponent}…`}
                style={{
                  flex: 1, minHeight: 48, maxHeight: 128, padding: 12, borderRadius: 8,
                  resize: 'none', fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5,
                  background: 'var(--bg-0)', border: '1px solid var(--line)', color: 'var(--ink-1)',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="wb-btn wb-btn-rapid"
                style={{ padding: 12, opacity: (!input.trim() || loading) ? 0.5 : 1 }}
              >
                <Send size={16} />
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, textAlign: 'center', color: 'var(--ink-2)' }}>
              Press <kbd style={{ padding: '1px 6px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 3, fontFamily: 'inherit' }}>Enter</kbd> to send,{' '}
              <kbd style={{ padding: '1px 6px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 3, fontFamily: 'inherit' }}>Shift+Enter</kbd> for newline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
