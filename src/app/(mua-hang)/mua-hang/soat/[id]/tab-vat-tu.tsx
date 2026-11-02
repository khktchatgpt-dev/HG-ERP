'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ngayGioVn } from '@/lib/date-vn'
import { NHOM_DOI, type DongDoi, type NhomDoi, type Viec } from '@/lib/lenh-doi'
import { ChipLoc, HangLoc, NUM, Nhan, Nut, TD, TF, TH, type Tone } from '../../_erp/ui'
import { so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import type { SoatCtx } from './useSoatLenh'

const COLS = 10
const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'
const THU_TU_NHOM: NhomDoi[] = ['dat_them', 'thua', 'chua_ma', 'du']

/** "dd/mm" theo giờ VN của một mốc giờ. */
export const ngay = (at: string | null) => (at ? ngayGioVn(at).slice(0, 5) : '')
const pct = (x: number) =>
  `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

/**
 * TAB "VẬT TƯ" — việc phải làm với đơn mua: mã nào đổi số cần, đã đặt bao
 * nhiêu, đặt thêm / thừa, trên đơn nào. Số "Đặt" là CÒN PHẢI ĐẶT của Kế hoạch
 * mua bước 1 (`tinhDongMua`) — hai trang không được nói hai số.
 */
export function TabVatTu({ d }: { d: SoatCtx }) {
  const m = d.thayDoi.moc
  const nhanTruoc = m.k === 'soat' ? 'Lần soát' : m.laDuyet ? 'Lúc duyệt' : 'Lúc phát'
  const nhoms = THU_TU_NHOM.filter((n) => d.hien.some((r) => r.nhom === n))
  if (d.thayDoi.dong.length === 0)
    return (
      <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
        <b>Số cần vật tư không đổi từ {m.k === 'soat' ? 'lần soát cuối' : 'lúc duyệt'}</b>
        <span className="text-[var(--ink-2)]">
          {d.thayDoi.choSoat
            ? 'Thay đổi của lệnh này nằm ở tab bên cạnh, chưa làm đổi số cần của mã vật tư nào.'
            : 'Định mức và lệnh khớp với mốc đã soát.'}
        </span>
        <Nut href={`/mua-hang/bang-ke/${d.lsx.id}`}>Mở kế hoạch mua</Nut>
      </div>
    )
  return (
    <>
      <HangLoc>
        <ChipLoc
          on={d.loc === null}
          count={d.thayDoi.dong.length}
          onClick={() => d.setLoc(null)}
        >
          Tất cả
        </ChipLoc>
        {THU_TU_NHOM.filter((n) => d.dem[n] > 0).map((n) => (
          <ChipLoc
            key={n}
            on={d.loc === n}
            count={d.dem[n]}
            onClick={() => d.setLoc(d.loc === n ? null : n)}
          >
            {NHOM_DOI[n].nhan}
          </ChipLoc>
        ))}
        <input
          type="search"
          aria-label="Tìm mã, tên vật tư đổi"
          placeholder="Tìm mã, tên vật tư…"
          value={d.q}
          onChange={(e) => d.setQ(e.target.value)}
          className="ml-auto w-[220px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[4px] text-[12.5px] outline-none focus:border-[var(--act)]"
        />
      </HangLoc>
      {d.hien.length === 0 ? (
        <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
          <b>Không thay đổi nào khớp bộ lọc</b>
          <span className="text-[var(--ink-2)]">
            Lệnh có {d.thayDoi.dong.length} thay đổi — bộ lọc hiện tại không để lại dòng
            nào.
          </span>
          <Nut onClick={() => (d.setLoc(null), d.setQ(''))}>Bỏ lọc</Nut>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <table className="w-full min-w-[980px] table-fixed border-collapse">
            <thead>
              <tr>
                <th className={`${TH} w-[92px]`}>Mã</th>
                <th className={TH}>Vật tư</th>
                <th className={`${TH} w-[56px]`}>ĐVT</th>
                <th className={`${TH} w-[118px]`}>Đổi</th>
                <th className={`${TH} w-[88px] text-right`}>{nhanTruoc}</th>
                <th className={`${TH} w-[88px] text-right`}>Nay</th>
                <th className={`${TH} w-[92px] text-right`}>Đã có đơn</th>
                <th className={`${TH} w-[168px]`}>Việc</th>
                <th className={`${TH} w-[128px]`}>Đơn mua</th>
                <th className={`${TH} w-[132px]`}>Do sửa</th>
              </tr>
            </thead>
            <tbody>
              {nhoms.map((n) => {
                const rows = d.hien.filter((r) => r.nhom === n)
                return (
                  <Fragment key={n}>
                    <tr>
                      <td
                        colSpan={COLS}
                        className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)]"
                      >
                        {NHOM_DOI[n].nhan}{' '}
                        <span className="font-normal">· {rows.length} mã</span>
                        {n === 'dat_them' && (
                          <Link
                            href={`/mua-hang/bang-ke/${d.lsx.id}?buoc=2`}
                            className={`ml-3 font-semibold ${LINK}`}
                          >
                            Sang Kế hoạch mua · Chọn NCC
                          </Link>
                        )}
                      </td>
                    </tr>
                    {rows.map((r) => (
                      <DongThayDoi key={r.key} r={r} />
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={COLS} className={TF}>
                  {d.thayDoi.dong.length} mã đổi
                  {THU_TU_NHOM.filter((n) => d.dem[n] > 0)
                    .map((n) => ` · ${d.dem[n]} ${NHOM_DOI[n].nhan.toLowerCase()}`)
                    .join('')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}

const NHAN_LOAI = { moi: 'Mã mới', doi_sl: 'Đổi SL', bo: 'Bỏ khỏi định mức' } as const

function DongThayDoi({ r }: { r: DongDoi }) {
  const chuaMa = r.material_id === null && r.code === null
  const so = (v: number | null) => (v === null ? '—' : so0(v))
  const viec = moTaViec(r.viec)
  const sps = r.sps.join(', ')
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={`${TD} font-mono text-[12px]`}>
        {r.material_id ? (
          <Link href={`/mua-hang/vat-tu/${r.material_id}`} className={LINK}>
            {r.code}
          </Link>
        ) : (
          <span className="text-[var(--ink-3)]">{chuaMa ? 'chưa mã' : r.code}</span>
        )}
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={r.name}>
          {r.name}
        </span>
      </td>
      <td className={`${TD} text-[12px]`}>{r.unit ?? ''}</td>
      <td className={TD}>
        <Nhan>{chuaMa && r.loai === 'moi' ? 'Mới' : NHAN_LOAI[r.loai]}</Nhan>
      </td>
      <td
        className={`${TD} ${NUM}`}
        title={r.uoc ? 'Ước từ định mức gốc lúc duyệt (ảnh chụp chưa quy đổi đơn vị mua)' : undefined} // prettier-ignore
      >
        {r.uoc && r.truoc ? `≈ ${so(r.truoc)}` : so(r.truoc)}
      </td>
      <td className={`${TD} ${NUM} font-semibold`}>{so(r.nay)}</td>
      <td className={`${TD} ${NUM} ${r.daCoDon === null ? 'text-[var(--ink-3)]' : ''}`}>
        {r.daCoDon === null ? '—' : so0(r.daCoDon)}
      </td>
      <td className={TD}>
        <Nhan tone={viec.tone}>{viec.nhan}</Nhan>
        {viec.phu && (
          <span className="ml-1.5 text-[11.5px] text-[var(--ink-3)]">{viec.phu}</span>
        )}
      </td>
      <td className={`${TD} max-w-0`}>
        {r.pos.length > 0 ? (
          <span className="block truncate" title={r.pos.map((p) => p.code).join(', ')}>
            <Link
              href={`/mua-hang/don/${r.pos[0].id}`}
              className={`font-mono text-[12px] ${LINK}`}
            >
              {r.pos[0].code}
            </Link>
            {r.pos.length > 1 && (
              <span className="text-[var(--ink-3)]"> +{r.pos.length - 1}</span>
            )}
          </span>
        ) : (
          <span className="text-[var(--ink-3)]">
            {chuaMa ? 'không so được' : 'chưa có'}
          </span>
        )}
      </td>
      <td className={`${TD} max-w-0 text-[12px] text-[var(--ink-3)]`}>
        <span className="block truncate" title={sps || undefined}>
          {r.sps.length > 0 ? `${r.sps.length} SP` : ''}
          {r.suaLuc &&
            ` · ${r.suaBoi ? tenNgan(r.suaBoi) : 'không ghi người'} ${ngay(r.suaLuc)}`}
        </span>
      </td>
    </tr>
  )
}

/** Tên gọi trong cột hẹp: chữ cuối của họ tên ("Lê Tú Thức" → "Thức"). */
function tenNgan(ten: string): string {
  return ten.trim().split(/\s+/).at(-1) ?? ten
}

function moTaViec(v: Viec): { nhan: string; tone: Tone; phu?: string } {
  switch (v.k) {
    case 'dat':
      return { nhan: `Đặt ${so0(v.qty)}`, tone: 'warn' }
    case 'thua':
      return { nhan: `Thừa ${so0(v.qty)} · soát đơn`, tone: 'stop' }
    case 'du_vuot':
      return { nhan: `Dư ${so0(v.qty)} (${pct(v.pct)})`, tone: 'warn' }
    case 'du':
      return { nhan: 'Đủ', tone: 'done', phu: v.tuTon ? 'có tồn' : v.pct > 0 ? `dư ${pct(v.pct)}` : undefined } // prettier-ignore
    case 'khong_can':
      return { nhan: 'Không cần nữa', tone: 'done' }
    case 'chua_ma':
      return v.tang === null
        ? { nhan: 'Cần gắn mã kho', tone: 'warn' }
        : { nhan: `${v.tang >= 0 ? 'Tăng' : 'Giảm'} ${so0(Math.abs(v.tang))} · cần gắn mã`, tone: 'warn' } // prettier-ignore
  }
}
