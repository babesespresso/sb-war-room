-- ============================================================
-- WARBIRD: Candidate Positions Seed
-- Scott Bottoms for Governor 2026 - Policy Knowledge Base
-- Updated: April 2, 2026
-- ============================================================
-- Sources: ScottBottoms.com, legislative record, public speeches,
-- campaign statements, Colorado Politics, CPR News, Grokipedia
-- ============================================================

INSERT INTO candidate_positions (tenant_id, topic, subtopic, position_summary, talking_points, supporting_data, vs_competitors, strength, last_public_statement) VALUES

-- ============================================================
-- FISCAL RESPONSIBILITY & GOVERNMENT REFORM
-- ============================================================
('bottoms-2026', 'government_spending', 'fiscal_responsibility',
'Scott Bottoms is committed to restoring fiscal discipline to Colorado state government. He advocates for mandatory agency audits, balanced budget requirements, and a prohibition on taxpayer-funded lobbying. The core message: every dollar the government takes from a Colorado family should be spent wisely, transparently, and accountably.',
'["Mandatory audits of every state agency to identify waste and inefficiency", "Balanced budget requirement with no gimmicks or hidden debt", "Ban taxpayer-funded lobbying -- your tax dollars should not be used to lobby against your interests", "DOGE-style review of state government to cut bureaucratic bloat", "Redirect savings to roads, schools, and public safety"]'::jsonb,
'[{"fact": "Colorado state budget has grown significantly under Democratic governance", "source": "Colorado General Assembly", "date": "2025"}, {"fact": "Scott serves on the House Appropriations Committee", "source": "CO General Assembly", "date": "2023-present"}]'::jsonb,
'{"kirkmeyer": "Kirkmeyer touts JBC experience but has been part of the system. Scott wants to reform the system, not manage it.", "bennet": "Bennet has spent 16 years in Washington adding to the national debt. Scott will bring fiscal discipline back to Colorado."}'::jsonb,
'strong', '2026-03-15'),

('bottoms-2026', 'taxes', 'tax_relief',
'Colorado families are being crushed by the cost of living. Scott supports cutting taxes, eliminating unnecessary fees, and ensuring government lives within its means. He opposes any new taxes or fee increases and supports making TABOR protections permanent.',
'["Protect TABOR -- the Taxpayer Bill of Rights is Colorado''s firewall against government overreach", "No new taxes or fee increases on Colorado families", "Reduce regulatory burden on small businesses", "Property tax relief for homeowners and seniors", "Make Colorado competitive again for businesses fleeing high-tax states"]'::jsonb,
'[]'::jsonb,
'{"kirkmeyer": "Both strong on TABOR, but Scott has a clearer commitment to cutting rather than just containing", "bennet": "Bennet voted for massive federal spending bills that drive inflation and hurt Colorado families"}'::jsonb,
'strong', '2026-02-01'),

-- ============================================================
-- EDUCATION & PARENTAL RIGHTS
-- ============================================================
('bottoms-2026', 'education', 'school_choice',
'Scott believes parents -- not bureaucrats -- should decide where and how their children are educated. He is a champion of school choice, supporting charter schools, homeschool freedom, and education savings accounts. He will fight to restore parental rights in education and remove political agendas from the classroom.',
'["Expand school choice for every Colorado family through Education Savings Accounts", "Support charter schools and remove caps on their growth", "Protect homeschool families from government overreach", "Remove political ideology from K-12 classrooms", "Restore parental rights: parents know what is best for their children", "Increase transparency in curriculum -- parents deserve to know what their kids are being taught"]'::jsonb,
'[{"fact": "Colorado ranks 40th in education freedom according to Heritage Foundation", "source": "Heritage Foundation Education Freedom Report", "date": "2024"}]'::jsonb,
'{"kirkmeyer": "Kirkmeyer supports school choice but has not championed it as aggressively in the legislature", "marx": "Marx talks about youth but has no legislative record on education reform", "bennet": "Bennet was Denver Public Schools superintendent -- his track record is the system that is failing our kids"}'::jsonb,
'strong', '2026-03-01'),

