-- ============================================================
-- VIDEO TRAINING SOURCES
-- Stores uploaded videos and AI-extracted talking points
-- for enhanced persona training and content generation.
-- ============================================================

CREATE TABLE video_training_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Video metadata
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    source_type TEXT CHECK (source_type IN (
        'speech', 'interview', 'debate', 'town_hall',
        'podcast', 'press_conference', 'ad', 'social_clip', 'other'
    )) DEFAULT 'other',

    -- Transcription
    transcript TEXT,
    transcript_segments JSONB DEFAULT '[]'::jsonb,
    -- [{ "start": 0.0, "end": 5.2, "text": "..." }]

    -- AI-extracted talking points
    extracted_talking_points JSONB DEFAULT '[]'::jsonb,
    -- [{ "topic": "water_policy", "point": "...", "quote": "exact quote", "confidence": 0.95 }]

    extracted_voice_patterns JSONB DEFAULT '{}'::jsonb,
    -- { "common_phrases": [], "rhetorical_devices": [], "tone_notes": "", "avg_sentence_length": 12 }

    extracted_policy_positions JSONB DEFAULT '[]'::jsonb,
    -- [{ "topic": "...", "position": "...", "supporting_quote": "..." }]

    -- Processing pipeline status
    processing_status TEXT CHECK (processing_status IN (
        'uploaded', 'transcribing', 'analyzing', 'completed', 'failed'
    )) DEFAULT 'uploaded',
    processing_error TEXT,
    processed_at TIMESTAMPTZ,

    -- Persona training integration
    is_active BOOLEAN NOT NULL DEFAULT true,
    training_weight DECIMAL(3,2) DEFAULT 1.00 CHECK (training_weight BETWEEN 0.00 AND 1.00),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_training_tenant ON video_training_sources(tenant_id);
CREATE INDEX idx_video_training_status ON video_training_sources(processing_status);
CREATE INDEX idx_video_training_active ON video_training_sources(tenant_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE video_training_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON video_training_sources FOR ALL USING (true) WITH CHECK (true);

-- Trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON video_training_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
