-- ============================================================
-- WARBIRD CAMPAIGN INTELLIGENCE ENGINE
-- Supabase Migration: Initial Schema
-- Multitude Media | Multi-Tenant Campaign AI Platform
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE: Tenants & Configuration
-- ============================================================

CREATE TABLE tenants (
    id TEXT PRIMARY KEY, -- e.g. 'bottoms-2026'
    name TEXT NOT NULL,
    candidate_name TEXT,
    campaign_type TEXT CHECK (campaign_type IN ('gubernatorial', 'senate', 'house', 'local', 'business')),
    state TEXT,
    
    -- Brand Configuration
    brand_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { primary_color, secondary_color, logo_url, signature_image_url, donation_url, website_url }
    
    -- Voice & Style
    voice_guide TEXT, -- System prompt fragment defining candidate's voice
    content_rules JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["no emojis", "no em dashes", "punchy short-form"]
    
    -- Slack Configuration
    slack_workspace_id TEXT,
    slack_channels JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { war_room, competitor_watch, content_queue, news_pulse, analytics, requests }
    
    -- API Keys (encrypted references to Supabase Vault)
    api_keys JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { meta_token_ref, twitter_token_ref, ghl_token_ref, claude_key_ref }
    
    -- Settings
    timezone TEXT NOT NULL DEFAULT 'America/Denver',
    brief_time TIME NOT NULL DEFAULT '06:30:00', -- Daily brief generation time
    content_approval_required BOOLEAN NOT NULL DEFAULT true,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INTELLIGENCE: Competitors
-- ============================================================

CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    party TEXT,
    role TEXT, -- "candidate", "incumbent", "surrogate"
    
    -- Social accounts to monitor
    social_accounts JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { twitter_handle, facebook_page, instagram_handle, tiktok_handle, website_url }
    
    -- Current messaging profile (updated by agent)
    messaging_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- { core_themes: [], attack_vectors: [], key_policies: [], tone: "", last_updated: "" }
    
    threat_level TEXT CHECK (threat_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitors_tenant ON competitors(tenant_id);

CREATE TABLE competitor_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'social_post', 'press_release', 'policy_announcement', 
        'endorsement', 'attack', 'ad_campaign', 'event', 'filing', 'media_appearance'
    )),
    platform TEXT, -- 'twitter', 'facebook', 'instagram', 'website', 'news', 'tv'
    
    -- Content
    title TEXT,
    summary TEXT NOT NULL, -- Claude-generated summary
    raw_content TEXT, -- Original scraped content
    source_url TEXT,
    
    -- Analysis
    topics TEXT[] NOT NULL DEFAULT '{}', -- ['water_policy', 'immigration', 'economy']
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'attack')),
    threat_level TEXT CHECK (threat_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    requires_response BOOLEAN NOT NULL DEFAULT false,
    suggested_response TEXT, -- Claude-generated response suggestion
    
    -- Engagement metrics (if social post)
    engagement_metrics JSONB, -- { likes, shares, comments, reach }
    
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comp_activities_tenant ON competitor_activities(tenant_id);
CREATE INDEX idx_comp_activities_competitor ON competitor_activities(competitor_id);
CREATE INDEX idx_comp_activities_type ON competitor_activities(activity_type);
CREATE INDEX idx_comp_activities_threat ON competitor_activities(threat_level);
CREATE INDEX idx_comp_activities_detected ON competitor_activities(detected_at DESC);

-- ============================================================
-- INTELLIGENCE: News Monitoring
-- ============================================================

CREATE TABLE news_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL, -- "Denver Post", "Colorado Sun"
    source_type TEXT CHECK (source_type IN ('newspaper', 'tv', 'radio', 'online', 'wire', 'blog')),
    feed_url TEXT, -- RSS feed URL
    website_url TEXT,
    reliability_score INTEGER CHECK (reliability_score BETWEEN 1 AND 10) DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_id UUID REFERENCES news_sources(id),
    
    headline TEXT NOT NULL,
    summary TEXT NOT NULL, -- Claude-generated summary
    source_name TEXT NOT NULL,
    source_url TEXT,
    published_at TIMESTAMPTZ,
    
    -- Classification
    topics TEXT[] NOT NULL DEFAULT '{}',
    relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 100), -- How relevant to the campaign
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    mentions_candidate BOOLEAN NOT NULL DEFAULT false,
    mentions_competitors TEXT[] DEFAULT '{}', -- competitor IDs mentioned
    
    -- Response assessment
    response_opportunity BOOLEAN NOT NULL DEFAULT false,
    response_urgency TEXT CHECK (response_urgency IN ('none', 'low', 'medium', 'high', 'critical')),
    suggested_angle TEXT, -- How candidate should respond/leverage
    
    -- Candidate position cross-reference
    related_positions UUID[] DEFAULT '{}', -- References to candidate_positions
    
    is_processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_tenant ON news_items(tenant_id);
