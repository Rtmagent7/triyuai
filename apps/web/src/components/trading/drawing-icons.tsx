/**
 * TRIYUAI drawing-tool icon set. House style: 24 px grid, 1.7 px rounded strokes,
 * anchor points drawn as solid "nodes" (like a constellation) and shapes with a
 * soft duotone fill. Everything uses currentColor, so icons follow button state.
 */
import type { SVGProps } from "react";
import type { DrawingTool } from "@/lib/ta/drawings";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

/** Anchor node: the signature of the set. */
const N = ({ x, y, r = 2.3 }: { x: number; y: number; r?: number }) => (
  <circle cx={x} cy={y} r={r} fill="currentColor" stroke="none" />
);
/** Soft duotone fill. */
const soft = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;

export const ICONS: Record<DrawingTool, () => React.ReactElement> = {
  cursor: () => (
    <Svg>
      <path d="M6 4.5 18 11l-5.2 1.6L10.6 18Z" fill="currentColor" fillOpacity={0.16} />
      <path d="m13 13 4 4" />
    </Svg>
  ),
  trendline: () => (
    <Svg>
      <path d="M5.5 17.5 18.5 6.5" />
      <N x={5.5} y={17.5} />
      <N x={18.5} y={6.5} />
    </Svg>
  ),
  ray: () => (
    <Svg>
      <path d="M5 18 21 4.5" />
      <path d="M17.5 4.5H21V8" />
      <N x={5} y={18} />
      <N x={11.5} y={12.5} r={1.8} />
    </Svg>
  ),
  extended: () => (
    <Svg>
      <path d="M2.5 19.5 21.5 4.5" strokeDasharray="0.1 0" />
      <N x={8.5} y={14.7} />
      <N x={15.5} y={9.2} />
    </Svg>
  ),
  arrow: () => (
    <Svg>
      <path d="M5 18.5 18 6" />
      <path d="M11.5 5.5H18.5V12.5" />
      <N x={5} y={18.5} />
    </Svg>
  ),
  hline: () => (
    <Svg>
      <path d="M2.5 12h19" />
      <N x={12} y={12} />
      <path d="M2.5 17.5h5M16.5 17.5h5" strokeOpacity={0.35} />
    </Svg>
  ),
  hray: () => (
    <Svg>
      <path d="M6 12h15.5" />
      <path d="m18.5 9 3 3-3 3" />
      <N x={6} y={12} />
    </Svg>
  ),
  vline: () => (
    <Svg>
      <path d="M12 2.5v19" />
      <N x={12} y={12} />
      <path d="M6.5 2.5v5M6.5 16.5v5" strokeOpacity={0.35} />
    </Svg>
  ),
  crossline: () => (
    <Svg>
      <path d="M2.5 12h19M12 2.5v19" />
      <circle cx={12} cy={12} r={3.4} fill="currentColor" fillOpacity={0.16} stroke="none" />
      <N x={12} y={12} />
    </Svg>
  ),
  channel: () => (
    <Svg>
      <path d="M3.5 15 20.5 6.5V12L3.5 20.5Z" {...soft} />
      <path d="M3.5 15 20.5 6.5M3.5 20.5 20.5 12" />
      <N x={3.5} y={15} />
      <N x={20.5} y={6.5} />
      <N x={12} y={16.3} r={1.8} />
    </Svg>
  ),
  fib: () => (
    <Svg>
      <path d="M4 4.5h16v5H4z" {...soft} />
      <path d="M4 14.5h16v5H4z" fill="currentColor" fillOpacity={0.08} stroke="none" />
      <path d="M4 4.5h16M4 9.5h16M4 14.5h16M4 19.5h16" />
      <path d="M5.5 19.5 18.5 4.5" strokeDasharray="1.6 2.6" strokeOpacity={0.7} />
    </Svg>
  ),
  fibext: () => (
    <Svg>
      <path d="M3.5 18 8.5 8 12 13.5" />
      <path d="M14 4h7.5M14 9h7.5M14 14h7.5" strokeOpacity={0.6} />
      <path d="M14 4h7.5v5H14z" {...soft} />
      <N x={3.5} y={18} />
      <N x={8.5} y={8} />
      <N x={12} y={13.5} />
    </Svg>
  ),
  fibtime: () => (
    <Svg>
      <path d="M4 4v16M7 4v16M10 4v16M14 4v16M20.5 4v16" />
      <path d="M14 4h6.5v16H14z" {...soft} />
      <N x={4} y={20} r={1.9} />
    </Svg>
  ),
  rect: () => (
    <Svg>
      <rect x={4} y={6} width={16} height={12} rx={2.5} fill="currentColor" fillOpacity={0.16} />
      <N x={4} y={6} />
      <N x={20} y={18} />
    </Svg>
  ),
  ellipse: () => (
    <Svg>
      <ellipse cx={12} cy={12} rx={8.5} ry={6} fill="currentColor" fillOpacity={0.16} />
      <N x={20.5} y={12} />
    </Svg>
  ),
  triangle: () => (
    <Svg>
      <path d="M12 4.5 20.5 19H3.5Z" fill="currentColor" fillOpacity={0.16} />
      <N x={12} y={4.5} />
      <N x={20.5} y={19} />
      <N x={3.5} y={19} />
    </Svg>
  ),
  path: () => (
    <Svg>
      <path d="M3.5 17 8.5 9l5 6 7-10" />
      <N x={3.5} y={17} />
      <N x={8.5} y={9} />
      <N x={13.5} y={15} />
      <N x={20.5} y={5} />
    </Svg>
  ),
  brush: () => (
    <Svg>
      <path d="M3.5 16.5c2.5-4 4.5-4 6 0s3.5 4 5.5 0 3.5-6 5.5-8" strokeWidth={2.1} />
      <N x={20.5} y={8.5} r={1.8} />
    </Svg>
  ),
  text: () => (
    <Svg>
      <path d="M5.5 7V5h13v2M12 5v14M9 19h6" />
      <path d="M17.5 13v6" strokeOpacity={0.45} />
    </Svg>
  ),
  callout: () => (
    <Svg>
      <path
        d="M8.5 4h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5H13l-4 3.5V13h-.5A1.5 1.5 0 0 1 7 11.5v-6A1.5 1.5 0 0 1 8.5 4Z"
        fill="currentColor"
        fillOpacity={0.16}
      />
      <path d="M10.5 7.5h6M10.5 10h4" />
      <N x={4} y={20} />
      <path d="M4 20 8.5 16.5" strokeOpacity={0.6} />
    </Svg>
  ),
  pricelabel: () => (
    <Svg>
      <path d="M3.5 12 8 6.5h12.5v11H8Z" fill="currentColor" fillOpacity={0.16} />
      <N x={8.5} y={12} r={1.8} />
      <path d="M12 12h5.5" />
    </Svg>
  ),
  markup: () => (
    <Svg>
      <path d="M12 4 19.5 13H15v7H9v-7H4.5Z" fill="currentColor" fillOpacity={0.16} />
    </Svg>
  ),
  markdown: () => (
    <Svg>
      <path d="M12 20 4.5 11H9V4h6v7h4.5Z" fill="currentColor" fillOpacity={0.16} />
    </Svg>
  ),
  pricerange: () => (
    <Svg>
      <path d="M6 4.5h12v15H6z" {...soft} />
      <path d="M6 4.5h12M6 19.5h12M12 7.5v9" />
      <path d="m9.5 10 2.5-2.5 2.5 2.5M9.5 14l2.5 2.5 2.5-2.5" />
    </Svg>
  ),
  daterange: () => (
    <Svg>
      <path d="M4.5 6h15v12h-15z" {...soft} />
      <path d="M4.5 6v12M19.5 6v12M7.5 12h9" />
      <path d="m10 9.5-2.5 2.5 2.5 2.5M14 9.5l2.5 2.5-2.5 2.5" />
    </Svg>
  ),
  measure: () => (
    <Svg>
      <path d="M4 20 20 4" />
      <path d="M4 20V9.5M4 20h10.5" strokeOpacity={0.45} />
      <path d="M7.5 16.5 9 18M10.5 13.5l1.5 1.5M13.5 10.5 15 12" />
      <N x={4} y={20} />
      <N x={20} y={4} />
    </Svg>
  ),
  long: () => (
    <Svg>
      <rect
        x={4}
        y={4}
        width={16}
        height={8}
        rx={1.5}
        fill="var(--up)"
        fillOpacity={0.3}
        stroke="none"
      />
      <rect
        x={4}
        y={12}
        width={16}
        height={7.5}
        rx={1.5}
        fill="var(--down)"
        fillOpacity={0.22}
        stroke="none"
      />
      <path d="M4 12h16" />
      <path d="m9 8.5 3-2.5 3 2.5" stroke="var(--up)" />
      <N x={4} y={12} />
    </Svg>
  ),
  short: () => (
    <Svg>
      <rect
        x={4}
        y={4.5}
        width={16}
        height={7.5}
        rx={1.5}
        fill="var(--down)"
        fillOpacity={0.22}
        stroke="none"
      />
      <rect
        x={4}
        y={12}
        width={16}
        height={8}
        rx={1.5}
        fill="var(--down)"
        fillOpacity={0.3}
        stroke="none"
      />
      <path d="M4 12h16" />
      <path d="m9 15.5 3 2.5 3-2.5" stroke="var(--down)" />
      <N x={4} y={12} />
    </Svg>
  ),
};

