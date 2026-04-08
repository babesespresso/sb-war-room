-- Remaining tables from 001_initial_schema.sql
-- (tenants, competitors, competitor_activities already created)

CREATE TABLE news_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source_type TEXT CHECK (source_type IN ('newspaper', 'tv', 'radio', 'online', 'wire', 'blog')),
    feed_url TEXT,
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
    summary TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_url TEXT,
    published_at TIMESTAMPTZ,
    topics TEXT[] NOT NULL DEFAULT '{}',
    relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 100),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
    mentions_candidate BOOLEAN NOT NULL DEFAULT false,
    mentions_competitors TEXT[] DEFAULT '{}',
    response_opportunity BOOLEAN NOT NULL DEFAULT false,
    response_urgency TEXT CHECK (response_urgency IN ('none', 'low', 'medium', 'high', 'critical')),
    suggested_angle TEXT,
    related_positions UUID[] DEFAULT '{}',
    is_processed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_news_tenant ON news_items(tenant_id);
CREATE INDEX idx_news_topics ON news_items USING GIN(topics);
CREATE INDEX idx_news_relevance ON news_items(relevance_score DESC);
CREATE INDEX idx_news_published ON news_items(published_at DESC);
CREATE INDEX idx_news_response ON news_items(response_opportunity) WHERE response_opportunity = true;

CREATE TABLE sentiment_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    source_identifier TEXT,
    topic TEXT NOT NULL,
    subtopic TEXT,
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score BETWEEN -1.00 AND 1.00),
    volume INTEGER NOT NULL DEFAULT 0,
    velocity DECIMAL(5,2),
    sample_posts JSONB DEFAULT '[]'::jsonb,
    key_phrases TEXT[] DEFAULT '{}',
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

CREATE TABLE candidate_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    subtopic TEXT,
    position_summary TEXT NOT NULL,
    talking_points JSONB NOT NULL DEFAULT '[]'::jsonb,
    supporting_data JSONB DEFAULT '[]'::jsonb,
    vs_competitors JSONB DEFAULT '{}'::jsonb,
    source_speeches TEXT[] DEFAULT '{}',
    source_documents TEXT[] DEFAULT '{}',
    source_urls TEXT[] DEFAULT '{}',
    strength TEXT CHECK (strength IN ('strong', 'moderate', 'developing', 'vulnerable')),
    last_public_statement TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_positions_tenant ON candidate_positions(tenant_id);
CREATE INDEX idx_positions_topic ON candidate_positions(topic);

CREATE TABLE content_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK (content_type IN (
        'social_twitter', 'social_facebook', 'social_instagram', 'social_tiktok',
        'email', 'sms', 'blog_post', 'press_release', 'rapid_response',
        'video_script', 'quote_card', 'infographic'
    )),
    title TEXT,
    body TEXT NOT NULL,
    html_body TEXT,
    visual_direction TEXT,
    hashtags TEXT[] DEFAULT '{}',
    intelligence_source TEXT,
    intelligence_ids UUID[] DEFAULT '{}',
    strategic_rationale TEXT,
    suggested_post_time TIMESTAMPTZ,
    platform TEXT,
    status TEXT NOT NULL CHECK (status IN (
        'draft', 'pending_review', 'approved', 'rejected', 'revision_requested',
        'scheduled', 'published', 'failed'
    )) DEFAULT 'draft',
    slack_message_ts TEXT,
    slack_channel TEXT,
    approved_by TEXT,
    rejection_reason TEXT,
    revision_notes TEXT,
    variant_group UUID,
    variant_label TEXT,
    published_at TIMESTAMPTZ,
    published_url TEXT,
    published_post_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_drafts_tenant ON content_drafts(tenant_id);
CREATE INDEX idx_drafts_status ON content_drafts(status);
CREATE INDEX idx_drafts_type ON content_drafts(content_type);
CREATE INDEX idx_drafts_scheduled ON content_drafts(suggested_post_time) WHERE status = 'approved';
CREATE INDEX idx_drafts_slack ON content_drafts(slack_message_ts);

CREATE TABLE content_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    calendar_date DATE NOT NULL,
    planned_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_theme TEXT,
    key_messages TEXT[] DEFAULT '{}',
    avoid_topics TEXT[] DEFAULT '{}',
    brief_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calendar_tenant_date ON content_calendar(tenant_id, calendar_date);

CREATE TABLE publishing_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    draft_id UUID REFERENCES content_drafts(id),
    platform TEXT NOT NULL,
    post_id TEXT,
    post_url TEXT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_by TEXT,
    distribution_channel TEXT,
    recipient_count INTEGER,
    status TEXT CHECK (status IN ('published', 'failed', 'deleted')) DEFAULT 'published',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_publishing_tenant ON publishing_log(tenant_id);
CREATE INDEX idx_publishing_platform ON publishing_log(platform);
CREATE INDEX idx_publishing_date ON publishing_log(published_at DESC);

CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    platform TEXT NOT NULL,
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
    sent INTEGER,
    delivered INTEGER,
    opens INTEGER,
    open_rate DECIMAL(5,4),
    click_rate DECIMAL(5,4),
    unsubscribes INTEGER,
    response_sentiment DECIMAL(3,2),
    top_posts JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_metrics_tenant_date ON performance_metrics(tenant_id, metric_date DESC);
CREATE INDEX idx_metrics_platform ON performance_metrics(platform);
CREATE UNIQUE INDEX idx_metrics_unique ON performance_metrics(tenant_id, metric_date, platform);

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
    dominant_topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_benchmarks_tenant_date ON competitor_benchmarks(tenant_id, benchmark_date DESC);

CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    run_type TEXT CHECK (run_type IN ('scheduled', 'triggered', 'manual')) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',
    items_processed INTEGER DEFAULT 0,
    items_created INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    api_cost DECIMAL(10,6) DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
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
    event_type TEXT NOT NULL,
    agent_name TEXT,
    actor TEXT,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_tenant ON audit_log(tenant_id);
CREATE INDEX idx_audit_event ON audit_log(event_type);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE daily_briefs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    brief_date DATE NOT NULL,
    brief_markdown TEXT NOT NULL,
    brief_slack_blocks JSONB,
    opportunities JSONB DEFAULT '[]'::jsonb,
    competitor_summary JSONB DEFAULT '{}'::jsonb,
    trending_issues JSONB DEFAULT '[]'::jsonb,
    news_highlights JSONB DEFAULT '[]'::jsonb,
    content_recs_generated INTEGER DEFAULT 0,
    slack_message_ts TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_briefs_tenant_date ON daily_briefs(tenant_id, brief_date DESC);
CREATE UNIQUE INDEX idx_briefs_unique ON daily_briefs(tenant_id, brief_date);
