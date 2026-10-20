'use client'

import { useMemo, useState } from 'react'
import { Btn, Sheet, Tick } from '@/components/kit'
import { cn } from '@/lib/utils'
import { TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import type { GioCongCtx } from './useGioCong'
import { THU, dm, gio, hm, ngayKy, so, thu } from './gio-cong.shared'

const c = 'border-b border-[var(--line-faint)]/40 px-2 py-0.5 whitespace-nowrap'
const h = cn(
  c,
  'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
)
const r = { textAlign: 'right' as const }
const l = { textAlign: 'left' as const }

/**
 * NGĂN TICK LÀM TRƯA THEO NGÀY — chép sổ tay tổ trưởng một lượt cho cả nhóm đang xem
 * (câu 4: "có nút tick cả tổ ngày này để khỏi bấm từng người"). Chỉ bày người có mặt
 * xuyên trưa hôm đó (ứng viên); mặc định chọn hết, 60 phút.
 */
export function NganTrua({ d }: { d: GioCongCtx }) {
  const ungVien = useMemo(() => {
    const m = new Map<string, { ma: string; ten: string; phut: number }[]>()
    for (const n of d.dong) {
      if (n.cachTinh !== 'khung') continue
      for (const x of n.ngay)
        if (x.xuyenTrua)
          m.set(x.ngay, [
            ...(m.get(x.ngay) ?? []),
            { ma: n.ma, ten: n.ten, phut: x.trua },
          ])
    }
    return m
  }, [d.dong])
  const ngays = [...ungVien.keys()].sort().reverse()
  const [ngay, setNgay] = useState<string | null>(null)
  const dangNgay = ngay ?? ngays[0] ?? null
  const ds = dangNgay ? (ungVien.get(dangNgay) ?? []) : []
  const [bo, setBo] = useState<Set<string>>(new Set())
  const [phut, setPhut] = useState(d.b.phutTruaMacDinh)
  const chon = ds.filter((x) => !bo.has(x.ma))

  return (
    <Sheet
      open={d.moTrua}
      onClose={() => d.setMoTrua(false)}
      title="Tick làm trưa theo ngày"
      subtitle="Chép sổ tay tổ trưởng — chỉ bày người có mặt xuyên trưa (đã bị trừ 1 giờ nghỉ trưa)"
      stakes="nhe"
      width={520}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-k-sm text-[var(--ink-3)]">
            {chon.length} người × {phut} phút × {d.b.heSoTrua} = +
            {gio(phut * d.b.heSoTrua)} giờ mỗi người
          </span>
          <Btn
            primary
            className="ml-auto"
            busy={d.dangGhi}
            aria-disabled={!chon.length}
            onClick={async () => {
              if (!dangNgay || !chon.length) return
              const ok = await d.ghiTrua(
                chon.map((x) => ({ ma: x.ma, ngay: dangNgay, phut })),
              )
              if (ok) d.setMoTrua(false)
            }}
          >
            Tick {chon.length} người
          </Btn>
        </div>
      }
    >
      {ngays.length === 0 ? (
        <p className="text-k-body text-[var(--ink-2)]">
          Nhóm đang xem không có ngày nào có mặt xuyên trưa.
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {ngays.map((ng) => {
              const v = ungVien.get(ng)!
              const chua = v.filter((x) => !x.phut).length
              return (
                <button
                  key={ng}
                  type="button"
                  onClick={() => {
                    setNgay(ng)
                    setBo(new Set())
                  }}
                  className={cn(
                    'border px-1.5 py-0.5 font-mono text-[11.5px]',
                    ng === dangNgay
                      ? 'border-[var(--act)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
                      : 'border-[var(--line)]',
                  )}
                >
                  {dm(ng)} {THU[thu(ng)]}
                  {chua ? (
                    <span className="ml-1 text-[var(--warn)]">{chua}</span>
                  ) : (
                    <span className="ml-1 text-[var(--done)]">✓</span>
                  )}
                </button>
              )
            })}
          </div>
          <label className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
            Số phút mỗi người
            <select
              className="border border-[var(--line)] px-1 py-0.5"
              value={phut}
              onChange={(e) => setPhut(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120].map((p) => (
                <option key={p} value={p}>
                  {p} phút
                </option>
              ))}
            </select>
          </label>
          <ul className="text-k-sm grid gap-0.5">
            {ds.map((x) => (
              <li key={x.ma} className="flex items-center gap-2">
                <Tick
                  label={`Chọn ${x.ten}`}
                  checked={!bo.has(x.ma)}
                  onChange={(v) =>
                    setBo((s) => {
                      const n = new Set(s)
                      if (v) n.delete(x.ma)
                      else n.add(x.ma)
                      return n
                    })
                  }
                />
                <span
                  className="num w-12 text-[var(--ink-3)]"
                  style={{ textAlign: 'left' }}
                >
                  {x.ma}
                </span>
                {x.ten}
                {x.phut > 0 && (
                  <span className="ml-auto text-[var(--done)]">
                    đã tick {x.phut} phút
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
