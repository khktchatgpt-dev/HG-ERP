/**
 * Bar chart SVG thuần cho dashboard (không lib, không state — render được từ
 * cả server lẫn client component). Theo dataviz spec: 1 series 1 hue
 * (#0284c7 sky-600 — pass validator cả light/dark), bar mỏng bo đầu, gap 2px,
 * nhãn giá trị CHỌN LỌC (chỉ cột max + cột cuối — không rải số mọi cột),
 * tooltip native qua <title>, trục/grid lặng (zinc nhạt), max=0 an toàn.
 */

export type MiniBar = { label: string; value: number; hint?: string }

export function MiniBarChart({
  data,
  height = 132,
  unit = '',
}: {
  data: MiniBar[]
  height?: number
  /** Hậu tố giá trị trong nhãn/tooltip, vd "sp". */
  unit?: string
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-zinc-400">Chưa có dữ liệu.</p>
  }

  const BAR_W = 34
  const GAP = 10
  const PAD_X = 6
  const LABEL_H = 16 // nhãn trục dưới
  const VALUE_H = 14 // chỗ cho nhãn giá trị trên đỉnh
  const width = PAD_X * 2 + data.length * BAR_W + (data.length - 1) * GAP
  const plotH = height - LABEL_H - VALUE_H
  const max = Math.max(...data.map((d) => d.value), 0)
  const maxIdx = data.findIndex((d) => d.value === max)
  const fmt = (n: number) => n.toLocaleString('vi-VN')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Biểu đồ cột"
    >
      {/* đường baseline lặng */}
      <line
        x1={0}
        y1={VALUE_H + plotH + 0.5}
        x2={width}
        y2={VALUE_H + plotH + 0.5}
        className="stroke-zinc-200 dark:stroke-zinc-800"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = max > 0 ? Math.round((d.value / max) * (plotH - 4)) : 0
        const x = PAD_X + i * (BAR_W + GAP)
        const y = VALUE_H + plotH - h
        // Nhãn giá trị chọn lọc: cột max + cột cuối (nếu > 0).
        const showValue = d.value > 0 && (i === maxIdx || i === data.length - 1)
        return (
          <g key={i}>
            <title>{`${d.hint ?? d.label}: ${fmt(d.value)}${unit ? ` ${unit}` : ''}`}</title>
            {/* hit target rộng hơn mark cho tooltip */}
            <rect
              x={x - GAP / 2}
              y={0}
              width={BAR_W + GAP}
              height={height}
              fill="transparent"
            />
            {d.value > 0 ? (
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={Math.max(h, 2)}
                rx={2}
                fill="#0284c7"
              />
            ) : (
              // cột 0: vệt mảnh để tuần trống vẫn hiện diện trên trục
              <rect
                x={x}
                y={VALUE_H + plotH - 2}
                width={BAR_W}
                height={2}
                rx={1}
                className="fill-zinc-200 dark:fill-zinc-800"
              />
            )}
            {showValue && (
              <text
                x={x + BAR_W / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px] font-medium tabular-nums dark:fill-zinc-400"
              >
                {fmt(d.value)}
              </text>
            )}
            <text
              x={x + BAR_W / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-zinc-400 text-[9px] dark:fill-zinc-500"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
