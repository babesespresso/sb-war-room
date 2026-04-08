-- Seed Intelligence Data for Dashboard
-- Fixed: variable shadowing, activity_type constraint, agent name format

DO $$
DECLARE
    t_id TEXT := 'bottoms-2026';
    comp_r UUID;
    comp_d UUID;
BEGIN
    -- Use t_id (not tenant_id) to avoid column name shadowing
    SELECT id INTO comp_r FROM competitors WHERE competitors.tenant_id = t_id AND party = 'Republican' LIMIT 1;
    SELECT id INTO comp_d FROM competitors WHERE competitors.tenant_id = t_id AND party = 'Democrat' LIMIT 1;

    IF comp_d IS NOT NULL THEN
        INSERT INTO competitor_activities (tenant_id, competitor_id, activity_type, summary, raw_content, detected_at, topics, threat_level, requires_response)
        VALUES 
        (t_id, comp_d, 'attack', 'Attacked Scott on Water Policy', 'Scott Bottoms wants to dry up our farms with his new water policy...', now() - interval '2 hours', ARRAY['water_policy', 'agriculture'], 'high', true),
        (t_id, comp_d, 'press_release', 'Announced new housing initiative', 'We are allocating $500M to urban housing...', now() - interval '1 day', ARRAY['housing'], 'medium', false);
    END IF;

    IF comp_r IS NOT NULL THEN
        INSERT INTO competitor_activities (tenant_id, competitor_id, activity_type, summary, raw_content, detected_at, topics, threat_level, requires_response)
        VALUES 
        (t_id, comp_r, 'event', 'Criticized current tax rates at local rally', 'Taxes are too high and hurting small business...', now() - interval '5 hours', ARRAY['economy', 'taxes'], 'critical', true);
    END IF;

    -- News Items
    INSERT INTO news_items (tenant_id, headline, summary, source_name, published_at, topics, relevance_score, sentiment, response_opportunity, response_urgency)
    VALUES
    (t_id, 'Local Farms Face Water Crisis', 'A deep dive into the upcoming water shortages...', 'Colorado Sun', now() - interval '10 hours', ARRAY['water_policy', 'economy'], 85, 'negative', true, 'high'),
    (t_id, 'Economic Growth Exceeds Expectations in Q1', 'State sees unexpected bump in jobs...', 'Denver Post', now() - interval '1 day', ARRAY['economy', 'jobs'], 90, 'positive', true, 'medium');

    -- Sentiment Signals
    INSERT INTO sentiment_signals (tenant_id, platform, topic, sentiment_score, volume, velocity, opportunity_score, candidate_alignment, period_start, period_end)
    VALUES
    (t_id, 'twitter', 'water_policy', -0.4, 1500, 2.5, 85, 'strong', now() - interval '24 hours', now()),
    (t_id, 'news', 'economy', 0.6, 3200, 1.2, 60, 'moderate', now() - interval '24 hours', now()),
    (t_id, 'facebook', 'public_safety', -0.2, 800, 0.5, 40, 'strong', now() - interval '24 hours', now());

    -- Content Drafts
    INSERT INTO content_drafts (tenant_id, content_type, title, body, status, platform, suggested_post_time)
    VALUES
    (t_id, 'social_twitter', 'Water Policy Response', 'Our agriculture relies on strong water rights. I will defend Colorado water. #CoPol', 'pending_review', 'twitter', now() + interval '1 hour'),
    (t_id, 'social_facebook', 'Economy Highlight', 'Great news on the job front today, but we can do more...', 'published', 'facebook', now() - interval '1 hour');

    -- Performance Metrics (ON CONFLICT for idempotent re-runs)
    INSERT INTO performance_metrics (tenant_id, metric_date, platform, followers_change, engagement_rate)
    VALUES
    (t_id, CURRENT_DATE, 'twitter', 125, 0.034),
    (t_id, CURRENT_DATE, 'facebook', 42, 0.051)
    ON CONFLICT (tenant_id, metric_date, platform) DO UPDATE SET
        followers_change = EXCLUDED.followers_change,
        engagement_rate = EXCLUDED.engagement_rate;

    -- Agent Runs (snake_case to match actual agent runner output)
    INSERT INTO agent_runs (tenant_id, agent_name, run_type, status, started_at, completed_at, items_processed, tokens_input, api_cost)
    VALUES
    (t_id, 'competitor_monitor', 'scheduled', 'completed', now() - interval '30 minutes', now() - interval '29 minutes', 15, 4500, 0.0135),
    (t_id, 'news_pulse', 'scheduled', 'completed', now() - interval '1 hour', now() - interval '58 minutes', 42, 12000, 0.036),
    (t_id, 'sentiment_analyzer', 'scheduled', 'completed', now() - interval '2 hours', now() - interval '118 minutes', 500, 25000, 0.075);
END $$;
