export type RiskLevel = "Low" | "Moderate" | "High" | "Severe";

export interface RiskScore {
  score: number;       // 0–10
  level: RiskLevel;
  rationale: string;
}

export interface RiskProfile {
  ai: RiskScore;
  climate: RiskScore;
  sector: string;
}

// Normalize sector names from Finviz screener, ETF names, and quote pages
export function normalizeSector(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("tech")) return "Technology";
  if (s.includes("financ") || s === "xlf") return "Financial";
  if (s.includes("health") || s === "xlv") return "Healthcare";
  if (s.includes("energy") || s === "xle") return "Energy";
  if (s.includes("util") || s === "xlu") return "Utilities";
  if (s.includes("industri") || s === "xli") return "Industrials";
  if (s.includes("material") || s.includes("basic mat") || s === "xlb") return "Basic Materials";
  if (s.includes("real estate") || s.includes("reit") || s === "xlre") return "Real Estate";
  if (s.includes("comm") || s.includes("media") || s.includes("telecom") || s === "xlc") return "Communication Services";
  if (s.includes("cyclical") || s.includes("discretionary") || s.includes("cons. disc") || s === "xly") return "Consumer Cyclical";
  if (s.includes("defensive") || s.includes("staples") || s.includes("cons. stap") || s === "xlp") return "Consumer Defensive";
  return raw;
}

function level(score: number): RiskLevel {
  if (score >= 8) return "Severe";
  if (score >= 6) return "High";
  if (score >= 4) return "Moderate";
  return "Low";
}

// ── Sector baseline scores ────────────────────────────────────────────────

const AI_BASELINES: Record<string, { score: number; rationale: string }> = {
  "Financial": {
    score: 8,
    rationale: "Trading, underwriting, credit decisioning, and advisory services are prime AI automation targets. Robo-advisors and LLM-driven analysis compress margins.",
  },
  "Technology": {
    score: 7,
    rationale: "Foundational models commoditize software development and SaaS features. Companies that don't embed AI face pricing pressure and customer churn.",
  },
  "Communication Services": {
    score: 7,
    rationale: "Content generation, ad targeting, and content moderation are rapidly automating. Media and publishing face structural disruption from AI-generated content.",
  },
  "Consumer Cyclical": {
    score: 6,
    rationale: "E-commerce logistics, customer service, and retail inventory management are heavily automated. Physical retail under sustained AI-driven efficiency pressure.",
  },
  "Healthcare": {
    score: 5,
    rationale: "AI accelerates drug discovery and diagnostic imaging. Administrative burden (billing, coding, scheduling) is automating rapidly. Core clinical delivery is protected longer-term.",
  },
  "Industrials": {
    score: 5,
    rationale: "Factory automation, predictive maintenance, and logistics optimization are AI targets. Physical manufacturing and infrastructure remain human-intensive.",
  },
  "Real Estate": {
    score: 4,
    rationale: "Transaction, property management, and valuation workflows are automating. Physical asset ownership and development are structurally resistant.",
  },
  "Basic Materials": {
    score: 3,
    rationale: "AI aids exploration, quality control, and safety monitoring. Core extraction and refining processes are physical and capital-intensive — hard to disrupt at the margin.",
  },
  "Consumer Defensive": {
    score: 3,
    rationale: "Supply chain and shelf planning benefit from AI optimization. Core demand for food, beverages, and household staples is inelastic and hard to automate away.",
  },
  "Energy": {
    score: 3,
    rationale: "AI improves drilling efficiency and grid optimization. Physical infrastructure and commodity exposure dominate. Demand is driven by macroeconomics, not AI adoption curves.",
  },
  "Utilities": {
    score: 2,
    rationale: "Regulated monopolies with inelastic demand. AI improves grid management and demand forecasting but cannot displace physical infrastructure or regulatory moats.",
  },
};

const CLIMATE_BASELINES: Record<string, { score: number; rationale: string }> = {
  "Energy": {
    score: 9,
    rationale: "Fossil fuel assets face regulatory-driven stranding risk and physical damage from extreme weather. Carbon transition accelerates asset write-downs and capex obsolescence.",
  },
  "Real Estate": {
    score: 8,
    rationale: "Physical assets directly exposed to flooding, wildfire, and sea-level rise. Insurance availability and cost is deteriorating rapidly in climate-exposed markets.",
  },
  "Utilities": {
    score: 7,
    rationale: "Grid and water infrastructure vulnerable to heat waves, droughts, and storms. Stranded fossil fuel plant risk alongside mounting renewable transition capex.",
  },
  "Basic Materials": {
    score: 6,
    rationale: "Water scarcity directly threatens mining and chemical operations. Regulatory carbon costs rising. Supply chains disrupted by weather events and climate-linked commodity swings.",
  },
  "Financial": {
    score: 6,
    rationale: "Mortgage portfolios and insurance books exposed to climate-affected properties. Regulatory pressure on climate disclosure and portfolio risk-weighting intensifying.",
  },
  "Consumer Defensive": {
    score: 5,
    rationale: "Agricultural input costs and crop yields are weather-dependent. Drought, flooding, and disease risk flow directly into food and beverage supply chains.",
  },
  "Industrials": {
    score: 5,
    rationale: "Physical plants and logistics networks vulnerable to extreme weather events. Supply chain disruptions amplify in high-frequency climate scenarios.",
  },
  "Consumer Cyclical": {
    score: 4,
    rationale: "Supply chain disruption and shifting consumer spending patterns during climate-driven recessions. Physical retail exposed to foot traffic loss during extreme weather.",
  },
  "Healthcare": {
    score: 3,
    rationale: "Increased disease burden from climate change expands demand. Supply chain exposure to weather events is present but manageable. Core business is structurally defensive.",
  },
  "Technology": {
    score: 2,
    rationale: "Data center energy and cooling costs are growing liabilities, but core IP is climate-resilient. Supply chain risk for semiconductors is present but diversifiable.",
  },
  "Communication Services": {
    score: 2,
    rationale: "Physical infrastructure (towers, cables, data centers) has some weather exposure. Core intangible business model is largely climate-resilient.",
  },
};

