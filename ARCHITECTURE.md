# Campaign Intelligence Engine — "Warbird"
## Multitude Media | Multi-Tenant Campaign AI Platform

---

## Overview

Warbird is a standalone AI-powered campaign intelligence and content engine built by Multitude Media. It operates as a multi-tenant SaaS platform, with the Scott Bottoms for Governor 2026 campaign as its first deployment. The system monitors competitors, tracks public sentiment, generates daily content, and delivers everything through Slack as the primary interface ("War Room").

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    SLACK WAR ROOM                        │
│  (Campaign team interface — approvals, requests, alerts) │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│   ScottBottoms.com   │    │     Paperclip (MM Ops)       │
│   Admin Dashboard    │    │  Rolled-up campaign reports   │
│   (Analytics views)  │    │  Cross-client performance     │
└──────────┬───────────┘    └──────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│              WARBIRD ENGINE (Standalone)                  │
│         Supabase + Vercel Serverless Functions            │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐  │
│  │ Intelligence │ │  Strategy   │ │  Content Factory  │  │
│  │   Agents    │ │   Brain     │ │     Agents        │  │
│  └─────────────┘ └─────────────┘ └───────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐  │
│  │ Distribution │ │  Analytics  │ │   Slack Bridge    │  │
│  │   Agents    │ │   Agents    │ │   (Bot + Hooks)   │  │
│  └─────────────┘ └─────────────┘ └───────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Slack Channel Architecture (War Room)

### Channel Structure

| Channel | Purpose | Who's There |
|---------|---------|-------------|
| `#sb-war-room` | Daily briefs, content approvals, strategic alerts | Campaign leadership + MM team |
| `#sb-competitor-watch` | Real-time competitor activity alerts | MM team + campaign strategist |
| `#sb-content-queue` | Content drafts awaiting approval (threaded) | Campaign comms team + MM |
| `#sb-news-pulse` | Colorado news alerts with relevance scores | All campaign staff |
| `#sb-analytics` | Daily/weekly performance reports | Campaign leadership |
| `#sb-requests` | Campaign team drops requests (videos, emails, SMS) | Campaign team → MM agents |

### Slack Bot: @warbird

The Warbird bot is the agent system's presence in Slack. It:

- Posts daily briefs to `#sb-war-room` every morning at 7 AM MT
- Drops content drafts as threaded messages in `#sb-content-queue`
- Listens for 👍 (approve), ✏️ (edit), ❌ (reject) reactions on content drafts
- Fires competitor alerts to `#sb-competitor-watch` when significant activity detected
- Monitors `#sb-requests` for inbound campaign team requests and routes them to the appropriate agent
- Responds to direct commands: `@warbird brief`, `@warbird draft [topic]`, `@warbird status`

### Approval Workflow

```
Agent generates content draft
  → Posts to #sb-content-queue as a thread
    → Thread contains: platform target, suggested post time, strategic rationale
      → Campaign team reacts:
        👍 = Approve → auto-schedules for posting
        ✏️ = Edit → bot asks for edits in thread, regenerates
        ❌ = Reject → logged for learning, removed from queue
        🔥 = Priority → bumps to next available slot
```

### Request Workflow

```
Campaign team posts in #sb-requests:
  "Need an email blast about Scott's water policy speech tomorrow"
  
@warbird acknowledges → routes to Email Agent
  → Agent pulls Scott's water policy positions from knowledge base
  → Cross-references today's news/sentiment on water issues
  → Generates HTML email draft (navy/red branding, WinRed button)
  → Posts preview + HTML to #sb-content-queue for approval
  → On 👍 → queues in GoHighLevel for send
```

---

## Tenant Model

Every table in the Engine has a `tenant_id` column. Tenant configuration lives in the `tenants` table and defines:

- Brand voice / style guide
- Competitor list
- News source list
- Social accounts to monitor/publish
- Slack workspace + channel IDs
- Content approval requirements
- Platform API keys (encrypted)

For the Bottoms campaign: `tenant_id = 'bottoms-2026'`

---

## Agent Specifications

### 1. Intelligence Agents

#### 1a. Competitor Monitor Agent
- **Schedule**: Every 4 hours
- **Sources**: Competitor social accounts (X, FB, IG), campaign websites, press releases, FEC filings
- **Process**: Scrape → Claude summarization → classify by topic/threat level → store
- **Output**: `competitor_activities` table entries + Slack alert if threat_level >= HIGH
- **Slack**: Posts to `#sb-competitor-watch` with summary + link

#### 1b. News Pulse Agent
- **Schedule**: Every 2 hours
- **Sources**: Colorado news RSS feeds, Google News API, local TV station feeds
- **Process**: Fetch → relevance scoring → topic classification → cross-ref with candidate positions
- **Output**: `news_items` table entries + Slack digest
- **Slack**: Posts to `#sb-news-pulse`, rolls up into morning brief

