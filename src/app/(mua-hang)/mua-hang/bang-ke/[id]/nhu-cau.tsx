'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { TINH_TRANG_MUA } from '@/lib/lsx-bang-ke-mua'
import { parsePasteNumber } from '@/lib/po-paste'
import type { BangKeRow } from '@/lib/lsx-bang-ke'
import { NUM, Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { dmy, lechPct, so, so0, type DongKH } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'
import { KhoiChuaMa } from './chua-ma'

const COLS = 8
const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'

/**
 * BƯỚC 1 · NHU CẦU — "lệnh này còn phải mua gì, bao nhiêu" (bản vẽ
 * https://claude.ai/artifact/WE12EjR59Qj1WNVaPXmzXu, duyệt 22/10/2026).
 *
 * Ba khối trên xuống: NGUỒN SỐ theo từng SP (SP nào máy tính được, SP nào phải
 * dán bảng kê) → khối dòng định mức CHƯA QUY ĐỔI được (số của chúng không có
 * trong bảng) → BẢNG KÊ gom theo loại. Mỗi dòng nói số Cần đến từ đâu; mã nào
 * cũng sửa được số cần tại chỗ (thành số nhập tay, ghi đè định mức của mã đó).
 */
export function NhuCau({ d }: { d: KeHoachCtx }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NguonTheoSp d={d} />
      <KhoiChuaMa d={d} />
      <KhoiChan d={d} />
      <LuoiNhuCau d={d} />
    </div>
  )
}

/**
 * Nguồn số theo SP — MỘT DÒNG tóm tắt (kể tên SP chưa có định mức), bấm mới mở
 * từng SP. Bản đầu bày sẵn 8 ô SP: ở 1280×800 lưới chỉ còn ~4 dòng (soi 22/10).
 */
