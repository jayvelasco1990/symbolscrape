interface Props {
  price: string;
  fairValue: string;
  formula?: string;
  note?: string;
}

function parseNum(s: string) {
  return parseFloat(s.replace(/[^0-9.-]/g, "")) || 0;
}

export default function IntrinsicValue({ price, fairValue, formula, note }: Props) {
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
            {priceNum ? `$${priceNum.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Graham Number</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {fairValue ? `$${fairValue}` : "—"}
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
              Graham Number {fairValue ? `$${fairValue}` : ""}
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
    </div>
  );
}