CREATE INDEX idx_news_topics ON news_items USING GIN(topics);
CREATE INDEX idx_news_relevance ON news_items(relevance_score DESC);
CREATE INDEX idx_news_published ON news_items(published_at DESC);
CREATE INDEX idx_news_response ON news_items(response_opportunity) WHERE response_opportunity = true;

-- ============================================================
-- INTELLIGENCE: Public Sentiment
-- ============================================================

CREATE TABLE sentiment_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source
    platform TEXT NOT NULL, -- 'reddit', 'twitter', 'facebook', 'nextdoor', 'news_comments'
    source_identifier TEXT, -- subreddit name, group name, etc.
    
    -- Topic cluster
    topic TEXT NOT NULL, -- 'housing_affordability', 'water_rights', 'immigration'
    subtopic TEXT,
    
    -- Metrics
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score BETWEEN -1.00 AND 1.00), -- -1 negative to +1 positive
    volume INTEGER NOT NULL DEFAULT 0, -- Number of posts/comments in this cluster
    velocity DECIMAL(5,2), -- Rate of change vs previous period
    
    -- Representative content
    sample_posts JSONB DEFAULT '[]'::jsonb, -- [{text, url, engagement, sentiment}]
    key_phrases TEXT[] DEFAULT '{}', -- Most common phrases
    
    -- Analysis
    opportunity_score INTEGER CHECK (opportunity_score BETWEEN 1 AND 100),
    candidate_alignment TEXT CHECK (candidate_alignment IN ('strong', 'moderate', 'weak', 'opposed')),
    recommended_action TEXT,
    
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sentiment_tenant ON sentiment_signals(tenant_id);
CREATE INDEX idx_sentiment_topic ON sentiment_signals(topic);
CREATE INDEX idx_sentiment_period ON sentiment_signals(period_start DESC);
CREATE INDEX idx_sentiment_opportunity ON sentiment_signals(opportunity_score DESC);

-- ============================================================
-- KNOWLEDGE: Candidate Positions
-- ============================================================

CREATE TABLE candidate_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    topic TEXT NOT NULL, -- 'water_policy', 'economy', 'education'
    subtopic TEXT,
    
    -- Position content
    position_summary TEXT NOT NULL, -- One-paragraph summary
    talking_points JSONB NOT NULL DEFAULT '[]'::jsonb, -- ["point 1", "point 2"]
    supporting_data JSONB DEFAULT '[]'::jsonb, -- [{fact, source, date}]
    
    -- Differentiation
    vs_competitors JSONB DEFAULT '{}'::jsonb, -- { competitor_id: "how we differ" }
    
    -- Source references
    source_speeches TEXT[] DEFAULT '{}',
    source_documents TEXT[] DEFAULT '{}',
    source_urls TEXT[] DEFAULT '{}',
    
    -- Metadata
    strength TEXT CHECK (strength IN ('strong', 'moderate', 'developing', 'vulnerable')),
    last_public_statement TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_positions_tenant ON candidate_positions(tenant_id);
CREATE INDEX idx_positions_topic ON candidate_positions(topic);

-- ============================================================
-- CONTENT: Generation & Approval Pipeline
-- ============================================================

