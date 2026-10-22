'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { chenhGia, tenNganNcc, type UngVienNcc } from '@/lib/goi-y-ncc'
import { groupForBangKe } from '@/lib/lsx-bang-ke'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { parsePasteNumber, sameUnit } from '@/lib/po-paste'
import { ChipLoc, HangLoc, NUM, Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { dmy, so, type DongKH } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'

const COLS = 9
const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'
const tien = (v: number) => Math.round(v).toLocaleString('vi-VN')

/**
 * BƯỚC 2 · CHỌN NCC — mỗi mã còn phải đặt một NCC + giá (bản vẽ WE12EjR5…, Q3–Q4).
 *
 * Máy chọn sẵn theo `lib/goi-y-ncc`: mua mã này lần gần nhất → rẻ nhất cùng quy
 * cách (đ/kg) → bán nhiều nhất cùng nhóm (giá trống, đi hỏi). Mọi thay đổi ghi
 * ngay vào lệnh (0275); dòng "máy gợi ý" chưa lưu thì nói rõ, có nút lưu cả loạt.
 */
export function ChonNcc({ d }: { d: KeHoachCtx }) {
  const n = d.ncc
  const hien = useMemo(() => {
    const rows = d.conDat.filter((x) => {
      const c = n.chon[x.r.material_id]
      if (n.locNcc === 'chua_gia') return !!c?.supplier_id && c.price == null
      if (n.locNcc === 'chua_luu') return !!c?.supplier_id && !c.luu
      return true
    })
    const byId = new Map(rows.map((x) => [x.r.material_id, x]))
    return groupForBangKe(
      rows.map((x) => x.r),
      partGroupLabel,
      partGroupRank,
    ).map((k) => ({ name: k.name, rows: k.rows.map((r) => byId.get(r.material_id)!) }))
  }, [d.conDat, n.chon, n.locNcc])
  const soHien = hien.reduce((s, k) => s + k.rows.length, 0)

  if (d.conDat.length === 0)
    return (
      <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
        <b>Không còn mã nào phải đặt</b>
        <span className="text-[var(--ink-2)]">
          Mọi mã của lệnh đã đủ (tồn + đã đặt + nháp). Muốn đặt thêm thì sửa số cần ở bước
          1.
        </span>
        <Nut onClick={() => d.setBuoc(1)}>Về bước 1 · Nhu cầu</Nut>
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <HangLoc>
        <ChipLoc
          on={n.locNcc === 'tat_ca'}
          count={d.conDat.length}
          onClick={() => n.setLocNcc('tat_ca')}
        >
          Tất cả mã còn phải đặt
        </ChipLoc>
        <ChipLoc
          on={n.locNcc === 'chua_gia'}
          count={n.dem.chuaGia}
          onClick={() => n.setLocNcc(n.locNcc === 'chua_gia' ? 'tat_ca' : 'chua_gia')}
        >
          Chưa có giá
        </ChipLoc>
        <ChipLoc
          on={n.locNcc === 'chua_luu'}
          count={n.dem.chuaLuu}
          onClick={() => n.setLocNcc(n.locNcc === 'chua_luu' ? 'tat_ca' : 'chua_luu')}
        >
          Máy gợi ý, chưa lưu
        </ChipLoc>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {d.canEdit && n.tich.size > 0 && <GanHangLoat d={d} />}
          {d.canEdit && n.dem.chuaLuu > 0 && (
            <Nut busy={n.busy} onClick={() => void n.luuGoiY()}>
              Lưu {n.dem.chuaLuu} gợi ý của máy
            </Nut>
          )}
        </span>
      </HangLoc>
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[28px]`}>
                <span className="sr-only">Chọn dòng</span>
              </th>
              <th className={`${TH} w-[88px]`}>Mã</th>
              <th className={TH}>Vật tư</th>
              <th className={`${TH} w-[100px] text-right`}>Còn phải đặt</th>
              <th className={`${TH} w-[210px]`}>Nhà cung cấp</th>
              <th className={`${TH} w-[124px] text-right`}>Đơn giá</th>
              <th className={`${TH} w-[170px]`}>Vì sao</th>
              <th className={`${TH} w-[160px]`}>NCC khác</th>
              <th
                className={`${TH} w-[120px] text-right`}
                title="Thành tiền dự kiến, chưa VAT"
              >
                Tiền dự kiến
              </th>
            </tr>
          </thead>
          <tbody>
            {soHien === 0 && (
              <tr>
                <td colSpan={COLS} className={`${TD} py-5 text-[var(--ink-2)]`}>
                  Không mã nào khớp bộ lọc.{' '}
                  <button
                    type="button"
                    className={LINK}
                    onClick={() => n.setLocNcc('tat_ca')}
                  >
                    Xem tất cả
                  </button>
                </td>
              </tr>
            )}
            {hien.map((k) => (
              <Fragment key={k.name}>
                <tr>
                  <td
                    colSpan={COLS}
                    className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]"
                  >
                    {k.name} <span className="font-normal">· {k.rows.length} mã</span>
                  </td>
                </tr>
                {k.rows.map((x) => (
                  <DongChon key={x.r.material_id} d={d} x={x} />
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className={TF}>
                {n.dem.coNcc}/{d.conDat.length} mã đã có NCC · {n.dem.nccs} NCC ·{' '}
                {n.dem.chuaGia} mã chưa có giá
              </td>
              <td colSpan={3} className={`${TF} font-normal text-[var(--ink-3)]`}>
                Tổng dự kiến chưa VAT — không gồm {n.dem.thieuTien} mã chưa tính được tiền
              </td>
              <td className={`${TF} ${NUM}`}>{tien(n.dem.tong)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function DongChon({ d, x }: { d: KeHoachCtx; x: DongKH }) {
  const n = d.ncc
  const { r, d: m } = x
  const c = n.chon[r.material_id]
  const ungVien = n.nguon.goiY[r.material_id] ?? []
  const kg = n.nguon.kgMoiDv[r.material_id]
  const dangChon = ungVien.find((u) => u.supplier_id === c?.supplier_id)
  const khac = ungVien.filter((u) => u.supplier_id !== c?.supplier_id).slice(0, 2)
  const tt = n.thanhTien(x)
  const lechDv = dangChon && !dangChon.giaKg && dangChon.giaDv != null && !sameUnit(dangChon.dvGia, r.unit) // prettier-ignore
  return (
    <tr
      className={
        n.tich.has(r.material_id)
          ? 'bg-[var(--act-wash)]'
          : 'hover:bg-[var(--surface-hover)]'
      }
    >
      <td className={TD}>
        {d.canEdit && (
          <input
            type="checkbox"
            aria-label={`Chọn ${r.material_code} để gán NCC hàng loạt`}
            checked={n.tich.has(r.material_id)}
            onChange={() => n.doiTich(r.material_id)}
            className="accent-[var(--act)]"
          />
        )}
      </td>
      <td className={`${TD} font-mono text-[12px]`}>
        <Link href={`/mua-hang/vat-tu/${r.material_id}`} className={LINK}>
          {r.material_code}
        </Link>
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={r.material_name}>
          {r.material_name}
        </span>
        {r.spec && (
          <span className="block truncate text-[11.5px] text-[var(--ink-3)]">
            {r.spec}
          </span>
        )}
      </td>
      <td className={`${TD} ${NUM}`}>
        <span className="font-semibold">{so(m.conPhaiDat)}</span>{' '}
        <span className="text-[11px] text-[var(--ink-3)]">{r.unit}</span>
      </td>
      <td className={TD}>
        {d.canEdit ? (
          <select
            aria-label={`Nhà cung cấp cho ${r.material_code}`}
            value={c?.supplier_id ?? ''}
            disabled={n.busy}
            onChange={(e) => e.target.value && n.doiNcc(r.material_id, e.target.value)}
            className="w-full max-w-[206px] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-[3px] text-[12.5px]"
            title={c?.supplier_name}
          >
            {!c?.supplier_id && <option value="">— chọn NCC —</option>}
            {ungVien.length > 0 && (
              <optgroup label="Gợi ý">
                {ungVien.map((u) => (
                  <option key={u.supplier_id} value={u.supplier_id}>
                    {tenNganNcc(u.supplier_name)} · {giaNgan(u)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Nhà cung cấp khác">
              {n.nguon.nccs
                .filter((s) => !ungVien.some((u) => u.supplier_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {tenNganNcc(s.name)}
                  </option>
                ))}
            </optgroup>
          </select>
        ) : (
          <span title={c?.supplier_name}>
            {c?.supplier_name ? tenNganNcc(c.supplier_name) : '—'}
          </span>
        )}
      </td>
      <td className={`${TD} ${NUM}`}>
        {c?.supplier_id ? (
          <O_Gia
            key={`${c.supplier_id}-${c.price}`}
            gia={c.price}
            dv={c.co_so === 'kg' ? 'kg' : r.unit}
            khoa={!d.canEdit || n.busy}
            onLuu={(v) => n.doiGia(r.material_id, v)}
            ma={r.material_code}
          />
        ) : (
          '—'
        )}
        {c?.co_so === 'kg' && kg && c.price != null && (
          <span className="block text-[11px] text-[var(--ink-3)]">
            ≈ {tien(c.price * kg)} đ/{r.unit}
          </span>
        )}
      </td>
      <td className={`${TD} max-w-0 text-[12px]`}>
        {c?.supplier_id ? (
          <span className="grid gap-0.5">
            {/* MỘT dòng: nhãn + lý do (cắt ba chấm, rê chuột đọc đủ) — bản đầu
                xuống 3 tầng làm mỗi dòng cao gấp ba (soi 22/10). */}
            <span
              className="flex min-w-0 items-center gap-1.5"
              title={`${c.lyDo}${dangChon?.po_code ? ` · ${dangChon.po_code} ${dmy(dangChon.at)}` : ''}`}
            >
              {c.luu ? <Nhan tone="done">đã lưu</Nhan> : <Nhan>máy gợi ý</Nhan>}
              <span className="truncate text-[11.5px] text-[var(--ink-3)]">
                {c.lyDo}
                {dangChon?.po_code ? ` · ${dangChon.po_code}` : ''}
              </span>
              {c.luu && d.canEdit && (
                <button
                  type="button"
                  disabled={n.busy}
                  className="shrink-0 text-[11px] text-[var(--act-text)] hover:underline"
                  onClick={() => void n.boChon(r.material_id)}
                  title="Bỏ lựa chọn đã lưu — quay về gợi ý của máy"
                >
                  bỏ
                </button>
              )}
            </span>
            {lechDv && (
              <span className="text-[11.5px] text-[var(--warn)]">
                lần trước tính theo {dangChon!.dvGia} ({tien(dangChon!.giaDv!)} đ/
                {dangChon!.dvGia}) — gõ giá theo {r.unit}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[var(--warn)]">
            chưa có NCC nào từng bán — chọn ở danh sách
          </span>
        )}
      </td>
      <td className={`${TD} text-[11.5px] text-[var(--ink-3)]`}>
        {khac.length === 0
          ? '—'
          : khac.map((u) => {
              const ch = dangChon ? chenhGia(dangChon, u) : null
              return (
                <span
                  key={u.supplier_id}
                  className="block truncate"
                  title={u.supplier_name}
                >
                  <b className="font-semibold text-[var(--ink-2)]">
                    {tenNganNcc(u.supplier_name)}
                  </b>{' '}
                  {giaNgan(u)}
                  {ch != null && (
                    <span
                      className={ch > 0 ? 'text-[var(--warn)]' : 'text-[var(--done)]'}
                    >
                      {' '}
                      {ch > 0 ? '+' : ''}
                      {(ch * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
                    </span>
                  )}
                </span>
              )
            })}
      </td>
      <td className={`${TD} ${NUM}`}>{tt == null ? '—' : tien(tt)}</td>
    </tr>
  )
}

/** Giá ngắn của ứng viên: "108.000/kg", "47/Cái", "chưa có giá". */
function giaNgan(u: UngVienNcc): string {
  if (u.giaKg != null) return `${tien(u.giaKg)}/kg`
  if (u.giaDv != null) return `${tien(u.giaDv)}/${u.dvGia}`
  return 'chưa có giá'
}

/** Ô giá: gõ xong rời ô / Enter là lưu. Trống = chưa có giá (đi hỏi). */
function O_Gia({
  gia,
  dv,
  khoa,
  onLuu,
  ma,
}: {
  gia: number | null
  dv: string
  khoa: boolean
  onLuu: (v: number | null) => void
  ma: string
}) {
  const [v, setV] = useState(gia == null ? '' : gia.toLocaleString('vi-VN'))
  const sn = v.trim() === '' ? null : parsePasteNumber(v)
  const hong = v.trim() !== '' && (sn == null || sn < 0)
  const chot = () => !hong && sn !== gia && onLuu(sn)
  return (
    <span className="inline-flex items-baseline justify-end gap-1">
      <input
        aria-label={`Đơn giá ${ma} (đ/${dv})`}
        value={v}
        disabled={khoa}
        placeholder="hỏi giá"
        onChange={(e) => setV(e.target.value)}
        onBlur={chot}
        onKeyDown={(e) =>
          e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()
        }
        className={`w-[86px] border px-1.5 py-[3px] text-right font-mono text-[12.5px] outline-none focus:border-[var(--act)] ${hong ? 'border-[var(--stop)]' : gia == null ? 'border-[var(--warn-line)] bg-[var(--warn-wash)]' : 'border-[var(--line)] bg-[var(--surface-card)]'}`}
      />
      <span className="text-[11px] text-[var(--ink-3)]">/{dv}</span>
    </span>
  )
}

/** Gán một NCC cho mọi dòng đang tích. */
function GanHangLoat({ d }: { d: KeHoachCtx }) {
  const n = d.ncc
  const [ncc, setNcc] = useState('')
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="font-semibold">{n.tich.size} dòng đã tích:</span>
      <select
        aria-label="NCC gán cho các dòng đã tích"
        value={ncc}
        onChange={(e) => setNcc(e.target.value)}
        className="max-w-[220px] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-[3px]"
      >
        <option value="">— chọn NCC —</option>
        {n.nguon.nccs.map((s) => (
          <option key={s.id} value={s.id}>
            {tenNganNcc(s.name)}
          </option>
        ))}
      </select>
      <Nut
        chinh
        busy={n.busy}
        khoa={ncc ? undefined : 'Chọn NCC trước'}
        onClick={() => void n.ganNcc(ncc)}
      >
        Gán NCC
      </Nut>
      <button type="button" className={LINK} onClick={() => n.setTich(new Set())}>
        bỏ tích
      </button>
    </span>
  )
}
