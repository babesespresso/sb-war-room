-- Migration 007: Prediction Markets Infrastructure

-- 1. Create prediction_markets table (stores the actual contracts/markets from Kalshi or Polymarket)
CREATE TABLE IF NOT EXISTS public.prediction_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    market_id VARCHAR NOT NULL, -- e.g., kalshi ticker or polymarket event ID
    platform VARCHAR NOT NULL CHECK (platform IN ('polymarket', 'kalshi', 'predictit')),
    title VARCHAR NOT NULL,
    description TEXT,
    competitor_id UUID NULL REFERENCES public.competitors(id) ON DELETE SET NULL, -- Tie market to specific competitor if applicable
    is_active BOOLEAN DEFAULT true,
    last_fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, market_id, platform)
);

-- 2. Create market_history table (stores the time-series odds/probability data)
CREATE TABLE IF NOT EXISTS public.market_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id UUID NOT NULL REFERENCES public.prediction_markets(id) ON DELETE CASCADE,
    probability NUMERIC(5, 4) NOT NULL CHECK (probability >= 0 AND probability <= 1), -- e.g. 0.4500 for 45%
    price_yes NUMERIC(10, 4), -- optional, actual share price in cents/crypto
    price_no NUMERIC(10, 4),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_market_history_market_recorded_at ON public.market_history(market_id, recorded_at);

-- RLS Policies
ALTER TABLE public.prediction_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.prediction_markets FOR SELECT USING (true);
CREATE POLICY "Enable write access for service role only" ON public.prediction_markets FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Enable read access for all users" ON public.market_history FOR SELECT USING (true);
CREATE POLICY "Enable write access for service role only" ON public.market_history FOR ALL USING (auth.role() = 'service_role');
