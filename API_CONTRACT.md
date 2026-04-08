# Warbird Engine API Contract
## Version 1.0 | Multitude Media

---

## Base URL
```
https://warbird-engine.vercel.app/api
```

## Authentication
All requests require a service key in the header:
```
Authorization: Bearer {WARBIRD_SERVICE_KEY}
X-Tenant-ID: bottoms-2026
```

---

## Endpoints

### Intelligence

#### GET /api/intel/brief
Get today's daily brief (or a specific date).
```
Query: ?date=2026-04-02
Response: {
  brief_date, brief_markdown, opportunities[], 
  competitor_summary, trending_issues[], news_highlights[],
  content_recs_generated
}
```

#### GET /api/intel/competitors
List competitors and their current messaging profiles.
```
Response: { competitors: [{ id, name, party, threat_level, messaging_profile, latest_activity }] }
```

#### GET /api/intel/competitor/:id/activities
Get recent activity for a specific competitor.
```
Query: ?limit=20&since=2026-04-01&type=attack
Response: { activities: [{ id, activity_type, summary, topics, threat_level, detected_at }] }
```

#### GET /api/intel/news
Get news items with filtering.
```
Query: ?relevance_min=50&topic=water_policy&response_opportunity=true&limit=20
Response: { news: [{ id, headline, summary, topics, relevance_score, response_urgency }] }
```

#### GET /api/intel/sentiment
Get current sentiment signals.
```
Query: ?topic=housing&period=7d
Response: { signals: [{ topic, sentiment_score, volume, velocity, opportunity_score, key_phrases }] }
```

#### GET /api/intel/heatmap
Get the issue heat map (aggregated sentiment across all topics).
```
Query: ?period=30d
Response: { 
  topics: [{ 
    topic, avg_sentiment, total_volume, velocity_trend, 
    candidate_alignment, opportunity_score 
  }] 
}
```

---

### Content

#### GET /api/content/queue
Get content drafts by status.
```
Query: ?status=pending_review&type=social_twitter&limit=20
Response: { drafts: [{ id, content_type, title, body, platform, status, suggested_post_time, strategic_rationale }] }
```

#### POST /api/content/generate
Trigger content generation for a specific topic/type.
```
Body: {
  content_type: "social_twitter",
  topic: "water_policy",
  context: "Respond to competitor X's attack on Scott's water position",
  urgency: "high"
}
Response: { draft_id, body, strategic_rationale, suggested_post_time }
```

#### PATCH /api/content/:id/approve
Approve a content draft.
```
Body: { approved_by: "U12345", notes: "Good to go" }
Response: { id, status: "approved", scheduled_for }
```

#### PATCH /api/content/:id/reject
Reject a content draft.
```
Body: { rejected_by: "U12345", reason: "Tone too aggressive" }
Response: { id, status: "rejected" }
```

#### PATCH /api/content/:id/revise
Request revision on a content draft.
```
Body: { requested_by: "U12345", notes: "Soften the opening, add the jobs number" }
Response: { id, status: "revision_requested" }
```

#### POST /api/content/rapid-response
Trigger rapid response generation.
```
Body: {
  trigger_type: "competitor_attack" | "negative_news" | "crisis",
  trigger_id: "uuid", -- reference to competitor_activity or news_item
  context: "Additional context from campaign team",
  variants: 3 -- number of response variants to generate
}
Response: { 
  drafts: [{ id, variant_label, body, tone, strategic_rationale }] 
}
```

---

### Calendar

#### GET /api/calendar
Get content calendar.
```
Query: ?start=2026-04-01&end=2026-04-07
Response: { 
  days: [{ 
    date, daily_theme, planned_items: [{ content_type, topic, platform, time, draft_id, status }],
    key_messages, avoid_topics 
  }] 
}
```

---

### Positions (Knowledge Base)

#### GET /api/positions
Get all candidate positions.
```
Query: ?topic=economy&strength=strong
Response: { positions: [{ id, topic, subtopic, position_summary, talking_points, strength }] }
```

#### POST /api/positions
Add/update a candidate position.
```
Body: {
  topic: "water_policy",
  subtopic: "colorado_river_compact",
  position_summary: "...",
  talking_points: ["...", "..."],
  supporting_data: [{ fact, source, date }]
}
Response: { id, created_at }
```

---

### Analytics

#### GET /api/analytics/performance
Get performance metrics.
```
Query: ?platform=twitter&start=2026-03-01&end=2026-04-01
Response: { 
  metrics: [{ date, platform, followers, impressions, engagements, engagement_rate }],
  summary: { total_impressions, avg_engagement_rate, follower_growth, top_posts }
}
```

#### GET /api/analytics/benchmarks
Get competitor benchmarks comparison.
```
Query: ?period=30d
Response: {
  candidate: { followers, growth_rate, avg_engagement },
  competitors: [{ name, followers, growth_rate, avg_engagement, dominant_topics }]
}
```

#### GET /api/analytics/weekly-report
Get the weekly strategy report.
```
Query: ?week=2026-W14
Response: { report_markdown, key_wins, areas_to_improve, recommendations, next_week_priorities }
```

---

### Agent Management

#### GET /api/agents/status
Get status of all agents.
```
Response: { 
  agents: [{ 
    name, last_run, next_scheduled_run, status, 
    items_processed_today, tokens_used_today 
  }] 
}
```

#### POST /api/agents/:name/trigger
Manually trigger an agent run.
```
Body: { run_type: "manual", params: {} }
Response: { run_id, status: "running" }
```

#### GET /api/agents/costs
Get API usage and costs.
```
Query: ?period=30d
Response: { 
  total_tokens_input, total_tokens_output, total_cost,
  by_agent: [{ name, tokens, cost, runs }] 
}
```

---

### Slack Webhook Endpoints

#### POST /api/slack/events
Receives Slack events (reactions, messages, commands).
Handles:
- `reaction_added` on content drafts → route to approve/reject/revise
- `message` in #sb-requests → route to appropriate agent
- `app_mention` → handle @warbird commands

#### POST /api/slack/commands
Handles slash commands:
- `/warbird brief` → Post today's brief
- `/warbird draft [topic]` → Generate content draft on topic
- `/warbird status` → Show agent status
- `/warbird rapid [context]` → Trigger rapid response
- `/warbird heatmap` → Post issue heat map

#### POST /api/slack/interactions
Handles interactive components (buttons, modals) in Slack messages.

---

## Webhook Callbacks

### To ScottBottoms Admin
```
POST {SCOTTBOTTOMS_ADMIN_URL}/api/webhooks/warbird
Events:
- brief_generated
- content_approved
- content_published
- alert_fired
- weekly_report_ready
```

### To Paperclip
```
POST {PAPERCLIP_WEBHOOK_URL}/warbird
Events:
- daily_summary (rolled up cross-tenant)
- cost_alert (when API spend exceeds threshold)
- system_error (agent failures)
```
