'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import type { PhuongAn } from '@/lib/tra-gia-chon'
import { Nhan, NUM, TD, TF, TH } from '../_erp/ui'
import { CHENH_DANG_XEM, type MonTinh, type TraGiaCtx } from './useTraGia'
import { GIA_CU_NGAY, nganNcc, ngay, phanTram, soNgay, tien } from './tra-gia.shared'

const SO_COT = 9
/** Dòng thông báo trong lưới (đang tra, mơ hồ, chưa có giá…) — thụt vào dưới tên món. */
const MSG =
  'border-b border-[var(--hair)] py-2 pr-2.5 pl-[30px] text-[12.5px] text-[var(--ink-2)]'
const LNK = 'cursor-pointer font-semibold text-[var(--act-text)] hover:underline'

/**
 * LƯỚI "THEO MÓN" — mỗi món một dòng xám, các NCC xếp bên dưới (rẻ → đắt).
 * Chọn NCC bằng nút tròn; thành tiền của NCC không chọn vẫn bày mờ để so.
 */
export function BangTheoMon({ d }: { d: TraGiaCtx }) {
  const nam = d.homNay.slice(0, 4)
  const coGia = d.hien.filter((t) => t.chon && !t.chon.tham_khao)
  const thieu = d.hien.filter((t) => !t.chon || t.chon.tham_khao)
  return (
    <table
      className="w-full border-separate border-spacing-0"
      aria-label="So sánh giá theo món"
    >
      <thead>
        <tr>
          <th className={TH} style={{ width: 34 }} />
          <th className={TH}>Món cần mua / Nhà cung cấp</th>
          <th className={`${TH} text-right`}>SL</th>
          <th className={`${TH} text-right`}>Giá</th>
          <th className={TH}>So rẻ nhất</th>
          <th className={TH}>Lần mua gần nhất</th>
          <th className={TH}>Mã · tên trên đơn của NCC</th>
          <th className={`${TH} text-right`} title="SL × giá — ước tính, chưa VAT">
            Thành tiền
          </th>
          <th className={TH} style={{ width: 30 }} />
        </tr>
      </thead>
      <tbody>
        {d.hien.length === 0 && (
          <tr>
            <td
              colSpan={SO_COT}
              className="px-4 py-8 text-center text-[13px] text-[var(--ink-2)]"
            >
              <b className="text-[var(--ink)]">Không có món nào khớp bộ lọc</b>
              <div className="mt-1 text-[12px]">
                {d.mons.length} món trong danh sách, không món nào ở nhóm này.{' '}
                <button type="button" className={LNK} onClick={() => d.setLoc('all')}>
                  Xem cả {d.mons.length} món
                </button>
              </div>
            </td>
          </tr>
        )}
        {d.hien.map((t) => (
          <Fragment key={t.m.id}>
            <DongMon d={d} t={t} nam={nam} />
            {!d.thu.has(t.m.id) && <ChiTiet d={d} t={t} nam={nam} />}
          </Fragment>
        ))}
      </tbody>
      {d.hien.length > 0 && (
        <tfoot>
          <tr>
            <td colSpan={7} className={TF}>
              Cộng {d.hien.length} món · {coGia.length} món có giá chốt
              {d.tong.thamKhao > 0 && (
                <span className="ml-1.5 font-normal text-[var(--ink-3)]">
                  · thêm ≈ {tien(d.tong.thamKhao)} giá tham khảo
                </span>
              )}
              <span className="ml-1.5 font-normal text-[var(--ink-3)]">
                — KHÔNG gồm:{' '}
                {thieu.length ? `${thieu.length} món chưa có giá chốt, ` : ''}giá tham
                khảo, đơn nháp; chưa VAT
              </span>
            </td>
            <td className={`${TF} ${NUM}`}>
              {tien(coGia.reduce((s, t) => s + (t.tien ?? 0), 0))}
            </td>
            <td className={TF} />
          </tr>
        </tfoot>
      )}
    </table>
  )
}

