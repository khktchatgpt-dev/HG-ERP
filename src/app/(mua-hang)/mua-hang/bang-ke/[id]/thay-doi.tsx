'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ngayGioVn } from '@/lib/date-vn'
import { NHOM_DOI, type DongDoi, type NhomDoi, type Viec } from '@/lib/lenh-doi'
import { ChipLoc, HangLoc, HopThoai, INPUT, NUM, Nhan, Nut, O, TD, TF, TH, type Tone } from '../../_erp/ui' // prettier-ignore
import { dmy, so0 } from './ke-hoach.shared'
import type { KeHoachCtx } from './useKeHoachMua'

const COLS = 10
const LINK = 'text-[var(--act-text)] underline-offset-2 hover:underline'
const THU_TU_NHOM: NhomDoi[] = ['dat_them', 'thua', 'chua_ma', 'du']

/** "dd/mm" theo giờ VN của một mốc giờ. */
const ngay = (at: string | null) => (at ? ngayGioVn(at).slice(0, 5) : '')
const pct = (x: number) =>
  `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

/**
 * TAB "THAY ĐỔI CHỜ SOÁT" — bản vẽ https://claude.ai/artifact/RL9ToGvjouLFkhNVeruAbS
 * (duyệt 02/11/2026). Câu tab trả lời: TỪ LẦN SOÁT TRƯỚC, LỆNH NÀY ĐỔI GÌ, VÀ
 * TÔI PHẢI LÀM GÌ VỚI TỪNG THAY ĐỔI. Đứng trước 3 bước; mở lệnh đang chờ soát
 * là vào thẳng đây. "Đã soát" ở góc phải đầu trang ghi mốc mới (0282).
 */
export function ThayDoi({ d }: { d: KeHoachCtx }) {
  const t = d.doi.thayDoi
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {t.thongTin.length > 0 && <ThongTinDoi d={d} />}
      {t.suaSauMoc && <SuaSauDuyet d={d} />}
      {t.dong.length > 0 && <LuoiDoi d={d} />}
      {!t.choSoat && (
        <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
          <b>Không có thay đổi từ lần soát cuối</b>
          <span className="text-[var(--ink-2)]">
            Định mức và lệnh khớp với mốc đã soát.
          </span>
          <Nut onClick={() => d.setBuoc(1)}>Sang bước 1 · Nhu cầu</Nut>
        </div>
      )}
    </div>
  )
}

/** Ngày xuất / mốc vật tư / SL từng SP đổi — một dòng, mỗi việc một cụm. */
function ThongTinDoi({ d }: { d: KeHoachCtx }) {
  const cum = d.doi.thayDoi.thongTin.map((x) => {
    const gt = (v: string | number | null) =>
      v === null ? '—' : typeof v === 'number' ? so0(v) : dmy(v)
    if (x.k === 'sp_them') return `Thêm SP ${x.nhan} (${gt(x.nay)})`
    if (x.k === 'sp_bo') return `Gỡ SP ${x.nhan} (${gt(x.truoc)})`
    const nhan = x.k === 'sp_sl' ? `SL ${x.nhan}` : x.nhan
    return `${nhan} ${gt(x.truoc)} → ${gt(x.nay)}`
  })
  return (
    <div className="flex shrink-0 flex-wrap gap-x-3 border-b border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-1.5 text-[12.5px] text-[var(--warn)]">
      <b>Lệnh đổi:</b>
      {cum.map((c) => (
        <span key={c} className="font-mono">
          {c}
        </span>
      ))}
    </div>
  )
}

/**
 * Chưa soát lần nào mà định mức / dòng lệnh sửa sau lúc duyệt — phần này không
 * còn số cũ. Có bảng từng mã thì gọn một dòng; không có thì bày theo SP.
 */
function SuaSauDuyet({ d }: { d: KeHoachCtx }) {
  const s = d.doi.thayDoi.suaSauMoc!
  const ai = [
    ...s.nguoi,
    ...(s.khongTen ? [`${s.khongTen} dòng không ghi người sửa`] : []),
  ]
  const cau = [
    s.dongDinhMuc ? `${s.dongDinhMuc} dòng định mức${s.dongChuaMa ? ` (${s.dongChuaMa} dòng chưa gắn mã kho)` : ''}` : '', // prettier-ignore
    s.dongLenh ? `${s.dongLenh} dòng lệnh` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const coBang = d.doi.thayDoi.dong.length > 0
  const moc = d.doi.thayDoi.moc
  const laDuyet = moc.k !== 'duyet' || moc.laDuyet
  return (
    <section
      aria-label="Sửa sau lúc duyệt"
      className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2 text-[12.5px]">
        <span className="font-semibold text-[var(--warn)]">
          Sửa sau {laDuyet ? 'duyệt' : 'phát lệnh'} {dmy(s.tu)}: {cau}
        </span>
        <span className="text-[var(--ink-3)]">
          lần cuối {ngay(s.lanCuoi)}
          {ai.length > 0 && ` · ${ai.join(', ')}`}
        </span>
        {!coBang && (
          <span className="text-[var(--ink-2)]">
            Không còn số cũ để so từng dòng — soát ở bước 1 rồi bấm Đã soát; từ lần sau
            máy so từng mã.
          </span>
        )}
        {!coBang && (
          <span className="ml-auto">
            <Nut onClick={() => d.setBuoc(1)}>Sang bước 1 · Nhu cầu</Nut>
          </span>
        )}
      </div>
      {!coBang && s.sps.length > 0 && (
        <table className="w-full border-collapse border-t border-[var(--hair)]">
          <thead>
            <tr>
              <th className={`${TH} w-[160px]`}>Sản phẩm</th>
              <th className={`${TH} w-[120px] text-right`}>Dòng sửa</th>
              <th className={`${TH} w-[120px]`}>Lần cuối</th>
              <th className={TH}>Người sửa</th>
            </tr>
          </thead>
          <tbody>
            {s.sps.map((p) => (
              <tr key={p.code}>
                <td className={`${TD} font-mono text-[12px]`}>{p.code}</td>
                <td className={`${TD} ${NUM}`}>{so0(p.dong)}</td>
                <td className={`${TD} font-mono tabular-nums whitespace-nowrap`}>{ngayGioVn(p.lanCuoi)}</td>
                <td className={`${TD} text-[var(--ink-2)]`}>
                  {p.nguoi ?? 'không ghi người sửa'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function LuoiDoi({ d }: { d: KeHoachCtx }) {
  const x = d.doi
  const m = x.thayDoi.moc
  const nhanTruoc = m.k === 'soat' ? 'Lần soát' : m.laDuyet ? 'Lúc duyệt' : 'Lúc phát'
  const nhoms = THU_TU_NHOM.filter((n) => x.hien.some((r) => r.nhom === n))
  return (
    <>
      <HangLoc>
        <ChipLoc
          on={x.loc === null}
          count={x.thayDoi.dong.length}
          onClick={() => x.setLoc(null)}
        >
          Tất cả
        </ChipLoc>
        {THU_TU_NHOM.filter((n) => x.dem[n] > 0).map((n) => (
          <ChipLoc
            key={n}
            on={x.loc === n}
            count={x.dem[n]}
            onClick={() => x.setLoc(x.loc === n ? null : n)}
          >
            {NHOM_DOI[n].nhan}
          </ChipLoc>
        ))}
        <input
          type="search"
          aria-label="Tìm mã, tên vật tư đổi"
          placeholder="Tìm mã, tên vật tư…"
          value={x.q}
          onChange={(e) => x.setQ(e.target.value)}
          className="ml-auto w-[220px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[4px] text-[12.5px] outline-none focus:border-[var(--act)]"
        />
      </HangLoc>
      {x.hien.length === 0 ? (
        <div className="grid justify-items-start gap-1.5 bg-[var(--surface-card)] px-4 py-6">
          <b>Không thay đổi nào khớp bộ lọc</b>
          <span className="text-[var(--ink-2)]">
            Lệnh có {x.thayDoi.dong.length} thay đổi — bộ lọc hiện tại không để lại dòng
            nào.
          </span>
          <Nut onClick={() => (x.setLoc(null), x.setQ(''))}>Bỏ lọc</Nut>
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
                const rows = x.hien.filter((r) => r.nhom === n)
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
                          <button
                            type="button"
                            className={`ml-3 font-semibold ${LINK}`}
                            onClick={() => d.setBuoc(2)}
                          >
                            Sang bước 2 · Chọn NCC
                          </button>
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
                  {x.thayDoi.dong.length} mã đổi
                  {THU_TU_NHOM.filter((n) => x.dem[n] > 0)
                    .map((n) => ` · ${x.dem[n]} ${NHOM_DOI[n].nhan.toLowerCase()}`)
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

/** Hộp "Đã soát" — ghi mốc mới, kèm ghi chú tuỳ chọn. */
export function HopSoat({ d }: { d: KeHoachCtx }) {
  const x = d.doi
  const dat = x.dem.dat_them
  return (
    <HopThoai
      title={`Ghi mốc soát · ${d.bk.lsx.code}`}
      aside={x.soDoi > 0 ? `${x.soDoi} thay đổi` : undefined}
      onClose={() => x.setMoSoat(false)}
      footer={
        <>
          <Nut onClick={() => x.setMoSoat(false)}>Huỷ</Nut>
          <Nut chinh busy={x.busy} onClick={() => void x.soat()}>
            Đã soát
          </Nut>
        </>
      }
    >
      <ul className="m-0 grid gap-0.5 pl-[18px] text-[var(--ink-2)]">
        <li>Từ giờ máy so với số hôm nay; lần đổi sau chỉ hiện phần đổi mới.</li>
        {dat > 0 && (
          <li>{dat} mã phải đặt thêm vẫn nằm ở bước 1 Nhu cầu, mục “Còn phải đặt”.</li>
        )}
      </ul>
      <O label="Ghi chú · không bắt buộc">
        <textarea
          id="kh-soat-ghi-chu"
          rows={3}
          maxLength={500}
          value={x.ghiChu}
          onChange={(e) => x.setGhiChu(e.target.value)}
          className={INPUT}
          placeholder="Đã giao ai đặt, đã hỏi Kỹ thuật mã nào…"
        />
      </O>
    </HopThoai>
  )
}

/** ⋯ › Lịch sử soát — ai soát, lúc nào, mấy thay đổi, ghi chú. */
export function HopLichSu({ d }: { d: KeHoachCtx }) {
  const x = d.doi
  return (
    <HopThoai
      title={`Lịch sử soát · ${d.bk.lsx.code}`}
      onClose={() => x.setMoLichSu(false)}
      width={640}
      footer={<Nut onClick={() => x.setMoLichSu(false)}>Đóng</Nut>}
    >
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-[128px]`}>Lúc</th>
            <th className={`${TH} w-[150px]`}>Người</th>
            <th className={`${TH} w-[72px] text-right`}>Đổi</th>
            <th className={TH}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {x.lichSu.map((l) => (
            <tr key={l.id}>
              <td className={`${TD} font-mono tabular-nums whitespace-nowrap`}>{ngayGioVn(l.luc)}</td>
              <td className={TD}>{l.boi ?? '—'}</td>
              <td className={`${TD} ${NUM}`}>{so0(l.so_doi)}</td>
              <td className={`${TD} whitespace-pre-wrap`}>{l.ghi_chu ?? ''}</td>
            </tr>
          ))}
          <tr>
            <td className={`${TD} font-mono tabular-nums whitespace-nowrap text-[var(--ink-3)]`}>
              {x.duyetLuc ? ngayGioVn(x.duyetLuc) : '—'}
            </td>
            <td className={`${TD} text-[var(--ink-3)]`}>mốc đầu</td>
            <td className={`${TD} ${NUM} text-[var(--ink-3)]`}>—</td>
            <td className={`${TD} text-[var(--ink-3)]`}>
              lúc duyệt lệnh (ảnh chụp định mức)
            </td>
          </tr>
        </tbody>
      </table>
    </HopThoai>
  )
}
