import { useState } from "react";
import { formatCurrency } from "../utils/format";

export interface RevenuePoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
}

const WIDTH = 560;
const HEIGHT = 200;
const PADDING_LEFT = 44;
const PADDING_BOTTOM = 24;
const PADDING_TOP = 12;
const BAR_MAX_WIDTH = 24;

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const plotWidth = WIDTH - PADDING_LEFT - 12;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const slotWidth = plotWidth / data.length;
  const barWidth = Math.min(BAR_MAX_WIDTH, slotWidth * 0.5);

  function yFor(value: number) {
    return PADDING_TOP + plotHeight - (value / max) * plotHeight;
  }

  const ticks = [0, max * 0.5, max];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Gráfico de receita recebida por mês"
      >
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PADDING_LEFT}
              x2={WIDTH - 4}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text x={0} y={yFor(tick) + 4} fontSize={10} fill="#898781">
              {tick >= 1000 ? `${Math.round(tick / 1000)}k` : Math.round(tick)}
            </text>
          </g>
        ))}

        {data.map((point, i) => {
          const slotX = PADDING_LEFT + i * slotWidth;
          const barX = slotX + (slotWidth - barWidth) / 2;
          const barTop = yFor(point.value);
          const barHeight = Math.max(0, PADDING_TOP + plotHeight - barTop);
          const isHovered = hovered === i;
          return (
            <g key={i}>
              <rect
                x={barX}
                y={barTop}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={isHovered ? "#1c5cab" : "#2a78d6"}
                className="transition-colors"
              />
              <rect
                x={slotX}
                y={PADDING_TOP}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                onPointerEnter={() => setHovered(i)}
                onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered((h) => (h === i ? null : h))}
                tabIndex={0}
                aria-label={`${point.label}: ${formatCurrency(point.value)}`}
              />
              <text
                x={slotX + slotWidth / 2}
                y={HEIGHT - 6}
                fontSize={10}
                fill="#898781"
                textAnchor="middle"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full bg-ink text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{
            left: `${((PADDING_LEFT + hovered * slotWidth + slotWidth / 2) / WIDTH) * 100}%`,
            top: `${(yFor(data[hovered].value) / HEIGHT) * 100}%`,
            marginTop: -8,
          }}
        >
          <span className="font-semibold">{formatCurrency(data[hovered].value)}</span>
          <span className="text-white/70 ml-1">{data[hovered].label}</span>
        </div>
      )}
    </div>
  );
}