CREATE TABLE content_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Content type
    content_type TEXT NOT NULL CHECK (content_type IN (
        'social_twitter', 'social_facebook', 'social_instagram', 'social_tiktok',
        'email', 'sms', 'blog_post', 'press_release', 'rapid_response',
        'video_script', 'quote_card', 'infographic'
    )),
    
    -- Content
    title TEXT,
    body TEXT NOT NULL, -- The actual content/copy
    html_body TEXT, -- For emails
    visual_direction TEXT, -- Image/video concept description
    hashtags TEXT[] DEFAULT '{}',
    
    -- Strategic context
    intelligence_source TEXT, -- What triggered this content
    intelligence_ids UUID[] DEFAULT '{}', -- References to news_items, competitor_activities, sentiment_signals
    strategic_rationale TEXT, -- Why this content matters now
    
    -- Scheduling
    suggested_post_time TIMESTAMPTZ,
    platform TEXT,
    
    -- Approval workflow
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'pending_review', 'approved', 'rejected', 'revision_requested',
        'scheduled', 'published', 'failed'
    )) DEFAULT 'draft',
    
    -- Slack tracking
    slack_message_ts TEXT, -- Slack message timestamp for reaction tracking
    slack_channel TEXT,
    approved_by TEXT, -- Slack user ID who approved
    rejection_reason TEXT,
    revision_notes TEXT,
    
    -- Variants for A/B testing
    variant_group UUID, -- Groups variants together
    variant_label TEXT, -- "A", "B", "C"
    
    -- Publishing
    published_at TIMESTAMPTZ,
    published_url TEXT,
    published_post_id TEXT, -- Platform-specific post ID
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafts_tenant ON content_drafts(tenant_id);
CREATE INDEX idx_drafts_status ON content_drafts(status);
CREATE INDEX idx_drafts_type ON content_drafts(content_type);
CREATE INDEX idx_drafts_scheduled ON content_drafts(suggested_post_time) WHERE status = 'approved';
CREATE INDEX idx_drafts_slack ON content_drafts(slack_message_ts);

-- ============================================================
-- CONTENT: Calendar
-- ============================================================

CREATE TABLE content_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    calendar_date DATE NOT NULL,
    
    -- Planned content
    planned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- [{content_type, topic, platform, time, draft_id, status}]
    
    -- Daily strategy
    daily_theme TEXT, -- Overarching theme for the day
    key_messages TEXT[] DEFAULT '{}',
    avoid_topics TEXT[] DEFAULT '{}', -- Topics to stay away from today
    
    -- Generated by daily brief
    brief_id UUID,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_tenant_date ON content_calendar(tenant_id, calendar_date);

-- ============================================================
-- DISTRIBUTION: Publishing Log
-- ============================================================

CREATE TABLE publishing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES content_drafts(id),
    
    platform TEXT NOT NULL,
    post_id TEXT, -- Platform-specific ID
    post_url TEXT,
    
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_by TEXT, -- 'agent' or slack user ID
    
    -- Distribution details
    distribution_channel TEXT, -- 'organic', 'ghl_email', 'ghl_sms', 'direct_api'
    recipient_count INTEGER, -- For email/SMS
    
    -- Status
    status TEXT CHECK (status IN ('published', 'failed', 'deleted')) DEFAULT 'published',
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publishing_tenant ON publishing_log(tenant_id);
CREATE INDEX idx_publishing_platform ON publishing_log(platform);
CREATE INDEX idx_publishing_date ON publishing_log(published_at DESC);

-- ============================================================
-- ANALYTICS: Performance Metrics
-- ============================================================

CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    metric_date DATE NOT NULL,
    platform TEXT NOT NULL,
    
    -- Engagement metrics
    followers INTEGER,
    followers_change INTEGER,
    posts_count INTEGER,
    impressions INTEGER,
    reach INTEGER,
    engagements INTEGER,
    engagement_rate DECIMAL(5,4),
    likes INTEGER,
    shares INTEGER,
    comments INTEGER,
    clicks INTEGER,
    
    -- Email/SMS metrics (when platform = 'email' or 'sms')
    sent INTEGER,
    delivered INTEGER,
    opens INTEGER,
    open_rate DECIMAL(5,4),
    click_rate DECIMAL(5,4),
    unsubscribes INTEGER,
    
    -- Sentiment of responses
    response_sentiment DECIMAL(3,2), -- Average sentiment of comments/replies
    
    -- Top performing content
    top_posts JSONB DEFAULT '[]'::jsonb, -- [{draft_id, post_url, engagements}]
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_tenant_date ON performance_metrics(tenant_id, metric_date DESC);
CREATE INDEX idx_metrics_platform ON performance_metrics(platform);
CREATE UNIQUE INDEX idx_metrics_unique ON performance_metrics(tenant_id, metric_date, platform);

-- ============================================================
-- ANALYTICS: Competitor Benchmarks
-- ============================================================

