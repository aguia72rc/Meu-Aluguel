interface SparklineProps {
  data: number[];
  color: string;
  className?: string;
}

const WIDTH = 72;
const HEIGHT = 28;

export default function Sparkline({ data, color, className }: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = WIDTH / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = HEIGHT - ((v - min) / range) * (HEIGHT - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={className}
      aria-hidden="true"
    >
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={2.25} fill={color} />
    </svg>
  );
}