const TOM: Record<MonTinh['trang'], (t: MonTinh) => React.ReactNode> = {
  dang: () => <span className="text-[var(--ink-3)]">đang tra…</span>,
  loi: () => <Nhan tone="stop">tra lỗi</Nhan>,
  ok: (t) => (
    <>
      {t.ds.filter((p) => p.so_duoc).length} NCC ·{' '}
      {t.chenh === 0 ? (
        <Nhan>bằng giá</Nhan>
      ) : (
        <>
          chênh{' '}
          <Nhan tone={(t.chenh ?? 0) > CHENH_DANG_XEM ? 'warn' : 'neutral'}>
            {phanTram(t.chenh ?? 0)}
          </Nhan>
        </>
      )}
    </>
  ),
  one: () => <Nhan>1 NCC, chưa so được</Nhan>,
  mo_ho: () => <Nhan tone="warn">chọn quy cách</Nhan>,
  moi: () => <Nhan tone="run">chưa mua quy cách này</Nhan>,
  trong: () => <Nhan tone="warn">chưa có giá</Nhan>,
}

/** Dòng xám của một món. */
function DongMon({ d, t, nam }: { d: TraGiaCtx; t: MonTinh; nam: string }) {
  const { m } = t
  const mo = !d.thu.has(m.id)
  const kq = m.kq
  const nhan = kq?.quy_cach?.label ?? m.text
  const lanCuoi = t.ds
    .filter((p) => p.nguon === 'don' && p.chon_duoc)
    .map((p) => p.ncc!.at)
    .sort()
    .at(-1)
  return (
    <tr className="bg-[var(--surface-raised)]">
      <td className={`${TD} border-t border-t-[var(--line)]`}>
        <button
          type="button"
          aria-expanded={mo}
          aria-label={`${mo ? 'Thu' : 'Mở'} ${nhan}`}
          onClick={() => d.lat(m.id)}
          className="inline-flex h-[18px] w-[18px] items-center justify-center text-[var(--ink-3)]"
        >
          <span className={`inline-block transition-transform ${mo ? 'rotate-90' : ''}`}>
            ▸
          </span>
        </button>
      </td>
      <td className={`${TD} border-t border-t-[var(--line)]`}>
        <div className="font-bold">{nhan}</div>
        <div
          className="text-[12px] text-[var(--ink-3)]"
          title={kq?.nhom ? `Nhóm: ${kq.nhom}` : undefined}
        >
          gõ “{m.text}”{kq?.so_ma ? ` · khớp ${kq.so_ma} mã` : ''}
        </div>
      </td>
      <td className={`${TD} border-t border-t-[var(--line)] ${NUM}`}>
        <input
          aria-label={`Số lượng ${nhan}`}
          inputMode="decimal"
          className="w-[64px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 py-[2px] text-right font-mono text-[12.5px] outline-none focus:border-[var(--act)]"
          value={m.sl ?? ''}
          placeholder="SL"
          onChange={(e) => {
            const v = e.target.value.replace(/\./g, '').replace(',', '.').trim()
            d.datSl(m.id, v === '' || Number.isNaN(Number(v)) ? null : Number(v))
          }}
        />
        {(m.dvt || t.dv) && (
          <span className="ml-1 font-sans text-[var(--ink-3)]">{m.dvt ?? t.dv}</span>
        )}
      </td>
      <td className={`${TD} border-t border-t-[var(--line)] ${NUM}`}>
        {t.re != null ? (
          <>
            <b className="text-[var(--done)]">{tien(t.re)}</b>
            <span className="ml-1 font-sans text-[11px] text-[var(--ink-3)]">
              đ/{t.dv}
            </span>
          </>
        ) : (
          <span className="text-[var(--ink-3)]">—</span>
        )}
      </td>
      <td
        className={`${TD} border-t border-t-[var(--line)] text-[12px] whitespace-nowrap`}
      >
        {TOM[t.trang](t)}
      </td>
      <td
        className={`${TD} border-t border-t-[var(--line)] font-mono text-[12px] text-[var(--ink-3)]`}
      >
        {lanCuoi ? ngay(lanCuoi, nam) : ''}
      </td>
      <td className={`${TD} border-t border-t-[var(--line)]`}>
        <button
          type="button"
          className={`${LNK} text-[12px] whitespace-nowrap`}
          onClick={() => d.setHoiCho(m.id)}
        >
          + Ghi giá hỏi được
        </button>
      </td>
      <td className={`${TD} border-t border-t-[var(--line)] ${NUM} font-bold`}>
        {t.tien != null ? (
          tien(t.tien)
        ) : t.chon?.tham_khao && m.sl ? (
          <span
            className="font-normal text-[var(--ink-3)]"
            title="Giá tham khảo cùng loại — chưa từng mua quy cách này"
          >
            ≈ {tien(t.chon.gia * m.sl)}
          </span>
        ) : (
          <span className="font-normal text-[var(--ink-3)]">—</span>
        )}
      </td>
      <td className={`${TD} border-t border-t-[var(--line)]`}>
        <button
          type="button"
          aria-label={`Bỏ ${nhan} khỏi danh sách`}
          title="Bỏ món khỏi danh sách"
          onClick={() => d.xoa(m.id)}
          className="text-[15px] leading-none text-[var(--ink-3)] hover:text-[var(--stop)]"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

/** Phần mở ra dưới món: thông báo theo trạng thái + mỗi phương án giá một dòng. */
function ChiTiet({ d, t, nam }: { d: TraGiaCtx; t: MonTinh; nam: string }) {
  const { m } = t
  const kq = m.kq
  const thongBao = (noi: React.ReactNode) => (
    <tr>
      <td className="border-b border-[var(--hair)]" />
      <td colSpan={SO_COT - 1} className={MSG}>
        {noi}
      </td>
    </tr>
  )
  let dau: React.ReactNode = null
  if (t.trang === 'dang' && !kq) dau = thongBao('Đang tra giá…')
  else if (t.trang === 'loi')
    dau = thongBao(
      <>
        <b>Tra không được:</b> {m.loi}{' '}
        <button type="button" className={LNK} onClick={d.traLai}>
          Tra lại
        </button>
      </>,
    )
  else if (t.trang === 'mo_ho' && kq)
    dau = thongBao(
      <span className="flex flex-wrap items-center gap-1.5">
        <b>Khớp {kq.so_ung_vien} quy cách đã từng mua.</b> Chọn một
        {kq.ung_vien.length > 1 && kq.ung_vien.length <= 4
          ? ', hoặc giữ tất cả thành nhiều dòng'
          : ''}
        :
        {kq.ung_vien.map((u) => (
          <button
            key={u.key}
            type="button"
            onClick={() => d.chonQuyCach(m.id, u.key)}
            className="rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[3px] text-[12px] font-semibold hover:border-[var(--act)]"
          >
            {u.label} · {u.so_ncc} NCC
          </button>
        ))}
        {kq.ung_vien.length > 1 && kq.ung_vien.length <= 4 && (
          <button type="button" className={LNK} onClick={() => d.tachQuyCach(m.id)}>
            Giữ tất cả
          </button>
        )}
        {kq.so_ung_vien > kq.ung_vien.length && (
          <span className="text-[var(--ink-3)]">
            · còn {kq.so_ung_vien - kq.ung_vien.length} quy cách nữa — gõ thêm chi tiết
            (cỡ, độ dày, màu) cho gọn
          </span>
        )}
      </span>,
    )
  else if (kq?.trang_thai === 'moi' && !t.ds.some((p) => p.so_duoc)) {
    const khongGia = kq.goi_y.filter((g) => g.gia == null)
    dau = thongBao(
      <>
        Chưa mua <b>{kq.quy_cach?.label ?? m.text}</b> trong kỳ. NCC từng bán cùng loại{' '}
        <b>“{kq.goi_y_theo}”</b>
        {khongGia.length === kq.goi_y.length
          ? ': '
          : ' — giá theo kg / m³ dưới đây dùng làm giá THAM KHẢO; chọn một để đưa vào danh sách, gọi hỏi rồi ghi giá thật.'}
        {khongGia.length > 0 && (
          <span>
            {khongGia.length < kq.goi_y.length ? ' Không kèm giá: ' : ''}
            {khongGia.map((g, i) => (
              <Fragment key={g.supplier_id}>
                {i > 0 && ', '}
                <Link
                  href={`/mua-hang/ncc/${g.supplier_id}`}
                  className={LNK}
                  title={g.mau.join(' · ')}
                >
                  {nganNcc(g.supplier_name)}
                </Link>
              </Fragment>
            ))}
            .
          </span>
        )}
      </>,
    )
  } else if (t.trang === 'trong')
    dau = thongBao(
      <>
        <b>Chưa có giá.</b>{' '}
        {kq?.danh_muc?.group_name
          ? `Gần nhất trong danh mục là ${kq.danh_muc.code} “${kq.danh_muc.name}” (nhóm ${kq.danh_muc.group_name}${kq.danh_muc.sub_group ? ` / ${kq.danh_muc.sub_group}` : ''}), nhưng nhóm này chưa có đơn mua nào trong kỳ. Gọi hỏi giá rồi`
          : 'Không khớp mã nào trong danh mục và chưa từng mua món nào giống vậy. Gõ lại theo tên trong danh mục, hoặc gọi hỏi giá rồi'}{' '}
        <button type="button" className={LNK} onClick={() => d.setHoiCho(m.id)}>
          ghi giá hỏi được
        </button>
        .
      </>,
    )

  const ds = d.chiChon ? t.ds.filter((p) => p.key === t.chon?.key) : t.ds
  return (
    <>
      {dau}
      {ds.map((p) => (
        <DongGia key={p.key} d={d} t={t} p={p} nam={nam} />
      ))}
    </>
  )
}

/** Một phương án giá (NCC trên đơn, giá hỏi được, hoặc gợi ý tham khảo). */
function DongGia({
  d,
  t,
  p,
  nam,
}: {
  d: TraGiaCtx
  t: MonTinh
  p: PhuongAn
  nam: string
}) {
  const { m } = t
  const on = t.chon?.key === p.key
  const n = p.ncc
  const cu = n && soNgay(n.at, d.homNay) > GIA_CU_NGAY
  const tt = p.tham_khao || !m.sl ? null : Math.round(p.gia * m.sl)
  const nen = on ? 'bg-[var(--act-wash)]' : 'hover:bg-[var(--surface-hover)]'
  const mo = !p.chon_duoc ? 'text-[var(--ink-3)]' : ''
  return (
    <tr className={nen}>
      <td className={`${TD} ${on ? 'shadow-[inset_3px_0_0_var(--act)]' : ''}`}>
        {p.chon_duoc ? (
          <input
            type="radio"
            name={`chon-${m.id}`}
            checked={on}
            onChange={() => d.chonNcc(m.id, p.key)}
            aria-label={`Chọn ${p.ten} cho ${m.kq?.quy_cach?.label ?? m.text}`}
            className="h-3.5 w-3.5 accent-[var(--act)]"
          />
        ) : (
          <span
            className="text-[var(--ink-3)]"
            title="Đơn chưa duyệt — giá chưa chốt, chưa chọn được"
          >
            —
          </span>
        )}
      </td>
      <td className={`${TD} pl-[30px] whitespace-nowrap ${mo}`}>
        {n ? (
          <Link
            href={`/mua-hang/ncc/${n.supplier_id}`}
            className="hover:underline"
            title={n.supplier_name}
          >
            {nganNcc(n.supplier_name)}
          </Link>
        ) : (
          nganNcc(p.ten)
        )}
        <span className="ml-1.5 inline-flex gap-1">
          {n?.bien && <Nhan>{n.bien}</Nhan>}
          {p.nguon === 'hoi' && <Nhan tone="run">hỏi giá {ngay(p.hoi!.at, nam)}</Nhan>}
          {p.nguon === 'goi_y' && <Nhan tone="run">tham khảo</Nhan>}
          {cu && (
            <Nhan tone="warn" title={`Mua cách đây ${soNgay(n!.at, d.homNay)} ngày`}>
              giá cũ
            </Nhan>
          )}
        </span>
      </td>
      <td className={TD} />
      <td
        className={`${TD} ${NUM} ${p.so_duoc && p.gia === t.re ? 'font-bold text-[var(--done)]' : mo}`}
        title={
          n?.quy
            ? `${tien(n.quy.gia_goc)} đ/${n.quy.dv_goc} ÷ ${n.quy.moi.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ${n.quy.dv_moi}/${n.quy.dv_goc} = ${tien(p.gia)} đ/${p.dv}`
            : undefined
        }
      >
        {n && !n.chot ? '≈ ' : ''}
        {tien(p.gia)}
        {p.dv !== t.dv && (
          <span className="ml-1 font-sans text-[11px] text-[var(--ink-3)]">đ/{p.dv}</span>
        )}
        {n?.quy && (
          <span className="block font-mono text-[11px] font-normal text-[var(--ink-3)]">
            {tien(n.quy.gia_goc)}/{n.quy.dv_goc}
          </span>
        )}
      </td>
      <td className={`${TD} text-[12px] whitespace-nowrap`}>
        {n && !n.chot ? (
          <span
            className="rounded-[3px] border border-dashed border-[var(--line)] px-1.5 py-[1px] text-[11.5px] text-[var(--ink-3)]"
            title="Đơn chưa duyệt: giá chưa chốt, không xếp hạng"
          >
            nháp, chưa chốt
          </span>
        ) : !p.so_duoc ? (
          p.nguon === 'goi_y' ? (
            <span className="text-[var(--ink-3)]">không xếp hạng</span>
          ) : (
            <span
              className="text-[var(--ink-3)]"
              title="Giá theo đơn vị khác — không so chung"
            >
              khác đơn vị
            </span>
          )
        ) : p.gia === t.re ? (
          <Nhan tone="done">rẻ nhất</Nhan>
        ) : (
          <Nhan tone={p.gia / t.re! - 1 > CHENH_DANG_XEM ? 'warn' : 'neutral'}>
            +{phanTram(p.gia / t.re! - 1)}
          </Nhan>
        )}
      </td>
      <td className={`${TD} text-[12px] whitespace-nowrap`}>
        {n ? (
          <>
            <span className="font-mono">{ngay(n.at, nam)}</span> ·{' '}
            <Link
              href={`/mua-hang/don/${n.po_id}`}
              className="font-mono text-[var(--act-text)] hover:underline"
            >
              {n.po_code}
            </Link>
          </>
        ) : p.goi_y ? (
          <>
            <span className="font-mono">{ngay(p.goi_y.at, nam)}</span>
            <span className="text-[var(--ink-3)]">
              {' '}
              · {p.goi_y.so_dong} dòng trong nhóm
            </span>
          </>
        ) : (
          <span className="text-[var(--ink-3)]">gọi hỏi, chưa qua đơn</span>
        )}
      </td>
      <td className={`${TD} text-[12px]`}>
        <div
          className="flex max-w-[190px] items-baseline gap-2 overflow-hidden whitespace-nowrap"
          title={n?.ten ?? p.hoi?.ghi_chu ?? p.goi_y?.mau.join(' · ') ?? ''}
        >
          {n && (
            <span className="flex-none font-mono text-[var(--act-text)]">
              {n.ma.join(' · ')}
            </span>
          )}
          <span className="min-w-0 overflow-hidden text-ellipsis text-[var(--ink-3)]">
            {n?.ten ??
              p.hoi?.ghi_chu ??
              (p.goi_y ? `cỡ đã mua: ${p.goi_y.mau.join(' · ')}` : '')}
          </span>
        </div>
      </td>
      <td className={`${TD} ${NUM} ${on ? 'font-bold' : 'text-[var(--ink-3)]'}`}>
        {n && !n.chot
          ? ''
          : tt != null
            ? tien(tt)
            : p.tham_khao && m.sl
              ? `≈ ${tien(p.gia * m.sl)}`
              : ''}
      </td>
      <td className={TD}>
        {p.hoi && (
          <button
            type="button"
            aria-label={`Xoá giá hỏi của ${p.ten}`}
            title="Xoá giá hỏi này"
            onClick={() => d.xoaHoi(m.id, p.hoi!.id)}
            className="text-[15px] leading-none text-[var(--ink-3)] hover:text-[var(--stop)]"
          >
            ×
          </button>
        )}
      </td>
    </tr>
  )
}
