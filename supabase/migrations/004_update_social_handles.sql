-- ============================================================
-- WARBIRD: Update Competitor Social Handles (Verified)
-- April 2, 2026
-- ============================================================

-- Victor Marx - VERIFIED
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "victormarx",
  "facebook_page": "VictorMarxMinistries",
  "instagram_handle": "victormarx",
  "instagram_campaign": "victormarxforgovernor",
  "tiktok_handle": "victormarx",
  "youtube": "VictorMarx",
  "website_url": "https://www.victor2026.com"
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Victor Marx';

-- Barbara Kirkmeyer - VERIFIED
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "BarbKirkmeyer",
  "facebook_page": "KirkmeyerForColorado",
  "instagram_handle": "barbkirkmeyer",
  "website_url": "https://kirkmeyerforcolorado.com"
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Barbara Kirkmeyer';

-- Jason Mikesell - VERIFIED from campaign
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "prior_sheriff",
  "facebook_page": "MikesellForGovernor",
  "instagram_handle": "",
  "website_url": "https://www.mikesellforgovernor.com"
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Jason Mikesell';

-- Michael Bennet - VERIFIED
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "SenatorBennet",
  "twitter_campaign": "BennetForCO",
  "facebook_page": "bennetforcolorado",
  "instagram_handle": "senatorbennet",
  "website_url": "https://bennetforcolorado.com"
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Michael Bennet';

-- Phil Weiser - VERIFIED
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "PhilWeiser",
  "facebook_page": "WeiserForColorado",
  "instagram_handle": "philweiser",
  "website_url": "https://weiserforcolorado.com"
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Phil Weiser';

-- Joe Oltmann - VERIFIED (podcast, not traditional campaign)
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "",
  "facebook_page": "joeoltmann",
  "instagram_handle": "",
  "podcast_name": "Untamed (formerly Conservative Daily)",
  "website_url": ""
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Joe Oltmann';

-- Greg Lopez - VERIFIED
UPDATE competitors SET social_accounts = '{
  "twitter_handle": "prior_rep_lopez",
  "facebook_page": "GregLopezForGovernor",
  "instagram_handle": "",
  "website_url": ""
}'::jsonb
WHERE tenant_id = 'bottoms-2026' AND name = 'Greg Lopez';
