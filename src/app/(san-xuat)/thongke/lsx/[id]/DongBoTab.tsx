'use client'

import { useMemo } from 'react'
import {
  DeltaNum,
  DualPct,
  MatrixTable,
  MiniBars,
  NGOAI_LO_TRINH,
  Tag,
  type MatrixCol,
} from '@/components/kit'
import type { WorklistRow } from '@/modules/dept/production/worklist.service'

/**
 * T2 — BẢNG ĐỒNG BỘ CỦA LỆNH (docs/thong-ke-thiet-ke-tu-excel.md §7 T2).
 *
 * Câu hỏi: "lệnh này giao được bao nhiêu bộ, và kẹt ở công đoạn nào?"
 *
 * Thay sheet `BC_CONG_DOAN` phần 1 của file Excel xưởng: mỗi dòng MỘT sản
 * phẩm, mỗi cột MỘT công đoạn có trong lộ trình của lệnh — cả tình hình lệnh
 * đọc trong một nhịp mắt, so dọc được "Sơn của SP A với Sơn của SP B". Màn
 * cũ bày cùng số đó thành danh sách phẳng (SP × công đoạn) nên phải lướt qua
 * mọi dòng xen giữa mới so được.
 *
 * Bốn luật của T2:
 *  1. Ô trống ba kiểu phân biệt được: `–` sọc = ngoài lộ trình · `0` = chưa
 *     làm · `(300)` = thiếu (`NGOAI_LO_TRINH`, `DeltaNum`).
 *  2. Cột kết luận là "Bộ hoàn chỉnh = công đoạn CHẬM NHẤT", không phải trung
 *     bình — và chân bảng nói thẳng như vậy.
 *  3. Bấm một ô → lọc danh sách việc bên dưới đúng công đoạn đó.
 *  4. Chân bảng nói tổng KHÔNG gồm gì.
 */

