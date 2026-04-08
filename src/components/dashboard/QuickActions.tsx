'use client';

import { useState, useEffect } from 'react';
import { Zap, Mail, Video, Brain, Flame, Instagram } from 'lucide-react';
import XIcon from '@/components/icons/XIcon';
import FacebookIcon from '@/components/icons/FacebookIcon';
import InfoTooltip from '@/components/ui/InfoTooltip';

export default function QuickActions({ 
  initialRapidResponse = false, 
  onRapidResponseClose 
}: { 
  initialRapidResponse?: boolean; 
  onRapidResponseClose?: () => void;
}) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [topic, setTopic] = useState('');
  const [selectedType, setSelectedType] = useState('social_twitter');

  // Open rapid response when triggered from header button
  useEffect(() => {
    if (initialRapidResponse) {
      setSelectedType('rapid_response');
      setShowPrompt(true);
      onRapidResponseClose?.();
    }
  }, [initialRapidResponse]);

  const actions = [
    { id: 'social_twitter', label: 'Post to X', icon: XIcon, color: '#ffffff' },
    { id: 'social_facebook', label: 'FB Post', icon: FacebookIcon, color: '#1877f2' },
    { id: 'social_instagram', label: 'IG Post', icon: Instagram, color: '#e1306c' },
    { id: 'email', label: 'Email', icon: Mail, color: 'var(--campaign-gold)' },
    { id: 'rapid_response', label: 'Rapid Response', icon: Zap, color: 'var(--campaign-red)' },
  ];

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(selectedType);
    try {
      const action = selectedType === 'rapid_response' ? 'rapid_response' : 'generate';
      const body = selectedType === 'rapid_response'
        ? { action, trigger: topic, source_content: topic }
        : { action, content_type: selectedType, topic, context: topic };

      await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setTopic('');
      setShowPrompt(false);
      
      // Redirect to Content Queue so the user can see the generated draft
      window.location.href = '/content';
    } catch (err) {
      console.error('Generation failed:', err);
    }
    setGenerating(null);
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider shrink-0" style={{ color: 'var(--text-muted)' }}>
          Quick Generate
        </span>
        <div className="flex gap-2 w-full overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-1 md:pb-0">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.id}
                onClick={() => { setSelectedType(action.id); setShowPrompt(true); }}
                disabled={generating !== null}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:brightness-125 disabled:opacity-50"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: action.color }} />
                {action.label}
                {generating === action.id && (
                  <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: `${action.color} transparent ${action.color} ${action.color}` }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showPrompt && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder={selectedType === 'rapid_response'
              ? 'Describe the trigger (attack, news, crisis)...'
              : 'What topic or angle should this cover?'}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none focus:ring-1"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
            autoFocus
          />
          <button onClick={handleGenerate}
            disabled={!topic.trim() || generating !== null}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: 'var(--campaign-red)', color: 'white' }}>
            <Brain className="w-4 h-4" />
          </button>
          <button onClick={() => setShowPrompt(false)}
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
