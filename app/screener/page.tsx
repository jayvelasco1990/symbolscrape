"use client";

import { useRouter, useSearchParams } from "next/navigation";
import StocksTable from "../components/StocksTable";

const TABS = [
  { key: "megacap",  label: "Mega Cap",  description: "Market cap > $200B" },
  { key: "largecap", label: "Large Cap", description: "Market cap $10B–$200B · USA" },
  { key: "midcap",   label: "Mid Cap",   description: "Market cap $2B–$10B · USA" },
  { key: "smallcap", label: "Small Cap", description: "Market cap $300M–$2B · USA" },
  { key: "microcap", label: "Micro Cap", description: "Market cap $50M–$300M · USA" },
];

const BETA_OPTIONS = [
  { value: "",     label: "Any Beta" },
  { value: "u0.5", label: "Beta < 0.5" },
  { value: "u1",   label: "Beta < 1" },
  { value: "u1.5", label: "Beta < 1.5" },
  { value: "u2",   label: "Beta < 2" },
  { value: "o0.5", label: "Beta > 0.5" },
  { value: "o1",   label: "Beta > 1" },
  { value: "o1.5", label: "Beta > 1.5" },
  { value: "o2",   label: "Beta > 2" },
];

const SECTORS = [
  { value: "sec_technology",            label: "Technology" },
  { value: "sec_financial",             label: "Financial" },
  { value: "sec_healthcare",            label: "Healthcare" },
  { value: "sec_energy",                label: "Energy" },
  { value: "sec_utilities",             label: "Utilities" },
  { value: "sec_industrials",           label: "Industrials" },
  { value: "sec_consumerdefensive",     label: "Consumer Defensive" },
  { value: "sec_consumercyclical",      label: "Consumer Cyclical" },
  { value: "sec_basicmaterials",        label: "Basic Materials" },
  { value: "sec_realestate",            label: "Real Estate" },
  { value: "sec_communicationservices", label: "Communication Services" },
];

