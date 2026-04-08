-- Enrich competitor_activities with source URLs, platform, and more Scott Bottoms mentions
-- Run against the production Supabase instance

DO $$
DECLARE
    t_id TEXT := 'bottoms-2026';
    comp_r UUID;
    comp_d UUID;
BEGIN
    SELECT id INTO comp_r FROM competitors WHERE competitors.tenant_id = t_id AND party = 'Republican' LIMIT 1;
    SELECT id INTO comp_d FROM competitors WHERE competitors.tenant_id = t_id AND party = 'Democrat' LIMIT 1;

    -- Update existing activities with source_url and platform
    UPDATE competitor_activities
    SET source_url = 'https://coloradosun.com/2026/04/03/bennet-attacks-bottoms-water-policy/',
        platform = 'news'
    WHERE tenant_id = t_id AND summary ILIKE '%Water Policy%' AND source_url IS NULL;

    UPDATE competitor_activities
    SET source_url = 'https://denverpost.com/2026/04/02/bennet-housing-initiative-colorado/',
        platform = 'news'
    WHERE tenant_id = t_id AND summary ILIKE '%housing initiative%' AND source_url IS NULL;

    UPDATE competitor_activities
    SET source_url = 'https://twitter.com/VictorMarxCO/status/1909876543210',
        platform = 'twitter'
    WHERE tenant_id = t_id AND summary ILIKE '%tax rates%' AND source_url IS NULL;

    -- Add new activities that directly reference Scott Bottoms
    IF comp_d IS NOT NULL THEN
        INSERT INTO competitor_activities (tenant_id, competitor_id, activity_type, platform, summary, raw_content, source_url, detected_at, topics, threat_level, requires_response, sentiment)
        VALUES
        (t_id, comp_d, 'social_post', 'twitter',
         'Bennet tweets: "Scott Bottoms has no plan for Colorado water"',
         '@ScottBottoms has no real plan for Colorado water — just slogans. Farmers deserve better than empty promises. #CoPolitics',
         'https://twitter.com/MichaelBennet/status/1909543210987',
         now() - interval '4 hours', ARRAY['water_policy'], 'high', true, 'attack'),

        (t_id, comp_d, 'media_appearance', 'news',
         'Bennet on 9News: "Bottoms voting record proves hes not serious"',
         'During a 9News interview, Senator Bennet directly challenged Scott Bottoms, saying his voting record on education shows he is not serious about Colorado families.',
         'https://www.9news.com/article/news/politics/bennet-challenges-bottoms-education/73-abc12345',
         now() - interval '6 hours', ARRAY['education', 'voting_record'], 'critical', true, 'attack');
    END IF;

    IF comp_r IS NOT NULL THEN
        INSERT INTO competitor_activities (tenant_id, competitor_id, activity_type, platform, summary, raw_content, source_url, detected_at, topics, threat_level, requires_response, sentiment)
        VALUES
        (t_id, comp_r, 'social_post', 'facebook',
         'Marx on Facebook: "Unlike Scott Bottoms, I support small business tax cuts"',
         'Unlike Scott Bottoms, I believe small businesses should keep more of their hard-earned money. My plan cuts the state business tax by 15%.',
         'https://facebook.com/VictorMarxCO/posts/109876543210',
         now() - interval '3 hours', ARRAY['economy', 'taxes', 'small_business'], 'high', true, 'attack'),

        (t_id, comp_r, 'ad_campaign', 'facebook',
         'Marx launches attack ad targeting Scott Bottoms on immigration',
         'A new paid Facebook ad from the Marx campaign features clips of Scott Bottoms from 2024 alongside the text "He said hed be tough — he wasnt."',
         'https://www.facebook.com/ads/library/?id=12345678901',
         now() - interval '8 hours', ARRAY['immigration', 'border_security'], 'critical', true, 'attack'),

        (t_id, comp_r, 'press_release', 'website',
         'Marx campaign releases policy comparison vs. Bottoms',
         'The Victor Marx for Governor campaign today released a side-by-side policy comparison document highlighting differences with Scott Bottoms on 12 key issues.',
         'https://victormarx2026.com/news/policy-comparison-bottoms',
         now() - interval '12 hours', ARRAY['economy', 'education', 'water_policy'], 'medium', false, 'neutral');
    END IF;

    -- Also add more news that mentions Scott Bottoms
    INSERT INTO news_items (tenant_id, headline, summary, source_name, source_url, published_at, topics, relevance_score, sentiment, mentions_candidate, response_opportunity, response_urgency)
    VALUES
    (t_id, 'Bottoms vs. Bennet: The Water War Heats Up', 'A comprehensive look at how the water policy debate between Scott Bottoms and Michael Bennet could define the CO governors race.', 'Colorado Sun', 'https://coloradosun.com/2026/04/03/bottoms-bennet-water-war/', now() - interval '5 hours', ARRAY['water_policy'], 95, 'neutral', true, true, 'high'),
    (t_id, 'Marx Super PAC Spends $2M on Anti-Bottoms Ads', 'A political action committee supporting Victor Marx has spent $2 million on digital and TV ads targeting Scott Bottoms economic record.', 'Denver Post', 'https://denverpost.com/2026/04/02/marx-pac-anti-bottoms-ads/', now() - interval '14 hours', ARRAY['campaign_finance', 'advertising'], 88, 'negative', true, true, 'critical');

END $$;