export function ToolIcon({ tool }: { tool: DrawingTool }) {
  const Icon = ICONS[tool];
  return <Icon />;
}

/* ---------- utility icons for the drawing rail ---------- */

export const MagnetIcon = () => (
  <Svg>
    <path d="M6 4.5v7a6 6 0 0 0 12 0v-7" />
    <path d="M6 4.5h3.5v7a2.5 2.5 0 0 0 5 0v-7H18" />
    <path d="M6 8h3.5M14.5 8H18" strokeOpacity={0.5} />
    <N x={12} y={20.5} r={1.4} />
  </Svg>
);

/** Keep drawing: a pencil inside a repeat loop. */
export const KeepDrawingIcon = () => (
  <Svg>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v4h-4" />
    <path d="m9.5 15 1-3 4-4 2 2-4 4Z" fill="currentColor" fillOpacity={0.16} />
  </Svg>
);

export const EyeIcon = ({ off }: { off?: boolean }) => (
  <Svg>
    <path
      d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
      fill="currentColor"
      fillOpacity={0.12}
    />
    <N x={12} y={12} r={2.6} />
    {off && <path d="m4 20 16-16" strokeWidth={2} />}
  </Svg>
);

export const LockIcon = ({ open }: { open?: boolean }) => (
  <Svg>
    <rect x={5} y={10.5} width={14} height={10} rx={2.5} fill="currentColor" fillOpacity={0.16} />
    <path d={open ? "M8 10.5V7.5a4 4 0 0 1 7.6-1.7" : "M8 10.5V7.5a4 4 0 0 1 8 0v3"} />
    <N x={12} y={15.5} r={1.6} />
  </Svg>
);

export const TrashIcon = () => (
  <Svg>
    <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2" />
    <path d="M6.5 6.5 7.5 20h9l1-13.5" fill="currentColor" fillOpacity={0.12} />
    <path d="M10.5 10.5v6M13.5 10.5v6" />
  </Svg>
);

export const SparkCleanIcon = () => (
  <Svg>
    <path d="m6 18 9-9 3 3-9 9H6Z" fill="currentColor" fillOpacity={0.16} />
    <path d="M14 4.5v3M12.5 6h3M19 7v2M18 8h2" />
  </Svg>
);
