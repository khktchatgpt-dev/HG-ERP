'use client'

import type { Dispatch, SetStateAction } from 'react'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { searchMatcher } from '@/lib/search-text'
import { OChu, ONgay, OSo, docSoVn } from '../_erp/o-nhap'
import { OTim } from '../_erp/o-tim'

export type DauPhieuState = {
  department: string
  need_by: string
  note: string
  production_order_id: string | null
  /** Phí vận chuyển dự kiến cả phiếu (Đ7). */
  shipping_fee: number
}

type Lenh = { id: string; code: string }
const KHONG_LENH: Lenh = { id: '', code: 'Không gắn lệnh' }

/**
 * Đầu phiếu đề nghị một dải nhãn–giá trị (khuôn F, Kho lối ERP · B5): bộ phận ·
 * ngày · cần trước · lệnh · vận chuyển · ghi chú. Sửa được khi phiếu còn nháp.
 */
export function DauPhieu({
  sua,
  head,
  setHead,
  createdAt,
  lsx,
}: {
  sua: boolean
  head: DauPhieuState
  setHead: Dispatch<SetStateAction<DauPhieuState>>
  createdAt: string | null
  lsx: Lenh[]
}) {
  const lsxChon = lsx.find((l) => l.id === head.production_order_id) ?? null
  return (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu đề nghị">
      <div style={{ width: 170 }}>
        <span className="k">Bộ phận</span>
        {sua ? (
          <OChu
            value={head.department}
            onCommit={(v) => setHead((h) => ({ ...h, department: v }))}
            label="Bộ phận đề nghị"
          />
        ) : (
          <span className="v">{head.department}</span>
        )}
      </div>
      <div>
        <span className="k">Ngày</span>
        <span className="v kh-num">
          {isoToVn(createdAt ? todayVn(new Date(createdAt)) : todayVn())}
        </span>
      </div>
      <div style={{ width: 128 }}>
        <span className="k">Cần trước</span>
        {sua ? (
          <ONgay
            value={head.need_by}
            onChange={(v) => setHead((h) => ({ ...h, need_by: v }))}
            label="Cần trước ngày"
          />
        ) : (
          <span className="v kh-num">{head.need_by ? isoToVn(head.need_by) : '—'}</span>
        )}
      </div>
      <div style={{ width: 200 }}>
        <span className="k">Lệnh SX</span>
        {sua ? (
          <OTim<Lenh>
            items={[KHONG_LENH, ...lsx]}
            khop={(l, q) => searchMatcher(q)([l.code])}
            keyOf={(l) => l.id || '-'}
            textOf={(l) => (l.id ? l.code : '')}
            value={lsxChon}
            giuChu
            onPick={(l) => setHead((h) => ({ ...h, production_order_id: l.id || null }))}
            render={(l) => <span className={l.id ? 'kh-ma' : 'kh-mut'}>{l.code}</span>}
            label="Lệnh sản xuất (tuỳ chọn)"
            placeholder="không gắn lệnh"
          />
        ) : (
          <span className="v kh-num">{lsxChon?.code ?? '—'}</span>
        )}
      </div>
      {/* Phí vận chuyển cả phiếu (Đ7) — tờ giấy có cột này; tổng lãnh đạo thấy gồm nó. */}
      <div style={{ width: 120 }}>
        <span className="k">Vận chuyển</span>
        {sua ? (
          <OSo
            value={head.shipping_fee ? String(head.shipping_fee) : ''}
            onCommit={(v) => {
              const n = docSoVn(v)
              setHead((h) => ({ ...h, shipping_fee: n > 0 ? n : 0 }))
            }}
            placeholder="0"
            label="Phí vận chuyển dự kiến"
          />
        ) : (
          <span className="v kh-num">
            {head.shipping_fee ? head.shipping_fee.toLocaleString('vi-VN') : '—'}
          </span>
        )}
      </div>
      <div style={{ flex: '1 1 240px' }}>
        <span className="k">Ghi chú</span>
        {sua ? (
          <OChu
            value={head.note}
            onCommit={(v) => setHead((h) => ({ ...h, note: v }))}
            placeholder="VD: cấp phục vụ sản xuất tuần 42"
            label="Ghi chú chung"
          />
        ) : (
          <span className="v" style={{ fontWeight: 400 }} title={head.note}>
            {head.note || '—'}
          </span>
        )}
      </div>
    </div>
  )
}
