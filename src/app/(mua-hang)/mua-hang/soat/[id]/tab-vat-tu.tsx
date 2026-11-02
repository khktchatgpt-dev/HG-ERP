'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ngayGioVn } from '@/lib/date-vn'
import {
  NHOM_DOI,
  type DongDinhMuc,
  type DongDoi,
  type DongLenh,
  type NhomDoi,
  type Viec,
} from '@/lib/lenh-doi'
import { ChipLoc, HangLoc, NUM, Nhan, Nut, TD, TF, TH, type Tone } from '../../_erp/ui'
import { so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import {
  aiLucLenh,
  moTaAnhHuong,
  moTaDoi,
  moTaLenh,
  NHAN_LOAI_DM,
  ngayGio,
  tenNhom,
} from './soat.shared'
import type { SoatCtx } from './useSoatLenh'

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
  // Cột ▸ chỉ có khi ít nhất một mã có nguồn để mở: dòng định mức (0284) hoặc
  // dòng lệnh (0285) gây đổi.
  const coMo = d.thayDoi.dong.some((r) => r.nguonDm.length + r.nguonLenh.length > 0)
  const COLS = coMo ? 11 : 10
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
                {coMo && (
                  <th className={`${TH} w-[30px]`} aria-label="Thay đổi gây ra số mới" />
                )}
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
                      <Fragment key={r.key}>
                        <DongThayDoi
                          r={r}
                          coMo={coMo}
                          mo={d.mo.has(r.key)}
                          batMo={() => d.batMo(r.key)}
                        />
                        {d.mo.has(r.key) && (
                          <NguonThayDoi
                            cols={COLS}
                            ds={r.nguonDm.map((k) => d.dmTheoKhoa.get(k)).filter((x): x is DongDinhMuc => !!x)} // prettier-ignore
                            dl={r.nguonLenh.map((k) => d.lenhTheoKhoa.get(k)).filter((x): x is DongLenh => !!x)} // prettier-ignore
                            code={r.code}
                          />
                        )}
                      </Fragment>
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

function DongThayDoi({
  r,
  coMo,
  mo,
  batMo,
}: {
  r: DongDoi
  coMo: boolean
  mo: boolean
  batMo: () => void
}) {
  const chuaMa = r.material_id === null && r.code === null
  const so = (v: number | null) => (v === null ? '—' : so0(v))
  const viec = moTaViec(r.viec)
  const nguon = [
    r.nguonDm.length && `${r.nguonDm.length} dòng định mức`,
    r.nguonLenh.length && `${r.nguonLenh.length} dòng lệnh`,
  ]
    .filter(Boolean)
    .join(' · ')
  const sps = r.sps.join(', ')
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      {coMo && (
        <td className={`${TD} px-1 text-center`}>
          {r.nguonDm.length + r.nguonLenh.length > 0 && (
            <button
              type="button"
              aria-expanded={mo}
              aria-label={`${mo ? 'Đóng' : 'Xem'} ${nguon} gây đổi ${r.code ?? r.name}`}
              title={`${nguon} gây đổi`}
              onClick={batMo}
              className="h-5 w-5 rounded-[3px] text-[11px] leading-none text-[var(--act-text)] hover:bg-[var(--act-wash)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--act)]"
            >
              {mo ? '▾' : '▸'}
            </button>
          )}
        </td>
      )}
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

/**
 * Dòng mở ra dưới một mã: những thay đổi đã gây ra số mới của nó — dòng định
 * mức (SP, chi tiết, cũ → mới, × SL SP = số đổi của CHÍNH mã này) và dòng lệnh
 * (SP dùng mã này đổi SL / thêm / bỏ), ai sửa lúc nào. Người mua cầm số
 * "Đặt …" đi sửa đơn và biết luôn vì sao.
 */
function NguonThayDoi({
  cols,
  ds,
  dl,
  code,
}: {
  cols: number
  ds: DongDinhMuc[]
  dl: DongLenh[]
  code: string | null
}) {
  const ma = code?.trim().toUpperCase() ?? null
  return (
    <tr>
      <td className="border-b border-[var(--hair)] bg-[var(--surface-raised)]" />
      <td
        colSpan={cols - 1}
        className="border-b border-[var(--hair)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[12.5px]"
      >
        <ul className="m-0 grid list-none gap-1 p-0">
          {ds.map((x) => {
            const a = x.sau ?? x.truoc!
            // Phần ảnh hưởng của đúng mã đang mở (đổi mã thì dòng có hai mục).
            const ah = x.anhHuong.find((h) => h.code === ma) ?? x.anhHuong[0]
            const m = ah ? moTaAnhHuong(ah) : null
            return (
              <li key={x.key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[12px]">{x.sp}</span>
                <span className="text-[var(--ink-3)]">· {tenNhom(a.group_code)} ·</span>
                <span>{a.part_name ?? '—'}</span>
                <span className="text-[var(--ink-3)]">· {NHAN_LOAI_DM[x.loai]}</span>
                <span>{moTaDoi(x).join(' · ')}</span>
                {m && (
                  <span title={m.phep}>
                    × {so0(x.slSp)} SP = <b className="font-mono tabular-nums">{m.chu}</b>
                  </span>
                )}
                <span className="text-[var(--ink-3)]">
                  · {x.boi ?? 'không ghi người'} · {ngayGio(x.luc)}
                </span>
              </li>
            )
          })}
          {dl.map((x) => {
            const m = moTaLenh(x)
            const al = aiLucLenh(x)
            return (
              <li key={x.key} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[var(--ink-3)]">Lệnh ·</span>
                <span>{m.gi}</span>
                <span className="font-mono text-[12px]">{m.cuMoi}</span>
                <span className="text-[var(--ink-3)]">
                  · {al.ai} · {al.luc}
                </span>
              </li>
            )
          })}
        </ul>
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
