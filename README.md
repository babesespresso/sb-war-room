# WARBIRD
### Campaign Intelligence Engine by Multitude Media

> AI-powered campaign intelligence, content generation, and distribution platform.
> Slack-first "War Room" interface. Multi-tenant. Built to win.

---

## Project Structure

```
campaign-engine/
├── ARCHITECTURE.md          # Full system architecture & Slack War Room design
├── API_CONTRACT.md          # REST API specification
├── AGENT_PROMPTS.md         # System prompts for all 7 agent types
├── README.md                # This file -- implementation roadmap
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   # Complete database schema (15 tables)
│
├── functions/               # Supabase Edge Functions (TO BUILD)
│   ├── competitor-monitor/
│   ├── news-pulse/
│   ├── sentiment-analyzer/
│   ├── daily-brief/
│   ├── content-generator/
│   ├── rapid-response/
│   ├── social-publisher/
│   └── slack-bot/
│
├── api/                     # Vercel API Routes (TO BUILD)
│   ├── intel/
│   ├── content/
│   ├── calendar/
│   ├── positions/
│   ├── analytics/
│   ├── agents/
│   └── slack/
│
└── packages/                # Shared utilities (TO BUILD)
    ├── db/                  # Supabase client & typed queries
    ├── agents/              # Agent runner framework
    ├── slack/               # Slack API helpers
    └── scrapers/            # Web scraping utilities
```

---

## Implementation Roadmap

### Sprint 1: Foundation (Week 1-2)
**Goal: Intelligence pipeline running, first content generating**

- [ ] Create new Supabase project ("warbird-engine")
- [ ] Run 001_initial_schema.sql migration
- [ ] Seed competitor data (current GOP primary field)
- [ ] Seed candidate_positions (Scott's key policy positions)
- [ ] Seed news_sources (Colorado media outlets)
- [ ] Build Competitor Monitor edge function
- [ ] Build News Pulse edge function
- [ ] Build Social Content Agent edge function
- [ ] Create Slack app (warbird-bot) + install to campaign workspace
- [ ] Wire #sb-competitor-watch alerts
- [ ] Wire #sb-news-pulse feed
- [ ] Deploy to Vercel (API routes)

### Sprint 2: War Room (Week 3-4)
**Goal: Full Slack workflow operational, daily briefs running**

- [ ] Build Daily Brief agent
- [ ] Build Content Calendar agent
- [ ] Wire #sb-war-room daily brief (7 AM MT cron)
- [ ] Wire #sb-content-queue approval workflow (reaction handling)
- [ ] Build #sb-requests inbound routing
- [ ] Build Email Content Agent (using existing HTML template system)
- [ ] Integrate GoHighLevel API for email/SMS distribution
- [ ] Wire approval → publish pipeline
- [ ] Build Rapid Response agent
- [ ] Set up Slack slash commands (/warbird)

### Sprint 3: Sentiment & Analytics (Week 5-6)
**Goal: Understanding what Colorado wants, measuring what works**

- [ ] Build Sentiment Analysis agent
- [ ] Set up Reddit scraper (CO subreddits)
- [ ] Set up X/Twitter geo-filtered monitoring
- [ ] Build Performance Tracker agent
- [ ] Build Weekly Strategy Report agent
- [ ] Wire #sb-analytics daily scorecard
- [ ] Build issue heat map visualization
- [ ] Wire Competitor Benchmarking

### Sprint 4: Scale & Optimize (Week 7-8)
**Goal: A/B testing, video pipeline, full automation**

- [ ] A/B variant generation for key content
- [ ] Skryber integration for video processing
- [ ] Video drop → caption → clip → social post pipeline
- [ ] Meta Business Suite API integration (FB/IG publishing)
- [ ] X API integration (direct publishing)
- [ ] ScottBottoms.com admin "War Room" tab (analytics views)
- [ ] Paperclip webhook integration (MM operations rollup)
- [ ] Cost monitoring and alerts

---

## First Deployment: Bottoms 2026

Tenant ID: `bottoms-2026`
State: Colorado
Race: Governor 2026
Brand: Navy #1a3147 / Red #dc2626 / White
Donation: WinRed
Distribution: GoHighLevel (MMDB)
Slack: Campaign workspace

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | Supabase (PostgreSQL + RLS) |
| Compute | Supabase Edge Functions + Vercel Serverless |
| AI | Claude API (Anthropic) |
| Interface | Slack API (Bot + Webhooks + Slash Commands) |
| Email/SMS | GoHighLevel API |
| Video | Skryber API |
| Social | Meta Graph API, X API v2 |
| Monitoring | ScottBottoms.com Admin (read-only views) |
| Operations | Paperclip (MM internal) |

---

## Key Design Decisions

1. **Slack-first**: Campaign team never leaves Slack. Zero adoption friction.
2. **Multi-tenant from day one**: Every table has tenant_id. Next client slots in immediately.
3. **Human-in-the-loop**: No auto-publishing. All content requires 👍 approval.
4. **Speed over perfection**: 3 good posts today beat 1 perfect post tomorrow.
5. **Intelligence-driven content**: Every piece of content traces back to a signal.
6. **Audit everything**: Full agent run logs, content audit trail, cost tracking.
