-- ============================================================
-- WARBIRD: Competitor Seed Data
-- Colorado 2026 Gubernatorial Race
-- Updated: April 2, 2026
-- ============================================================
-- NOTE: Joe Oltmann dropped out late March 2026, pivoting to run for CO GOP Chair.
-- Mark Baisley left race Jan 2026 to run for U.S. Senate.
-- Greg Lopez left GOP Jan 2026, running as Independent.
-- ============================================================

-- ============================================================
-- REPUBLICAN PRIMARY COMPETITORS (Direct threats to Scott Bottoms)
-- ============================================================

INSERT INTO competitors (tenant_id, name, party, role, social_accounts, messaging_profile, threat_level) VALUES

-- #1 THREAT: Victor Marx - Ministry leader, 2M+ social media followers, Colorado Springs
('bottoms-2026', 'Victor Marx', 'Republican', 'candidate',
'{
  "twitter_handle": "VictorMarx",
  "facebook_page": "VictorMarxMinistries",
  "instagram_handle": "victormarx",
  "tiktok_handle": "victormarx",
  "website_url": "https://www.marxforgovernor.com"
}'::jsonb,
'{
  "core_themes": ["faith-based leadership", "family values", "veteran advocacy", "youth outreach"],
  "attack_vectors": [],
  "key_policies": ["anti-human-trafficking", "faith in government", "veteran support", "youth mentorship"],
  "tone": "inspirational, ministry-style, emotionally driven",
  "last_updated": "2026-04-02"
}'::jsonb,
'high'),

-- #2 THREAT: Barbara Kirkmeyer - State Senator SD-23, Brighton, most politically experienced
('bottoms-2026', 'Barbara Kirkmeyer', 'Republican', 'candidate',
'{
  "twitter_handle": "BarbKirkmeyer",
  "facebook_page": "KirkmeyerForColorado",
  "instagram_handle": "",
  "website_url": "https://kirkmeyerforcolorado.com"
}'::jsonb,
'{
  "core_themes": ["budget discipline", "lower costs", "road infrastructure", "community safety", "families first"],
  "attack_vectors": ["budget experience vs rivals", "legislative record"],
  "key_policies": ["JBC budget experience", "anti-abortion", "road repair", "cost of living", "pro-Trump alignment"],
  "tone": "pragmatic, experienced, budget-hawk, establishment conservative",
  "last_updated": "2026-04-02"
}'::jsonb,
'high'),

-- #3 THREAT: Jason Mikesell - Teller County Sheriff, law enforcement angle
('bottoms-2026', 'Jason Mikesell', 'Republican', 'candidate',
'{
  "twitter_handle": "prior_sheriff",
  "facebook_page": "MikesellForGovernor",
  "instagram_handle": "",
  "website_url": "https://www.mikesellforgovernor.com"
}'::jsonb,
'{
  "core_themes": ["law and order", "immigration enforcement", "public safety", "economy"],
  "attack_vectors": ["crime statistics", "sanctuary policy opposition"],
  "key_policies": ["eliminate sanctuary policies", "ICE cooperation", "crime reduction", "economic growth"],
  "tone": "tough, law enforcement authority, direct",
  "last_updated": "2026-04-02"
}'::jsonb,
'medium'),

-- Josh Griffin - Army veteran, former congressional candidate
('bottoms-2026', 'Josh Griffin', 'Republican', 'candidate',
'{
  "twitter_handle": "",
  "facebook_page": "GriffinForColorado",
  "instagram_handle": "",
  "website_url": ""
}'::jsonb,
'{
  "core_themes": ["military service", "sovereign wealth fund", "government innovation"],
  "attack_vectors": [],
  "key_policies": ["sovereign wealth fund for CO", "veteran issues", "independent from Trump"],
  "tone": "military, pragmatic, policy-focused",
  "last_updated": "2026-04-02"
}'::jsonb,
'low'),

-- Will McBride - attorney
('bottoms-2026', 'Will McBride', 'Republican', 'candidate',
'{
  "twitter_handle": "",
  "facebook_page": "",
  "instagram_handle": "",
  "website_url": ""
}'::jsonb,
'{
  "core_themes": ["legal reform", "constitutional rights"],
  "attack_vectors": [],
  "key_policies": [],
  "tone": "legal, professional",
  "last_updated": "2026-04-02"
}'::jsonb,
'low'),

-- Stevan Gess - logistics professional, Army veteran
('bottoms-2026', 'Stevan Gess', 'Republican', 'candidate',
'{
  "twitter_handle": "",
  "facebook_page": "",
  "instagram_handle": "",
  "website_url": ""
}'::jsonb,
'{
  "core_themes": ["military service", "logistics expertise"],
  "attack_vectors": [],
  "key_policies": [],
  "tone": "veteran, practical",
  "last_updated": "2026-04-02"
}'::jsonb,
'low');

-- ============================================================
-- DEMOCRATIC PRIMARY COMPETITORS (General election opponents)
-- ============================================================

INSERT INTO competitors (tenant_id, name, party, role, social_accounts, messaging_profile, threat_level) VALUES

