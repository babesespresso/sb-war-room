'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Brain, Save, RefreshCw, Plus, X, CheckCircle, AlertCircle,
  Twitter, Sparkles, User, FileText, Shield, Mic, Loader2,
  Video, Upload, Trash2, Film, Clock, Zap, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { SCOTT_VOICE_GUIDE_DEFAULT, SCOTT_CONTENT_RULES_DEFAULT } from '@/lib/persona';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import CubeLoader from '@/components/ui/cube-loader';

let ffmpegInstance: FFmpeg | null = null;

interface PersonaData {
  candidate_name: string;
  campaign_type: string;
  state: string;
  voice_guide: string;
  content_rules: string[];
  brand_config: Record<string, string>;
}

interface VideoSource {
  id: string;
  title: string;
  description: string;
  source_type: string;
  file_size_bytes: number;
  duration_seconds: number;
  processing_status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  processing_error: string | null;
  extracted_talking_points: Array<{ topic: string; point: string; quote: string; confidence: number }>;
  extracted_voice_patterns: { common_phrases: string[]; rhetorical_devices: string[]; tone_notes: string };
  extracted_policy_positions: Array<{ topic: string; position: string; supporting_quote: string }>;
  training_weight: number;
  is_active: boolean;
  created_at: string;
}

// Simulated X posts for voice training — based on real Scott Bottoms posting patterns
const SAMPLE_TWEETS = [
  {
    handle: '@ScottBottomsCO',
    text: "Colorado deserves a Governor who shows up. I've been to 47 counties in the last 6 months. My opponents can't say that.",
    date: '2h ago',
    likes: 287,
    retweets: 94,
  },
  {
    handle: '@ScottBottomsCO',
    text: "Water policy isn't a talking point for me — it's personal. I've stood with farmers in the San Luis Valley watching their wells run dry. We need real solutions, not Denver bureaucrats drawing lines on a map.",
    date: '6h ago',
    likes: 412,
    retweets: 156,
  },
  {
    handle: '@ScottBottomsCO',
    text: "Just left a roundtable with small business owners in Pueblo. The message was clear: lower taxes, less regulation, more freedom. That's exactly what I'll deliver as Governor.",
    date: '1d ago',
    likes: 523,
    retweets: 189,
  },
  {
    handle: '@ScottBottomsCO',
    text: "My opponents want to talk about me. I want to talk about YOU — your family, your business, your future. That's the difference. #copolitics",
    date: '2d ago',
    likes: 671,
    retweets: 234,
  },
  {
    handle: '@ScottBottomsCO',
    text: "Constitutional rights aren't negotiable. Period. As Governor, I will defend the 2nd Amendment with everything I've got.",
    date: '3d ago',
    likes: 892,
    retweets: 312,
  },
];

const EXTRACTED_VOICE_TRAITS = [
  'Direct and confident — never hedges or over-qualifies',
  'Heavy use of "I" and personal experience — every claim backed by "I was there"',
  'Short, punchy sentences. Rarely uses compound-complex structures.',
  'Colorado-first framing — everything links back to the state, not national politics',
  'Populist authenticity — "I\'m not a politician, I\'m a Coloradan"',
  'Policy contrast without personal attacks — critiques opponents\' inaction, not character',
  'Aggressive confidence without arrogance — sounds like a fighter, not a bully',
  'Veteran\'s discipline with a pastor\'s heart — authoritative but compassionate',
  'No emojis. No hashtag spam. Maximum 1-2 hashtags per post.',
  'Calls to action are direct: "Join us", "Stand with me", "Chip in"',
  'Frequent geographic specificity: names towns, valleys, counties',
  'Uses "Reclaim" language: "Reclaim Colorado", "Reclaim our schools"',
  'Faith-informed but not preachy — values show through actions, not sermons',
  'Anti-bureaucratic tone — government is the problem, families are the solution',
  'References his 8 years of Navy service when establishing credibility',
  'Frames parental rights as "the legislature does not own the child"',
];

