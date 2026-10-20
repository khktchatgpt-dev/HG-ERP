'use client'

import { isoToVn } from '@/lib/date-vn'
import {
  LY_DO_NGOAI_DON,
  timLyDoNgoaiDon,
  type DauPhieuNgoai,
} from '@/lib/kho-nhap-ngoai-don'
import { GoiY, OChu, ONgay } from '../../_erp/o-nhap'

/**
 * ĐẦU PHIẾU NHẬP NGOÀI ĐƠN — Kho lối ERP · B6, dải ô nhãn–giá trị như đầu phiếu
 * nhận theo đơn (thủ kho đi lại giữa hai màn suốt). Ô "Người giao" gõ tự do,
 * gợi ý tên NCC trong danh mục qua `datalist` — một ô thay cho hai ô cũ
 * (gõ tay + chọn từ danh mục). Ô bắt buộc chỉ đỏ SAU KHI đã bấm Ghi sổ.
 */
export function DauNgoai({
  head,
  dat,
  ncc,
  today,
  nguoiNhan,
  thieu,
  busy,
}: {
  head: DauPhieuNgoai
  dat: (p: Partial<DauPhieuNgoai>) => void
  ncc: { id: string; name: string; code: string | null }[]
  today: string
  nguoiNhan: string
  thieu: (o: 'nguoi_giao' | 'ly_do' | 'ghi_chu') => boolean
  busy: boolean
}) {
  const lyDo = timLyDoNgoaiDon(head.ly_do)
  const k = (need: boolean) => (need ? 'k need' : 'k')

  return (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu nhập ngoài đơn">
      <div style={{ flex: '1 1 260px' }}>
        <span className={k(thieu('nguoi_giao'))}>
          <i className="kh-buoc">1</i>Người giao
        </span>
        <OChu
          id="head-nguoi_giao"
          value={head.nguoi_giao}
          onCommit={(v) => dat({ nguoi_giao: v })}
          placeholder={`tên NCC / nơi mua / người mang tới · gợi ý ${ncc.length} NCC`}
          label="Người giao"
          list="ngoai-ncc"
          tone={thieu('nguoi_giao') ? 'need' : undefined}
          disabled={busy}
        />
        <datalist id="ngoai-ncc">
          {ncc.map((s) => (
            <option key={s.id} value={s.name}>
              {s.code ?? undefined}
            </option>
          ))}
        </datalist>
      </div>

      <div>
        <span className={k(thieu('ly_do'))}>
          <i className="kh-buoc">2</i>Vì sao không có đơn
        </span>
        <select
          id="head-ly_do"
          className={thieu('ly_do') ? 'kh-o need' : 'kh-o'}
          value={head.ly_do}
          onChange={(e) => dat({ ly_do: e.target.value })}
          aria-label="Vì sao không có đơn"
          style={{ width: 240 }}
          disabled={busy}
        >
          <option value="">— chưa chọn —</option>
          {LY_DO_NGOAI_DON.map((x) => (
            <option key={x.ma} value={x.ma}>
              {x.nhan}
            </option>
          ))}
        </select>
      </div>

      <div style={{ width: 140 }}>
        <span className="k">
          <i className="kh-buoc">3</i>Ngày{head.doc_date === today ? ' · hôm nay' : ''}
        </span>
        <ONgay
          value={head.doc_date}
          onChange={(v) => dat({ doc_date: v })}
          label="Ngày chứng từ"
          disabled={busy}
        />
        {head.doc_date && head.doc_date !== today && (
          <GoiY tone="warn">ghi lùi về {isoToVn(head.doc_date)}</GoiY>
        )}
      </div>

      <div style={{ width: 160 }}>
        <span className="k">Số phiếu NCC</span>
        <OChu
          value={head.supplier_doc_no}
          onCommit={(v) => dat({ supplier_doc_no: v })}
          placeholder="số trên phiếu của họ"
          label="Số phiếu NCC"
          mono
          disabled={busy}
        />
      </div>

      <div style={{ flex: '2 1 320px' }}>
        <span className={k(thieu('ghi_chu'))}>
          Ghi chú phiếu{lyDo?.batGhiChu ? ' · bắt buộc' : ''}
        </span>
        <OChu
          id="head-ghi_chu"
          value={head.note}
          onCommit={(v) => dat({ note: v })}
          placeholder={
            lyDo?.batGhiChu ? 'nói rõ hàng này ở đâu ra' : 'ghi chú (không bắt buộc)'
          }
          label="Ghi chú phiếu"
          tone={thieu('ghi_chu') ? 'need' : undefined}
          disabled={busy}
        />
        {lyDo && <GoiY tone="mut">{lyDo.heQua}</GoiY>}
      </div>

      <div>
        <span className="k">Người nhận</span>
        <span className="v">{nguoiNhan}</span>
      </div>
    </div>
  )
}
