import clsx from 'clsx';

type Props = {
  goalMin: number;
  suggestedMax: number;
  value: number;
  onChange: (next: number) => void;
  hasHistory: boolean;
  historyMin: number;
  historyMax: number;
  historyAvg: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function RangeBar({
  goalMin,
  suggestedMax,
  value,
  onChange,
  hasHistory,
  historyMin,
  historyMax,
  historyAvg,
}: Props) {
  const historySpan = hasHistory ? Math.max(1, historyMax - historyMin) : 1;
  const scaleMin = hasHistory ? Math.max(goalMin, Math.floor(historyMin - historySpan * 0.5)) : goalMin;
  const scaleMax = Math.max(
    suggestedMax,
    hasHistory ? Math.ceil(historyMax + historySpan * 0.6) : goalMin + 10,
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
    <div className="space-y-2">
      <div className="relative h-9">
        <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />

        {hasHistory && (
          <div
            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-emerald-300/90"
            style={{ left: `${historyLeft}%`, width: `${Math.max(2, historyRight - historyLeft)}%` }}
            title={`Historical range: ${Math.round(historyMin)}-${Math.round(historyMax)}`}
          />
        )}

        {hasHistory && (
          <div
            className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-slate-800"
            style={{ left: `${avgPct}%` }}
            title={`Historical avg: ${Math.round(historyAvg)}`}
          />
        )}

        <div
          className={clsx('absolute -top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white', hasHistory ? 'bg-emerald-700' : 'bg-slate-700')}
          style={{ left: `calc(${clamp(currentPct, 4, 96)}% - 13px)` }}
        >
          {safeValue}
        </div>

        <input
          aria-label="Drag to set goal"
          className="range-slider absolute left-0 right-0 top-1/2 h-8 -translate-y-1/2 bg-transparent"
          max={safeMax}
          min={scaleMin}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          step={1}
          type="range"
          value={safeValue}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Planning min {scaleMin}</span>
        {hasHistory ? <span>History {Math.round(historyMin)}-{Math.round(historyMax)}</span> : <span>No history band</span>}
        <span>Planning max {safeMax}</span>
      </div>
    </div>
  );
}