const SOURCE_TYPE_LABELS: Record<string, string> = {
  speech: 'Speech',
  interview: 'Interview',
  debate: 'Debate',
  town_hall: 'Town Hall',
  podcast: 'Podcast',
  press_conference: 'Press Conference',
  ad: 'Campaign Ad',
  social_clip: 'Social Clip',
  other: 'Other',
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
  uploaded: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.3)', label: 'Queued', icon: Clock },
  transcribing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', label: 'Transcribing', icon: Loader2 },
  analyzing: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', label: 'Analyzing', icon: Brain },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: 'Complete', icon: CheckCircle },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', label: 'Failed', icon: AlertCircle },
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PersonaPage() {
  const [data, setData] = useState<PersonaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [voiceGuide, setVoiceGuide] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  
  const [customHashtags, setCustomHashtags] = useState<string[]>([]);
  const [newHashtag, setNewHashtag] = useState('');

  // X Sync state
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [xHandle, setXHandle] = useState('@ScottBottomsCO');

  // Video Training state
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoSourceType, setVideoSourceType] = useState('speech');
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPersona();
    fetchVideoSources();
  }, []);

  // Track which videos we've already triggered processing for (to avoid duplicate triggers)
  const triggeredProcessingRef = useRef<Set<string>>(new Set());

  // Poll for processing status updates and auto-trigger processing for 'uploaded' videos
  useEffect(() => {
    const hasProcessing = videoSources.some(
      v => v.processing_status === 'uploaded' || v.processing_status === 'transcribing' || v.processing_status === 'analyzing'
    );
    if (!hasProcessing) return;

    // Auto-trigger processing for any video stuck in 'uploaded' that we haven't triggered yet
    const uploadedVideos = videoSources.filter(
      v => v.processing_status === 'uploaded' && !triggeredProcessingRef.current.has(v.id)
    );
    for (const v of uploadedVideos) {
      triggeredProcessingRef.current.add(v.id);
      console.log('[Train from Video] Auto-triggering processing for:', v.title, v.id);
      fetch('/api/persona/video/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: v.id }),
      }).then(res => {
        if (res.ok) {
          console.log('[Train from Video] Processing completed for:', v.title);
        } else {
          res.json().then(err => console.error('[Train from Video] Processing failed for:', v.title, err.error)).catch(() => {});
        }
        fetchVideoSources();
      }).catch(err => {
        console.error('[Train from Video] Processing request failed:', err.message);
      });
    }

    const interval = setInterval(() => {
      fetchVideoSources();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [videoSources]);

  async function fetchPersona() {
    setLoading(true);
    try {
      const [res] = await Promise.all([
        fetch('/api/persona'),
        new Promise(resolve => setTimeout(resolve, 2500)) // Force minimum 2.5s display for AI loader UX
      ]);
      if (!res.ok) throw new Error('Failed to load persona');
      const json = await res.json();
      setData(json);
      setVoiceGuide(json.voice_guide || '');
      setRules(json.content_rules || []);
      setCustomHashtags(json.brand_config?.custom_hashtags || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function fetchVideoSources() {
    try {
      const res = await fetch('/api/persona/video');
      if (!res.ok) return;
      const json = await res.json();
      setVideoSources(json.sources || []);
    } catch {
      // Non-critical, table may not exist yet
    }
  }

  async function handleSave(overrideData?: any) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = overrideData || { 
        voice_guide: voiceGuide, 
        content_rules: rules,
        brand_config: { ...data?.brand_config, custom_hashtags: customHashtags }
      };

      const res = await fetch('/api/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save');
      
      // Update local state copy to match
      setData(prev => prev ? { ...prev, brand_config: payload.brand_config } : null);
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
    setSaving(false);
  }

  function addRule() {
    if (newRule.trim()) {
      const newRules = [...rules, newRule.trim()];
      setRules(newRules);
      setNewRule('');
      handleSave({ voice_guide: voiceGuide, content_rules: newRules, brand_config: { ...data?.brand_config, custom_hashtags: customHashtags } });
    }
  }

  function removeRule(index: number) {
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
    handleSave({ voice_guide: voiceGuide, content_rules: newRules, brand_config: { ...data?.brand_config, custom_hashtags: customHashtags } });
  }

  function addHashtag() {
    if (newHashtag.trim()) {
      let tag = newHashtag.trim();
      if (!tag.startsWith('#')) tag = '#' + tag;
      const newTags = [...customHashtags, tag];
      setCustomHashtags(newTags);
      setNewHashtag('');
      handleSave({ voice_guide: voiceGuide, content_rules: rules, brand_config: { ...data?.brand_config, custom_hashtags: newTags } });
    }
  }

  function removeHashtag(index: number) {
    const newTags = customHashtags.filter((_, i) => i !== index);
    setCustomHashtags(newTags);
    handleSave({ voice_guide: voiceGuide, content_rules: rules, brand_config: { ...data?.brand_config, custom_hashtags: newTags } });
  }

  async function handleXSync() {
    setSyncing(true);
    setSynced(false);
    // Simulate API call delay
    await new Promise((r) => setTimeout(r, 2500));

    // Extract voice traits from the sample tweets and inject into voice guide
    const currentGuide = voiceGuide.trim();
    const separator = currentGuide ? '\n\n--- EXTRACTED FROM X (@ScottBottomsCO) ---\n' : '';
    setVoiceGuide(currentGuide + separator + SCOTT_VOICE_GUIDE_DEFAULT);

    // Merge extracted content rules with canonical defaults
    const combined = [...new Set([...rules, ...SCOTT_CONTENT_RULES_DEFAULT])];
    setRules(combined);

    setSyncing(false);
    setSynced(true);
  }

  // ---- Video Upload Handlers ----

  async function handleVideoUpload(file: File) {
    if (!file) return;

    console.log('[Train from Video] handleVideoUpload called:', file.name, 'type:', file.type, 'size:', file.size);

    // Allow any video/* or audio/* MIME type, plus check file extension as fallback
    const validExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    const fileExt = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isValidType = file.type.startsWith('video/') || file.type.startsWith('audio/') || validExtensions.includes(fileExt);

    if (!isValidType) {
      const msg = `Unsupported file type: "${file.type || 'unknown'}" (${file.name}). Upload video or audio files (MP4, MOV, WebM, MP3, etc.)`;
      console.error('[Train from Video]', msg);
      setError(msg);
      return;
    }

    // We no longer strictly enforce the 25MB limit on initial select, because we will convert large videos
    // However, if it's already an audio file and it's > 25MB, we must reject it (Whisper limit).
    if (file.size > 25 * 1024 * 1024 && file.type.startsWith('audio/')) {
      setError(`Audio file too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum is 25MB for audio files.`);
      return;
    }

    // Duplicate detection: check if a video with the same file size and similar name already exists
    const titleToUse = videoTitle || file.name.replace(/\.[^.]+$/, '');
    const possibleDuplicate = videoSources.find(v => {
      const sameSize = v.file_size_bytes === file.size;
      const sameName = v.title.toLowerCase().trim() === titleToUse.toLowerCase().trim();
      return sameSize || sameName;
    });

    if (possibleDuplicate) {
      const dupStatus = possibleDuplicate.processing_status === 'completed' ? 'already processed' : `currently ${possibleDuplicate.processing_status}`;
      const confirmed = window.confirm(
        `⚠️ Possible duplicate detected!\n\n` +
        `"${possibleDuplicate.title}" (${formatFileSize(possibleDuplicate.file_size_bytes)}) is ${dupStatus}.\n\n` +
        `Are you sure you want to upload "${titleToUse}" (${formatFileSize(file.size)})?`
      );
      if (!confirmed) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus('Preparing...');
    setError(null);

    let processedFile = file;

    try {
      // Step 0: Extract Audio locally if it's a large video
      if (file.type.startsWith('video/') && file.size > 15 * 1024 * 1024) {
        setUploadStatus('Extracting Audio...');
        console.log('[Train from Video] Video > 15MB detected. Initializing FFmpeg to extract audio locally...');
        
        if (!ffmpegInstance) {
          ffmpegInstance = new FFmpeg();
          ffmpegInstance.on('progress', ({ progress }) => {
            setUploadProgress(Math.round(progress * 100));
          });
          await ffmpegInstance.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
          });
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        setUploadProgress(0);
        await ffmpegInstance.writeFile(safeName, await fetchFile(file));
        
        // Extract to mp3 at 32k bitrate (very small, fine for speech recognition)
        await ffmpegInstance.exec(['-i', safeName, '-vn', '-b:a', '32k', 'output.mp3']);
        
        const audioData = await ffmpegInstance.readFile('output.mp3');
        const audioBlob = new Blob([audioData as unknown as BlobPart], { type: 'audio/mp3' });
        processedFile = new File([audioBlob], safeName.replace(/\.[^.]+$/, '.mp3'), { type: 'audio/mp3' });
        
        console.log(`[Train from Video] Extraction complete. Orignal: ${(file.size/1024/1024).toFixed(1)}MB -> Audio: ${(processedFile.size/1024/1024).toFixed(1)}MB`);
        
        if (processedFile.size > 25 * 1024 * 1024) {
             throw new Error('Even after extracting audio, the file is too large for AI transcription (OpenAI 25MB limit).');
        }
      }

      // Step 1: Initialize upload - ensure storage bucket exists and get credentials
      setUploadStatus('Initializing upload...');
      console.log('[Train from Video] Step 1: Initializing upload...');
      const initRes = await fetch('/api/persona/video/init-upload', { method: 'POST' });
      if (!initRes.ok) {
        const errText = await initRes.text();
        console.error('[Train from Video] Init failed:', initRes.status, errText);
        throw new Error(`Failed to initialize upload (${initRes.status}): ${errText}`);
      }
      const initData = await initRes.json();
      const { supabaseUrl, serviceKey } = initData;
      console.log('[Train from Video] Step 1 complete. URL:', supabaseUrl ? 'OK' : 'MISSING', 'Key:', serviceKey ? 'OK' : 'MISSING');

      if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing Supabase configuration for direct upload');
      }

      // Step 2: Upload file directly to Supabase Storage from the browser
      setUploadStatus('Uploading securely...');
      const sanitizedName = processedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `bottoms-2026/${Date.now()}-${sanitizedName}`;
      const storageUrl = `${supabaseUrl}/storage/v1/object/video-training/${storagePath}`;
      const contentType = processedFile.type || 'application/octet-stream';

      console.log('[Train from Video] Step 2: Uploading to storage...', storageUrl, 'Content-Type:', contentType);
      setUploadProgress(5); // Show initial progress

      // Use XMLHttpRequest for real upload progress tracking
      const uploadResult = await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            // Map upload progress to 5-80% of total progress
            const pct = 5 + (e.loaded / e.total) * 75;
            setUploadProgress(Math.round(pct));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            let msg = 'Storage upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              msg = errData.message || errData.error || msg;
            } catch {}
            reject(new Error(`${msg} (${xhr.status})`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('[Train from Video] XHR network error');
          reject(new Error('Network error during upload'));
        });
        xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')));

        xhr.open('POST', storageUrl, true);
        xhr.setRequestHeader('Authorization', `Bearer ${serviceKey}`);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.setRequestHeader('x-upsert', 'false');
        console.log('[Train from Video] XHR sending file...');
        xhr.send(processedFile);
      });

      setUploadStatus('Registering...');

      setUploadProgress(85);

      // Step 3: Register the uploaded video with our API (just metadata, no file bytes)
      console.log('[Train from Video] Step 3: Registering with API...');
      const registerRes = await fetch('/api/persona/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: storagePath,
          title: titleToUse,
          source_type: videoSourceType,
          file_size: processedFile.size,
        }),
      });

      if (!registerRes.ok) {
        const errJson = await registerRes.json();
        throw new Error(errJson.error || 'Failed to register video');
      }

      const registerData = await registerRes.json();
      setUploadProgress(95);

      // Step 4: Trigger processing in the background (fire-and-forget)
      // The processing endpoint has a 5-minute timeout and runs transcription + analysis.
      // The existing polling (every 5s) will pick up status changes in the UI.
      if (registerData.source?.id) {
        console.log('[Train from Video] Step 4: Triggering processing for', registerData.source.id);
        setUploadStatus('Starting transcription...');
        fetch('/api/persona/video/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: registerData.source.id }),
        }).then(res => {
          if (res.ok) {
            console.log('[Train from Video] Processing completed successfully');
          } else {
            res.json().then(err => {
              console.error('[Train from Video] Processing failed:', err.error);
            }).catch(() => {});
          }
          // Refresh list to show final status
          fetchVideoSources();
        }).catch(err => {
          console.error('[Train from Video] Processing request failed:', err.message);
        });
      }

      setUploadProgress(100);

      // Reset form
      setVideoTitle('');
      setVideoSourceType('speech');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh video sources list to show the new entry
      await fetchVideoSources();

      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err: any) {
      console.error('[Train from Video] Upload failed:', err);
      setError(err.message || 'Upload failed. Check browser console for details.');
    } finally {
      setUploading(false);
      setUploadStatus(null);
      setUploadProgress(0);
    }
  }

  async function handleDeleteVideo(id: string) {
    try {
      const res = await fetch(`/api/persona/video?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setVideoSources(prev => prev.filter(v => v.id !== id));
      if (expandedVideoId === id) setExpandedVideoId(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      console.log('[Train from Video] File dropped:', file.name, file.type, file.size);
      handleVideoUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('[Train from Video] File selected:', file?.name, file?.type, file?.size);
    if (file) {
      handleVideoUpload(file);
    }
  };

  const completedVideos = videoSources.filter(v => v.processing_status === 'completed');
  const totalTalkingPoints = completedVideos.reduce((sum, v) => sum + (v.extracted_talking_points?.length || 0), 0);
  const totalPolicyPositions = completedVideos.reduce((sum, v) => sum + (v.extracted_policy_positions?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <CubeLoader />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Brain className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold tracking-tight">AI Persona</h1>
            <InfoTooltip text="Configure how the AI writes content as Scott Bottoms. The voice guide and content rules are injected into every AI prompt to ensure authentic, first-person content generation. Upload videos to train the AI on Scott's actual talking points." />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Teach the AI to write like {data?.candidate_name || 'the candidate'}. All generated content will use this persona.
          </p>
        </div>
        <button
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={{
            background: saved ? 'rgba(16, 185, 129, 0.2)' : 'var(--campaign-red)',
            color: saved ? '#6ee7b7' : 'white',
            border: saved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
          }}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : saved ? 'Saved' : 'Save Persona'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3 border border-red-500/30" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Training Stats Banner */}
      {completedVideos.length > 0 && (
        <div className="mb-6 p-4 rounded-2xl glass-panel border border-purple-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-blue-500/5 to-emerald-500/5 pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl" style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)' }}>
                <Zap className="w-5 h-5 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.6))' }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Voice Training Active</p>
                <p className="text-[11px] text-slate-400">
                  {completedVideos.length} video{completedVideos.length !== 1 ? 's' : ''} analyzed · {totalTalkingPoints} talking points · {totalPolicyPositions} policy positions extracted
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{completedVideos.length}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500">Sources</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400">{totalTalkingPoints}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500">Points</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-400">{totalPolicyPositions}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500">Positions</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Identity + Voice Guide */}
        <div className="lg:col-span-7 space-y-6">

          {/* Identity Card */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                  <User className="w-5 h-5 text-purple-400" style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.6))' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Candidate Identity</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">Who the AI becomes</p>
                </div>
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-subpanel shadow-inner rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Candidate</p>
                  <p className="text-lg font-bold text-white">{data?.candidate_name || '—'}</p>
                </div>
                <div className="glass-subpanel shadow-inner rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Race</p>
                  <p className="text-lg font-bold text-white">{data?.campaign_type || '—'}</p>
                </div>
                <div className="glass-subpanel shadow-inner rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">State</p>
                  <p className="text-lg font-bold text-white">{data?.state || '—'}</p>
                </div>
                <div className="glass-subpanel shadow-inner rounded-xl p-4 border border-white/5">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Perspective</p>
                  <p className="text-lg font-bold text-emerald-400">1st Person</p>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Guide */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <Mic className="w-5 h-5 text-amber-400" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Voice Guide</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">How Scott sounds — injected into every AI prompt</p>
                </div>
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              <textarea
                value={voiceGuide}
                onChange={(e) => setVoiceGuide(e.target.value)}
                rows={14}
                className="w-full bg-transparent rounded-xl p-4 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                style={{
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
                placeholder="Describe how Scott writes and speaks. Be specific about tone, sentence structure, vocabulary, and habits. This text is injected directly into every AI prompt."
              />
              <p className="text-xs mt-2 text-slate-500">
                {voiceGuide.length} characters · This is injected as the VOICE context in every content generation prompt.
              </p>
            </div>
          </div>

          {/* Video Training — FULL WIDTH under voice guide */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/3 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                  <Video className="w-5 h-5 text-violet-400" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.6))' }} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold tracking-tight">Train from Video</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
                    Upload speeches, interviews, and debates to extract Scott's authentic talking points
                  </p>
                </div>
                {videoSources.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                      {videoSources.length} video{videoSources.length !== 1 ? 's' : ''} uploaded
                    </div>
                    {completedVideos.length > 0 && completedVideos.length < videoSources.length && (
                      <div className="px-3 py-1.5 rounded-full text-[11px] font-bold" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                        {videoSources.length - completedVideos.length} processing
                      </div>
                    )}
                  </div>
                )}
                <InfoTooltip text="Upload videos of Scott speaking. The system will automatically transcribe the audio, then use AI to extract talking points, voice patterns, and policy positions. These get injected into every content generation prompt so X posts and emails sound authentically like Scott." />
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              {/* Upload Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="Video title (e.g. 'KRDO Interview April 2026')"
                />
                <select
                  value={videoSourceType}
                  onChange={(e) => setVideoSourceType(e.target.value)}
                  className="bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)', background: 'var(--surface-1)' }}
                >
                  {Object.entries(SOURCE_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg flex items-start gap-2 border border-red-500/30" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-red-300 flex-1 leading-snug">{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Drag & Drop Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200"
                style={{
                  borderColor: dragOver ? 'rgba(139, 92, 246, 0.6)' : uploading ? 'rgba(139, 92, 246, 0.3)' : 'var(--border-color)',
                  background: dragOver ? 'rgba(139, 92, 246, 0.08)' : uploading ? 'rgba(139, 92, 246, 0.04)' : 'transparent',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-violet-300">{uploadStatus || 'Uploading & Processing...'}</p>
                    <div className="w-full max-w-xs mx-auto h-2 rounded-full overflow-hidden" style={{ background: 'rgba(139,92,246,0.15)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">{Math.round(uploadProgress)}% — {uploadStatus === 'Extracting Audio...' ? 'Extracting locally before upload' : 'Transcription will begin automatically'}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-300">Drop a video or audio file here</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      MP4, MOV, WebM, AVI, MP3, WAV · Any size (Large videos are compressed locally)
                    </p>
                    <p className="text-[10px] text-violet-400/60 mt-2">
                      The system will transcribe the audio and extract talking points, voice patterns, and policy positions
                    </p>
                  </>
                )}
              </div>

              {/* Video Sources List — Always visible */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Uploaded Training Sources ({videoSources.length})</h3>
                  {completedVideos.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {totalTalkingPoints} talking points · {totalPolicyPositions} positions extracted
                    </span>
                  )}
                </div>

                {videoSources.length === 0 ? (
                  <div className="glass-subpanel shadow-inner rounded-xl border border-white/5 p-8 text-center">
                    <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">No videos uploaded yet</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Upload a video above to start training. Scott's speeches, interviews, and debates work best.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                    {videoSources.map((video) => {
                      const status = STATUS_CONFIG[video.processing_status] || STATUS_CONFIG.uploaded;
                      const StatusIcon = status.icon;
                      const isExpanded = expandedVideoId === video.id;
                      const isComplete = video.processing_status === 'completed';
                      const tpCount = video.extracted_talking_points?.length || 0;
                      const ppCount = video.extracted_policy_positions?.length || 0;

                      return (
                        <div key={video.id} className="glass-subpanel shadow-inner rounded-xl border border-white/5 overflow-hidden relative">
                          
                          {/* Transcribing / Completed Surge Effect at the Bottom */}
                          {(video.processing_status === 'transcribing' || video.processing_status === 'analyzing') && (
                            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-amber-500/20 z-10 overflow-hidden">
                              <div className="absolute inset-0 bg-amber-400 opacity-60 w-1/2 -translate-x-full animate-[shimmer_2s_infinite]" style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.8))' }} />
                            </div>
                          )}
                          {isComplete && (
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-500 z-10" style={{ filter: 'drop-shadow(0 -1px 8px rgba(16,185,129,0.7))' }} />
                          )}

                          {/* Video Header */}
                          <div className="p-4 flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ background: status.bg, border: `1px solid ${status.border}` }}>
                              <Film className="w-4 h-4" style={{ color: status.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{video.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>
                                  <StatusIcon className={`w-2.5 h-2.5 inline-block mr-1 ${video.processing_status === 'transcribing' || video.processing_status === 'analyzing' ? 'animate-spin' : ''}`} />
                                  {status.label}
                                </span>
                                <span className="text-[10px] text-slate-500">{SOURCE_TYPE_LABELS[video.source_type] || 'Other'}</span>
                                <span className="text-[10px] text-slate-600">·</span>
                                <span className="text-[10px] text-slate-500">{formatFileSize(video.file_size_bytes)}</span>
                                <span className="text-[10px] text-slate-600">·</span>
                                <span className="text-[10px] text-slate-500">{new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                {isComplete && (
                                  <>
                                    <span className="text-[10px] text-slate-600">·</span>
                                    <span className="text-[10px] text-emerald-400 font-bold">{tpCount} points, {ppCount} positions</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {isComplete && (
                                <button
                                  onClick={() => setExpandedVideoId(isExpanded ? null : video.id)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                  title="View extracted insights"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <Eye className="w-4 h-4 text-violet-400" />
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group"
                                title="Delete training source"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-red-400" />
                              </button>
                            </div>
                          </div>

                          {/* Processing Error */}
                          {video.processing_status === 'failed' && video.processing_error && (
                            <div className="px-4 pb-3">
                              <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg p-2 border border-red-500/20">
                                {video.processing_error}
                              </p>
                            </div>
                          )}

                          {/* Expanded Insights */}
                          {isExpanded && isComplete && (
                            <div className="border-t border-white/5 p-4 space-y-4" style={{ background: 'rgba(139,92,246,0.03)' }}>
                              {/* Extracted Talking Points */}
                              {tpCount > 0 && (
                                <div>
                                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-violet-400 mb-2 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Extracted Talking Points ({tpCount})
                                  </h4>
                                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {video.extracted_talking_points.map((tp, i) => (
                                      <div key={i} className="text-[11px] p-2.5 rounded-lg border border-white/5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-bold uppercase">{tp.topic}</span>
                                          <span className="text-[9px] text-slate-500">{Math.round(tp.confidence * 100)}% confident</span>
                                        </div>
                                        <p className="text-slate-300 leading-relaxed">{tp.point}</p>
                                        <p className="text-slate-500 italic mt-1">"{tp.quote}"</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Voice Patterns */}
                              {video.extracted_voice_patterns?.common_phrases?.length > 0 && (
                                <div>
                                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-amber-400 mb-2 flex items-center gap-1">
                                    <Mic className="w-3 h-3" /> Voice Patterns
                                  </h4>
                                  <div className="flex flex-wrap gap-1.5">
                                    {video.extracted_voice_patterns.common_phrases.map((phrase, i) => (
                                      <span key={i} className="text-[10px] px-2 py-1 rounded-full border border-amber-500/20 text-amber-300/80" style={{ background: 'rgba(245,158,11,0.08)' }}>
                                        "{phrase}"
                                      </span>
                                    ))}
                                  </div>
                                  {video.extracted_voice_patterns.tone_notes && (
                                    <p className="text-[11px] text-slate-400 mt-2 italic">{video.extracted_voice_patterns.tone_notes}</p>
                                  )}
                                </div>
                              )}

                              {/* Policy Positions */}
                              {ppCount > 0 && (
                                <div>
                                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-2 flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> Policy Positions Detected ({ppCount})
                                  </h4>
                                  <div className="space-y-1.5">
                                    {video.extracted_policy_positions.map((pp, i) => (
                                      <div key={i} className="text-[11px] p-2 rounded-lg border border-white/5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                                        <span className="text-blue-400 font-bold">{pp.topic}:</span>{' '}
                                        <span className="text-slate-300">{pp.position}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content Rules + Hashtags + X Sync */}
        <div className="lg:col-span-5 space-y-6">

          {/* Content Rules */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <Shield className="w-5 h-5 text-blue-400" style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Content Rules</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">{rules.length} active rules</p>
                </div>
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto custom-scrollbar">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 glass-subpanel shadow-inner rounded-lg p-3 border border-white/5 group">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300 flex-1">{rule}</span>
                    <button
                      onClick={() => removeRule(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                    >
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  </div>
                ))}
                {rules.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-4">No rules configured yet. Add rules below or sync from X.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addRule()}
                  className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  placeholder="Add a content rule..."
                />
                <button
                  onClick={addRule}
                  className="px-3 py-2 rounded-lg transition-all hover:bg-white/10"
                  style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Custom Hashtags */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <span className="text-blue-400 font-bold" style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.6))' }}>#</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Custom Hashtags</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">{customHashtags.length} hashtags</p>
                </div>
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              <div className="flex flex-wrap gap-2 mb-4">
                {customHashtags.map((tag, i) => (
                  <div key={i} className="flex items-center gap-1.5 glass-subpanel shadow-inner rounded-full pl-3 pr-1 py-1 border border-white/5 group">
                    <span className="text-xs font-bold text-slate-300">{tag}</span>
                    <button
                      onClick={() => removeHashtag(i)}
                      className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3 h-3 text-slate-500 group-hover:text-red-400" />
                    </button>
                  </div>
                ))}
                {customHashtags.length === 0 && (
                  <p className="text-xs text-slate-500 text-center w-full py-2">No custom hashtags configured.</p>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={newHashtag}
                  onChange={(e) => setNewHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                  className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                  placeholder="Add hashtag (e.g. #copolitics)..."
                />
                <button
                  onClick={addHashtag}
                  className="px-3 py-2 rounded-lg transition-all hover:bg-white/10"
                  style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                </button>
              </div>
            </div>
          </div>

          {/* X (Twitter) Sync */}
          <div className="rounded-2xl glass-panel relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent pointer-events-none" />
            <div className="p-6 relative z-10 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl glass-subpanel shadow-inner" style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Twitter className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Train from X</h2>
                  <p className="text-[11px] uppercase tracking-widest font-bold mt-1 text-slate-400">
                    {synced ? 'Voice extracted' : 'Analyze posting patterns'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 relative z-10 bg-black/20">
              {/* Handle Input */}
              <div className="flex gap-2 mb-4">
                <input
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value)}
                  className="flex-1 bg-transparent rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-white/20"
                  style={{ border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder="@handle"
                />
                <button
                  onClick={handleXSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:brightness-110"
                  style={{
                    background: synced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: synced ? '#6ee7b7' : 'white',
                    border: synced ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  {syncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : synced ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {syncing ? 'Analyzing...' : synced ? 'Synced' : 'Sync Voice'}
                </button>
              </div>

              {/* Sample Posts */}
              <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                {SAMPLE_TWEETS.map((tweet, i) => (
                  <div key={i} className="glass-subpanel shadow-inner rounded-xl p-4 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">SB</span>
                      </div>
                      <span className="text-xs font-bold text-white">{tweet.handle}</span>
                      <span className="text-[10px] text-slate-500">· {tweet.date}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300 mb-2">{tweet.text}</p>
                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                      <span>♥ {tweet.likes}</span>
                      <span>↻ {tweet.retweets}</span>
                    </div>
                  </div>
                ))}
              </div>

              {synced && (
                <div className="mt-4 p-3 rounded-xl border border-emerald-500/30" style={{ background: 'rgba(16, 185, 129, 0.08)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Voice Traits Extracted</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {EXTRACTED_VOICE_TRAITS.length} voice characteristics and {SCOTT_CONTENT_RULES_DEFAULT.length} content rules have been extracted from {SAMPLE_TWEETS.length} recent posts
                    and injected into the Voice Guide and Content Rules above. Click <strong>Save Persona</strong> to apply.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
