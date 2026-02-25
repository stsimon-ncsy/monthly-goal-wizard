type Props = {
  values: number[];
  color: string;
};

export function Sparkline({ values, color }: Props) {
  if (values.length < 2) {
    return <div className="h-8 w-20 rounded bg-slate-100" />;
  }

  const width = 88;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 6) + 3;
      const y = height - 3 - ((value - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastPoint = points.split(' ').slice(-1)[0]?.split(',') ?? ['0', '0'];

  return (
    <svg aria-hidden="true" className="h-8 w-[5.5rem]" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} fill={color} r="2.8" />
    </svg>
  );
}
