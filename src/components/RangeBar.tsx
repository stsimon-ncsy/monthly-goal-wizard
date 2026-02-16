import clsx from 'clsx';

type Props = {
  min: number;
  max: number;
  avg: number;
};

export function RangeBar({ min, max, avg }: Props) {
  const span = Math.max(1, max - min);
  const avgPos = ((avg - min) / span) * 100;

  return (
    <div className="space-y-1">
      <div className="relative h-3 rounded-full bg-slate-200">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-gradient-to-r from-amber-200 via-emerald-200 to-teal-300" />
        <div
          className={clsx(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow',
          )}
          style={{ left: `calc(${Math.min(95, Math.max(5, avgPos))}% - 8px)` }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>Min {Math.round(min)}</span>
        <span>Avg {Math.round(avg)}</span>
        <span>Max {Math.round(max)}</span>
      </div>
    </div>
  );
}