const INDUSTRIES_BY_SECTOR: Record<string, { value: string; label: string }[]> = {
  sec_technology: [
    { value: "ind_softwareapplication",           label: "Software—Application" },
    { value: "ind_softwareinfrastructure",         label: "Software—Infrastructure" },
    { value: "ind_semiconductors",                 label: "Semiconductors" },
    { value: "ind_semiconductorequipment",         label: "Semiconductor Equipment" },
    { value: "ind_informationtechnologyservices",  label: "IT Services" },
    { value: "ind_computerhardware",               label: "Computer Hardware" },
    { value: "ind_electroniccomponents",           label: "Electronic Components" },
    { value: "ind_consumerelectronics",            label: "Consumer Electronics" },
    { value: "ind_internetcontentinformation",     label: "Internet Content & Information" },
  ],
  sec_financial: [
    { value: "ind_banksregional",                  label: "Banks—Regional" },
    { value: "ind_banksdiversified",               label: "Banks—Diversified" },
    { value: "ind_insurancelife",                  label: "Insurance—Life" },
    { value: "ind_insurancepropertycasualty",      label: "Insurance—Property & Casualty" },
    { value: "ind_assetmanagement",                label: "Asset Management" },
    { value: "ind_capitalmarkets",                 label: "Capital Markets" },
    { value: "ind_creditservices",                 label: "Credit Services" },
    { value: "ind_insurancediversified",           label: "Insurance—Diversified" },
    { value: "ind_financialdatastockexchanges",    label: "Financial Data & Exchanges" },
    { value: "ind_mortgagefinance",                label: "Mortgage Finance" },
  ],
  sec_healthcare: [
    { value: "ind_drugmanufacturersgeneral",           label: "Drug Manufacturers—General" },
    { value: "ind_drugmanufacturersspecialtygeneric",  label: "Drug Manufacturers—Specialty" },
    { value: "ind_biotechnology",                      label: "Biotechnology" },
    { value: "ind_medicaldevices",                     label: "Medical Devices" },
    { value: "ind_healthcareplans",                    label: "Healthcare Plans" },
    { value: "ind_diagnosticsresearch",                label: "Diagnostics & Research" },
    { value: "ind_medicaldistribution",                label: "Medical Distribution" },
    { value: "ind_hospitals",                          label: "Hospitals" },
    { value: "ind_medicalinstrumentssupplies",         label: "Medical Instruments" },
  ],
  sec_energy: [
    { value: "ind_oilgasep",                       label: "Oil & Gas E&P" },
    { value: "ind_oilgasintegrated",               label: "Oil & Gas—Integrated" },
    { value: "ind_oilgasrefiningmarketing",        label: "Oil & Gas Refining" },
    { value: "ind_oilgasequipmentservices",        label: "Oil & Gas Equipment" },
    { value: "ind_oilgasmidstream",                label: "Oil & Gas Midstream" },
  ],
  sec_consumercyclical: [
    { value: "ind_automanufacturers",              label: "Auto Manufacturers" },
    { value: "ind_internetretail",                 label: "Internet Retail" },
    { value: "ind_restaurants",                    label: "Restaurants" },
    { value: "ind_homeimprovementretail",          label: "Home Improvement Retail" },
    { value: "ind_apparelretail",                  label: "Apparel Retail" },
    { value: "ind_departmentstores",               label: "Department Stores" },
    { value: "ind_luxurygoods",                    label: "Luxury Goods" },
    { value: "ind_lodging",                        label: "Lodging" },
    { value: "ind_gambling",                       label: "Gambling" },
    { value: "ind_travelservices",                 label: "Travel Services" },
  ],
  sec_consumerdefensive: [
    { value: "ind_discountstores",                 label: "Discount Stores" },
    { value: "ind_beveragesnonalcoholic",          label: "Beverages—Non-Alcoholic" },
    { value: "ind_beveragesbrewers",               label: "Beverages—Brewers" },
    { value: "ind_fooddistribution",               label: "Food Distribution" },
    { value: "ind_grocerystores",                  label: "Grocery Stores" },
    { value: "ind_householdpersonalproducts",      label: "Household & Personal Products" },
    { value: "ind_tobacco",                        label: "Tobacco" },
    { value: "ind_packagedfoods",                  label: "Packaged Foods" },
  ],
  sec_industrials: [
    { value: "ind_aerospacedefense",               label: "Aerospace & Defense" },
    { value: "ind_airlines",                       label: "Airlines" },
    { value: "ind_railroads",                      label: "Railroads" },
    { value: "ind_trucking",                       label: "Trucking" },
    { value: "ind_farmheavyconstructionmachinery", label: "Farm & Heavy Machinery" },
    { value: "ind_specialtyindustrialmachinery",   label: "Specialty Machinery" },
    { value: "ind_staffingemploymentservices",     label: "Staffing & Employment" },
    { value: "ind_wastemanagement",                label: "Waste Management" },
    { value: "ind_industrialdistribution",         label: "Industrial Distribution" },
  ],
  sec_communicationservices: [
    { value: "ind_telecomservices",                label: "Telecom Services" },
    { value: "ind_entertainment",                  label: "Entertainment" },
    { value: "ind_electronicgamingmultimedia",     label: "Electronic Gaming" },
    { value: "ind_advertisingagencies",            label: "Advertising Agencies" },
    { value: "ind_publishing",                     label: "Publishing" },
  ],
  sec_utilities: [
    { value: "ind_utilitiesregulatedelectric",           label: "Utilities—Regulated Electric" },
    { value: "ind_utilitiesregulatedgas",                label: "Utilities—Regulated Gas" },
    { value: "ind_utilitiesdiversified",                  label: "Utilities—Diversified" },
    { value: "ind_utilitiesrenewable",                   label: "Utilities—Renewable" },
    { value: "ind_utilitiesindependentpowerproducers",   label: "Independent Power Producers" },
  ],
  sec_realestate: [
    { value: "ind_reitretail",                     label: "REIT—Retail" },
    { value: "ind_reitresidential",                label: "REIT—Residential" },
    { value: "ind_reitindustrial",                 label: "REIT—Industrial" },
    { value: "ind_reitoffice",                     label: "REIT—Office" },
    { value: "ind_reithealthcarefacilities",       label: "REIT—Healthcare" },
    { value: "ind_reitdiversified",                label: "REIT—Diversified" },
    { value: "ind_reitspecialty",                  label: "REIT—Specialty" },
    { value: "ind_reitmortgage",                   label: "REIT—Mortgage" },
  ],
  sec_basicmaterials: [
    { value: "ind_specialtychemicals",             label: "Specialty Chemicals" },
    { value: "ind_gold",                           label: "Gold" },
    { value: "ind_silver",                         label: "Silver" },
    { value: "ind_steel",                          label: "Steel" },
    { value: "ind_copper",                         label: "Copper" },
    { value: "ind_agriculturalInputs",             label: "Agricultural Inputs" },
  ],
};

