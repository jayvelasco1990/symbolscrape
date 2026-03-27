interface Props {
  price: string;
  fairValue: string;
  formula?: string;
  note?: string;
  netCashPerShare?: string;
}

function parseNum(s: string) {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IntrinsicValue({ price, fairValue, formula, note, netCashPerShare }: Props) {
  const hasAny = price || fairValue;
  if (!hasAny) return null;

  const priceNum = parseNum(price);
  const fair = parseNum(fairValue);
  const mosRaw = fair && priceNum ? ((fair - priceNum) / fair) * 100 : null;

  const isUndervalued = mosRaw !== null && mosRaw > 0;
  const isOvervalued = mosRaw !== null && mosRaw < 0;

  const mosColor = isUndervalued
    ? "text-emerald-600 dark:text-emerald-400"
    : isOvervalued
    ? "text-red-500 dark:text-red-400"
    : "text-zinc-500";

  const badgeBg = isUndervalued
    ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
    : isOvervalued
    ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
    : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700";

  let barPercent: number | null = null;
  if (priceNum && fair) {
    barPercent = Math.min(Math.max((priceNum / fair) * 100, 0), 200);
  }

  return (
    <div className={`rounded-xl border p-5 ${badgeBg}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Intrinsic Value
        </h3>
        {formula && (
          <p className="text-xs text-zinc-400 mt-0.5">{formula}</p>
        )}
        <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
          The Graham Number, developed by Benjamin Graham, estimates the maximum fair price for a stock based on earnings and book value. A stock trading below this number is considered undervalued by conservative standards.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Stock Price</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {priceNum ? `$${fmt(priceNum)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Graham Number</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {fairValue ? `$${fmt(parseNum(fairValue))}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Margin of Safety</p>
          <p className={`text-xl font-bold ${mosColor}`}>
            {mosRaw !== null
              ? `${mosRaw >= 0 ? "+" : ""}${mosRaw.toFixed(1)}%`
              : "—"}
          </p>
        </div>
      </div>

      {note && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 pb-2">{note}</p>
      )}

      {barPercent !== null && (
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>$0</span>
            <span className="font-medium text-zinc-500 dark:text-zinc-400">
              Graham Number {fair ? `$${fmt(fair)}` : ""}
            </span>
          </div>
          <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-400 dark:bg-zinc-500 z-10" />
            <div
              className={`absolute top-0 bottom-0 left-0 rounded-full transition-all ${
                isUndervalued ? "bg-emerald-500" : "bg-red-500"
              }`}
              style={{ width: `${Math.min(barPercent / 2, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mt-1">
            <span>{isUndervalued ? "Undervalued" : isOvervalued ? "Overvalued" : ""}</span>
            <span>{priceNum ? `Current $${priceNum.toFixed(2)}` : ""}</span>
          </div>
        </div>
      )}

      {netCashPerShare && (() => {
        const nc = parseNum(netCashPerShare);
        const isNetNet = priceNum > 0 && nc > 0 && priceNum < nc;
        const isPositive = nc > 0;
        // bar: show price relative to nc (anchored at 0)
        const maxVal = Math.max(Math.abs(nc) * 1.5, priceNum * 1.2, 1);
        const ncBarPct  = Math.min(Math.max((nc / maxVal) * 100, 0), 100);
        const priceBarPct = Math.min(Math.max((priceNum / maxVal) * 100, 0), 100);

        const containerCls = isNetNet
          ? "mt-4 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 p-3"
          : isPositive
          ? "mt-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3"
          : "mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 p-3";

        const valueCls = isNetNet
          ? "text-2xl font-bold text-emerald-600 dark:text-emerald-400"
          : isPositive
          ? "text-2xl font-bold text-zinc-900 dark:text-zinc-50"
          : "text-2xl font-bold text-red-500 dark:text-red-400";

        const label = isNetNet
          ? "Stock trades below net cash — rare Graham net-net opportunity"
          : isPositive
          ? "Cash surplus after all debt — balance sheet is self-funding"
          : "Debt exceeds cash — net cash position is negative";

        return (
          <div className={containerCls}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Net Cash / Share
              </p>
              {isNetNet && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
                  NET-NET
                </span>
              )}
            </div>
            <div className="flex items-end gap-3 mt-0.5 mb-1">
              <p className={valueCls}>
                {nc >= 0 ? "$" : "−$"}{fmt(Math.abs(nc))}
              </p>
              {priceNum > 0 && (() => {
                const ncPct = (nc / priceNum) * 100;
                const tier =
                  ncPct >= 100 ? { label: "Net-Net",        cls: "bg-emerald-500 text-white" } :
                  ncPct >= 30  ? { label: "Strong cushion",  cls: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" } :
                  ncPct >= 0   ? { label: "Healthy surplus", cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300" } :
                  ncPct >= -30 ? { label: "Modest net debt", cls: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" } :
                                 { label: "High net debt",   cls: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" };
                return (
                  <span className={`mb-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${tier.cls}`}>
                    {tier.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{label}</p>
            {/* Price vs Net Cash bar */}
            <div className="relative mb-1" style={{ paddingTop: "18px" }}>
              {/* Stock price label above the line */}
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${priceBarPct}%` }}
              >
                <span className={`text-[10px] font-semibold whitespace-nowrap ${isNetNet ? "text-emerald-700 dark:text-emerald-300" : isPositive ? "text-indigo-500 dark:text-indigo-400" : "text-red-500"}`}>
                  Stock Price
                </span>
              </div>
              <div className="relative h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                {isPositive && (
                  <div
                    className={`absolute top-0 bottom-0 left-0 rounded-full ${isNetNet ? "bg-emerald-400" : "bg-zinc-400 dark:bg-zinc-500"}`}
                    style={{ width: `${ncBarPct}%` }}
                  />
                )}
                <div
                  className={`absolute top-0 bottom-0 w-1 -translate-x-1/2 ${isNetNet ? "bg-emerald-700 dark:bg-emerald-300" : isPositive ? "bg-indigo-500" : "bg-red-500"}`}
                  style={{ left: `${priceBarPct}%` }}
                />
              </div>
            </div>
            {/* Benchmark scale */}
            <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/60">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1.5">Benchmark · Net Cash as % of Price</p>
              <div className="flex items-center gap-0 rounded-full overflow-hidden h-1.5 mb-1.5">
                <div className="flex-1 bg-red-400" />
                <div className="flex-1 bg-amber-300" />
                <div className="flex-1 bg-zinc-300 dark:bg-zinc-600" />
                <div className="flex-1 bg-emerald-300" />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>High debt</span>
                <span>Modest debt</span>
                <span className="font-medium text-zinc-500 dark:text-zinc-400">0%</span>
                <span>&gt;30% Strong</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">&gt;100% Net-Net</span>
              </div>
              {priceNum > 0 && (
                <p className={`text-[10px] mt-1.5 font-semibold ${
                  nc / priceNum >= 1    ? "text-emerald-600 dark:text-emerald-400" :
                  nc / priceNum >= 0.3  ? "text-emerald-500" :
                  nc / priceNum >= 0    ? "text-zinc-500 dark:text-zinc-400" :
                  nc / priceNum >= -0.3 ? "text-amber-600 dark:text-amber-400" :
                                          "text-red-500"
                }`}>
                  {((nc / priceNum) * 100).toFixed(1)}% of stock price
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