function NguonTheoSp({ d }: { d: KeHoachCtx }) {
  const [mo, setMo] = useState(false)
  const { products } = d.bk
  if (products.length === 0) return null
  const coMa = products.filter((p) => p.coded_parts > 0).length
  const chua = products.filter((p) => p.coded_parts === 0)
  return (
    <section
      aria-label="Nguồn số cần theo sản phẩm"
      className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-1.5 text-[12px] text-[var(--ink-2)]">
        <button
          type="button"
          aria-expanded={mo}
          onClick={() => setMo(!mo)}
          className="inline-flex items-baseline gap-1.5 font-semibold text-[var(--ink)]"
        >
          <span aria-hidden>{mo ? '▾' : '▸'}</span>
          Nguồn số: {coMa}/{products.length} SP có định mức gắn mã
        </button>
        {chua.length > 0 && (
          <span className="min-w-0 text-[var(--warn)]">
            {chua.length} SP chưa có — máy chưa tính được:{' '}
            <span className="font-mono">{chua.map((p) => p.code).join(', ')}</span>
            {d.canEdit && (
              <>
                {' · '}
                <button type="button" className={LINK} onClick={() => d.setMoDan(true)}>
                  dán bảng kê
                </button>
              </>
            )}
          </span>
        )}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={d.includeDraft}
            onChange={(e) => d.doiNhap(e.target.checked)}
            className="accent-[var(--act)]"
          />
          Tính cả định mức Kỹ thuật chưa kiểm
        </label>
      </div>
      {mo && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] border-t border-[var(--hair)]">
          {products.map((p) => (
            <div
              key={p.id}
              className={`grid min-w-0 gap-0.5 border-r border-b border-[var(--hair)] px-4 py-1 ${p.coded_parts > 0 ? '' : 'bg-[var(--warn-wash)]'}`}
            >
              <span className="flex min-w-0 items-baseline gap-2 text-[12px]">
                <Link href={`/products/${p.id}/dinh-muc`} className={`font-mono ${LINK}`}>
                  {p.code}
                </Link>
                <span className="font-mono text-[var(--ink-2)]">× {so0(p.qty)}</span>
                <span className="truncate" title={p.name}>
                  {p.name}
                </span>
              </span>
              <span className="text-[11.5px]">
                {p.coded_parts > 0 ? (
                  <span className="text-[var(--done)]">
                    định mức {p.coded_parts} dòng gắn mã
                    {p.bom_confirmed ? ' · KT đã kiểm' : ' · KT chưa kiểm'}
                  </span>
                ) : (
                  <span className="text-[var(--warn)]">
                    chưa có định mức gắn mã
                    {d.canEdit && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className={LINK}
                          onClick={() => d.setMoDan(true)}
                        >
                          dán bảng kê
                        </button>
                      </>
                    )}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Dòng định mức có mã nhưng KHÔNG đổi được sang đơn vị mua (thiếu dài cây,
 * thiếu khối lượng, lệch ĐVT…). Số của chúng không vào bảng — phải nói ra kèm ai
 * gỡ, ở đâu. Gập sẵn; ô đếm ở đầu trang bấm là mở.
 */
function KhoiChan({ d }: { d: KeHoachCtx }) {
  const { blocked, products } = d.bk
  if (blocked.length === 0) return null
  const spId = new Map(products.map((p) => [p.code, p.id]))
  return (
    <section
      id="kh-chan"
      className="shrink-0 border-b border-[var(--stop-line)] bg-[var(--stop-wash)]"
    >
      <button
        type="button"
        aria-expanded={d.moChan}
        onClick={() => d.setMoChan(!d.moChan)}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[12.5px] font-semibold text-[var(--stop)]"
      >
        <span aria-hidden>{d.moChan ? '▾' : '▸'}</span>
        {blocked.length} dòng định mức chưa đổi được sang đơn vị mua — số của chúng CHƯA
        có trong bảng kê
        <span className="font-normal text-[var(--ink-2)]">
          · gỡ xong ở hồ sơ, hoặc nhập số cần tay cho mã đó ở bảng dưới
        </span>
      </button>
      {d.moChan && (
        <div className="max-h-[240px] overflow-auto bg-[var(--surface-card)] px-4 pb-2">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {['SP', 'Chi tiết', 'Mã VT', 'Vướng gì', 'Ai gỡ · ở đâu'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {blocked.map((b, i) => {
                const pid = spId.get(b.product_code)
                const viCungUng = /dài một|chiều dài/i.test(b.reason)
                return (
                  <tr key={i} className="align-top">
                    <td className={`${TD} font-mono text-[12px]`}>{b.product_code}</td>
                    <td className={TD}>{b.part_name}</td>
                    <td className={TD}>
                      <span className="font-mono text-[12px]">{b.material_code}</span>{' '}
                      <span className="text-[var(--ink-3)]">{b.material_name}</span>
                    </td>
                    <td className={`${TD} text-[var(--ink-2)]`}>{b.reason}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {viCungUng ? (
                        <>
                          Cung ứng ·{' '}
                          <Link
                            href={`/mua-hang/vat-tu/${b.material_id}`}
                            className={LINK}
                          >
                            Hồ sơ vật tư
                          </Link>
                        </>
                      ) : pid ? (
                        <>
                          Kỹ thuật ·{' '}
                          <Link href={`/products/${pid}/dinh-muc`} className={LINK}>
                            Hồ sơ SP
                          </Link>
                        </>
                      ) : (
                        'Kỹ thuật · hồ sơ SP'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function LuoiNhuCau({ d }: { d: KeHoachCtx }) {
  if (d.tatCa.length === 0) return <RongLenh d={d} />
  if (d.soDongHien === 0)
    return (
      <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
        <b>Không mã nào khớp bộ lọc</b>
        <span className="text-[var(--ink-2)]">
          Lệnh có {d.tatCa.length} mã — bộ lọc hiện tại không để lại dòng nào.
        </span>
        <Nut onClick={d.boLoc}>Bỏ lọc</Nut>
      </div>
    )
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      <table className="w-full min-w-[920px] border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[92px]`}>Mã</th>
            <th className={TH}>Vật tư · quy cách · vị trí</th>
            <th className={`${TH} w-[200px]`}>Nguồn số</th>
            <th className={`${TH} w-[120px] text-right`}>Cần</th>
            <th className={`${TH} w-[80px] text-right`}>Tồn</th>
            <th className={`${TH} w-[96px] text-right`}>Đã đặt</th>
            <th className={`${TH} w-[104px] text-right`}>Còn phải đặt</th>
            <th className={`${TH} w-[190px]`}>Tình trạng · đơn</th>
          </tr>
        </thead>
        <tbody>
          {d.hien.map((k) => (
            <Fragment key={k.name}>
              <tr>
                <td
                  colSpan={COLS}
                  className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]"
                >
                  {k.name} <span className="font-normal">· {k.rows.length} mã</span>
                </td>
              </tr>
              {k.subs.map((sub) => (
                <Fragment key={`${k.name}/${sub.name ?? ''}`}>
                  {sub.name && (
                    <tr>
                      <td
                        colSpan={COLS}
                        className="border-b border-[var(--hair)] px-2.5 py-0.5 pl-5 text-[11.5px] font-semibold text-[var(--ink-3)]"
                      >
                        {sub.name} · {sub.rows.length} mã
                      </td>
                    </tr>
                  )}
                  {sub.rows.map((r) => (
                    <DongNhuCau
                      key={r.material_id}
                      d={d}
                      x={d.byId.get(r.material_id)!}
                    />
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className={TF}>
              {d.soDongHien} mã đang hiện · {d.conDat.length} mã còn phải đặt
            </td>
            <td colSpan={COLS - 3} className={`${TF} font-normal text-[var(--ink-3)]`}>
              Không cộng số lượng giữa các mã. Cần làm tròn LÊN theo đơn vị mua. Còn phải
              đặt = Cần − Tồn − Đã đặt − Nháp.
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DongNhuCau({ d, x }: { d: KeHoachCtx; x: DongKH }) {
  const { r, d: m } = x
  const tt = TINH_TRANG_MUA[m.tinhTrang]
  const phu = [r.spec, (r.positions ?? []).join(', ')].filter(Boolean).join(' · ')
  const sua = d.dangSua === r.material_id
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={`${TD} font-mono text-[12px]`}>
        <Link href={`/mua-hang/vat-tu/${r.material_id}`} className={LINK}>
          {r.material_code}
        </Link>
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={r.material_name}>
          {r.material_name}
        </span>
        {phu && (
          <span className="block truncate text-[11.5px] text-[var(--ink-3)]" title={phu}>
            {phu}
          </span>
        )}
      </td>
      <td className={TD}>
        <NguonSo d={d} r={r} />
      </td>
      <td className={`${TD} ${NUM}`}>
        {sua ? (
          <SuaSoCan d={d} r={r} hienTai={m.can} />
        ) : (
          <span className="inline-flex items-baseline gap-1.5">
            <span className={m.can > 0 ? 'font-semibold' : ''}>{so(m.can)}</span>
            <span className="text-[11px] text-[var(--ink-3)]">{r.unit}</span>
            {d.canEdit && (
              <button
                type="button"
                aria-label={`Sửa số cần ${r.material_code}`}
                title="Sửa số cần — thành số nhập tay, thay định mức của mã này"
                onClick={() => d.setDangSua(r.material_id)}
                className="text-[11px] text-[var(--act-text)] hover:underline"
              >
                sửa
              </button>
            )}
          </span>
        )}
      </td>
      <td
        className={`${TD} ${NUM}`}
        title={`Tồn kho ${so0(r.on_hand)} − giữ cho lệnh khác ${so0(r.reserved_others)}`}
      >
        {so0(m.tonKhaDung)}
      </td>
      <td
        className={`${TD} ${NUM}`}
        title={
          m.daGui > 0 || m.nhap > 0
            ? `Đã gửi NCC ${so(m.daGui)} · nháp/chờ duyệt ${so(m.nhap)} — đều đã trừ vào Còn phải đặt`
            : undefined
        }
      >
        {so(m.daGui)}
        {m.nhap > 0 && (
          <span className="block text-[11px] text-[var(--ink-3)]">nháp {so(m.nhap)}</span>
        )}
      </td>
      <td className={`${TD} ${NUM} ${m.conPhaiDat > 0 ? 'font-bold' : ''}`}>
        {so(m.conPhaiDat)}
      </td>
      <td className={`${TD} max-w-[190px]`}>
        <Nhan tone={tt.tone}>{tt.label}</Nhan>
        {r.pos.length > 0 ? (
          <span className="block truncate text-[11.5px] text-[var(--ink-3)]">
            <Link href={`/mua-hang/don/${r.pos[0].id}`} className={LINK}>
              {r.pos[0].code}
            </Link>
            {r.pos.length > 1 ? ` +${r.pos.length - 1}` : ''} · {r.pos[0].supplier_name}
          </span>
        ) : r.last_price ? (
          <span
            className="block truncate text-[11.5px] text-[var(--ink-3)]"
            title={`Mua lần gần nhất ${r.last_price.po_code}`}
          >
            lần trước {r.last_price.supplier_name} ·{' '}
            {r.last_price.unit_price.toLocaleString('vi-VN')}
          </span>
        ) : null}
      </td>
    </tr>
  )
}

/** Số cần đến từ đâu — định mức (SP nào), số nhập tay (ai, khi nào, lệch bao nhiêu). */
function NguonSo({ d, r }: { d: KeHoachCtx; r: BangKeRow }) {
  if (r.source === 'manual') {
    const lech = r.auto_needed != null ? lechPct(r.qty_needed, r.auto_needed) : ''
    return (
      <span className="grid gap-0.5 text-[12px]">
        <span className="flex items-baseline gap-1.5">
          <Nhan tone="run">nhập tay</Nhan>
          <span className="truncate text-[11.5px] text-[var(--ink-3)]">
            {r.edited_by ?? '—'} · {dmy(r.edited_at)}
          </span>
        </span>
        {r.auto_needed != null && (
          <span
            className={`text-[11.5px] ${r.deviates ? 'font-semibold text-[var(--warn)]' : 'text-[var(--ink-3)]'}`}
            title={
              r.deviates
                ? 'Lệch định mức hơn 10% — Kỹ thuật nên xem lại định mức, hoặc ghi lý do ở ghi chú'
                : undefined
            }
          >
            định mức {so(r.auto_needed)} ({lech})
          </span>
        )}
        {r.note && (
          <span className="truncate text-[11.5px] text-[var(--ink-3)]" title={r.note}>
            {r.note}
          </span>
        )}
        {d.canEdit && (
          <button
            type="button"
            disabled={d.busy}
            onClick={() => void d.boSoTay(r.material_id)}
            className="justify-self-start text-[11px] text-[var(--act-text)] hover:underline"
          >
            bỏ số tay
          </button>
        )}
      </span>
    )
  }
  if (r.source === 'none')
    return (
      <span className="text-[12px] text-[var(--ink-3)]">
        ngoài định mức — chỉ thấy vì đã có đơn
      </span>
    )
  if (r.source === 'components')
    return <span className="text-[12px]">bảng định hình của Sản xuất</span>
  const chuaKiem = r.from_products.some((p) => !p.confirmed)
  const tip = r.from_products
    .map(
      (p) =>
        `${p.code} × ${p.qty.toLocaleString('vi-VN')}: ${p.per.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} ${r.unit}/SP${p.confirmed ? '' : ' (chưa kiểm)'}`,
    )
    .join('\n')
  return (
    <span className="grid gap-0.5 text-[12px]" title={tip}>
      <span>
        định mức · {r.from_products.length} SP
        {r.source === 'bom_draft' || chuaKiem ? (
          <span className="text-[var(--ink-3)]"> · chưa kiểm</span>
        ) : null}
      </span>
      <span className="truncate font-mono text-[11px] text-[var(--ink-3)]">
        {r.from_products.map((p) => `${p.code} ×${p.per}`).join(', ')}
      </span>
    </span>
  )
}

/** Ô sửa số cần tại chỗ: Enter lưu, Esc thôi. Lưu là thành số nhập tay. */
function SuaSoCan({ d, r, hienTai }: { d: KeHoachCtx; r: BangKeRow; hienTai: number }) {
  const [v, setV] = useState(hienTai > 0 ? String(hienTai).replace('.', ',') : '')
  const n = parsePasteNumber(v)
  const hong = v.trim() !== '' && (n == null || n < 0)
  async function luu() {
    if (n == null || n < 0) return
    if (await d.ghiSoTay([{ material_id: r.material_id, qty_needed: n }]))
      d.setDangSua(null)
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        aria-label={`Số cần ${r.material_code} (${r.unit})`}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void luu()
          if (e.key === 'Escape') {
            e.stopPropagation()
            d.setDangSua(null)
          }
        }}
        className={`w-[78px] border px-1.5 py-0.5 text-right font-mono text-[12.5px] outline-none focus:border-[var(--act)] ${hong ? 'border-[var(--stop)]' : 'border-[var(--line)]'}`}
      />
      <button
        type="button"
        disabled={hong || n == null || d.busy}
        onClick={() => void luu()}
        className="text-[11.5px] font-semibold text-[var(--act-text)] disabled:text-[var(--ink-3)]"
      >
        Lưu
      </button>
      <button
        type="button"
        onClick={() => d.setDangSua(null)}
        className="text-[11.5px] text-[var(--ink-3)]"
      >
        Thôi
      </button>
    </span>
  )
}

/** Lệnh chưa có số cần nào — nói vì sao và hai đường đi. */
function RongLenh({ d }: { d: KeHoachCtx }) {
  const { products } = d.bk
  return (
    <div className="grid justify-items-start gap-2 bg-[var(--surface-card)] px-4 py-6">
      <b>Chưa có số cần nào cho lệnh này</b>
      <span className="max-w-[70ch] text-[var(--ink-2)]">
        {products.length === 0
          ? 'Lệnh chưa có dòng sản phẩm nào.'
          : `${products.length} SP của lệnh chưa có dòng định mức gắn mã vật tư, nên máy chưa biết cần mua gì. Dán bảng kê đang làm trong Excel vào là sang được bước chọn NCC; muốn máy tự tính thì Kỹ thuật gắn mã cho định mức ở hồ sơ SP.`}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {d.canEdit && (
          <Nut chinh onClick={() => d.setMoDan(true)}>
            Dán bảng kê
          </Nut>
        )}
        {products.slice(0, 3).map((p) => (
          <Nut key={p.id} href={`/products/${p.id}/dinh-muc`}>
            Định mức {p.code}
          </Nut>
        ))}
      </span>
    </div>
  )
}
