'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { dongThieuKg, kgDuKienDong } from '@/lib/da-ve'
import type { DaVeRow } from '@/modules/dept/supply/da-ve.repo'
import { HopThoai, OSo, docSoVn } from '../../_erp/o-nhap'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * HỘP GHI KG CÂN BỔ SUNG (01/10/2026) — BẢN CỦA KHO, cùng route `docs/[id]/kg-can`.
 * Cho phiếu nhập đã ghi sổ mà dòng nhôm / thép chưa có kg cân. Kg là số đo,
 * không đổi tồn; bắt lý do, vết vào Trao đổi của đơn. Không kit (B6).
 */
export function KgCanSheet({ row, onClose }: { row: DaVeRow; onClose: () => void }) {
  const router = useRouter()
  const dong = dongThieuKg(row.phieu)
  const [kg, setKg] = useState<Record<string, number>>({})
  const [lyDo, setLyDo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  const thieu = dong.filter((l) => !(kg[l.movement_id] > 0)).length
  const why =
    thieu > 0
      ? `Còn ${thieu} dòng chưa ghi kg`
      : lyDo.trim().length < 3
        ? 'Ghi lý do (vì sao ghi kg sau khi đã nhập)'
        : null

  async function luu() {
    if (why) return
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/dept/warehouse/docs/${row.doc_id}/kg-can`, {
        method: 'POST',
        body: {
          lines: dong.map((l) => ({
            movement_id: l.movement_id,
            qty2_actual: kg[l.movement_id],
          })),
          reason: lyDo.trim(),
        },
      })
      onClose()
      router.refresh()
    } catch (e) {
      setLoi(`Chưa ghi được kg cân: ${apiErrorText(e)}`)
      setBusy(false)
    }
  }

  return (
    <HopThoai
      title={`Ghi kg cân · ${row.code}`}
      subtitle={`${row.po_code} · ${row.supplier_name} — đơn trả tiền theo kg cân thực, lúc nhận chưa ghi kg.`}
      onClose={onClose}
      width={600}
      footer={
        <>
          {why && (
            <span
              className="kh-warn"
              style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 12 }}
            >
              {why}
            </span>
          )}
          <button type="button" className="kh-btn" onClick={onClose}>
            Thôi
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={!!why || busy}
            onClick={() => void luu()}
          >
            {busy ? 'Đang ghi…' : 'Ghi kg cân'}
          </button>
        </>
      }
    >
      <div className="kh-ds">
        {dong.map((l) => {
          const du = kgDuKienDong(l)
          return (
            <div
              key={l.movement_id}
              style={{
                gridTemplateColumns: '96px minmax(0,1fr) 130px',
                alignItems: 'center',
              }}
            >
              <span className="kh-ma">{l.material_code}</span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.lines.find((x) => x.movement_id === l.movement_id)?.material_name}
                </span>
                <span className="kh-mut kh-num" style={{ fontSize: 12 }}>
                  nhận {so(l.qty)} {l.unit}
                  {du != null ? ` · theo đơn ~${so(du)} kg` : ''}
                </span>
              </span>
              <OSo
                value={kg[l.movement_id] ? String(kg[l.movement_id]) : ''}
                placeholder="kg cân"
                onCommit={(v) => setKg((m) => ({ ...m, [l.movement_id]: docSoVn(v) }))}
                label={`Kg cân thực ${l.material_code}`}
              />
            </div>
          )
        })}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="kh-mut" style={{ fontSize: 11, fontWeight: 700 }}>
          LÝ DO · BẮT BUỘC
        </span>
        <textarea
          className="kh-o"
          value={lyDo}
          onChange={(e) => setLyDo(e.target.value)}
          rows={2}
          placeholder="ví dụ: lúc nhận chưa cân, cân lại tại xưởng ngày 01/10"
          aria-label="Lý do ghi kg cân bổ sung"
        />
      </label>
      <p className="kh-mut" style={{ fontSize: 12 }}>
        Kg chỉ là số đo — tồn kho không đổi. Kế toán đối chiếu hoá đơn theo kg này; ai
        ghi, lúc nào, trước → sau và lý do hiện ở Trao đổi của đơn.
      </p>
      {loi && <span className="kh-stop">{loi}</span>}
    </HopThoai>
  )
}
