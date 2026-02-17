type Props = {
  goalMin: number;
  value: number;
  onChange: (next: number) => void;
  hasHistory: boolean;
  historyMin: number;
  historyMax: number;
  historyAvg: number;
  accentColor: string;
  accentSoftColor: string;
  accentStrongColor: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function RangeBar({
  goalMin,
  value,
  onChange,
  hasHistory,
  historyMin,
  historyMax,
  historyAvg,
  accentColor,
  accentSoftColor,
  accentStrongColor,
}: Props) {
  const historySpan = hasHistory ? Math.max(1, historyMax - historyMin) : 1;
  const scaleMin = hasHistory ? Math.max(goalMin, Math.floor(historyMin - historySpan * 0.35)) : goalMin;
  const scaleMax = Math.max(
    hasHistory ? Math.ceil(historyMax * 2) : goalMin + 10,
    value + 2,
    goalMin + 5,
  );
  const safeMax = Math.max(scaleMin + 1, scaleMax);
  const safeValue = clamp(value, scaleMin, safeMax);

  const toPercent = (target: number): number => ((target - scaleMin) / (safeMax - scaleMin)) * 100;

  const currentPct = toPercent(safeValue);
  const historyLeft = hasHistory ? clamp(toPercent(historyMin), 0, 100) : 0;
  const historyRight = hasHistory ? clamp(toPercent(historyMax), 0, 100) : 0;
  const avgPct = hasHistory ? clamp(toPercent(historyAvg), 0, 100) : 0;

  return (
    <div className="space-y-3">
      <div className="relative h-12">
        <div className="absolute left-0 right-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-slate-200" />

        {hasHistory && (
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full"
            style={{ left: `${historyLeft}%`, width: `${Math.max(2, historyRight - historyLeft)}%`, backgroundColor: accentSoftColor }}
            title={`Historical range: ${Math.round(historyMin)}-${Math.round(historyMax)}`}
          />
        )}

        {hasHistory && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2"
            style={{ left: `${avgPct}%`, backgroundColor: accentStrongColor }}
            title={`Historical avg: ${Math.round(historyAvg)}`}
          />
        )}

        <div
          className="absolute -top-1 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
          style={{ left: `calc(${clamp(currentPct, 4, 96)}% - 13px)`, backgroundColor: hasHistory ? accentColor : '#334155' }}
        >
          {safeValue}
        </div>

        <input
          aria-label="Drag to set goal"
          className="range-slider absolute left-0 right-0 top-1/2 h-10 -translate-y-1/2 bg-transparent"
          style={{ '--slider-thumb': accentColor } as Record<string, string>}
          max={safeMax}
          min={scaleMin}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step={1}
          type="range"
          value={safeValue}
        />
      </div>

      {hasHistory && <p className="text-sm text-slate-600">Historical band: {Math.round(historyMin)}-{Math.round(historyMax)}</p>}
    </div>
  );
}
