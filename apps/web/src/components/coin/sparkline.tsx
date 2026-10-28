import { memo } from "react";

type Props = { data: number[]; width?: number; height?: number; className?: string };

/** Lightweight SVG sparkline; colour follows the 7d direction. */
export const Sparkline = memo(function Sparkline({
  data,
  width = 120,
  height = 36,
  className,
}: Props) {
  if (data.length < 2)
    return <svg width={width} height={height} className={className} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map(
    (v, i) =>
      `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`,
  );
  const up = data[data.length - 1]! >= data[0]!;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`7 day trend ${up ? "up" : "down"}`}
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={up ? "var(--up)" : "var(--down)"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
});