type Stage = { code: string; label: string }
type Dong = {
  id: string
  code: string
  name: string
  planned: number
  byStage: Map<string, WorklistRow>
  complete: number
  started: boolean
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

export function DongBoTab({
  rows,
  stages,
  unshaped,
  onPickStage,
}: {
  rows: WorklistRow[]
  /** Công đoạn CÓ trong lộ trình của lệnh, đúng thứ tự xưởng đi. */
  stages: Stage[]
  /** Số dòng SP của lệnh chưa định hình chi tiết — không có mặt trong bảng. */
  unshaped: number
  onPickStage: (stage: string) => void
}) {
  const dong = useMemo<Dong[]>(() => {
    const m = new Map<string, Dong>()
    for (const r of rows) {
      const d = m.get(r.order_line_id) ?? {
        id: r.order_line_id,
        code: r.product_code,
        name: r.product_name,
        planned: r.planned,
        byStage: new Map(),
        complete: 0,
        started: false,
      }
      d.byStage.set(r.stage, r)
      m.set(r.order_line_id, d)
    }
    for (const d of m.values()) {
      const ds = [...d.byStage.values()]
      // BỘ HOÀN CHỈNH = công đoạn chậm nhất mà SP ĐI QUA (luật 2). Công đoạn
      // ngoài lộ trình không kéo số xuống — SP không đi qua đó bao giờ.
      d.complete = ds.length ? Math.min(...ds.map((r) => r.done)) : 0
      d.started = ds.some((r) => r.status !== 'not_started')
    }
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code))
  }, [rows])

  /** % theo MẢNH của cả lệnh ở từng công đoạn — "xưởng đang làm ở đâu". */
  const theoCongDoan = useMemo(
    () =>
      stages.map((s) => {
        const rs = rows.filter((r) => r.stage === s.code)
        const can = rs.reduce((a, r) => a + r.pieces_needed, 0)
        const lam = rs.reduce((a, r) => a + r.pieces_done, 0)
        return { s, ratio: can > 0 ? lam / can : 0 }
      }),
    [rows, stages],
  )

  const tongDat = dong.reduce((a, d) => a + d.planned, 0)
  const tongDu = dong.reduce((a, d) => a + d.complete, 0)

  const pinned: (MatrixCol<Dong> & { width: number })[] = [
    {
      id: 'ma',
      header: 'Mã SP',
      width: 128,
      cell: (d) => <span className="num font-semibold">{d.code}</span>,
    },
    {
      id: 'ten',
      header: 'Tên SP',
      width: 190,
      muted: true,
      title: (d) => d.name,
      cell: (d) => <span className="block max-w-[174px] truncate">{d.name}</span>,
    },
    {
      id: 'sl',
      header: 'SL bộ',
      width: 70,
      num: true,
      foot: fmt(tongDat),
      cell: (d) => fmt(d.planned),
    },
  ]

  const congDoan: MatrixCol<Dong>[] = stages.map((s) => ({
    id: s.code,
    header: s.label,
    width: 128,
    title: (d) => {
      const r = d.byStage.get(s.code)
      return r
        ? `${s.label}: ${fmt(r.done)}/${fmt(r.planned)} bộ · ${fmt(r.pieces_done)}/${fmt(r.pieces_needed)} cái — bấm để xem việc của công đoạn này`
        : undefined
    },
    cell: (d) => {
      const r = d.byStage.get(s.code)
      if (!r) return NGOAI_LO_TRINH
      return (
        <span className="grid justify-items-end leading-tight">
          <span
            className={r.done === 0 ? 'num text-[var(--ink-3)]' : 'num font-semibold'}
          >
            {fmt(r.done)}
          </span>
          <DualPct
            pieces={r.pieces_needed > 0 ? r.pieces_done / r.pieces_needed : null}
            sets={r.planned > 0 ? r.done / r.planned : null}
          />
        </span>
      )
    },
  }))

  const ketLuan: MatrixCol<Dong>[] = [
    {
      id: 'du',
      header: 'Bộ hoàn chỉnh',
      pick: false,
      width: 96,
      num: true,
      foot: fmt(tongDu),
      cell: (d) => <span className="num font-semibold">{fmt(d.complete)}</span>,
    },
    {
      id: 'thieu',
      header: 'Thiếu / dư',
      pick: false,
      width: 84,
      num: true,
      cell: (d) => <DeltaNum value={d.complete - d.planned} unit="bộ" />,
    },
    {
      id: 'tt',
      header: 'Trạng thái',
      pick: false,
      width: 96,
      cell: (d) =>
        d.complete >= d.planned ? (
          <Tag tone="done">Đủ bộ</Tag>
        ) : d.started ? (
          <Tag tone="warn">Đang làm</Tag>
        ) : (
          <Tag tone="neutral">Chưa làm</Tag>
        ),
    },
  ]

  return (
    <div className="grid gap-3">
      <div className="px-[var(--gutter)] pt-2">
        <MiniBars
          label="Tiến độ theo mảnh ở từng công đoạn của lệnh"
          rows={theoCongDoan.map(({ s, ratio }) => ({
            id: s.code,
            label: s.label,
            value: ratio,
            onClick: () => onPickStage(s.code),
          }))}
        />
      </div>
      <MatrixTable
        label="Bảng đồng bộ: số bộ đạt từng công đoạn của từng sản phẩm"
        rows={dong}
        rowKey={(d) => d.id}
        pinned={pinned}
        groups={[
          { id: 'cd', header: 'Công đoạn — theo lộ trình của lệnh', cols: congDoan },
          { id: 'kl', header: 'Kết luận', cols: ketLuan },
        ]}
        onCell={(_d, colId) => {
          if (stages.some((s) => s.code === colId)) onPickStage(colId)
        }}
        foot={{
          label: `Cộng ${fmt(dong.length)} SP`,
          note:
            'Bộ hoàn chỉnh = công đoạn CHẬM NHẤT của từng SP, không phải trung bình.' +
            (unshaped > 0
              ? ` Không gồm ${fmt(unshaped)} SP chưa định hình chi tiết.`
              : ''),
        }}
      />
    </div>
  )
}