const SELECT_CLS = (active: boolean) =>
  `px-3 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer ${
    active
      ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
      : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
  }`;

export default function ScreenerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab")      ?? "megacap";
  const page      = parseInt(searchParams.get("page") ?? "1", 10);
  const dividend  = searchParams.get("dividend") === "true";
  const rsi       = searchParams.get("rsi")      === "true";
  const beta      = searchParams.get("beta")     ?? "";
  const sort      = searchParams.get("sort")     ?? "asc";
  const sector    = searchParams.get("sector")   ?? "";
  const industry  = searchParams.get("industry") ?? "";

  const activeTabData   = TABS.find((t) => t.key === activeTab) ?? TABS[0];
  const sectorLabel     = SECTORS.find((s) => s.value === sector)?.label ?? "";
  const industryOptions = sector ? (INDUSTRIES_BY_SECTOR[sector] ?? []) : [];
  const industryLabel   = industryOptions.find((i) => i.value === industry)?.label ?? "";

  function buildUrl(overrides: Record<string, string | number | boolean>) {
    const params = {
      tab: activeTab,
      page: String(page),
      dividend: String(dividend),
      rsi: String(rsi),
      beta,
      sort,
      sector,
      industry,
      ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, String(v)])),
    };
    // Strip empty values to keep URLs clean
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== "false"));
    return `/screener?${new URLSearchParams(clean).toString()}`;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-indigo-500 dark:text-indigo-400 uppercase mb-2">
            Value Screener
          </p>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Stock Screener</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Stocks filtered by beta, RSI, and market cap
          </p>

          {/* Tabs */}
          <div className="flex gap-2 mt-6 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => router.push(buildUrl({ tab: tab.key, page: 1 }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {/* Sector */}
            <select
              value={sector}
              onChange={(e) => router.push(buildUrl({ sector: e.target.value, industry: "", page: 1 }))}
              className={SELECT_CLS(!!sector)}
            >
              <option value="">All Sectors</option>
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            {/* Industry — only shown when a sector is selected */}
            {sector && industryOptions.length > 0 && (
              <select
                value={industry}
                onChange={(e) => router.push(buildUrl({ industry: e.target.value, page: 1 }))}
                className={SELECT_CLS(!!industry)}
              >
                <option value="">All Industries</option>
                {industryOptions.map((ind) => (
                  <option key={ind.value} value={ind.value}>{ind.label}</option>
                ))}
              </select>
            )}

            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />

            {/* Dividend toggle */}
            <button
              onClick={() => router.push(buildUrl({ dividend: !dividend, page: 1 }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                dividend
                  ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dividend ? "bg-emerald-500" : "bg-zinc-400"}`} />
              Dividend
            </button>

            {/* RSI toggle */}
            <button
              onClick={() => router.push(buildUrl({ rsi: !rsi, page: 1 }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                rsi
                  ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${rsi ? "bg-emerald-500" : "bg-zinc-400"}`} />
              RSI &lt; 50
            </button>

            {/* P/E sort toggle */}
            <button
              onClick={() => router.push(buildUrl({ sort: sort === "asc" ? "desc" : "asc", page: 1 }))}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                sort === "desc"
                  ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                  : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
              }`}
            >
              P/E {sort === "desc" ? "↓ High" : "↑ Low"}
            </button>

            {/* Beta select */}
            <select
              value={beta}
              onChange={(e) => router.push(buildUrl({ beta: e.target.value, page: 1 }))}
              className={SELECT_CLS(!!beta)}
            >
              {BETA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-3">
            {activeTabData.description}
            {sectorLabel    ? ` · ${sectorLabel}`    : ""}
            {industryLabel  ? ` · ${industryLabel}`  : ""}
            {dividend       ? " · Dividend"          : ""}
            {rsi            ? " · RSI < 50"          : ""}
            {beta           ? ` · ${BETA_OPTIONS.find(o => o.value === beta)?.label}` : ""}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <StocksTable
          screener={activeTab}
          page={page}
          dividend={dividend}
          rsi={rsi}
          beta={beta}
          sort={sort}
          sector={sector}
          industry={industry}
          onPageChange={(p) => router.push(buildUrl({ page: p }))}
        />
      </div>
    </div>
  );
}
