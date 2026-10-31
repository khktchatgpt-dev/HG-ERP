'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApLedgerResult } from '@/modules/dept/accounting/ap-ledger.service'
import { CnKhung, Seg, dmy, money, monthLabel } from './cong-no.shared'
import { LuoiNcc } from './luoi-ncc'
import { SoChiTiet } from './so-chi-tiet'

/**
 * CÔNG NỢ NHÀ CUNG CẤP THEO THÁNG — khuôn C, có tầng soi chi tiết. KHÔNG dùng kit
 * (chủ dự án 31/10/2026: "không dùng bộ kit cũng như hiển thị nội dung thừa").
 *
 * Ba câu hỏi của kế toán, ba tầng trên cùng một màn, theo đúng thứ tự họ hỏi:
 *   1. Tổng công nợ bao nhiêu?   → dải phương trình tháng (dư đầu → dư cuối)
 *   2. Từng NCC bao nhiêu?       → lưới NCC
 *   3. Gồm những khoản nào?      → sổ chi tiết theo dòng hàng, nửa dưới màn
 *
 * Hai cơ sở (bản vẽ Ht7MpqcutpTUyG4r4DvymN, duyệt 31/10): mặc định theo HÀNG ĐÃ
 * NHẬN (phiếu nhập, gồm VAT), công tắc "Hoá đơn NCC" giữ sổ TK 331. Không bao giờ
 * cộng lẫn hai cơ sở hay hai tiền tệ. Kỳ · cơ sở · tiền tệ · NCC đang soi nằm trên
 * URL (`?ky=&co-so=&tien=&ncc=&tt=`) vì kế toán gửi link cho nhau khi đối chiếu.
 *
 * Bỏ có chủ ý so với bản kit: khối giải thích dài, dải cảnh báo chồng nhau, chú
 * thích chân bảng, nhãn trang lặp tên — mỗi điều đó đã nói bằng chính con số.
 */
