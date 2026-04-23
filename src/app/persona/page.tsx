'use client';

/**
 * AI Persona — configures how generated content "sounds" like the candidate.
 *
 * Endpoints:
 *   GET  /api/persona                       → PersonaData
 *   PUT  /api/persona                       → save voice_guide / content_rules / brand_config
 *   GET  /api/persona/video                 → list of VideoSource[]
 *   POST /api/persona/video                 → register an uploaded video (metadata)
 *   POST /api/persona/video/init-upload     → returns { supabaseUrl, serviceKey } for browser-side upload
 *   POST /api/persona/video/process         → kick off transcription + analysis
 *   DELETE /api/persona/video?id=<uuid>     → delete source
 *
 * Simplifications vs the original:
 *   - Dropped the optional in-browser FFmpeg audio-extraction step (heavy dep, optional optimization).
 *     Server-side processing handles transcoding; this keeps the handoff lean.
 *   - Everything else (drag-and-drop upload, XHR progress, duplicate detection, polling, voice-trait
 *     injection from X sync, video insight expansion, rule & hashtag editing) is preserved.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, Save, RefreshCw, Plus, X, CheckCircle, AlertCircle,
  Twitter, Sparkles, User, FileText, Shield, Mic, Loader2,
  Video, Upload, Trash2, Film, Clock, Zap, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import PageHeader from '@/components/layout/PageHeader';
import CubeLoader from '@/components/ui/cube-loader';
import { SCOTT_VOICE_GUIDE_DEFAULT, SCOTT_CONTENT_RULES_DEFAULT } from '@/lib/persona';

interface PersonaData {
  candidate_name: string;
  campaign_type: string;
  state: string;
  voice_guide: string;
  content_rules: string[];
  brand_config: Record<string, any>;
}

interface VideoSource {
  id: string;
  title: string;
  source_type: string;
  file_size_bytes: number;
  processing_status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  processing_error: string | null;
  extracted_talking_points: Array<{ topic: string; point: string; quote: string; confidence: number }>;
  extracted_voice_patterns: { common_phrases: string[]; rhetorical_devices: string[]; tone_notes: string };
  extracted_policy_positions: Array<{ topic: string; position: string; supporting_quote: string }>;
  created_at: string;
}

// ─────────────────────────── sample voice-training data ───────────────────────────

const SAMPLE_TWEETS = [
  { handle: '@ScottBottomsCO', text: "Colorado deserves a Governor who shows up. I've been to 47 counties in the last 6 months. My opponents can't say that.", date: '2h ago', likes: 287, retweets: 94 },
  { handle: '@ScottBottomsCO', text: "Water policy isn't a talking point for me — it's personal. I've stood with farmers in the San Luis Valley watching their wells run dry. We need real solutions, not Denver bureaucrats drawing lines on a map.", date: '6h ago', likes: 412, retweets: 156 },
  { handle: '@ScottBottomsCO', text: "Just left a roundtable with small business owners in Pueblo. The message was clear: lower taxes, less regulation, more freedom. That's exactly what I'll deliver as Governor.", date: '1d ago', likes: 523, retweets: 189 },
  { handle: '@ScottBottomsCO', text: "My opponents want to talk about me. I want to talk about YOU — your family, your business, your future. That's the difference. #copolitics", date: '2d ago', likes: 671, retweets: 234 },
  { handle: '@ScottBottomsCO', text: "Constitutional rights aren't negotiable. Period. As Governor, I will defend the 2nd Amendment with everything I've got.", date: '3d ago', likes: 892, retweets: 312 },
];

const SOURCE_TYPE_LABELS: Record<string, string> = {
  speech: 'Speech', interview: 'Interview', debate: 'Debate', town_hall: 'Town Hall',
  podcast: 'Podcast', press_conference: 'Press Conference', ad: 'Campaign Ad', social_clip: 'Social Clip', other: 'Other',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
  uploaded:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: 'Queued',       icon: Clock },
  transcribing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: 'Transcribing', icon: Loader2 },
  analyzing:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)',  label: 'Analyzing',    icon: Brain },
  completed:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  label: 'Complete',     icon: CheckCircle },
  failed:       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'Failed',       icon: AlertCircle },
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────── main component ───────────────────────────

export default function PersonaPage() {
  const [data, setData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voiceGuide, setVoiceGuide] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [xHandle, setXHandle] = useState('@ScottBottomsCO');

  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoSourceType, setVideoSourceType] = useState('speech');
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggeredProcessingRef = useRef<Set<string>>(new Set());

  useEffect(() => { fetchPersona(); fetchVideoSources(); }, []);

  // Poll for processing + auto-trigger 'uploaded' videos
  useEffect(() => {
    const hasProcessing = videoSources.some(
      v => v.processing_status === 'uploaded' || v.processing_status === 'transcribing' || v.processing_status === 'analyzing'
    );
    if (!hasProcessing) return;

    videoSources
      .filter(v => v.processing_status === 'uploaded' && !triggeredProcessingRef.current.has(v.id))
      .forEach(v => {
        triggeredProcessingRef.current.add(v.id);
        fetch('/api/persona/video/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: v.id }),
        }).finally(fetchVideoSources);
      });

    const interval = setInterval(fetchVideoSources, 5000);
    return () => clearInterval(interval);
  }, [videoSources]);

  async function fetchPersona() {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch('/api/persona'),
        new Promise(resolve => setTimeout(resolve, 400)),
      ]);
      if (!res.ok) throw new Error('Failed to load persona');
      const json = await res.json();
      setData(json);
      setVoiceGuide(json.voice_guide || '');
      setRules(json.content_rules || []);
      setCustomHashtags(json.brand_config?.custom_hashtags || []);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }

  async function fetchVideoSources() {
    try {
      const res = await fetch('/api/persona/video');
      if (!res.ok) return;
      const json = await res.json();
      setVideoSources(json.sources || []);
    } catch { /* table may not exist yet */ }
  }

  async function handleSave(override?: any) {
    setSaving(true); setSaved(false); setError(null);
    try {
      const payload = override || {
        voice_guide: voiceGuide,
        content_rules: rules,
        brand_config: { ...data?.brand_config, custom_hashtags: customHashtags },
      };
      const res = await fetch('/api/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      setData(prev => prev ? { ...prev, brand_config: payload.brand_config } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) { setError(err.message); }
    setSaving(false);
  }

  function addRule() {
    if (!newRule.trim()) return;
    const next = [...rules, newRule.trim()];
    setRules(next); setNewRule('');
    handleSave({ voice_guide: voiceGuide, content_rules: next, brand_config: { ...data?.brand_config, custom_hashtags: customHashtags } });
  }
  function removeRule(i: number) {
    const next = rules.filter((_, ix) => ix !== i);
    setRules(next);
    handleSave({ voice_guide: voiceGuide, content_rules: next, brand_config: { ...data?.brand_config, custom_hashtags: customHashtags } });
  }
  function addHashtag() {
    if (!newHashtag.trim()) return;
    let tag = newHashtag.trim();
    if (!tag.startsWith('#')) tag = '#' + tag;
    const next = [...customHashtags, tag];
    setCustomHashtags(next); setNewHashtag('');
    handleSave({ voice_guide: voiceGuide, content_rules: rules, brand_config: { ...data?.brand_config, custom_hashtags: next } });
  }
  function removeHashtag(i: number) {
    const next = customHashtags.filter((_, ix) => ix !== i);
    setCustomHashtags(next);
    handleSave({ voice_guide: voiceGuide, content_rules: rules, brand_config: { ...data?.brand_config, custom_hashtags: next } });
  }

  async function handleXSync() {
    setSyncing(true); setSynced(false);
    await new Promise(r => setTimeout(r, 2500));
    const separator = voiceGuide.trim() ? '\n\n--- EXTRACTED FROM X (@ScottBottomsCO) ---\n' : '';
    setVoiceGuide(voiceGuide.trim() + separator + SCOTT_VOICE_GUIDE_DEFAULT);
    setRules([...new Set([...rules, ...SCOTT_CONTENT_RULES_DEFAULT])]);
    setSyncing(false); setSynced(true);
  }

  // ─────────────────────────── upload ───────────────────────────

  async function handleVideoUpload(file: File) {
    if (!file) return;
    const validExt = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!(file.type.startsWith('video/') || file.type.startsWith('audio/') || validExt.includes(ext))) {
      setError(`Unsupported file type: "${file.type || 'unknown'}" (${file.name}). Upload video or audio files.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024 && file.type.startsWith('audio/')) {
      setError(`Audio file too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 25MB for audio.`);
      return;
    }

    const titleToUse = videoTitle || file.name.replace(/\.[^.]+$/, '');
    const duplicate = videoSources.find(v =>
      v.file_size_bytes === file.size || v.title.toLowerCase().trim() === titleToUse.toLowerCase().trim()
    );
    if (duplicate) {
      const status = duplicate.processing_status === 'completed' ? 'already processed' : `currently ${duplicate.processing_status}`;
      if (!window.confirm(`Possible duplicate: "${duplicate.title}" (${formatFileSize(duplicate.file_size_bytes)}) is ${status}.\n\nUpload "${titleToUse}" anyway?`)) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploading(true); setUploadProgress(0); setUploadStatus('Preparing…'); setError(null);

    try {
      // 1) Get direct-upload credentials
      const initRes = await fetch('/api/persona/video/init-upload', { method: 'POST' });
      if (!initRes.ok) throw new Error(`Failed to initialize upload (${initRes.status})`);
      const { supabaseUrl, serviceKey } = await initRes.json();
      if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase configuration');

      // 2) Upload file → Supabase storage (XHR for progress)
      setUploadStatus('Uploading…');
      const sanitized = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `bottoms-2026/${Date.now()}-${sanitized}`;
      const storageUrl = `${supabaseUrl}/storage/v1/object/video-training/${storagePath}`;
      const contentType = file.type || 'application/octet-stream';

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round(5 + (e.loaded / e.total) * 75));
        });
        xhr.addEventListener('load',  () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('POST', storageUrl, true);
        xhr.setRequestHeader('Authorization', `Bearer ${serviceKey}`);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(file);
      });

      // 3) Register metadata
      setUploadStatus('Registering…'); setUploadProgress(85);
      const regRes = await fetch('/api/persona/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath, title: titleToUse, source_type: videoSourceType, file_size: file.size }),
      });
      if (!regRes.ok) throw new Error((await regRes.json()).error || 'Failed to register');
      const { source } = await regRes.json();

      // 4) Fire-and-forget processing; polling picks up status
      setUploadStatus('Starting transcription…'); setUploadProgress(95);
      if (source?.id) {
        fetch('/api/persona/video/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: source.id }),
        }).finally(fetchVideoSources);
      }

      setUploadProgress(100);
      setVideoTitle(''); setVideoSourceType('speech');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchVideoSources();
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false); setUploadStatus(null);
    }
  }

  async function handleDeleteVideo(id: string) {
    try {
      const res = await fetch(`/api/persona/video?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setVideoSources(prev => prev.filter(v => v.id !== id));
      if (expandedVideoId === id) setExpandedVideoId(null);
    } catch (err: any) { setError(err.message); }
  }

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }, []);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleVideoUpload(f);
  };
  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) handleVideoUpload(f);
  };

  const completed = videoSources.filter(v => v.processing_status === 'completed');
  const totalTalkingPoints = completed.reduce((s, v) => s + (v.extracted_talking_points?.length || 0), 0);
  const totalPolicyPositions = completed.reduce((s, v) => s + (v.extracted_policy_positions?.length || 0), 0);

  if (loading) {
    return (
      <div style={{ padding: 'var(--pad-section)', background: 'var(--bg-0)', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CubeLoader />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--pad-section)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', background: 'var(--bg-0)' }}>
      <PageHeader
        eyebrow="Operations · Voice model"
        title={<><Brain size={22} style={{ color: '#a78bfa', display: 'inline', marginRight: 8, verticalAlign: '-3px' }} />AI Persona <InfoTooltip text="Configure how the AI writes content as the candidate. The voice guide and content rules are injected into every AI prompt." /></>}
        subtitle={<>Teach the AI to write like {data?.candidate_name || 'the candidate'}. All generated content will use this persona.</>}
        actions={
          <button onClick={() => handleSave()} disabled={saving} className={`wb-btn ${saved ? '' : 'wb-btn-rapid'}`} style={saved ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)' } : undefined}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save persona'}
          </button>
        }
      />

      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: '#fca5a5' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 0, color: '#f87171', cursor: 'pointer' }}><X size={14} /></button>
        </div>
      )}

      {completed.length > 0 && (
        <div className="wb-panel" style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 10, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <Zap size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>Voice training active</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>
                {completed.length} video{completed.length !== 1 ? 's' : ''} analyzed · {totalTalkingPoints} talking points · {totalPolicyPositions} policy positions extracted
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <Stat value={completed.length} label="Sources" tone="#a78bfa" />
            <Stat value={totalTalkingPoints} label="Points" tone="#60a5fa" />
            <Stat value={totalPolicyPositions} label="Positions" tone="var(--ok)" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-7" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>

          {/* Identity */}
          <Section icon={<User size={18} style={{ color: '#a78bfa' }} />} title="Candidate identity" eyebrow="Who the AI becomes">
            <div className="grid grid-cols-2 gap-4">
              <IdField label="Candidate"   value={data?.candidate_name} />
              <IdField label="Race"        value={data?.campaign_type} />
              <IdField label="State"       value={data?.state} />
              <IdField label="Perspective" value="1st person" tone="var(--ok)" />
            </div>
          </Section>

          {/* Voice guide */}
          <Section icon={<Mic size={18} style={{ color: '#fbbf24' }} />} title="Voice guide" eyebrow="How the candidate sounds — injected into every AI prompt">
            <textarea
              value={voiceGuide}
              onChange={(e) => setVoiceGuide(e.target.value)}
              rows={14}
              style={{
                width: '100%', background: 'var(--bg-2)', color: 'var(--ink-1)',
                border: '1px solid var(--line)', borderRadius: 10, padding: 14,
                fontSize: 13, lineHeight: 1.55, resize: 'vertical', fontFamily: 'inherit',
              }}
              placeholder="Describe tone, sentence structure, vocabulary, habits. Injected verbatim into every prompt."
            />
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>
              {voiceGuide.length} characters · Injected as the VOICE context in every content-generation prompt.
            </p>
          </Section>

          {/* Video training */}
          <Section icon={<Video size={18} style={{ color: '#a78bfa' }} />} title="Train from video" eyebrow="Speeches, interviews, and debates — source material">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
              <input
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink-1)' }}
                placeholder="Video title (e.g. 'KRDO Interview April 2026')"
              />
              <select
                value={videoSourceType}
                onChange={(e) => setVideoSourceType(e.target.value)}
                style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink-1)' }}
              >
                {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'rgba(168,85,247,0.6)' : 'var(--line)'}`,
                background: dragOver ? 'rgba(168,85,247,0.08)' : 'transparent',
                borderRadius: 12, padding: 32, textAlign: 'center', cursor: uploading ? 'default' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              <input ref={fileInputRef} type="file" accept="video/*,audio/*" onChange={onFileSelect} style={{ display: 'none' }} />
              {uploading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={28} className="animate-spin" style={{ color: '#a78bfa' }} />
                  <p style={{ margin: 0, fontWeight: 700, color: '#c4b5fd' }}>{uploadStatus || 'Uploading…'}</p>
                  <div style={{ width: '60%', height: 6, borderRadius: 999, background: 'rgba(168,85,247,0.15)', overflow: 'hidden' }}>
                    <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)', transition: 'width 300ms' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-2)' }}>{Math.round(uploadProgress)}%</p>
                </div>
              ) : (
                <>
                  <Upload size={28} style={{ color: 'var(--ink-2)', margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--ink-1)' }}>Drop a video or audio file here</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-2)' }}>
                    MP4, MOV, WebM, AVI, MP3, WAV · The server will transcribe and extract talking points, voice patterns, and policy positions.
                  </p>
                </>
              )}
            </div>

            {/* Video list */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="wb-eyebrow" style={{ margin: 0 }}>Uploaded training sources ({videoSources.length})</h3>
                {completed.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ok)' }}>
                    {totalTalkingPoints} talking points · {totalPolicyPositions} positions
                  </span>
                )}
              </div>
              {videoSources.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 10 }}>
                  <Film size={32} style={{ color: 'var(--ink-2)', margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>No videos uploaded yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                  {videoSources.map(v => (
                    <VideoRow
                      key={v.id}
                      video={v}
                      expanded={expandedVideoId === v.id}
                      onToggle={() => setExpandedVideoId(expandedVideoId === v.id ? null : v.id)}
                      onDelete={() => handleDeleteVideo(v.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {/* Content rules */}
          <Section icon={<Shield size={18} style={{ color: '#60a5fa' }} />} title="Content rules" eyebrow={`${rules.length} active rules`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-2)', borderRadius: 8, padding: '8px 10px', border: '1px solid var(--line)' }}>
                  <CheckCircle size={13} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, flex: 1, color: 'var(--ink-1)' }}>{rule}</span>
                  <button onClick={() => removeRule(i)} style={{ background: 'none', border: 0, color: 'var(--ink-2)', cursor: 'pointer', padding: 4 }}><X size={12} /></button>
                </div>
              ))}
              {rules.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'center', margin: '14px 0' }}>No rules yet. Add below or sync from X.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRule()}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink-1)' }}
                placeholder="Add a content rule…"
              />
              <button onClick={addRule} className="wb-btn" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}><Plus size={14} /></button>
            </div>
          </Section>

          {/* Hashtags */}
          <Section icon={<span style={{ color: '#60a5fa', fontWeight: 800, fontSize: 16 }}>#</span>} title="Custom hashtags" eyebrow={`${customHashtags.length} hashtags`}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {customHashtags.map((tag, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-2)', borderRadius: 999, padding: '4px 4px 4px 10px', border: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{tag}</span>
                  <button onClick={() => removeHashtag(i)} style={{ background: 'none', border: 0, padding: 4, cursor: 'pointer', color: 'var(--ink-2)', display: 'flex' }}><X size={12} /></button>
                </div>
              ))}
              {customHashtags.length === 0 && <p style={{ fontSize: 12, color: 'var(--ink-2)', margin: '6px 0' }}>No hashtags configured.</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink-1)' }}
                placeholder="e.g. #copolitics"
              />
              <button onClick={addHashtag} className="wb-btn" style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}><Plus size={14} /></button>
            </div>
          </Section>

          {/* X sync */}
          <Section icon={<Twitter size={18} />} title="Train from X" eyebrow={synced ? 'Voice extracted' : 'Analyze posting patterns'}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink-1)', fontFamily: 'ui-monospace, SF Mono, monospace' }}
                placeholder="@handle"
              />
              <button
                onClick={handleXSync}
                disabled={syncing}
                className="wb-btn"
                style={synced ? { background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)' } : undefined}
              >
                {syncing ? <RefreshCw size={14} className="animate-spin" /> : synced ? <CheckCircle size={14} /> : <Sparkles size={14} />}
                {syncing ? 'Analyzing…' : synced ? 'Synced' : 'Sync voice'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {SAMPLE_TWEETS.map((t, i) => (
                <div key={i} style={{ padding: 12, background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>SB</div>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{t.handle}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>· {t.date}</span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, lineHeight: 1.5, color: 'var(--ink-1)' }}>{t.text}</p>
                  <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--ink-2)' }}>
                    <span>♥ {t.likes}</span><span>↻ {t.retweets}</span>
                  </div>
                </div>
              ))}
            </div>
            {synced && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Sparkles size={14} style={{ color: 'var(--ok)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: 1 }}>Voice traits extracted</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-2)' }}>
                  Voice characteristics and content rules injected into the guide. Click <strong>Save persona</strong> to apply.
                </p>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── subcomponents ───────────────────────────

function Section({ icon, title, eyebrow, children }: { icon: React.ReactNode; title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <div className="wb-panel" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h2>
          {eyebrow && <p className="wb-eyebrow" style={{ margin: '2px 0 0' }}>{eyebrow}</p>}
        </div>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: tone }}>{value}</p>
      <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--ink-2)', fontWeight: 700 }}>{label}</p>
    </div>
  );
}

function IdField({ label, value, tone }: { label: string; value?: string; tone?: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 14, border: '1px solid var(--line)' }}>
      <p className="wb-eyebrow" style={{ margin: '0 0 4px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: tone || 'var(--ink-1)' }}>{value || '—'}</p>
    </div>
  );
}

function VideoRow({ video, expanded, onToggle, onDelete }: { video: VideoSource; expanded: boolean; onToggle: () => void; onDelete: () => void }) {
  const status = STATUS_CONFIG[video.processing_status] || STATUS_CONFIG.uploaded;
  const StatusIcon = status.icon;
  const complete = video.processing_status === 'completed';
  const tpCount = video.extracted_talking_points?.length || 0;
  const ppCount = video.extracted_policy_positions?.length || 0;
  const animating = video.processing_status === 'transcribing' || video.processing_status === 'analyzing';

  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ padding: 6, borderRadius: 8, background: status.bg, border: `1px solid ${status.border}` }}>
          <Film size={14} style={{ color: status.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{video.title}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2, alignItems: 'center' }}>
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, background: status.bg, border: `1px solid ${status.border}`, color: status.color }}>
              <StatusIcon size={10} className={animating ? 'animate-spin' : ''} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />{status.label}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>{SOURCE_TYPE_LABELS[video.source_type] || 'Other'}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>· {formatFileSize(video.file_size_bytes)}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>· {new Date(video.created_at).toLocaleDateString()}</span>
            {complete && <span style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 700 }}>· {tpCount} points, {ppCount} positions</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {complete && (
            <button onClick={onToggle} className="wb-btn" style={{ padding: 6 }} title={expanded ? 'Collapse' : 'View insights'}>
              {expanded ? <ChevronUp size={14} /> : <Eye size={14} />}
            </button>
          )}
          <button onClick={onDelete} className="wb-btn" style={{ padding: 6 }} title="Delete"><Trash2 size={13} /></button>
        </div>
      </div>

      {video.processing_status === 'failed' && video.processing_error && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            {video.processing_error}
          </p>
        </div>
      )}

      {expanded && complete && (
        <div style={{ borderTop: '1px solid var(--line)', padding: 14, background: 'rgba(168,85,247,0.03)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tpCount > 0 && (
            <InsightBlock icon={<Zap size={11} />} tone="#a78bfa" label={`Extracted talking points (${tpCount})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {video.extracted_talking_points.map((tp, i) => (
                  <div key={i} style={{ fontSize: 11, padding: 10, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-0)' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase' }}>{tp.topic}</span>
                      <span style={{ fontSize: 9, color: 'var(--ink-2)' }}>{Math.round(tp.confidence * 100)}% confident</span>
                    </div>
                    <p style={{ margin: '0 0 4px', color: 'var(--ink-1)' }}>{tp.point}</p>
                    <p style={{ margin: 0, color: 'var(--ink-2)', fontStyle: 'italic' }}>&ldquo;{tp.quote}&rdquo;</p>
                  </div>
                ))}
              </div>
            </InsightBlock>
          )}
          {video.extracted_voice_patterns?.common_phrases?.length > 0 && (
            <InsightBlock icon={<Mic size={11} />} tone="#fbbf24" label="Voice patterns">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {video.extracted_voice_patterns.common_phrases.map((p, i) => (
                  <span key={i} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>&ldquo;{p}&rdquo;</span>
                ))}
              </div>
              {video.extracted_voice_patterns.tone_notes && (
                <p style={{ margin: '8px 0 0', fontSize: 11, fontStyle: 'italic', color: 'var(--ink-2)' }}>{video.extracted_voice_patterns.tone_notes}</p>
              )}
            </InsightBlock>
          )}
          {ppCount > 0 && (
            <InsightBlock icon={<FileText size={11} />} tone="#60a5fa" label={`Policy positions (${ppCount})`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {video.extracted_policy_positions.map((pp, i) => (
                  <div key={i} style={{ fontSize: 11, padding: 8, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-0)' }}>
                    <span style={{ color: '#60a5fa', fontWeight: 700 }}>{pp.topic}:</span>{' '}
                    <span style={{ color: 'var(--ink-1)' }}>{pp.position}</span>
                  </div>
                ))}
              </div>
            </InsightBlock>
          )}
        </div>
      )}
    </div>
  );
}

function InsightBlock({ icon, tone, label, children }: { icon: React.ReactNode; tone: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="wb-eyebrow" style={{ color: tone, display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 8px' }}>
        {icon} {label}
      </h4>
      {children}
    </div>
  );
}
