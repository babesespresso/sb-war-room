-- Social Threats Table
-- Persists analyzed threats from X (Twitter) locally so they don't vanish on refresh

CREATE TABLE IF NOT EXISTS social_threats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL,
    author_name TEXT,
    author_handle TEXT,
    avatar_url TEXT,
    content TEXT NOT NULL,
    threat_level TEXT CHECK (threat_level IN ('hostile', 'bot', 'negative', 'spam', 'safe')) DEFAULT 'safe',
    confidence INTEGER DEFAULT 0,
    flags JSONB DEFAULT '[]'::jsonb,
    platform TEXT DEFAULT 'x',
    metrics JSONB DEFAULT '{}'::jsonb,
    status TEXT CHECK (status IN ('active', 'ignored', 'hidden', 'reported')) DEFAULT 'active',
    detected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, post_id)
);

CREATE INDEX idx_social_threats_tenant ON social_threats(tenant_id);
CREATE INDEX idx_social_threats_status ON social_threats(status);

-- Enable RLS
ALTER TABLE social_threats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON social_threats AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Enable all for service role" ON social_threats AS PERMISSIVE FOR ALL USING (true) WITH CHECK (true);