CREATE TABLE competitor_benchmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    
    benchmark_date DATE NOT NULL,
    platform TEXT NOT NULL,
    
    followers INTEGER,
    followers_change INTEGER,
    posts_count INTEGER,
    avg_engagement DECIMAL(10,2),
    top_post_engagement INTEGER,
    
    -- Topic dominance
    dominant_topics TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_benchmarks_tenant_date ON competitor_benchmarks(tenant_id, benchmark_date DESC);

-- ============================================================
-- SYSTEM: Agent Runs & Audit Log
-- ============================================================

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    agent_name TEXT NOT NULL, -- 'competitor_monitor', 'news_pulse', 'daily_brief', etc.
    run_type TEXT CHECK (run_type IN ('scheduled', 'triggered', 'manual')) DEFAULT 'scheduled',
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    
    status TEXT CHECK (status IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',
    
    -- What it did
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    
    -- Token usage
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    api_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    
    -- Output summary
    run_summary TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runs_tenant ON agent_runs(tenant_id);
CREATE INDEX idx_runs_agent ON agent_runs(agent_name);
CREATE INDEX idx_runs_started ON agent_runs(started_at DESC);
CREATE INDEX idx_runs_status ON agent_runs(status);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL, -- 'content_generated', 'content_approved', 'content_published', 'alert_fired'
    agent_name TEXT,
    actor TEXT, -- 'system', 'agent:name', or slack user ID
    
    entity_type TEXT, -- 'content_draft', 'news_item', etc.
    entity_id UUID,
    
    details JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_event ON audit_log(event_type);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================
-- SYSTEM: Daily Briefs
-- ============================================================

CREATE TABLE daily_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    brief_date DATE NOT NULL,
    
    -- Brief content
    brief_markdown TEXT NOT NULL, -- Full brief in markdown
    brief_slack_blocks JSONB, -- Slack Block Kit formatted version
    
    -- Components
    opportunities JSONB DEFAULT '[]'::jsonb, -- [{title, description, content_type, priority}]
    competitor_summary JSONB DEFAULT '{}'::jsonb,
    trending_issues JSONB DEFAULT '[]'::jsonb,
    news_highlights JSONB DEFAULT '[]'::jsonb,
    
    -- Content recommendations generated
    content_recs_generated INTEGER DEFAULT 0,
    
    -- Slack
    slack_message_ts TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_briefs_tenant_date ON daily_briefs(tenant_id, brief_date DESC);
CREATE UNIQUE INDEX idx_briefs_unique ON daily_briefs(tenant_id, brief_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentiment_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE publishing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

-- Service role can access everything (for edge functions / agents)
-- These policies allow the service_role key used by agents to operate across tenants
-- Individual user access policies would be added per-deployment

CREATE POLICY "Service role full access" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON competitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON competitor_activities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON news_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON news_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sentiment_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON candidate_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON content_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON content_calendar FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON publishing_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON performance_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON competitor_benchmarks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agent_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON audit_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON daily_briefs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED: Bottoms 2026 Campaign
-- ============================================================

INSERT INTO tenants (id, name, candidate_name, campaign_type, state, brand_config, voice_guide, content_rules, timezone) 
VALUES (
    'bottoms-2026',
    'Scott Bottoms for Governor 2026',
    'Scott Bottoms',
    'gubernatorial',
    'CO',
    '{
        "primary_color": "#1a3147",
        "secondary_color": "#dc2626",
        "accent_color": "#ffffff",
        "donation_url": "https://secure.winred.com/scott-bottoms",
        "website_url": "https://scottbottoms.com",
        "logo_url": null,
        "signature_image_url": null
    }'::jsonb,
    'Direct, confident, Colorado-first voice. Speaks like a leader who has lived the issues, not a politician reading talking points. Uses concrete examples and local references. Tone is strong but not aggressive -- firm conviction backed by real experience. Never condescending. Speaks TO Coloradans, not AT them. Wife Linda is occasionally referenced as grounding, family-oriented touchpoint.',
    '["No emojis in formal communications", "No em dashes", "Punchy short-form for social", "Always tie back to Colorado impact", "Use concrete numbers and examples over vague promises", "Never attack opponents personally -- contrast on policy only"]'::jsonb,
    'America/Denver'
);

-- ============================================================
-- FUNCTIONS: Updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON competitors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON candidate_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON content_drafts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON content_calendar FOR EACH ROW EXECUTE FUNCTION update_updated_at();
