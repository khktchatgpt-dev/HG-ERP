'use client'

/**
 * Vẽ phương án xếp cont dạng 3D trên <canvas> (chiếu trục đo, không cần lib).
 * Kéo chuột để xoay, lăn chuột để zoom, nhấn đúp để đặt lại góc nhìn.
 *
 * Hiệu năng: góc nhìn giữ trong ref + vẽ lại qua requestAnimationFrame → KHÔNG
 * re-render React khi kéo chuột; canvas chỉ đổi kích thước khi thật sự thay đổi.
 */

import { useCallback, useEffect, useRef } from 'react'
import type { ContainerLoad, Placement } from '@/lib/loadcont/types'
import { doorZoneFor } from '@/lib/loadcont/types'

/** Bảng màu phân biệt loại kiện — parent gán màu theo itemId. */
export const ITEM_COLORS = [
  '#38bdf8', // sky
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f472b6', // pink
  '#f87171', // red-ish
  '#60a5fa', // blue
  '#4ade80', // green
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#c084fc', // purple
  '#facc15', // yellow
] as const

type Props = {
  container: ContainerLoad
  colors: Record<string, string>
  /** Chỉ vẽ các kiện có order ≤ maxOrder (mô phỏng thứ tự xếp). */
  maxOrder: number
  /** itemId đang được chọn ở legend — các loại khác mờ đi. */
  highlightId?: string | null
}

type Vec3 = [number, number, number]

function shade(hex: string, factor: number, alpha = 1): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) * factor))
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) * factor))
  const b = Math.min(255, Math.round((n & 0xff) * factor))
  return `rgba(${r},${g},${b},${alpha})`
}

// 6 mặt hộp: pháp tuyến + 4 đỉnh từ (x,y,z,l,w,h).
const FACES: { n: Vec3; pts: (p: Placement) => Vec3[] }[] = [
  {
    n: [0, 0, 1],
    pts: (p) => [
      [p.x, p.y, p.z + p.h],
      [p.x + p.l, p.y, p.z + p.h],
      [p.x + p.l, p.y + p.w, p.z + p.h],
      [p.x, p.y + p.w, p.z + p.h],
    ],
  },
  {
    n: [0, 0, -1],
    pts: (p) => [
      [p.x, p.y, p.z],
      [p.x + p.l, p.y, p.z],
      [p.x + p.l, p.y + p.w, p.z],
      [p.x, p.y + p.w, p.z],
    ],
  },
  {
    n: [1, 0, 0],
    pts: (p) => [
      [p.x + p.l, p.y, p.z],
      [p.x + p.l, p.y + p.w, p.z],
      [p.x + p.l, p.y + p.w, p.z + p.h],
      [p.x + p.l, p.y, p.z + p.h],
    ],
  },
  {
    n: [-1, 0, 0],
    pts: (p) => [
      [p.x, p.y, p.z],
      [p.x, p.y + p.w, p.z],
      [p.x, p.y + p.w, p.z + p.h],
      [p.x, p.y, p.z + p.h],
    ],
  },
  {
    n: [0, 1, 0],
    pts: (p) => [
      [p.x, p.y + p.w, p.z],
      [p.x + p.l, p.y + p.w, p.z],
      [p.x + p.l, p.y + p.w, p.z + p.h],
      [p.x, p.y + p.w, p.z + p.h],
    ],
  },
  {
    n: [0, -1, 0],
    pts: (p) => [
      [p.x, p.y, p.z],
      [p.x + p.l, p.y, p.z],
      [p.x + p.l, p.y, p.z + p.h],
      [p.x, p.y, p.z + p.h],
    ],
  },
]

const DEFAULT_VIEW = { yaw: -0.55, pitch: 0.5, zoom: 1 }