// ── Description keyword adjustments (±1–2 points) ───────────────────────

const AI_INCREASE = ["software", "saas", "platform", "digital", "analytics", "cloud", "fintech", "data", "subscription", "media", "publishing", "advisory", "brokerage", "research"];
const AI_DECREASE = ["mining", "drilling", "pipeline", "refinery", "utility", "electric", "water", "manufacturing", "construction", "cement", "steel", "chemical", "agriculture", "farming"];

const CLIMATE_INCREASE = ["oil", "gas", "coal", "petroleum", "fossil", "offshore", "drilling", "refinery", "pipeline", "carbon", "liquefied", "lng", "coastal", "agriculture", "crop", "lumber", "forest", "mining"];
const CLIMATE_DECREASE = ["software", "digital", "cloud", "virtual", "saas", "internet", "online", "platform", "streaming"];

function keywordAdjust(text: string, increase: string[], decrease: string[]): number {
  const t = text.toLowerCase();
  let adj = 0;
  for (const kw of increase) { if (t.includes(kw)) { adj += 1; break; } }
  for (const kw of decrease) { if (t.includes(kw)) { adj -= 1; break; } }
  return adj;
}

// ── Interest rate sensitivity ─────────────────────────────────────────────

const RATE_SENSITIVITY: Record<string, { score: number; rationale: string }> = {
  "Real Estate": {
    score: 9,
    rationale: "REITs are direct rate proxies — higher rates raise cap rates, compress valuations, and increase refinancing costs on leveraged property portfolios.",
  },
  "Utilities": {
    score: 8,
    rationale: "Yield-alternative stocks with heavy debt loads. Rising rates make the dividend less competitive vs risk-free alternatives and increase borrowing costs.",
  },
  "Financial": {
    score: 5,
    rationale: "Mixed exposure: banks benefit from wider net interest margins in rising rate environments, but higher rates compress loan demand and can stress credit quality.",
  },
  "Consumer Cyclical": {
    score: 5,
    rationale: "Higher consumer borrowing costs reduce discretionary spending. Auto and housing-adjacent businesses are most directly affected.",
  },
  "Technology": {
    score: 4,
    rationale: "High-growth tech companies are long-duration assets — future cash flows get discounted more aggressively when rates rise.",
  },
  "Industrials": {
    score: 4,
    rationale: "Capital-intensive businesses with moderate debt. Rising rates increase financing costs for equipment and infrastructure investment.",
  },
  "Communication Services": {
    score: 4,
    rationale: "Large capital structures for network infrastructure. Moderate rate sensitivity through debt servicing and long-term contract discounting.",
  },
  "Basic Materials": {
    score: 4,
    rationale: "Commodity prices partially rate-sensitive through USD strength. Moderate capex financing exposure.",
  },
  "Consumer Defensive": {
    score: 3,
    rationale: "Inelastic demand buffers rate sensitivity. Pricing power and stable cash flows make these businesses relatively rate-immune.",
  },
  "Healthcare": {
    score: 3,
    rationale: "Need-driven, non-cyclical demand. Rate exposure limited to capital structure and R&D financing — structurally defensive.",
  },
  "Energy": {
    score: 3,
    rationale: "Commodity prices and geopolitics dominate. Capex financing has some rate exposure, but demand is driven by macro growth cycles.",
  },
};

export function computeRateSensitivity(rawSector: string): RiskScore {
  const sector = normalizeSector(rawSector);
  const base = RATE_SENSITIVITY[sector] ?? { score: 5, rationale: "Sector not classified. Moderate rate sensitivity assumed." };
  return { score: base.score, level: level(base.score), rationale: base.rationale };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function computeRiskProfile(
  rawSector: string,
  description = ""
): RiskProfile {
  const sector = normalizeSector(rawSector);

  const aiBase = AI_BASELINES[sector] ?? { score: 5, rationale: "Sector not classified. Moderate AI disruption risk assumed." };
  const climateBase = CLIMATE_BASELINES[sector] ?? { score: 5, rationale: "Sector not classified. Moderate climate risk assumed." };

  const aiAdj      = description ? keywordAdjust(description, AI_INCREASE, AI_DECREASE) : 0;
  const climateAdj = description ? keywordAdjust(description, CLIMATE_INCREASE, CLIMATE_DECREASE) : 0;

  const aiScore      = Math.max(1, Math.min(10, aiBase.score + aiAdj));
  const climateScore = Math.max(1, Math.min(10, climateBase.score + climateAdj));

  return {
    sector,
    ai: {
      score: aiScore,
      level: level(aiScore),
      rationale: aiBase.rationale,
    },
    climate: {
      score: climateScore,
      level: level(climateScore),
      rationale: climateBase.rationale,
    },
  };
}