#### 1c. Sentiment Agent
- **Schedule**: Every 6 hours
- **Sources**: Reddit (CO subreddits), X trending (CO geo), public FB groups
- **Process**: Scrape → theme clustering → sentiment scoring → trend detection
- **Output**: `sentiment_signals` table entries with topic, sentiment, velocity, volume
- **Slack**: Weekly "Issue Heat Map" to `#sb-war-room`

#### 1d. Policy Knowledge Agent
- **Schedule**: On-demand (triggered by other agents)
- **Sources**: Internal knowledge base (`candidate_positions` table)
- **Process**: Query candidate's positions on a given topic, return talking points + supporting data
- **Output**: Structured talking points for content agents

### 2. Strategy Brain

#### 2a. Daily Brief Agent
- **Schedule**: 6:30 AM MT daily
- **Process**: Pulls overnight intel from all agents → synthesizes → generates prioritized brief
- **Output**: Formatted Slack message to `#sb-war-room` with sections:
  - 🎯 Today's Top Opportunities (content recs tied to intel signals)
  - ⚔️ Competitor Activity (what they said/did in last 24h)
  - 📊 Trending Issues (what CO is talking about)
  - 📰 News to Watch (stories that need response or can be leveraged)

#### 2b. Content Calendar Agent
- **Schedule**: Daily after brief
- **Process**: Takes brief → generates 3-5 content recommendations → assigns to platforms
- **Output**: `content_calendar` entries + posts to `#sb-content-queue`

### 3. Content Factory Agents

#### 3a. Social Content Agent
- **Platforms**: X/Twitter, Facebook, Instagram, TikTok
- **Input**: Content calendar item + intelligence context + brand voice guide
- **Output**: Platform-specific draft with copy, hashtags, suggested visual direction
- **Rules**: No emojis in formal comms, punchy short-form, Scott's voice (direct, Colorado-first)

#### 3b. Email Content Agent
- **Input**: Campaign request or content calendar item
- **Output**: Full HTML email (navy #1a3147 / red #dc2626 branding, WinRed donation CTA, handwritten signature, social footer)
- **Template**: Uses existing Bottoms email design system

#### 3c. Video Processing Agent
- **Input**: Raw video dropped in `#sb-requests`
- **Process**: Auto-caption via Skryber pipeline → generate short clips → create social posts around clips
- **Output**: Captioned video + suggested social copy for each clip

#### 3d. Rapid Response Agent
- **Trigger**: Competitor attack detected OR negative news cycle
- **Response Time**: < 30 minutes from trigger
- **Process**: Analyze attack → pull counter-positions → generate response options (3 variants: measured, aggressive, redirect)
- **Output**: Urgent thread in `#sb-war-room` with response options for immediate approval

### 4. Distribution Agents

#### 4a. Social Publisher Agent
- **Trigger**: Content approved (👍 reaction)
- **Process**: Format for target platform → schedule via API (Meta Business Suite, X API) or GoHighLevel
- **Output**: Published post + tracking entry in `publishing_log`

#### 4b. Email/SMS Publisher Agent
- **Trigger**: Email/SMS content approved
- **Process**: Push to GoHighLevel for send
- **Output**: Campaign sent + tracking entry

### 5. Analytics Agents

#### 5a. Performance Tracker Agent
- **Schedule**: Daily at 10 PM MT
- **Process**: Pull engagement metrics from all platforms → calculate KPIs → detect trends
- **Output**: `performance_metrics` entries + daily scorecard to `#sb-analytics`

#### 5b. Weekly Strategy Report Agent
- **Schedule**: Every Monday 8 AM MT
- **Process**: Aggregate week's data → compare vs previous weeks → generate insights
- **Output**: Comprehensive report to `#sb-war-room` + PDF for campaign leadership

---

## Integration Points

| System | Role | Connection |
|--------|------|------------|
| Supabase (Engine) | Data store, edge functions, cron | Primary backend |
| Vercel | Serverless functions, API routes | Compute layer |
| Slack API | War Room interface | Bot + Webhooks |
| GoHighLevel (MMDB) | Email/SMS distribution | API integration |
| Skryber | Video captioning/editing | Internal API |
| Claude API | All agent intelligence | Anthropic API |
| Meta Business Suite | FB/IG publishing | Graph API |
| X/Twitter API | Twitter publishing + monitoring | v2 API |
| ScottBottoms.com Admin | Analytics dashboard views | REST API from Engine |
| Paperclip | MM operations rollup | Webhook summaries |

---

## Security & Compliance

- All campaign data scoped by `tenant_id` with RLS policies
- API keys stored encrypted in Supabase Vault
- Slack bot tokens scoped to minimum required permissions
- Content approval required before any public publishing (no auto-post without 👍)
- Audit log on all content generation and publishing events
- Campaign finance compliance: all ad spend tracked and attributable
