// ===========================================
// WARBIRD ENGINE - Type Definitions
// ===========================================

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'attack';
export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | 'scheduled' | 'published' | 'failed';
export type ResponseUrgency = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'partial';
export type CandidateAlignment = 'strong' | 'moderate' | 'weak' | 'opposed';

export type ContentType =
  | 'social_twitter' | 'social_facebook' | 'social_instagram' | 'social_tiktok'
  | 'email' | 'sms' | 'blog_post' | 'press_release' | 'rapid_response'
  | 'video_script' | 'quote_card' | 'infographic';

export type ActivityType =
  | 'social_post' | 'press_release' | 'policy_announcement'
  | 'endorsement' | 'attack' | 'ad_campaign' | 'event' | 'filing' | 'media_appearance';

export const TOPICS = [
  'economy', 'jobs', 'taxes', 'housing', 'water_policy', 'energy',
  'education', 'healthcare', 'immigration', 'public_safety',
  'infrastructure', 'environment', 'gun_policy', 'election_integrity',
  'government_spending', 'veterans', 'agriculture', 'tech_innovation',
  'drug_policy', 'constitutional_rights'
] as const;

export type Topic = typeof TOPICS[number];

// ---- Database Row Types ----

export interface Tenant {
  id: string;
  name: string;
  candidate_name: string;
  campaign_type: string;
  state: string;
  brand_config: {
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    donation_url: string;
    website_url: string;
    logo_url: string | null;
    signature_image_url: string | null;
  };
  voice_guide: string;
  content_rules: string[];
  slack_workspace_id: string;
  slack_channels: Record<string, string>;
  api_keys: Record<string, string>;
  timezone: string;
  brief_time: string;
  content_approval_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Competitor {
  id: string;
  tenant_id: string;
  name: string;
  party: string;
  role: string;
  social_accounts: {
    twitter_handle?: string;
    facebook_page?: string;
    instagram_handle?: string;
    tiktok_handle?: string;
    website_url?: string;
  };
  messaging_profile: {
    core_themes: string[];
    attack_vectors: string[];
    key_policies: string[];
    tone: string;
    last_updated: string;
  };
  threat_level: ThreatLevel;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitorActivity {
  id: string;
  tenant_id: string;
  competitor_id: string;
  activity_type: ActivityType;
  platform: string;
  title: string;
  summary: string;
  raw_content: string;
  source_url: string;
  topics: string[];
  sentiment: Sentiment;
  threat_level: ThreatLevel;
  requires_response: boolean;
  suggested_response: string;
  engagement_metrics: Record<string, number> | null;
  detected_at: string;
  created_at: string;
  // Joined
  competitor?: Competitor;
}

export interface NewsItem {
  id: string;
  tenant_id: string;
  source_id: string;
  headline: string;
  summary: string;
  source_name: string;
  source_url: string;
  published_at: string;
  topics: string[];
  relevance_score: number;
  sentiment: Sentiment;
  mentions_candidate: boolean;
  mentions_competitors: string[];
  response_opportunity: boolean;
  response_urgency: ResponseUrgency;
  suggested_angle: string;
  related_positions: string[];
  is_processed: boolean;
  created_at: string;
}

export interface SentimentSignal {
  id: string;
  tenant_id: string;
  platform: string;
  source_identifier: string;
  topic: string;
  subtopic: string;
  sentiment_score: number;
  volume: number;
  velocity: number;
  sample_posts: Array<{ text: string; url: string; engagement: number; sentiment: string }>;
  key_phrases: string[];
  opportunity_score: number;
  candidate_alignment: CandidateAlignment;
  recommended_action: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface CandidatePosition {
  id: string;
  tenant_id: string;
  topic: string;
  subtopic: string;
  position_summary: string;
  talking_points: string[];
  supporting_data: Array<{ fact: string; source: string; date: string }>;
  vs_competitors: Record<string, string>;
  source_speeches: string[];
  source_documents: string[];
  source_urls: string[];
  strength: 'strong' | 'moderate' | 'developing' | 'vulnerable';
  last_public_statement: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VideoTrainingSource {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  video_url: string;
  file_size_bytes: number;
  duration_seconds: number;
  source_type: 'speech' | 'interview' | 'debate' | 'town_hall' | 'podcast' | 'press_conference' | 'ad' | 'social_clip' | 'other';
  transcript: string | null;
  transcript_segments: Array<{ start: number; end: number; text: string }>;
  extracted_talking_points: Array<{
    topic: string;
    point: string;
    quote: string;
    confidence: number;
  }>;
  extracted_voice_patterns: {
    common_phrases: string[];
    rhetorical_devices: string[];
    tone_notes: string;
    avg_sentence_length: number;
  };
  extracted_policy_positions: Array<{
    topic: string;
    position: string;
    supporting_quote: string;
  }>;
  processing_status: 'uploaded' | 'transcribing' | 'analyzing' | 'completed' | 'failed';
  processing_error: string | null;
  processed_at: string | null;
  is_active: boolean;
  training_weight: number;
  created_at: string;
  updated_at: string;
}

export interface ContentDraft {
  id: string;
  tenant_id: string;
  content_type: ContentType;
  title: string;
  body: string;
  html_body: string;
  visual_direction: string;
  hashtags: string[];
  intelligence_source: string;
  intelligence_ids: string[];
  strategic_rationale: string;
  suggested_post_time: string;
  platform: string;
  status: ContentStatus;
  slack_message_ts: string;
  slack_channel: string;
  approved_by: string;
  rejection_reason: string;
  revision_notes: string;
  variant_group: string;
  variant_label: string;
  published_at: string;
  published_url: string;
  published_post_id: string;
  created_at: string;
  updated_at: string;
}

export interface DailyBrief {
  id: string;
  tenant_id: string;
  brief_date: string;
  brief_markdown: string;
  brief_slack_blocks: any;
  opportunities: Array<{
    title: string;
    description: string;
    content_type: ContentType;
    priority: 'must-do' | 'should-do' | 'nice-to-have';
  }>;
  competitor_summary: Record<string, any>;
  trending_issues: Array<{ topic: string; direction: string; volume: number }>;
  news_highlights: Array<{ headline: string; angle: string; urgency: string }>;
  content_recs_generated: number;
  slack_message_ts: string;
  created_at: string;
}

export interface PerformanceMetric {
  id: string;
  tenant_id: string;
  metric_date: string;
  platform: string;
  followers: number;
  followers_change: number;
  posts_count: number;
  impressions: number;
  reach: number;
  engagements: number;
  engagement_rate: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  sent: number;
  delivered: number;
  opens: number;
  open_rate: number;
  click_rate: number;
  unsubscribes: number;
  response_sentiment: number;
  top_posts: Array<{ draft_id: string; post_url: string; engagements: number }>;
  created_at: string;
}

export interface AgentRun {
  id: string;
  tenant_id: string;
  agent_name: string;
  run_type: 'scheduled' | 'triggered' | 'manual';
  started_at: string;
  completed_at: string;
  status: AgentRunStatus;
  items_processed: number;
  items_created: number;
  items_updated: number;
  tokens_input: number;
  tokens_output: number;
  api_cost: number;
  error_message: string;
  error_details: any;
  run_summary: string;
  created_at: string;
}

// ---- Agent Output Types ----

export interface CompetitorAnalysis {
  summary: string;
  activity_type: ActivityType;
  topics: Topic[];
  sentiment: Sentiment;
  threat_level: ThreatLevel;
  requires_response: boolean;
  suggested_response: string;
  engagement_assessment: string;
}

export interface NewsAnalysis {
  summary: string;
  topics: Topic[];
  relevance_score: number;
  sentiment: Sentiment;
  mentions_candidate: boolean;
  response_opportunity: boolean;
  response_urgency: ResponseUrgency;
  suggested_angle: string;
  related_positions: string[];
}

export interface RapidResponseOutput {
  trigger_summary: string;
  variants: Array<{
    label: 'measured' | 'firm_contrast' | 'redirect';
    copy: string;
    best_platforms: string[];
    risk_assessment: string;
    recommended_timing: string;
  }>;
  do_not_list: string[];
  surrogate_recommendations: string[];
}

// ---- Dashboard View Types ----

export interface DashboardStats {
  pendingContent: number;
  publishedToday: number;
  competitorAlerts: number;
  followerGrowth: number;
  topThreat: { name: string; level: ThreatLevel } | null;
  topOpportunity: { topic: string; score: number } | null;
}

export interface HeatMapEntry {
  topic: string;
  sentiment: number;
  volume: number;
  velocity: number;
  alignment: CandidateAlignment;
  opportunity: number;
}
