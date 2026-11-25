'use client'

import './so-phieu.css'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, FileText, Printer } from 'lucide-react'
import { useBeRong } from '@/lib/use-be-rong'
import { isoToVn } from '@/lib/date-vn'
import {
  KY_TAT_CA,
  RO_NHAP,
  RO_XUAT,
  coTinh,
  doiKy,
  khopTim,
  kyTrongCau,
  lyDoPhieu,
  nhanKy,
  nhomXuat,
  tongSo,
  type Ky,
  type RoNhap,
  type RoXuat,
  type SoPhieuDong,
  type SoPhieuLoai,
} from '@/lib/kho-so-phieu'
import type { SoPhieuKy } from '@/modules/dept/warehouse/so-phieu.service'
import { ApNhom, ApNut, DauTrang, KhoKhung, Rong, ThanhLoc, ThanhTT } from '../_erp/khung'
import { BangSoPhieu } from './bang-so-phieu'
import { LocGiu } from '../nhap/loc-giu'
import { cheDoMacDinh, khopGiu, type CheDoGiu } from '@/lib/kho-phu-trach'

const fmt = (n: number) => n.toLocaleString('vi-VN')

const NHAN_RO: Record<RoNhap | RoXuat, string> = {
  all: 'Tất cả',
  thieu: 'Thiếu số NCC',
  dao: 'Đã đảo',
  lenh: 'Cấp cho lệnh',
  tra: 'Trả NCC',
  khac: 'Xuất khác',
}

export type SoPhieuLoc = { q: string; ro: string; lyDo: string; nguoi: string }

/**
 * SỔ PHIẾU THEO KỲ — Phiếu nhập / Phiếu xuất (bản vẽ
 * https://claude.ai/artifact/JG1wTjeFFCmHauZfmNhdGa, duyệt 23/11/2026). Thay trang
 * "Phiếu đã ghi" trộn 247 phiếu mọi loại, 50 phiếu một trang.
 *
 * Câu màn trả lời: Kho đã ghi những phiếu nào, trong kỳ nào, vì việc gì?
 * Kỳ tháng ‹ › đổi trên server (URL `?ky=`); tìm / rổ / lý do / người lập lọc tại
 * chỗ trên phiếu của kỳ (≤ 140 phiếu một tháng) và ghi lại URL bằng
 * `history.replaceState(null, …)`.
 */