-- ============================================================
-- PUBLIC SAFETY & LAW ENFORCEMENT
-- ============================================================
('bottoms-2026', 'public_safety', 'law_and_order',
'Scott Bottoms stands firmly with law enforcement and believes Colorado must reverse the soft-on-crime policies that have made communities less safe. He supports repealing lenient sentencing laws, bolstering police funding, and ensuring criminals face real consequences.',
'["Repeal soft-on-crime legislation passed under Democratic supermajority", "Fully fund and support law enforcement at every level", "Restore mandatory minimum sentences for violent crimes", "Support faith-based recovery and rehabilitation programs", "Hold district attorneys accountable for refusing to prosecute", "Back the badge -- our officers deserve support, not defunding"]'::jsonb,
'[{"fact": "Property crime in Colorado has risen significantly since 2019", "source": "Colorado Bureau of Investigation", "date": "2024"}, {"fact": "Scott serves on the State, Civic, Military & Veterans Affairs Committee", "source": "CO General Assembly", "date": "2023-present"}]'::jsonb,
'{"mikesell": "Mikesell has the law enforcement background but Scott has the legislative record of fighting for law enforcement IN the Capitol", "bennet": "Bennet sat in Washington while Colorado communities became less safe under Democratic state leadership"}'::jsonb,
'strong', '2026-03-20'),

-- ============================================================
-- IMMIGRATION
-- ============================================================
('bottoms-2026', 'immigration', 'border_security',
'Colorado has been impacted by the border crisis -- from overwhelmed social services to public safety concerns. Scott supports ending sanctuary policies, cooperating with federal immigration enforcement, and protecting Colorado resources for Colorado citizens.',
'["End sanctuary policies in Colorado", "Cooperate fully with ICE and federal immigration enforcement", "Protect Colorado taxpayer resources from being used for illegal immigration services", "Support legal immigration while opposing illegal entry", "Hold elected officials accountable who refuse to enforce immigration law"]'::jsonb,
'[]'::jsonb,
'{"mikesell": "Mikesell fought ACLU over ICE cooperation -- Scott aligns with him on this and will bring legislative authority to back it up", "bennet": "Bennet supports sanctuary policies that put Colorado communities at risk"}'::jsonb,
'strong', '2026-02-15'),

-- ============================================================
-- ENERGY
-- ============================================================
('bottoms-2026', 'energy', 'energy_freedom',
'Scott supports the Colorado Energy Freedom Act -- a vision for diverse energy production free from ESG mandates and green energy overreach. Colorado should harness ALL of its energy resources including oil, gas, solar, wind, and nuclear, without government picking winners and losers.',
'["Colorado Energy Freedom Act: develop ALL energy sources without government mandates", "Remove ESG mandates that drive up energy costs for families", "Support Colorado''s oil and gas industry -- it employs tens of thousands of Coloradans", "Lower energy costs by expanding supply, not restricting it", "Oppose forced EV mandates and let consumers choose", "Support nuclear energy as part of Colorado''s energy future"]'::jsonb,
'[{"fact": "Colorado oil and gas industry supports over 89,000 jobs", "source": "Colorado Oil & Gas Association", "date": "2024"}]'::jsonb,
'{"kirkmeyer": "Kirkmeyer is strong on energy from her Weld County roots, similar alignment", "bennet": "Bennet has supported the Green New Deal framework that would devastate Colorado energy jobs"}'::jsonb,
'strong', '2026-01-15'),

-- ============================================================
-- WATER POLICY
-- ============================================================
('bottoms-2026', 'water_policy', 'colorado_water',
'Water is Colorado''s most precious resource. Scott supports protecting water rights for agriculture, ensuring municipal water supply growth, and fighting any federal attempts to control Colorado water resources. The Colorado River Compact must be defended.',
'["Protect Colorado''s water rights under the Colorado River Compact", "Support agricultural water rights -- farmers feed Colorado and the nation", "Invest in water infrastructure and storage", "Fight federal overreach on Colorado water resources", "Balance municipal growth needs with agricultural and environmental water needs", "Support transmountain diversion maintenance and expansion"]'::jsonb,
'[{"fact": "Colorado River basin faces continued drought pressure", "source": "Bureau of Reclamation", "date": "2025"}]'::jsonb,
'{"kirkmeyer": "Both strong on water from Colorado backgrounds, similar positions", "bennet": "Bennet has been in the Senate for 16 years and Colorado''s water infrastructure is still failing"}'::jsonb,
'moderate', '2025-12-01'),

-- ============================================================
-- HEALTHCARE
-- ============================================================
('bottoms-2026', 'healthcare', 'free_market_healthcare',
'Scott supports free-market healthcare reforms that increase competition, price transparency, and choice. He opposes government-run healthcare and believes patients and doctors -- not bureaucrats -- should make medical decisions.',
'["Price transparency: Coloradans deserve to know what healthcare costs BEFORE they receive it", "Expand telemedicine access especially for rural Colorado", "Remove barriers to cross-state insurance competition", "Protect the doctor-patient relationship from government interference", "Support faith-based and community health programs", "Oppose single-payer government healthcare"]'::jsonb,
'[]'::jsonb,
'{"bennet": "Bennet supports expanding government control of healthcare. Scott trusts patients and doctors, not politicians.", "weiser": "Weiser talks about consumer protection but supports policies that reduce healthcare choice"}'::jsonb,
'moderate', '2026-01-01'),