export function ContainerView3D({ container, colors, maxOrder, highlightId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useRef({ ...DEFAULT_VIEW })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const props = useRef({ container, colors, maxOrder, highlightId })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const cw = wrap.clientWidth
    const ch = wrap.clientHeight
    if (!cw || !ch) return
    const sz = size.current
    if (sz.w !== cw || sz.h !== ch || sz.dpr !== dpr) {
      canvas.width = cw * dpr
      canvas.height = ch * dpr
      canvas.style.width = `${cw}px`
      canvas.style.height = `${ch}px`
      size.current = { w: cw, h: ch, dpr }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cw, ch)

    const { container, colors, maxOrder, highlightId } = props.current
    const { yaw, pitch, zoom } = view.current
    const { spec } = container
    const cx = spec.length / 2
    const cy = spec.width / 2
    const cz = spec.height / 2
    const cosT = Math.cos(yaw)
    const sinT = Math.sin(yaw)
    const cosP = Math.cos(pitch)
    const sinP = Math.sin(pitch)

    const project = ([x, y, z]: Vec3): { sx: number; sy: number; d: number } => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const xr = dx * cosT - dy * sinT
      const yr = dx * sinT + dy * cosT
      return { sx: xr, sy: -(yr * sinP + dz * cosP), d: yr * cosP - dz * sinP }
    }
    const rotNormal = ([nx, ny, nz]: Vec3): Vec3 => [
      nx * cosT - ny * sinT,
      nx * sinT + ny * cosT,
      nz,
    ]
    const facingDot = (n: Vec3) => {
      const [, ry, rz] = rotNormal(n)
      return ry * cosP - rz * sinP
    }

    // Fit khung nhìn CỐ ĐỊNH (không đổi theo góc XOAY) để mô hình không phóng
    // to/thu nhỏ/nhảy tâm khi xoay (gây cảm giác méo). Bề ngang tối đa của cont
    // khi xoay quanh trục đứng = đường chéo đáy; bề dọc = chéo đáy·|sinP| + cao·|cosP|.
    // Tâm cont luôn chiếu về gốc nên đặt gốc ở giữa canvas — không cần recenter.
    const diag = Math.hypot(spec.length, spec.width)
    const spanX = diag
    const spanY = diag * Math.abs(sinP) + spec.height * Math.abs(cosP)
    const scale = Math.min(cw / (spanX || 1), ch / (spanY || 1)) * 0.82 * zoom
    const ox = cw / 2
    const oy = ch / 2
    const S = ({ sx, sy }: { sx: number; sy: number }) => ({
      x: sx * scale + ox,
      y: sy * scale + oy,
    })

    const path = (pts: Vec3[]) => {
      ctx.beginPath()
      pts.forEach((pt, i) => {
        const { x, y } = S(project(pt))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
    }

    // ── Vách sau + sàn cont (mặt quay lưng về camera) ──
    const contBox = {
      x: 0,
      y: 0,
      z: 0,
      l: spec.length,
      w: spec.width,
      h: spec.height,
    } as Placement
    for (const f of FACES) {
      const isFloor = f.n[2] === -1
      if (facingDot(f.n) > 0.001 || isFloor) {
        path(f.pts(contBox))
        ctx.fillStyle = isFloor ? 'rgba(148,163,184,0.18)' : 'rgba(148,163,184,0.08)'
        ctx.fill()
      }
    }

    // Vùng cửa: chỉ hiện khi cửa CHƯA bị xếp đè (chế độ an toàn). Nhồi tối đa lấp
    // kín tới cửa → không vẽ (tránh gây hiểu nhầm).
    const zoneStart = spec.length - doorZoneFor(spec)
    const doorFilled = container.placements.some((p) => p.x + p.l > zoneStart + 0.01)
    if (!doorFilled) {
      path([
        [zoneStart, 0, 0],
        [spec.length, 0, 0],
        [spec.length, spec.width, 0],
        [zoneStart, spec.width, 0],
      ])
      ctx.fillStyle = 'rgba(245,158,11,0.2)'
      ctx.fill()
      const zoneMid = S(project([(zoneStart + spec.length) / 2, spec.width / 2, 0]))
      ctx.fillStyle = 'rgba(217,119,6,0.9)'
      ctx.font = '10px ui-sans-serif, system-ui'
      ctx.textAlign = 'center'
      ctx.fillText('vùng cửa', zoneMid.x, zoneMid.y + 4)
    }

    // Khung 12 cạnh.
    ctx.strokeStyle = 'rgba(100,116,139,0.5)'
    ctx.lineWidth = 1
    const L = spec.length
    const W = spec.width
    const H = spec.height
    const E = (a: Vec3, b: Vec3) => {
      const pa = S(project(a))
      const pb = S(project(b))
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()
    }
    E([0, 0, 0], [L, 0, 0])
    E([0, W, 0], [L, W, 0])
    E([0, 0, H], [L, 0, H])
    E([0, W, H], [L, W, H])
    E([0, 0, 0], [0, W, 0])
    E([L, 0, 0], [L, W, 0])
    E([0, 0, H], [0, W, H])
    E([L, 0, H], [L, W, H])
    E([0, 0, 0], [0, 0, H])
    E([L, 0, 0], [L, 0, H])
    E([0, W, 0], [0, W, H])
    E([L, W, 0], [L, W, H])

    const door = S(project([L, W / 2, 0]))
    ctx.fillStyle = 'rgba(100,116,139,0.9)'
    ctx.font = '11px ui-sans-serif, system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('CỬA CONT', door.x, door.y + 16)

    // ── Kiện: vẽ từ xa tới gần (painter). Tính độ sâu 1 lần/kiện ──
    const items: { p: Placement; d: number }[] = []
    for (const p of container.placements) {
      if (p.order > maxOrder) continue
      items.push({ p, d: project([p.x + p.l / 2, p.y + p.w / 2, p.z + p.h / 2]).d })
    }
    items.sort((a, b) => b.d - a.d)

    // Độ sáng mặt phụ thuộc yaw/pitch → tính 1 lần cho mọi kiện.
    const faceVisible = FACES.map((f) => facingDot(f.n) < -0.001)
    const faceBright = FACES.map((f) => {
      const [rx, ry] = rotNormal(f.n)
      return f.n[2] === 1 ? 1 : 0.58 + 0.3 * Math.max(0, rx * 0.9 - ry * 0.2)
    })

    for (const { p } of items) {
      const base = colors[p.itemId] ?? '#94a3b8'
      const dim = highlightId != null && highlightId !== p.itemId
      const alpha = dim ? 0.14 : 1
      for (let fi = 0; fi < 6; fi++) {
        if (!faceVisible[fi]) continue
        path(FACES[fi].pts(p))
        ctx.fillStyle = shade(base, faceBright[fi], alpha)
        ctx.fill()
        ctx.strokeStyle = `rgba(15,23,42,${0.28 * alpha})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
    }
  }, [])

  // Vẽ ĐỒNG BỘ ngay khi có yêu cầu (không rAF/không cờ) để không bao giờ kẹt:
  // draw() nhanh (~vài ms) và đã bỏ re-render React khi kéo nên vẫn mượt.
  useEffect(() => {
    props.current = { container, colors, maxOrder, highlightId }
    draw()
  }, [container, colors, maxOrder, highlightId, draw])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => draw())
    ro.observe(wrap)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const v = view.current
      v.zoom = Math.min(4, Math.max(0.4, v.zoom * (e.deltaY > 0 ? 0.9 : 1.1)))
      draw()
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      wrap.removeEventListener('wheel', onWheel)
    }
  }, [draw])

  return (
    <div
      ref={wrapRef}
      className="relative h-[420px] w-full cursor-grab touch-none overflow-hidden rounded-lg border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 select-none active:cursor-grabbing dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        const dy = e.clientY - drag.current.y
        drag.current = { x: e.clientX, y: e.clientY }
        const v = view.current
        v.yaw += dx * 0.008
        v.pitch = Math.min(1.35, Math.max(0.12, v.pitch + dy * 0.006))
        draw()
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      onDoubleClick={() => {
        view.current = { ...DEFAULT_VIEW }
        draw()
      }}
    >
      <canvas ref={canvasRef} />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/70 px-2 py-0.5 text-[10px] text-zinc-500 backdrop-blur dark:bg-zinc-900/70">
        Kéo để xoay · Lăn chuột để zoom · Nhấn đúp để đặt lại
      </div>
    </div>
  )
}