export function SoCongNoScreen(p: ApLedgerResult & { currency?: string }) {
  const router = useRouter()
  const receipt = p.basis === 'receipt'
  const currencies = p.totals.map((t) => t.currency)
  const cur =
    p.currency && currencies.includes(p.currency)
      ? p.currency
      : currencies.includes('VND')
        ? 'VND'
        : (currencies[0] ?? 'VND')

  const [prepayOnly, setPrepayOnly] = useState(false)
  const [q, setQ] = useState('')

  const go = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams({ ky: p.month })
    if (!receipt) sp.set('co-so', 'hd')
    if (p.currency) sp.set('tien', p.currency)
    if (p.detail) {
      sp.set('ncc', p.detail.supplier_id)
      sp.set('tt', p.detail.currency)
    }
    for (const [k, v] of Object.entries(patch)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    router.push(`/finance/so-cong-no?${sp}`)
  }

  const inCur = p.rows.filter((r) => r.currency === cur)
  const needle = q.trim().toLowerCase()
  const shown = inCur.filter(
    (r) =>
      (!prepayOnly || r.prepay) &&
      (!needle || r.supplier_name.toLowerCase().includes(needle)),
  )
  const total = p.totals.find((t) => t.currency === cur)
  const prepayCount = inCur.filter((r) => r.prepay).length
  const months = p.months.length ? p.months : [{ month: p.month, entry_count: 0 }]

  return (
    <CnKhung>
      <div className="cn-head">
        {/* Tên màn đã ở thanh trên của khung — không nhắc lại ở đây. */}
        <select
          className="cn-btn"
          aria-label="Tháng"
          value={p.month}
          onChange={(e) => go({ ky: e.target.value, ncc: undefined, tt: undefined })}
        >
          {months.map((m) => (
            <option key={m.month} value={m.month}>
              Tháng {Number(m.month.slice(5))}/{m.month.slice(0, 4)}
            </option>
          ))}
        </select>
        <div className="cn-actions">
          <a className="cn-btn cn-btn-p" href="/finance/cong-no-ncc">
            Ghi thanh toán
          </a>
          <a
            className="cn-btn"
            href={`/api/dept/accounting/so-cong-no/export?ky=${p.month}${receipt ? '' : '&co-so=hd'}`}
          >
            Xuất Excel
          </a>
        </div>
      </div>

      <div className="cn-bar">
        <span className="cn-lbl">Tính theo</span>
        <Seg
          label="Tính theo"
          value={receipt ? 'receipt' : 'invoice'}
          options={[
            { value: 'receipt', label: 'Hàng đã nhận' },
            { value: 'invoice', label: 'Hoá đơn NCC', count: p.invoice_count },
          ]}
          onChange={
            (v) =>
            go({ 'co-so': v === 'invoice' ? 'hd' : undefined, ky: undefined, ncc: undefined, tt: undefined }) // prettier-ignore
          }
        />
        {currencies.length > 1 && (
          <>
            <span className="cn-lbl">Tiền tệ</span>
            <Seg
              label="Tiền tệ"
              value={cur}
              options={p.totals.map((t) => ({ value: t.currency, label: t.currency, count: t.supplier_count }))} // prettier-ignore
              onChange={(v) => go({ tien: v })}
            />
          </>
        )}
        {receipt && prepayCount > 0 && (
          <span className="cn-seg">
            <button
              type="button"
              aria-pressed={prepayOnly}
              onClick={() => setPrepayOnly((v) => !v)}
            >
              Cọc chưa ghi<span className="cn-n">{prepayCount}</span>
            </button>
          </span>
        )}
        <input
          className="cn-search"
          type="search"
          placeholder="Tìm nhà cung cấp…"
          aria-label="Tìm nhà cung cấp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {total && (
        <div className="cn-eq">
          <div>
            <div className="cn-k">Dư đầu tháng</div>
            <div className="cn-v">{money(total.opening, cur)}</div>
          </div>
          <span className="cn-op">+</span>
          <div>
            <div className="cn-k">
              {receipt ? 'Nhận trong tháng' : 'Hoá đơn trong tháng'}
            </div>
            <div className="cn-v">{money(total.increase, cur)}</div>
          </div>
          {receipt && (
            <>
              <span className="cn-op">−</span>
              <div>
                <div className="cn-k">Trả hàng · đảo phiếu</div>
                <div className="cn-v">{money(total.returned, cur)}</div>
              </div>
            </>
          )}
          <span className="cn-op">−</span>
          <div>
            <div className="cn-k">Đã thanh toán</div>
            <div className="cn-v">{money(total.decrease, cur)}</div>
            {p.payment_count === 0 && (
              <div className="cn-sub cn-warn">chưa có phiếu chi trên ERP</div>
            )}
          </div>
          <span className="cn-op">=</span>
          <div className="cn-end">
            <div className="cn-k">Dư cuối tháng</div>
            <div className="cn-v">{money(total.closing, cur)}</div>
            <div className="cn-sub">
              {total.supplier_count} NCC{receipt ? ' · gồm VAT' : ''}
              {cur !== 'VND' &&
                (total.closing_base == null
                  ? ` · chưa quy đổi — thiếu tỷ giá ${dmy(p.to)}`
                  : ` · ≈ ${money(total.closing_base, 'VND')} đ`)}
            </div>
          </div>
        </div>
      )}

      {p.rows.length === 0 ? (
        <div className="cn-empty">
          <b>
            {receipt
              ? `${monthLabel(p.month)[0].toUpperCase()}${monthLabel(p.month).slice(1)} chưa có phiếu nhập nào gắn đơn mua`
              : `Chưa có hoá đơn NCC nào vào sổ ${monthLabel(p.month)}`}
          </b>
          <span>
            {receipt
              ? 'Công nợ theo hàng nhận chỉ phát sinh khi hàng về và có phiếu nhập kho.'
              : 'Sổ TK 331 chỉ có số khi Kế toán vào sổ hoá đơn NCC.'}
          </span>
          {receipt ? (
            p.months.at(-1) && p.months.at(-1)!.month !== p.month ? (
              <button
                type="button"
                className="cn-btn"
                onClick={() => go({ ky: p.months.at(-1)!.month })}
              >
                Xem {monthLabel(p.months.at(-1)!.month)}
              </button>
            ) : null
          ) : (
            <button
              type="button"
              className="cn-btn"
              onClick={() => go({ 'co-so': undefined, ky: undefined })}
            >
              Xem theo hàng đã nhận
            </button>
          )}
        </div>
      ) : (
        <div className="cn-split">
          <div className="cn-scroll">
            <LuoiNcc
              rows={shown}
              all={inCur}
              total={total}
              cur={cur}
              receipt={receipt}
              selected={p.detail}
              onPick={(r) =>
                go(
                  p.detail?.supplier_id === r.supplier_id &&
                    p.detail?.currency === r.currency
                    ? { ncc: undefined, tt: undefined }
                    : { ncc: r.supplier_id, tt: r.currency },
                )
              }
              onClear={() => {
                setQ('')
                setPrepayOnly(false)
              }}
            />
          </div>
          {p.detail && (
            <div className="cn-scroll">
              <SoChiTiet
                // Đổi NCC thì dựng lại: trạng thái gập/mở theo vị trí dòng của NCC cũ không còn nghĩa.
                key={`${p.detail.supplier_id}-${p.detail.currency}-${p.month}`}
                d={p.detail}
                p={p}
                onClose={() => go({ ncc: undefined, tt: undefined })}
              />
            </div>
          )}
        </div>
      )}
    </CnKhung>
  )
}