-- ============================================================
-- CONSTITUTIONAL RIGHTS
-- ============================================================
('bottoms-2026', 'constitutional_rights', 'second_amendment',
'Scott is a firm defender of the Second Amendment and opposes all gun control measures that infringe on law-abiding Coloradans'' right to bear arms. He will fight to repeal gun control laws passed under Democratic governance.',
'["Defend the Second Amendment without compromise", "Repeal red flag laws that violate due process", "Oppose magazine capacity bans and assault weapons bans", "Support constitutional carry", "Protect gun rights for law-abiding citizens while prosecuting violent criminals"]'::jsonb,
'[]'::jsonb,
'{"kirkmeyer": "Both strong on 2A", "mikesell": "Both strong on 2A, aligned as law enforcement and legislator"}'::jsonb,
'strong', '2026-02-01'),

('bottoms-2026', 'constitutional_rights', 'parental_rights',
'Parents are the primary authority over their children''s upbringing, education, and healthcare. Scott will fight for a Parental Rights Amendment to the Colorado constitution and protect families from government overreach.',
'["Support a Parental Rights Amendment to the Colorado Constitution", "Parents must consent to medical decisions for their minor children", "Parents deserve full transparency on school curriculum and activities", "Protect the right of parents to raise their children according to their values"]'::jsonb,
'[]'::jsonb,
'{}'::jsonb,
'strong', '2026-03-01'),

-- ============================================================
-- ELECTION INTEGRITY
-- ============================================================
('bottoms-2026', 'election_integrity', 'secure_elections',
'Scott believes every legal vote should count and supports common-sense election security measures. He advocates for voter ID requirements, transparent auditing processes, and restoring confidence in Colorado elections.',
'["Support voter ID requirements for all elections", "Transparent, auditable election processes", "Ensure voter rolls are current and accurate", "Protect election integrity while maintaining access for all legal voters", "Restore public confidence in the election process"]'::jsonb,
'[]'::jsonb,
'{}'::jsonb,
'moderate', '2026-01-01'),

-- ============================================================
-- VETERANS
-- ============================================================
('bottoms-2026', 'veterans', 'veteran_support',
'As a Navy veteran, Scott understands the sacrifices of military service. He will fight to ensure Colorado is the best state in the nation for veterans, with access to healthcare, housing, employment, and the respect they have earned.',
'["Make Colorado the #1 state for veteran support services", "Expand access to veteran healthcare and mental health services", "Support veteran employment programs and transition assistance", "Protect veteran benefits from state budget cuts", "Scott served in the U.S. Navy -- he understands the sacrifice"]'::jsonb,
'[{"fact": "Colorado is home to over 390,000 veterans", "source": "U.S. Census Bureau", "date": "2023"}, {"fact": "Scott Bottoms is a U.S. Navy veteran", "source": "Campaign", "date": ""}]'::jsonb,
'{"marx": "Marx is also veteran-adjacent through ministry work but has not served. Scott served.", "mikesell": "Mikesell is law enforcement, not military. Scott has the veteran credential."}'::jsonb,
'strong', '2026-03-15'),

-- ============================================================
-- HOUSING
-- ============================================================
('bottoms-2026', 'housing', 'affordability',
'Housing affordability is crushing Colorado families. Scott supports cutting regulations that drive up construction costs, protecting property rights, and opposing government-mandated rent control or density requirements.',
'["Cut regulatory red tape that drives up housing construction costs", "Oppose rent control -- it reduces supply and makes the problem worse", "Protect private property rights from government overreach", "Support local control of zoning decisions, not state mandates", "Make homeownership achievable for young Colorado families"]'::jsonb,
'[]'::jsonb,
'{"bennet": "Bennet supports federal housing programs that have failed to deliver results. Scott will cut the regulations that make building affordable housing impossible."}'::jsonb,
'moderate', '2026-02-01'),

-- ============================================================
-- AI & TECHNOLOGY INNOVATION
-- ============================================================
('bottoms-2026', 'tech_innovation', 'ai_and_innovation',
'Scott supports protecting human innovation and ensuring AI technology serves Colorado families rather than replacing them. He opposes overregulation that would drive tech companies out of Colorado while supporting common-sense guardrails.',
'["Protect human innovation and jobs from AI displacement", "Attract tech companies to Colorado with business-friendly policies", "Oppose heavy-handed AI regulation that stifles innovation", "Ensure AI in government is transparent and accountable", "Support Colorado''s tech corridor growth"]'::jsonb,
'[]'::jsonb,
'{}'::jsonb,
'developing', '2025-12-01');
