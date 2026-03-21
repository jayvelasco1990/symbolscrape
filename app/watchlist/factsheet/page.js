"use client";

import { useEffect, useState } from "react";

function n2(n) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pct(n, sign = true) {
  if (n == null || isNaN(n)) return "—";
  return `${sign && n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function money(n) {
  if (n == null || isNaN(n)) return "—";
  return `$${n2(n)}`;
}
function moneyAbs(n) {
  if (n == null || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : "−"}$${n2(Math.abs(n))}`;
}

const PERIODS = [
  { key: "Perf Week",    label: "1W"  },
  { key: "Perf Month",   label: "1M"  },
  { key: "Perf Quarter", label: "3M"  },
  { key: "Perf YTD",     label: "YTD" },
];

const DOC = {
  fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
  fontSize: "11px",
  color: "#0a0a0a",
  background: "white",
  lineHeight: 1.4,
};
const TH = {
  fontSize: "8px",
  fontWeight: 700,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#52525b",
  padding: "5px 8px",
  borderBottom: "1.5px solid #d4d4d8",
  whiteSpace: "nowrap",
};
const TD = { padding: "5px 8px", fontSize: "11px", color: "#0a0a0a" };
const TD_R = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const LABEL = {
  fontSize: "8px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#3730a3",
  marginBottom: "8px",
  display: "block",
  borderBottom: "1px solid #e0e7ff",
  paddingBottom: "3px",
};
const GREEN = "#059669";
const RED = "#dc2626";
const MUTED = "#a1a1aa";

function color(n) { return n == null ? MUTED : n >= 0 ? GREEN : RED; }

