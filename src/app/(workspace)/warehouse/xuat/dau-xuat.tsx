'use client'

import { isoToVn } from '@/lib/date-vn'
import { searchMatcher } from '@/lib/search-text'
import { LY_DO_XUAT_LE, type DauPhieuXuat, type LoaiXuat } from '@/lib/kho-phieu-xuat'
import { OChu, ONgay } from '../_erp/o-nhap'
import { ChonMot, OTim } from '../_erp/o-tim'

export type LsxOpt = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  status: string
  /** Hạn xuất hàng — nhắc ghi bù khi lệnh quá hạn mà còn hàng trên máy (B4). */
  ship_date: string | null
}

const tenTo = (n: string) => n.replace(/^tổ\s+/i, '')

/**
 * ĐẦU PHIẾU XUẤT — Kho lối ERP · B3, dải ô nhãn–giá trị theo THỨ TỰ CÂU HỎI THẬT:
 * 1 Xuất cho (lệnh / lẻ) → 2 Lệnh (hoặc Lý do) → 3 Tổ lấy (bấm một phát) →
 * 4 Ngày (mặc định hôm nay). Ô bắt buộc chỉ đỏ SAU KHI đã bấm Ghi sổ mà còn
 * trống — đỏ lúc form mới mở là mắng người chưa làm gì. State nằm ở màn.
 */
export function DauXuat({
  head,
  setH,
  lsx,
  to,
  phong,
  today,
  canLenh,
  thieu,
}: {
  head: DauPhieuXuat
  setH: (p: Partial<DauPhieuXuat>) => void
  lsx: LsxOpt[]
  to: string[]
  phong: string[]
  today: string
  canLenh: boolean
  /** Ô còn thiếu sau khi đã bấm Ghi sổ. */
  thieu: (o: 'lenh' | 'ly_do' | 'to') => boolean
}) {
  const lsxChon = lsx.find((l) => l.id === head.lsx_id) ?? null
  const khopLenh = (l: LsxOpt, q: string) => searchMatcher(q)([l.code, l.customer_name, ...l.order_codes]) // prettier-ignore
  const k = (need: boolean) => (need ? 'k need' : 'k')

  return (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu xuất">
      <div>
        <span className="k">
          <i className="kh-buoc">1</i>Xuất cho
        </span>
        <ChonMot<LoaiXuat>
          value={head.loai}
          label="Xuất cho"
          options={[
            { value: 'lsx', label: 'Lệnh sản xuất' },
            { value: 'daily', label: 'Xuất lẻ' },
          ]}
          onChange={(v) => setH({ loai: v, ly_do: '', to: '' })}
        />
      </div>

      {head.loai === 'daily' && (
        <div>
          <span className={k(thieu('ly_do'))}>
            <i className="kh-buoc">2</i>Lý do
          </span>
          <select
            id="xuat-ly_do"
            className={thieu('ly_do') ? 'kh-o need' : 'kh-o'}
            value={head.ly_do}
            onChange={(e) => setH({ ly_do: e.target.value })}
            aria-label="Lý do xuất lẻ"
            style={{ width: 280 }}
          >
            <option value="">— chọn lý do —</option>
            {LY_DO_XUAT_LE.map((x) => (
              <option key={x.ma} value={x.ma}>
                {x.ma} · {x.nhan}
              </option>
            ))}
          </select>
        </div>
      )}

      {canLenh && (
        <div style={{ flex: '1 1 300px' }}>
          <span className={k(thieu('lenh'))}>
            <i className="kh-buoc">{head.loai === 'daily' ? '2b' : 2}</i>Lệnh
            {lsxChon && (
              <span
                className="kh-mut"
                style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}
              >
                {lsxChon.customer_name}
                {lsxChon.order_codes.length > 0 &&
                  ` · ${lsxChon.order_codes.join(', ')}`}{' '}
                · {lsxChon.status === 'in_progress' ? 'đang SX' : 'đã duyệt'}
              </span>
            )}
          </span>
          <OTim<LsxOpt>
            id="xuat-lenh"
            items={lsx}
            khop={khopLenh}
            keyOf={(l) => l.id}
            textOf={(l) => l.code}
            value={lsxChon}
            giuChu
            onPick={(l) => setH({ lsx_id: l.id })}
            render={(l) => (
              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <b className="kh-ma">{l.code}</b>
                <span>{l.customer_name}</span>
                <span className="kh-mut" style={{ marginLeft: 'auto' }}>
                  {l.order_codes.join(', ')} ·{' '}
                  {l.status === 'in_progress' ? 'đang SX' : 'đã duyệt'}
                </span>
              </span>
            )}
            label="Lệnh sản xuất"
            placeholder="gõ số lệnh hoặc tên khách…"
            tone={thieu('lenh') ? 'need' : undefined}
            rong="Không có lệnh đang chạy nào khớp"
          />
        </div>
      )}

      <div>
        <span className={k(thieu('to'))}>
          <i className="kh-buoc">3</i>
          {head.loai === 'lsx' ? 'Tổ lấy' : 'Bộ phận nhận'}
        </span>
        <span id="xuat-to" tabIndex={-1}>
          {head.loai === 'lsx' ? (
            <ChonMot<string>
              value={head.to}
              label="Tổ lấy"
              need={thieu('to')}
              options={to.map((t) => ({ value: t, label: tenTo(t) }))}
              onChange={(v) => setH({ to: v })}
            />
          ) : (
            <OTim<string>
              items={phong}
              khop={(p, q) => searchMatcher(q)([p])}
              keyOf={(p) => p}
              textOf={(p) => p}
              value={head.to || null}
              giuChu
              onPick={(p) => setH({ to: p })}
              render={(p) => p}
              label="Bộ phận nhận"
              placeholder="gõ tên phòng / tổ…"
              tone={thieu('to') ? 'need' : undefined}
              width={220}
            />
          )}
        </span>
      </div>

      <div style={{ width: 190 }}>
        <span className="k">Người lấy</span>
        <OChu
          value={head.nguoi_lay}
          onCommit={(v) => setH({ nguoi_lay: v })}
          placeholder="không bắt buộc"
          label="Người lấy"
        />
      </div>

      <div style={{ width: 140 }}>
        <span className="k">
          <i className="kh-buoc">4</i>Ngày{head.doc_date === today ? ' · hôm nay' : ''}
        </span>
        <ONgay
          value={head.doc_date}
          onChange={(v) => setH({ doc_date: v })}
          label="Ngày chứng từ"
        />
      </div>
      {head.doc_date && head.doc_date !== today && (
        <div style={{ justifyContent: 'center' }}>
          <span className="kh-warn" style={{ fontSize: 11.5 }}>
            ghi lùi về {isoToVn(head.doc_date)}
          </span>
        </div>
      )}
    </div>
  )
}