export function SoPhieuKyScreen({
  loai,
  ky,
  today,
  data,
  loc,
  canEdit,
  meId = '',
}: {
  loai: SoPhieuLoai
  ky: Ky
  today: string
  data: SoPhieuKy
  loc: SoPhieuLoc
  canEdit: boolean
  /** Người xem — lọc "Của tôi" theo nhóm vật tư (0305, bước 3). */
  meId?: string
}) {
  const router = useRouter()
  const nhap = loai === 'receipt'
  const tenLoai = nhap ? 'phiếu nhập' : 'phiếu xuất'
  const base = nhap ? '/warehouse/phieu-nhap' : '/warehouse/phieu-xuat'
  const ROS: readonly (RoNhap | RoXuat)[] = nhap ? RO_NHAP : RO_XUAT

  const [q, setQ] = useState(loc.q)
  const [ro, setRo] = useState<RoNhap | RoXuat>(
    (ROS as readonly string[]).includes(loc.ro) ? (loc.ro as RoNhap | RoXuat) : 'all',
  )
  const [lyDo, setLyDo] = useState(loc.lyDo)
  const [nguoi, setNguoi] = useState(loc.nguoi)
  const [chon, setChon] = useState<string | null>(null)
  // Q3: nhân viên Kho có phiếu của mình mở là "Của tôi"; thủ kho / người ngoài Kho "Tất cả".
  const [cheDo, setCheDo] = useState<CheDoGiu>(() =>
    cheDoMacDinh(
      meId,
      data.nguoiKho,
      data.rows.map((d) => d.giu ?? []),
    ),
  )
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  // < 1000px (laptop phóng 125%): ẩn Người lập để Nhà cung cấp còn chỗ (1280 → khung 1053).
  const gon = beRong > 0 && beRong < 1000

  const thamSo = (p: Partial<SoPhieuLoc> & { ky?: Ky }) => {
    const v = { q, ro, lyDo, nguoi, ky, ...p }
    const s = new URLSearchParams()
    if (v.ky !== today.slice(0, 7)) s.set('ky', v.ky)
    if (v.q.trim()) s.set('q', v.q.trim())
    if (v.ro !== 'all') s.set('ro', v.ro)
    if (v.lyDo) s.set('ly_do', v.lyDo)
    if (v.nguoi) s.set('nguoi', v.nguoi)
    const qs = s.toString()
    return qs ? `${base}?${qs}` : base
  }
  const ghiUrl = (p: Partial<SoPhieuLoc>) => {
    setChon(null)
    window.history.replaceState(null, '', thamSo(p))
  }
  const sangKy = (k: Ky) => router.push(thamSo({ ky: k }), { scroll: false })
  const mo = (id: string) => router.push(`/warehouse/phieu/${id}`)

  // Ô lý do (phiếu nhập) + người lập: chỉ những giá trị CÓ trong kỳ, kèm số.
  const lyDoCo = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of data.rows) {
      const n = lyDoPhieu(d).nhan
      m.set(n, (m.get(n) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [data.rows])
  const nguoiCo = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>()
    for (const d of data.rows) {
      if (!d.created_by) continue
      const c = m.get(d.created_by) ?? { name: d.created_by_name ?? '—', n: 0 }
      c.n++
      m.set(d.created_by, c)
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [data.rows])

  // Lọc theo tìm + lý do + người lập trước, rổ sau — số trên rổ là số của phần đã lọc.
  const theoNguoi = data.rows.filter((d) => khopGiu(d.giu ?? [], cheDo, meId))
  const truocRo = theoNguoi.filter(
    (d) =>
      khopTim(d, q) &&
      (!lyDo || lyDoPhieu(d).nhan === lyDo) &&
      (!nguoi || d.created_by === nguoi),
  )
  const vaoRo = (d: SoPhieuDong, r: RoNhap | RoXuat) =>
    r === 'all'
      ? true
      : nhap
        ? r === 'thieu'
          ? d.thieu_ncc
          : !!d.dao_boi
        : nhomXuat(d) === r
  const demRo = Object.fromEntries(
    ROS.map((r) => [r, truocRo.filter((d) => vaoRo(d, r)).length]),
  ) as Record<string, number>
  const ds = truocRo.filter((d) => vaoRo(d, ro))
  const t = tongSo(ds)
  const tKy = tongSo(data.rows)
  const sel = ds.find((d) => d.id === chon) ?? null
  const dangLoc = !!q.trim() || !!lyDo || !!nguoi

  const thangNay = today.slice(0, 7)
  const trongKy = kyTrongCau(ky)
  const ganNhat = data.ganNhat
  const kyGanNhat = ganNhat?.doc_date.slice(0, 7)

  // Thanh trạng thái phải: hai tháng liền trước kỳ đang xem (so nhịp ghi).
  const thangTruoc = ky === KY_TAT_CA ? [] : [doiKy(ky, -1), doiKy(ky, -2)]

  const chan = nhap ? (
    <>
      {fmt(t.soPhieu)} phiếu {trongKy} · không gồm phiếu đã bị đảo
      {t.thieuNcc > 0 && ` · ${fmt(t.thieuNcc)} phiếu chưa ghi số phiếu NCC`}
    </>
  ) : (
    <>
      {fmt(t.soPhieu)} phiếu · {fmt(t.soDong)} dòng {trongKy}
      {t.dao > 0 && ` · gồm ${fmt(t.dao)} đảo phiếu nhập (không phải hàng ra thật)`}
      {t.daBiDao > 0 && ` · ${fmt(t.daBiDao)} phiếu đã bị đảo không cộng`}
    </>
  )

  const rong = () => {
    if (data.rows.length === 0)
      return (
        <Rong
          tieuDe={`${nhanKy(ky)} chưa có ${tenLoai} nào`}
          lyDo={
            ganNhat
              ? `Kho chưa ghi ${tenLoai} trong kỳ này. ${nhap ? 'Phiếu nhập' : 'Phiếu xuất'} gần nhất: ${ganNhat.code} ngày ${isoToVn(ganNhat.doc_date)}.`
              : `Sổ chưa có ${tenLoai} nào.`
          }
          tiep={
            kyGanNhat && kyGanNhat !== ky ? (
              <button type="button" className="kh-btn" onClick={() => sangKy(kyGanNhat)}>
                Xem {kyTrongCau(kyGanNhat)} · {fmt(data.theoThang[kyGanNhat] ?? 0)} phiếu
              </button>
            ) : undefined
          }
        />
      )
    if (theoNguoi.length === 0 && cheDo !== 'tat_ca')
      return (
        <Rong
          tieuDe={`${cheDo === 'toi' ? 'Bạn' : (data.nguoiKho.find((n) => n.id === cheDo)?.name ?? 'Người này')} không có ${tenLoai} nào ${trongKy}`}
          lyDo={`Phiếu thuộc người giữ nhóm vật tư trên dòng phiếu (Danh mục › Phụ trách nhóm). Kỳ này có ${fmt(data.rows.length)} ${tenLoai} của cả kho.`}
          tiep={
            <button type="button" className="kh-btn" onClick={() => setCheDo('tat_ca')}>
              Xem cả {fmt(data.rows.length)} phiếu
            </button>
          }
        />
      )
    if (q.trim() && truocRo.length === 0)
      return (
        <Rong
          tieuDe={`Không ${tenLoai} nào khớp “${q.trim()}” ${trongKy}`}
          lyDo="Tìm theo số phiếu, đơn mua, lệnh, nhà cung cấp / người nhận, số phiếu NCC, diễn giải, người lập."
          tiep={
            ky !== KY_TAT_CA ? (
              <button type="button" className="kh-btn" onClick={() => sangKy(KY_TAT_CA)}>
                Tìm trong mọi tháng
              </button>
            ) : undefined
          }
        />
      )
    return (
      <Rong
        tieuDe={`Không có phiếu nào ở “${NHAN_RO[ro]}” ${trongKy}`}
        lyDo={`Kỳ này có ${fmt(truocRo.length)} ${tenLoai}${dangLoc ? ' khớp bộ lọc' : ''}, rổ này trống.`}
        tiep={
          <button
            type="button"
            className="kh-btn"
            onClick={() => {
              setRo('all')
              ghiUrl({ ro: 'all' })
            }}
          >
            Xem cả {fmt(truocRo.length)} phiếu
          </button>
        }
      />
    )
  }

  return (
    <KhoKhung label={nhap ? 'Phiếu nhập' : 'Phiếu xuất'}>
      <DauTrang
        crumb="Kho › Sổ sách"
        title={nhap ? 'Phiếu nhập' : 'Phiếu xuất'}
        ctx={
          <>
            <b>{fmt(tKy.soPhieu)}</b> phiếu
            {nhap && (
              <>
                {' '}
                · <b>{fmt(tKy.soDong)}</b> dòng
              </>
            )}{' '}
            {trongKy}
            {tKy.dao > 0 && (
              <>
                {' '}
                · gồm <b>{fmt(tKy.dao)}</b> phiếu đảo
              </>
            )}
          </>
        }
        actions={
          <>
            <ApNhom>
              <ApNut
                primary
                icon={<FileText size={15} aria-hidden />}
                href={sel ? `/warehouse/phieu/${sel.id}` : undefined}
                why={sel ? null : 'Chọn một phiếu trong bảng trước'}
              >
                {sel ? `Mở phiếu ${sel.code}` : 'Mở phiếu'}
              </ApNut>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                href={sel ? `/print/warehouse/${sel.id}` : undefined}
                why={sel ? null : 'Chọn một phiếu trong bảng trước'}
              >
                In phiếu
              </ApNut>
            </ApNhom>
            {canEdit && (
              <ApNhom>
                {nhap ? (
                  <ApNut
                    icon={<ArrowDownToLine size={15} aria-hidden />}
                    href="/warehouse/nhap"
                  >
                    Nhận hàng
                  </ApNut>
                ) : (
                  <ApNut
                    icon={<ArrowUpFromLine size={15} aria-hidden />}
                    href="/warehouse/xuat"
                  >
                    Xuất hàng
                  </ApNut>
                )}
              </ApNhom>
            )}
          </>
        }
      />

      <ThanhLoc>
        <LocGiu
          giuCuaDon={data.rows
            .filter(
              (d) =>
                khopTim(d, q) &&
                (!lyDo || lyDoPhieu(d).nhan === lyDo) &&
                (!nguoi || d.created_by === nguoi),
            )
            .map((d) => d.giu ?? [])}
          nguoi={data.nguoiKho}
          meId={meId}
          cheDo={cheDo}
          onDoi={(c) => {
            setCheDo(c)
            setChon(null)
          }}
        />
        <div className="sp-ky" role="group" aria-label="Kỳ">
          <button
            type="button"
            aria-label="Tháng trước"
            disabled={ky === KY_TAT_CA}
            onClick={() => sangKy(doiKy(ky, -1))}
          >
            ‹
          </button>
          <b>{nhanKy(ky)}</b>
          {ky === KY_TAT_CA ? (
            <button type="button" onClick={() => sangKy(thangNay)}>
              Về tháng này
            </button>
          ) : (
            <button
              type="button"
              aria-label="Tháng sau"
              disabled={ky >= thangNay}
              onClick={() => sangKy(doiKy(ky, 1))}
            >
              ›
            </button>
          )}
        </div>
        <input
          type="search"
          value={q}
          placeholder={
            nhap
              ? 'Tìm số phiếu, đơn, lệnh, NCC, số phiếu NCC…'
              : 'Tìm số phiếu, lệnh, phiếu gốc, diễn giải…'
          }
          aria-label="Tìm phiếu"
          onChange={(e) => {
            setQ(e.target.value)
            ghiUrl({ q: e.target.value })
          }}
        />
        {nhap && (
          <select
            value={lyDo}
            className={lyDo ? 'on' : undefined}
            aria-label="Lý do"
            onChange={(e) => {
              setLyDo(e.target.value)
              ghiUrl({ lyDo: e.target.value })
            }}
          >
            <option value="">Mọi lý do</option>
            {lyDoCo.map(([n, c]) => (
              <option key={n} value={n}>
                {n} ({fmt(c)})
              </option>
            ))}
          </select>
        )}
        <select
          value={nguoi}
          className={nguoi ? 'on' : undefined}
          aria-label="Người lập"
          style={{ maxWidth: 220 }}
          onChange={(e) => {
            setNguoi(e.target.value)
            ghiUrl({ nguoi: e.target.value })
          }}
        >
          <option value="">Mọi người lập</option>
          {nguoiCo.map(([id, x]) => (
            <option key={id} value={id}>
              {x.name} ({fmt(x.n)})
            </option>
          ))}
        </select>
        <div className="kh-seg" role="radiogroup" aria-label={nhap ? 'Rổ' : 'Lý do xuất'}>
          {ROS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={ro === r}
              onClick={() => {
                setRo(r)
                ghiUrl({ ro: r })
              }}
            >
              {NHAN_RO[r]}
              <span className="n">{fmt(demRo[r] ?? 0)}</span>
            </button>
          ))}
        </div>
        {dangLoc && (
          <button
            type="button"
            className="clr"
            onClick={() => {
              setQ('')
              setLyDo('')
              setNguoi('')
              ghiUrl({ q: '', lyDo: '', nguoi: '' })
            }}
          >
            Bỏ lọc
          </button>
        )}
      </ThanhLoc>

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {ds.length === 0 ? (
        rong()
      ) : (
        <BangSoPhieu
          // Đổi rổ / lọc / tìm → lưới dựng lại từ đầu, không giữ chỗ cuộn của tập cũ.
          key={`${ro}|${lyDo}|${nguoi}|${q.trim()}|${cheDo}`}
          loai={loai}
          ds={ds}
          today={today}
          chon={chon}
          onChon={setChon}
          onMo={mo}
          goSoNcc={nhap && ro === 'thieu' && canEdit}
          gon={gon}
          chan={chan}
          tongDong={ds.filter(coTinh).reduce((s, d) => s + d.so_dong, 0)}
        />
      )}

      <ThanhTT
        left={
          sel ? (
            <>
              Đang chọn <b className="kh-num">{sel.code}</b> · Enter hoặc bấm đúp để mở
            </>
          ) : nhap && ro === 'thieu' ? (
            'Gõ số phiếu NCC ngay trên dòng rồi Enter để lưu, con trỏ xuống phiếu kế tiếp (không đổi tồn)'
          ) : nhap ? (
            'Phiếu gạch ngang đã bị đảo, không cộng vào số · bấm một dòng để chọn, Enter mở phiếu'
          ) : (
            'Phiếu đảo ghi rõ phiếu gốc; bấm mã phiếu gốc để mở phiếu nhập đã bị đảo'
          )
        }
        right={
          thangTruoc.length > 0 ? (
            <>
              {thangTruoc
                .map((k) => `${kyTrongCau(k)}: ${fmt(data.theoThang[k] ?? 0)} phiếu`)
                .join(' · ')}
            </>
          ) : (
            <>
              <b>{fmt(ds.length)}</b> phiếu
            </>
          )
        }
      />
    </KhoKhung>
  )
}