-- #1 OVERALL THREAT: Michael Bennet - U.S. Senator, massive fundraising, frontrunner
('bottoms-2026', 'Michael Bennet', 'Democrat', 'candidate',
'{
  "twitter_handle": "SenatorBennet",
  "facebook_page": "bennetforcolorado",
  "instagram_handle": "senatorbennet",
  "tiktok_handle": "",
  "website_url": "https://bennetforcolorado.com"
}'::jsonb,
'{
  "core_themes": ["fighting Trump agenda", "healthcare protection", "Colorado families", "education", "public lands"],
  "attack_vectors": ["Trump alignment attacks on GOP candidates", "healthcare cuts", "MAGA extremism framing"],
  "key_policies": ["protect ACA/healthcare", "public education funding", "fight federal overreach", "economic opportunity", "climate/energy"],
  "tone": "senatorial, measured, policy-wonk, anti-Trump contrast",
  "last_updated": "2026-04-02"
}'::jsonb,
'critical'),

-- Phil Weiser - Attorney General, strong assembly performance
('bottoms-2026', 'Phil Weiser', 'Democrat', 'candidate',
'{
  "twitter_handle": "PhilWeiser",
  "facebook_page": "WeiserForColorado",
  "instagram_handle": "philweiser",
  "website_url": "https://weiserforcolorado.com"
}'::jsonb,
'{
  "core_themes": ["defending Colorado from Trump", "freedom and opportunity", "consumer protection", "rule of law"],
  "attack_vectors": ["suing Trump admin", "defending CO against federal overreach", "MAGA extremism framing"],
  "key_policies": ["defend state rights vs federal", "consumer protection", "freedom agenda", "environmental protection"],
  "tone": "legal authority, defender posture, progressive but pragmatic",
  "last_updated": "2026-04-02"
}'::jsonb,
'high');

-- ============================================================
-- INDEPENDENT / OTHER
-- ============================================================

INSERT INTO competitors (tenant_id, name, party, role, social_accounts, messaging_profile, threat_level) VALUES

-- Greg Lopez - Former U.S. Rep, left GOP Jan 2026, running as Independent
('bottoms-2026', 'Greg Lopez', 'Independent', 'candidate',
'{
  "twitter_handle": "prior_rep_lopez",
  "facebook_page": "LopezForGovernor",
  "instagram_handle": "",
  "website_url": ""
}'::jsonb,
'{
  "core_themes": ["post-partisan", "both parties are broken", "independent voice"],
  "attack_vectors": ["attacks both parties", "broken system narrative"],
  "key_policies": ["bipartisan governance", "problem solving over party loyalty"],
  "tone": "independent, frustrated with both sides, populist",
  "last_updated": "2026-04-02"
}'::jsonb,
'low');

-- ============================================================
-- KEY FIGURE (Not running for Gov, but relevant)
-- ============================================================

INSERT INTO competitors (tenant_id, name, party, role, social_accounts, messaging_profile, threat_level) VALUES

-- Joe Oltmann - Dropped out of Gov race, running for CO GOP Chair
-- Still relevant as surrogate/endorser and potential party power broker
('bottoms-2026', 'Joe Oltmann', 'Republican', 'surrogate',
'{
  "twitter_handle": "",
  "facebook_page": "joeoltmann",
  "instagram_handle": "",
  "website_url": "",
  "podcast": "Untamed (formerly Conservative Daily)"
}'::jsonb,
'{
  "core_themes": ["party reform", "election integrity", "anti-establishment", "free Tina Peters"],
  "attack_vectors": ["election fraud claims", "attacks on party establishment"],
  "key_policies": ["eliminate mail-in ballots", "DOGE-style state government cuts", "free Tina Peters"],
  "tone": "aggressive, conspiratorial, anti-establishment firebrand",
  "last_updated": "2026-04-02"
}'::jsonb,
'medium');

-- ============================================================
-- COLORADO NEWS SOURCES
-- ============================================================

INSERT INTO news_sources (tenant_id, name, source_type, feed_url, website_url, reliability_score) VALUES
('bottoms-2026', 'Denver Post', 'newspaper', 'https://www.denverpost.com/feed/', 'https://www.denverpost.com', 8),
('bottoms-2026', 'Colorado Sun', 'newspaper', 'https://coloradosun.com/feed/', 'https://coloradosun.com', 9),
('bottoms-2026', 'Colorado Springs Gazette', 'newspaper', 'https://gazette.com/search/?f=rss', 'https://gazette.com', 7),
('bottoms-2026', 'Colorado Politics', 'online', 'https://www.coloradopolitics.com/search/?f=rss', 'https://www.coloradopolitics.com', 9),
('bottoms-2026', 'Colorado Newsline', 'online', '', 'https://coloradonewsline.com', 7),
('bottoms-2026', 'CPR News', 'radio', 'https://www.cpr.org/feed/', 'https://www.cpr.org', 8),
('bottoms-2026', '9News Colorado', 'tv', 'https://www.9news.com/feeds/syndication/rss/news', 'https://www.9news.com', 7),
('bottoms-2026', 'Westword', 'online', 'https://www.westword.com/xml/rss/all', 'https://www.westword.com', 6),
('bottoms-2026', 'Colorado Pols', 'online', '', 'https://www.coloradopols.com', 5),
('bottoms-2026', 'Colorado Times Recorder', 'online', '', 'https://coloradotimesrecorder.com', 5),
('bottoms-2026', 'Axios Denver', 'online', '', 'https://www.axios.com/local/denver', 7),
('bottoms-2026', 'FOX 31 Denver', 'tv', '', 'https://kdvr.com', 6);