export default function FactsheetPage() {
  const [state, setState] = useState({ loading: true, perf: null, val: null, macro: null });

  useEffect(() => {
    Promise.all([
      fetch("/api/performance").then((r) => r.json()),
      fetch("/api/watchlist/valuation").then((r) => r.json()),
      fetch("/api/macro").then((r) => r.json()),
    ]).then(([perf, val, macro]) => {
      const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      document.title = `Factsheet as of ${date}`;
      setState({ loading: false, perf, val, macro });
    });
  }, []);

  if (state.loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
        <p style={{ color: MUTED, fontSize: "12px" }}>Preparing factsheet…</p>
      </div>
    );
  }

  const { perf, val, macro } = state;
  const rows   = perf?.breakdown ?? [];
  const spy    = perf?.spy ?? {};
  const si     = perf?.sinceInception ?? null;
  const valMap = Object.fromEntries((val?.items ?? []).map((v) => [v.ticker, v]));

  const totalLiveValue = rows.reduce((s, r) => s + (r.currentPrice ?? parseFloat(r.price) ?? 0) * (r.quantity || 0), 0);
  const totalCost      = rows.reduce((s, r) => s + (r.unit_cost > 0 ? r.unit_cost : parseFloat(r.price) || 0) * (r.quantity || 0), 0);
  const totalGL        = totalCost > 0 ? totalLiveValue - totalCost : null;
  const totalGLPct     = totalGL !== null && totalCost > 0 ? (totalGL / totalCost) * 100 : null;

  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const inceptionStr = si?.inceptionDate
    ? new Date(si.inceptionDate.replace(" ", "T") + "Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .screen-only { display: none !important; }
          .doc-page { padding: 0.6in 0.65in !important; box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
        @media screen {
          body { background: #71717a; }
          .doc-page {
            max-width: 820px;
            margin: 32px auto;
            padding: 36px 44px 44px;
            box-shadow: 0 4px 32px rgba(0,0,0,0.18);
          }
        }
        table { border-collapse: collapse; width: 100%; }
        * { box-sizing: border-box; }
      `}</style>

      {/* Screen-only fixed button */}
      <button
        className="screen-only"
        onClick={() => window.print()}
        style={{ position: "fixed", bottom: "28px", right: "28px", background: "#4f46e5", color: "white", border: "none", borderRadius: "6px", padding: "10px 22px", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 16px rgba(79,70,229,0.4)", zIndex: 9999 }}
      >
        Save as PDF
      </button>

      {/* Document */}
      <div className="doc-page" style={{ ...DOC, background: "white" }}>

        {/* ── Header bar ───────────────────────────────── */}
        <div style={{ background: "#3730a3", padding: "12px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>
              Personal Investment Portfolio
            </div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "white", letterSpacing: "0.01em" }}>
              Portfolio Factsheet
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>As of</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{dateStr}</div>
          </div>
        </div>

        {/* ── Fund metadata line ───────────────────────── */}
        <div style={{ fontSize: "10px", color: "#52525b", borderBottom: "1px solid #e4e4e7", paddingBottom: "10px", marginBottom: "16px", display: "flex", gap: "24px" }}>
          {inceptionStr && <span><strong>Inception:</strong> {inceptionStr} &nbsp;·&nbsp; {si.daysElapsed} days</span>}
          <span><strong>Positions:</strong> {rows.length}</span>
          <span><strong>Market Value:</strong> {money(totalLiveValue)}</span>
          {val?.avgMarginOfSafety != null && (
            <span><strong>Avg Margin of Safety:</strong> <span style={{ color: color(val.avgMarginOfSafety), fontWeight: 700 }}>{pct(val.avgMarginOfSafety)}</span></span>
          )}
        </div>

        {/* ── Three key stat columns ───────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0", marginBottom: "20px", border: "1px solid #e4e4e7" }}>

          {/* Fund summary */}
          <div style={{ padding: "12px 14px", borderRight: "1px solid #e4e4e7" }}>
            <span style={LABEL}>Fund Summary</span>
            <Row label="Market Value"  value={money(totalLiveValue)} />
            <Row label="Cost Basis"    value={money(totalCost)} />
            <Row label="Unrealized G/L" value={totalGL !== null ? moneyAbs(totalGL) : "—"} valueColor={color(totalGL)} />
            <Row label="Return vs Cost" value={totalGLPct != null ? pct(totalGLPct) : "—"} valueColor={color(totalGLPct)} bold />
          </div>

          {/* Since inception */}
          <div style={{ padding: "12px 14px", borderRight: "1px solid #e4e4e7" }}>
            <span style={LABEL}>Since Inception</span>
            {si ? (
              <>
                <Row label="Your Fund" value={pct(si.portfolioReturn)} valueColor={color(si.portfolioReturn)} bold />
                <Row label="SPY (Benchmark)" value={pct(si.spyReturn)} valueColor={color(si.spyReturn)} />
                <Row label="Alpha" value={pct(si.alpha)} valueColor={color(si.alpha)} bold />
                <div style={{ marginTop: "8px", fontSize: "9px", color: si.alpha >= 0 ? GREEN : RED, fontWeight: 700 }}>
                  {si.alpha >= 0 ? "▲ OUTPERFORMING" : "▼ UNDERPERFORMING"} SPY
                </div>
              </>
            ) : (
              <p style={{ color: MUTED, fontSize: "10px" }}>No data available</p>
            )}
          </div>

          {/* Valuation summary */}
          <div style={{ padding: "12px 14px" }}>
            <span style={LABEL}>Valuation (Graham)</span>
            <Row label="Avg Margin of Safety" value={val?.avgMarginOfSafety != null ? pct(val.avgMarginOfSafety) : "—"} valueColor={color(val?.avgMarginOfSafety)} bold />
            <Row label="Undervalued" value={`${(val?.items ?? []).filter(i => i.marginOfSafety > 0).length} of ${(val?.items ?? []).filter(i => i.marginOfSafety != null).length}`} />
            <Row label="10Y Yield" value={val?.tenYear != null ? `${val.tenYear.toFixed(2)}%` : "—"} />
          </div>
        </div>

        {/* ── Holdings ─────────────────────────────────── */}
        <span style={LABEL}>Holdings</span>
        <table style={{ marginBottom: "20px" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th style={{ ...TH, textAlign: "left" }}>Ticker</th>
              <th style={{ ...TH, textAlign: "right" }}>Shares</th>
              <th style={{ ...TH, textAlign: "right" }}>Unit Cost</th>
              <th style={{ ...TH, textAlign: "right" }}>Live Price</th>
              <th style={{ ...TH, textAlign: "right" }}>Market Value</th>
              <th style={{ ...TH, textAlign: "right" }}>Weight</th>
              <th style={{ ...TH, textAlign: "right" }}>G/L</th>
              <th style={{ ...TH, textAlign: "right" }}>Graham No.</th>
              <th style={{ ...TH, textAlign: "right" }}>MoS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const livePrice = row.currentPrice ?? parseFloat(row.price) ?? 0;
              const cost      = row.unit_cost > 0 ? row.unit_cost : null;
              const value     = livePrice * (row.quantity || 0);
              const gl        = cost ? ((livePrice - cost) / cost) * 100 : null;
              const v         = valMap[row.ticker];
              return (
                <tr key={row.ticker} style={{ background: i % 2 === 1 ? "#fafafa" : "white", borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ ...TD, fontWeight: 700 }}>{row.ticker}</td>
                  <td style={TD_R}>{row.quantity || "—"}</td>
                  <td style={TD_R}>{cost ? money(cost) : "—"}</td>
                  <td style={TD_R}>{livePrice ? money(livePrice) : "—"}</td>
                  <td style={{ ...TD_R, fontWeight: 600 }}>{money(value)}</td>
                  <td style={TD_R}>{row.weight != null ? `${row.weight.toFixed(1)}%` : "—"}</td>
                  <td style={{ ...TD_R, fontWeight: 600, color: color(gl) }}>{gl != null ? pct(gl) : "—"}</td>
                  <td style={{ ...TD_R, color: GREEN }}>{v?.grahamValue ? money(v.grahamValue) : "—"}</td>
                  <td style={{ ...TD_R, fontWeight: 600, color: color(v?.marginOfSafety) }}>{v?.marginOfSafety != null ? pct(v.marginOfSafety) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f4f4f5", borderTop: "1.5px solid #d4d4d8" }}>
              <td style={{ ...TD, fontWeight: 700 }}>Total</td>
              <td colSpan={3} style={TD} />
              <td style={{ ...TD_R, fontWeight: 800 }}>{money(totalLiveValue)}</td>
              <td style={{ ...TD_R, fontWeight: 700 }}>100%</td>
              <td style={{ ...TD_R, fontWeight: 700, color: color(totalGLPct) }}>{totalGLPct != null ? pct(totalGLPct) : "—"}</td>
              <td colSpan={2} style={TD} />
            </tr>
          </tfoot>
        </table>

        {/* ── Periodic performance ─────────────────────── */}
        <span style={LABEL}>Periodic Returns</span>
        <table style={{ marginBottom: "20px" }}>
          <thead>
            <tr style={{ background: "#f4f4f5" }}>
              <th style={{ ...TH, textAlign: "left" }}>Ticker</th>
              {PERIODS.map((p) => <th key={p.key} style={{ ...TH, textAlign: "right" }}>{p.label}</th>)}
              <th style={{ ...TH, textAlign: "right" }}>Since Purchase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.ticker} style={{ background: i % 2 === 1 ? "#fafafa" : "white", borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ ...TD, fontWeight: 700 }}>{row.ticker}</td>
                {PERIODS.map(({ key }) => {
                  const v = row.perf?.[key] ?? null;
                  return <td key={key} style={{ ...TD_R, color: color(v), fontWeight: v != null ? 600 : 400 }}>{v != null ? pct(v) : "—"}</td>;
                })}
                <td style={{ ...TD_R, color: color(row.unitReturn), fontWeight: row.unitReturn != null ? 600 : 400 }}>
                  {row.unitReturn != null ? pct(row.unitReturn) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: "#fffbeb", borderTop: "1.5px solid #fde68a" }}>
              <td style={{ ...TD, fontWeight: 700, color: "#92400e" }}>SPY</td>
              {PERIODS.map(({ key }) => {
                const v = spy?.[key] ?? null;
                return <td key={key} style={{ ...TD_R, color: color(v), fontWeight: v != null ? 600 : 400 }}>{v != null ? pct(v) : "—"}</td>;
              })}
              <td style={TD_R} />
            </tr>
          </tfoot>
        </table>

        {/* ── Disclaimer ───────────────────────────────── */}
        <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: "10px", marginTop: "4px" }}>
          <p style={{ fontSize: "8px", color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: "#71717a" }}>Disclosure:</strong> This document is generated for personal informational purposes only and does not constitute investment advice, a solicitation, or an offer to buy or sell any security. All data is sourced from publicly available information (Finviz, FRED) and is provided without warranty of accuracy or completeness. Graham Number estimates are based on trailing twelve-month EPS and book value per share. Past performance does not guarantee future results. Since-inception performance uses unit costs where available; otherwise stored prices at time of addition are used as a proxy.
          </p>
          <p style={{ fontSize: "8px", color: "#d4d4d8", marginTop: "6px" }}>
            vpfund &nbsp;·&nbsp; Generated {dateStr}
          </p>
        </div>

      </div>

      {/* ── Page 2: Macro Environment ────────────────── */}
      {macro && (
        <div className="doc-page" style={{ ...DOC, background: "white", pageBreakBefore: "always", breakBefore: "page" }}>

          {/* Header bar — matches page 1 */}
          <div style={{ background: "#3730a3", padding: "12px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>
                Personal Investment Portfolio
              </div>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "white", letterSpacing: "0.01em" }}>
                Macro Environment
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>As of</div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "white" }}>{dateStr}</div>
            </div>
          </div>

          {/* Regime + rates grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", border: "1px solid #e4e4e7", marginBottom: "20px" }}>

            {/* Regime + rates */}
            <div style={{ padding: "12px 14px", borderRight: "1px solid #e4e4e7" }}>
              {(() => {
                const REGIME = {
                  "risk-on":  { label: "Risk-On",  color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
                  "neutral":  { label: "Neutral",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
                  "risk-off": { label: "Risk-Off", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
                };
                const r = REGIME[macro.regime] ?? REGIME["neutral"];
                return (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: r.bg, border: `1px solid ${r.border}`, borderRadius: "4px", padding: "3px 8px", marginBottom: "10px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: r.color, display: "inline-block" }} />
                    <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: r.color }}>
                      Market Regime: {r.label}
                    </span>
                  </div>
                );
              })()}
              <Row label="VIX" value={macro.vix != null ? macro.vix.toFixed(1) : "—"} valueColor={macro.vix == null ? MUTED : macro.vix < 18 ? GREEN : macro.vix > 25 ? RED : "#d97706"} />
              <Row label="10Y Treasury" value={macro.rates?.tenYear != null ? `${macro.rates.tenYear.toFixed(2)}%` : "—"} />
              <Row label="2Y Treasury"  value={macro.rates?.twoYear  != null ? `${macro.rates.twoYear.toFixed(2)}%`  : "—"} />
              <Row label="Fed Funds"    value={macro.rates?.fedFunds != null ? `${macro.rates.fedFunds.toFixed(2)}%`  : "—"} />
            </div>

            {/* Yield curve + spreads */}
            <div style={{ padding: "12px 14px" }}>
              <Row
                label="Yield Curve (10Y−2Y)"
                value={macro.rates?.yieldCurve != null ? `${macro.rates.yieldCurve > 0 ? "+" : ""}${macro.rates.yieldCurve.toFixed(2)}%` : "—"}
                valueColor={macro.rates?.isInverted ? RED : GREEN}
                bold
              />
              {macro.rates?.isInverted && (
                <div style={{ fontSize: "9px", color: RED, marginBottom: "8px" }}>Curve inverted — historically precedes recession</div>
              )}
              <Row label="IG Credit Spread" value={macro.spreads?.ig != null ? `${macro.spreads.ig.toFixed(2)}%` : "—"} valueColor={macro.spreads?.ig > 2 ? RED : macro.spreads?.ig > 1.2 ? "#d97706" : GREEN} />
              <Row label="HY Credit Spread" value={macro.spreads?.hy != null ? `${macro.spreads.hy.toFixed(2)}%` : "—"} valueColor={macro.spreads?.hy > 6 ? RED : macro.spreads?.hy > 4 ? "#d97706" : GREEN} />
              <Row label="SPY vs MA200"      value={macro.spy?.sma200 != null ? `${macro.spy.sma200 > 0 ? "+" : ""}${macro.spy.sma200.toFixed(1)}%` : "—"} valueColor={macro.spy?.aboveMA200 ? GREEN : RED} />
            </div>
          </div>

          {/* Sector performance table */}
          {macro.sectors?.length > 0 && (
            <>
              <span style={LABEL}>Sector ETF Performance</span>
              <table style={{ marginBottom: "20px" }}>
                <thead>
                  <tr style={{ background: "#f4f4f5" }}>
                    <th style={{ ...TH, textAlign: "left" }}>Sector</th>
                    <th style={{ ...TH, textAlign: "right" }}>1W</th>
                    <th style={{ ...TH, textAlign: "right" }}>1M</th>
                    <th style={{ ...TH, textAlign: "right" }}>YTD</th>
                    <th style={{ ...TH, textAlign: "right" }}>vs MA200</th>
                  </tr>
                </thead>
                <tbody>
                  {[...macro.sectors]
                    .sort((a, b) => (b.perfYTD ?? -Infinity) - (a.perfYTD ?? -Infinity))
                    .map((s, i) => (
                      <tr key={s.symbol} style={{ background: i % 2 === 1 ? "#fafafa" : "white", borderBottom: "1px solid #f0f0f0" }}>
                        <td style={{ ...TD, fontWeight: 600 }}>{s.symbol} <span style={{ fontWeight: 400, color: "#71717a", fontSize: "10px" }}>{s.name}</span></td>
                        <td style={{ ...TD_R, color: color(s.perfWeek) }}>{s.perfWeek != null ? pct(s.perfWeek) : "—"}</td>
                        <td style={{ ...TD_R, color: color(s.perfMonth) }}>{s.perfMonth != null ? pct(s.perfMonth) : "—"}</td>
                        <td style={{ ...TD_R, fontWeight: 600, color: color(s.perfYTD) }}>{s.perfYTD != null ? pct(s.perfYTD) : "—"}</td>
                        <td style={{ ...TD_R, color: s.sma200 >= 0 ? GREEN : RED }}>{s.sma200 != null ? `${s.sma200 > 0 ? "+" : ""}${s.sma200.toFixed(1)}%` : "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}

        </div>
      )}
    </>
  );
}

function Row({ label, value, valueColor, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
      <span style={{ fontSize: "10px", color: "#71717a" }}>{label}</span>
      <span style={{ fontSize: "11px", fontWeight: bold ? 700 : 500, color: valueColor ?? "#0a0a0a", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}
