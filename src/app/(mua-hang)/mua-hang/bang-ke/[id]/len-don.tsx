'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { tenNganNcc } from '@/lib/goi-y-ncc'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { NUM, Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { so } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'

const COLS = 6
const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'
const tien = (v: number) => Math.round(v).toLocaleString('vi-VN')
const nhanThue = (t: { rate: number; incl: boolean } | null) =>
  t == null
    ? 'thuế theo mẫu'
    : t.rate === 0
      ? 'không VAT'
      : `VAT ${t.rate}%${t.incl ? ' đã gồm' : ''}`

/**
 * BƯỚC 3 · LÊN ĐƠN — mỗi NCC một đơn NHÁP gắn lệnh (bản vẽ WE12EjR5…, Q5).
 * Không tự gửi duyệt, không đổi bảng giá. Người mua đổi được mẫu đơn từng NCC
 * và bỏ NCC nào chưa muốn tạo trước khi bấm.
 */
export function LenDon({ d }: { d: KeHoachCtx }) {
  const l = d.lenDon
  const n = d.ncc
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {l.ketQua && <KetQua d={d} />}
      {l.nhom.length === 0 ? (
        <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
          <b>Chưa có đơn nào để tạo</b>
          <span className="text-[var(--ink-2)]">
            {d.conDat.length === 0
              ? 'Không còn mã nào phải đặt — các mã đã đủ hoặc đã nằm trên đơn nháp.'
              : 'Chưa mã nào có NCC. Chọn NCC ở bước 2 trước.'}
          </span>
          {d.conDat.length > 0 && (
            <Nut onClick={() => d.setBuoc(2)}>Về bước 2 · Chọn NCC</Nut>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <table className="w-full min-w-[900px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className={`${TH} w-[96px]`}>Mã</th>
                <th className={TH}>Vật tư</th>
                <th className={`${TH} w-[110px] text-right`}>SL đặt</th>
                <th className={`${TH} w-[70px]`}>ĐVT</th>
                <th className={`${TH} w-[140px] text-right`}>Đơn giá</th>
                <th className={`${TH} w-[130px] text-right`}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {l.nhom.map((g) => {
                const tao = !l.boQua.has(g.supplier_id)
                return (
                  <Fragment key={g.supplier_id}>
                    <tr>
                      <td
                        colSpan={COLS}
                        className={`border-b border-[var(--line)] px-2.5 py-1.5 ${tao ? 'bg-[var(--surface-raised)]' : 'bg-[var(--surface)] opacity-70'}`}
                      >
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 font-bold">
                            <input
                              type="checkbox"
                              checked={tao}
                              onChange={() => l.doiTao(g.supplier_id)}
                              className="accent-[var(--act)]"
                              aria-label={`Tạo đơn cho ${g.supplier_name}`}
                            />
                            <span title={g.supplier_name}>
                              {tenNganNcc(g.supplier_name)}
                            </span>
                          </label>
                          <span className="text-[12px] text-[var(--ink-3)]">
                            {g.dong.length} mã · {nhanThue(g.thue)}
                          </span>
                          <label className="inline-flex items-center gap-1 text-[12px]">
                            <span className="text-[var(--ink-3)]">Mẫu đơn</span>
                            <select
                              aria-label={`Mẫu đơn cho ${g.supplier_name}`}
                              value={g.mau}
                              onChange={(e) =>
                                l.setMau(g.supplier_id, e.target.value as PoTemplate)
                              }
                              className="border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-[2px]"
                            >
                              {PO_TEMPLATES.map((t) => (
                                <option key={t} value={t}>
                                  {poTemplateMeta(t).label}
                                  {t === g.mauGoiY ? ' (gợi ý)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          {g.thieuGia > 0 && (
                            <Nhan tone="warn">{g.thieuGia} mã chưa có giá</Nhan>
                          )}
                          <span className="ml-auto font-mono text-[13px] font-bold tabular-nums">
                            {tien(g.tien)}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {g.dong.map((x) => {
                      const c = n.chon[x.r.material_id]
                      const tt = n.thanhTien(x)
                      return (
                        <tr key={x.r.material_id} className={tao ? '' : 'opacity-60'}>
                          <td className={`${TD} font-mono text-[12px]`}>
                            {x.r.material_code}
                          </td>
                          <td className={`${TD} max-w-0`}>
                            <span className="block truncate" title={x.r.material_name}>
                              {x.r.material_name}
                            </span>
                          </td>
                          <td className={`${TD} ${NUM}`}>{so(x.d.conPhaiDat)}</td>
                          <td className={`${TD} text-[var(--ink-3)]`}>{x.r.unit}</td>
                          <td className={`${TD} ${NUM}`}>
                            {c.price == null ? (
                              <span className="text-[var(--warn)]">chưa có</span>
                            ) : (
                              <>
                                {tien(c.price)}
                                <span className="text-[11px] text-[var(--ink-3)]">
                                  /{c.co_so === 'kg' ? 'kg' : x.r.unit}
                                </span>
                              </>
                            )}
                          </td>
                          <td className={`${TD} ${NUM}`}>
                            {tt == null ? '—' : tien(tt)}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className={TF}>
                  {l.seTao.length} đơn sẽ tạo ·{' '}
                  {l.seTao.reduce((s, g) => s + g.dong.length, 0)} mã
                </td>
                <td className={`${TF} font-normal text-[var(--ink-3)]`}>chưa VAT</td>
                <td className={`${TF} ${NUM}`}>
                  {tien(l.seTao.reduce((s, g) => s + g.tien, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {l.nhom.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] bg-[var(--surface-raised)] px-4 py-2 text-[12px]">
          {l.chuaNcc.length > 0 && (
            <span className="text-[var(--warn)]">
              {l.chuaNcc.length} mã chưa chọn NCC nên không vào đơn nào —{' '}
              <button type="button" className={LINK} onClick={() => d.setBuoc(2)}>
                chọn ở bước 2
              </button>
            </span>
          )}
          <span className="text-[var(--ink-2)]">
            Tạo NHÁP, chưa gửi duyệt, không đổi bảng giá. Mã đã lên nháp tự rời bảng “còn
            phải đặt” nên bấm lại không tạo trùng.
          </span>
          {d.canEdit && (
            <span className="ml-auto">
              <Nut
                chinh
                busy={l.busy}
                khoa={
                  l.seTao.length === 0 ? 'Tích ít nhất một NCC để tạo đơn' : undefined
                }
                onClick={() => void l.taoDon()}
              >
                Tạo {l.seTao.length} đơn nháp
              </Nut>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** Kết quả lượt tạo: đơn nào đã tạo (mở được), NCC nào lỗi + vì sao. */
function KetQua({ d }: { d: KeHoachCtx }) {
  const r = d.lenDon.ketQua!
  return (
    <div
      role="status"
      className={`shrink-0 border-b px-4 py-2 text-[12.5px] ${r.loi.length ? 'border-[var(--warn-line)] bg-[var(--warn-wash)]' : 'border-[var(--done-line)] bg-[var(--done-wash)]'}`}
    >
      {r.tao.length > 0 && (
        <span className="block">
          <b>Đã tạo {r.tao.length} đơn nháp</b> gắn lệnh {d.bk.lsx.code}:{' '}
          {r.tao.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && ' · '}
              <Link href={`/mua-hang/don/${t.id}`} className={`font-mono ${LINK}`}>
                {t.code}
              </Link>{' '}
              {tenNganNcc(t.supplier_name)} ({t.so_dong} mã
              {t.thieu_gia ? `, ${t.thieu_gia} chưa có giá` : ''})
            </Fragment>
          ))}
          . Mở từng đơn kiểm lại, điền giá còn thiếu rồi gửi duyệt.
        </span>
      )}
      {r.loi.map((x) => (
        <span key={x.supplier_name} className="block text-[var(--stop)]">
          {x.supplier_name}: {x.loi}
        </span>
      ))}
    </div>
  )
}
