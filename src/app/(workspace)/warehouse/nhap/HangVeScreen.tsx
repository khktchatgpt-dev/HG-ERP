'use client'

import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownToLine, BookOpen, ListChecks, TriangleAlert } from 'lucide-react'
import {
  INCOMING_BUCKET,
  INCOMING_BUCKETS,
  type IncomingBucket,
} from '@/lib/supply-watch'
import { poTemplateShort } from '@/lib/po-template'
import { MOI, NGOAI_LENH, demTheo, khopLenh, tenNccGon } from '@/lib/theo-doi-loc'
import { searchMatcher } from '@/lib/search-text'
import { useLocalPref } from '@/lib/use-local-pref'
import { useBeRong } from '@/lib/use-be-rong'
import {
  chiDongTuDo,
  ngay,
  ngayBatThuong,
  soNgayToi,
  xepHangVe,
  type HangVeRow,
} from '@/lib/kho-hang-ve'
import {
  ApNhom,
  ApNut,
  DaGhiSo,
  DauTrang,
  KhoKhung,
  Rong,
  TabNgang,
  ThanhLoc,
  ThanhTT,
  type TabMuc,
} from '../_erp/khung'
import { HangCuaDonSheet } from './hang-cua-don'
import { BaoSuCoSheet } from './bao-su-co'
import type { HangCuaDonData } from './tai-hang-cua-don'

type Hen = typeof MOI | IncomingBucket
type Gom = 'moc' | 'lsx' | 'ncc'
const GOM_LABEL: Record<Gom, string> = { moc: 'Mốc hẹn', lsx: 'Lệnh SX', ncc: 'Nhà cung cấp' } // prettier-ignore

/** Tab theo mốc hẹn: tên ngắn + màu + kiểu số (đỏ = trễ). */
const TAB_HEN: Record<
  IncomingBucket,
  { ten: string; mau: string; tone?: TabMuc['tone'] }
> = {
  overdue: { ten: 'Quá hẹn', mau: 'c-stop', tone: 'red' },
  today: { ten: 'Hôm nay', mau: 'c-warn', tone: 'warn' },
  week: { ten: '7 ngày tới', mau: 'c-nhap', tone: 'mut' },
  later: { ten: 'Sau đó', mau: 'c-mut', tone: 'mut' },
  no_eta: { ten: 'Chưa hẹn', mau: 'c-warn', tone: 'warn' },
}
const MAU_NHOM: Record<IncomingBucket, string> = {
  overdue: 'c-stop',
  today: 'c-warn',
  week: 'c-nhap',
  later: 'c-mut',
  no_eta: 'c-warn',
}

const nhanHref = (r: HangVeRow) =>
  `/warehouse/nhap/${r.po_id}${r.dot?.ke_tiep ? `?dot=${r.dot.ke_tiep.id}` : ''}`

/**
 * KHO › HÀNG VỀ — Kho lối ERP · B2 (bản vẽ K-2
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR, duyệt 14/10/2026). Viết
 * tay, không kit — khung chung ở `../_erp/khung.tsx`.
 *
 * Câu màn trả lời cho thủ kho: "hôm nay xe nào tới, cái nào trễ, tôi nhận hàng
 * của đơn nào?". Một dòng = một đơn đang về. Tab theo MỐC HẸN đếm bằng CÙNG
 * `bucket` server tính bằng `incomingBucket` (badge menu cũng đếm bằng nó).
 * K3: mở ra đứng ở "Quá hẹn" nếu có đơn, không thì "Hôm nay", không nữa thì
 * "Tất cả".
 *
 * K1: không nút trên dòng — chọn đơn rồi bấm Nhận hàng / Xem hàng của đơn / Báo
 * sự cố ở Action Pane; Enter hoặc bấm đúp trên dòng = Nhận hàng. Mã đơn vẫn
 * bấm mở hộp "Hàng của đơn" (?don=).
 *
 * Hai hộp (Hàng của đơn, Báo sự cố) là hộp thoại của Kho (B6).
 */
export function HangVeScreen({
  rows,
  today,
  canEdit,
  truncatedAt,
  hangCuaDon,
  suCo,
}: {
  rows: HangVeRow[]
  today: string
  /** Ghi phiếu kho được (`warehouse.stock.write`). */
  canEdit: boolean
  truncatedAt: number | null
  /** Hộp "Hàng của đơn" đang mở (`?don=`). */
  hangCuaDon: HangCuaDonData | null
  /** Hộp "Báo sự cố giao hàng" đang mở (`?su_co=`). */
  suCo: HangCuaDonData | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const thayUrl = (sua: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString())
    sua(p)
    const qs = p.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const moDon = (id: string) => thayUrl((p) => p.set('don', id))
  const dongDon = () => thayUrl((p) => p.delete('don'))
  const moSuCo = (id: string) =>
    thayUrl((p) => {
      p.delete('don')
      p.set('su_co', id)
    })
  const dongSuCo = () => thayUrl((p) => p.delete('su_co'))
  /* Phiếu VỪA GHI ở form nhận hàng — mã phiếu qua URL để dải "Đã ghi sổ" (có
     nút In) sống qua lần điều hướng. */
  const vuaGhi = params.get('vua_ghi')
  const vuaGhiMa = params.get('ma')
  const dongVuaGhi = () =>
    thayUrl((p) => {
      p.delete('vua_ghi')
      p.delete('ma')
      p.delete('chi_tiet')
    })

  const [q, setQ] = useState('')
  // `?hen=` từ ô việc của Bàn làm việc Kho (B8a) mở thẳng đúng tab mốc hẹn.
  const henUrl = params.get('hen')
  const [hen, setHen] = useState<Hen>(() =>
    henUrl && rows.some((r) => r.bucket === henUrl)
      ? (henUrl as Hen)
      : rows.some((r) => r.bucket === 'overdue')
        ? 'overdue'
        : rows.some((r) => r.bucket === 'today')
          ? 'today'
          : MOI,
  )
  const [lsx, setLsx] = useState<string>(MOI)
  const [ncc, setNcc] = useState('')
  const [loai, setLoai] = useState<string>(MOI)
  const [chon, setChon] = useState<string | null>(null)
  const [gomRaw, setGom] = useLocalPref('hg.kho.hang-ve.gom', 'moc')
  const gom: Gom = gomRaw === 'lsx' || gomRaw === 'ncc' ? gomRaw : 'moc'
  /* Bộ cột theo bề rộng KHUNG: < 1100 bỏ Loại hàng + Phụ trách (còn ở tooltip
     mã đơn); < 900 gộp Trễ vào Hẹn, Lệnh xuống dòng hai của NCC. */
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const gon = beRong > 0 && beRong < 1100
  const hep = beRong > 0 && beRong < 900
  /** Điện thoại: danh sách phẳng thay lưới. */
  const dien = beRong > 0 && beRong < 600

  // Một hàm khớp, bỏ được MỘT trục — số trong từng ô chọn đếm trên tập đã lọc các trục khác.
  const khop = (r: HangVeRow, bo?: 'hen' | 'lsx' | 'ncc' | 'loai') => {
    if (bo !== 'lsx' && !khopLenh(r.lsx_code, lsx)) return false
    if (bo !== 'ncc' && ncc && r.supplier_name !== ncc) return false
    if (bo !== 'loai' && loai !== MOI && r.template !== loai) return false
    if (bo !== 'hen' && hen !== MOI && r.bucket !== hen) return false
    return searchMatcher(q)([r.po_code, r.supplier_name, r.lsx_code, ...r.extra_lsx])
  }
  const kept = rows.filter((r) => khop(r))
  const theoHen = rows.filter((r) => khop(r, 'hen'))
  const demMoc = (b: IncomingBucket) => theoHen.filter((r) => r.bucket === b).length
  const lenh = demTheo(rows.filter((r) => khop(r, 'lsx')), (r) => r.lsx_code) // prettier-ignore
  const ngoaiLenh = rows.filter((r) => khop(r, 'lsx') && r.lsx_code == null).length
  const nccs = demTheo(rows.filter((r) => khop(r, 'ncc')), (r) => r.supplier_name) // prettier-ignore
  const loais = demTheo(rows.filter((r) => khop(r, 'loai')), (r) => r.template) // prettier-ignore
  const dangLoc = !!q.trim() || lsx !== MOI || !!ncc || loai !== MOI
  const boLoc = () => {
    setQ('')
    setLsx(MOI)
    setNcc('')
    setLoai(MOI)
  }

  const nhom = useMemo(() => {
    if (gom === 'moc')
      return INCOMING_BUCKETS.map((b) => {
        const rs = kept.filter((r) => r.bucket === b).sort(xepHangVe)
        return { key: b, ten: INCOMING_BUCKET[b].label, mau: MAU_NHOM[b], rows: rs }
      }).filter((g) => g.rows.length > 0)
    const keyOf =
      gom === 'lsx'
        ? (r: HangVeRow) => r.lsx_code ?? 'Ngoài lệnh SX'
        : (r: HangVeRow) => tenNccGon(r.supplier_name)
    const m = new Map<string, HangVeRow[]>()
    for (const r of kept) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r])
    return [...m]
      .map(([k, rs]) => ({
        key: k,
        ten: k,
        mau: rs.some((r) => r.bucket === 'overdue') ? 'c-stop' : 'c-mut',
        rows: rs.sort(xepHangVe),
      }))
      .sort((a, b) => b.rows.length - a.rows.length || a.ten.localeCompare(b.ten, 'vi'))
  }, [kept, gom])

  // Đúng MỘT lệnh đang lọc thì cột Lệnh SX lặp một giá trị — ẩn.
  const hienLenh = !hep && (lsx === MOI || lsx === NGOAI_LENH)
  const soCot = 5 + (hep ? 0 : 1) + (hienLenh ? 1 : 0) + (gon ? 0 : 2)
  const soGo = kept.filter(chiDongTuDo).length
  const choNhan = kept.reduce((s, r) => s + Math.max(0, r.lines_total - r.lines_done), 0)

  const sel = kept.find((r) => r.po_id === chon) ?? null
  const lyDoNhan = (r: HangVeRow | null) =>
    !r
      ? 'Chọn một đơn trong bảng trước'
      : chiDongTuDo(r)
        ? 'Đơn chỉ có dòng theo mã SP (gỗ…): không vào tồn kho, Cung ứng nghiệm thu ngoài sổ'
        : !canEdit
          ? 'Chỉ phòng Kho ghi phiếu nhập'
          : null
  const nhan = (r: HangVeRow) => {
    if (lyDoNhan(r) == null) router.push(nhanHref(r))
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, r: HangVeRow) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      nhan(r)
    }
  }

  const tabs: TabMuc[] = [
    {
      key: 'all',
      label: 'Tất cả',
      on: hen === MOI,
      onClick: () => setHen(MOI),
      n: theoHen.length,
      tone: 'mut',
    },
    ...INCOMING_BUCKETS.map((b) => {
      const n = demMoc(b)
      return {
        key: b,
        label: TAB_HEN[b].ten,
        on: hen === b,
        onClick: () => setHen(b),
        n,
        tone: n > 0 ? TAB_HEN[b].tone : undefined,
        mau: TAB_HEN[b].mau,
      }
    }),
  ]

  const dong = (r: HangVeRow) => {
    const n = r.expected_at ? soNgayToi(r.expected_at, today) : null
    const la = ngayBatThuong(r.expected_at, today)
    const tuDo = chiDongTuDo(r)
    const on = r.po_id === chon || hangCuaDon?.po.id === r.po_id
    const tre = !la && n != null && n < 0 ? -n : 0
    return (
      <tr
        key={r.po_id}
        className={on ? 'd on' : 'd'}
        tabIndex={0}
        aria-selected={on}
        onClick={() => setChon(r.po_id)}
        onDoubleClick={() => nhan(r)}
        onKeyDown={(e) => phim(e, r)}
      >
        <td className="kh-num">
          {r.expected_at ? (
            <>
              <span className={tre ? 'kh-stop' : undefined}>
                {la && hep ? '' : ngay(r.expected_at, today)}
              </span>
              {la && (
                <span
                  className="kh-tag warn"
                  style={{ marginLeft: 4 }}
                  title={`Hẹn ${ngay(r.expected_at, today)} — cách hôm nay hơn một năm, có thể gõ nhầm năm. Nhờ người phụ trách sửa.`}
                >
                  ngày lạ
                </span>
              )}
              {hep && tre > 0 && <span className="kh-stop"> −{tre}</span>}
            </>
          ) : (
            <span className="kh-warn">chưa hẹn</span>
          )}
        </td>
        {!hep && (
          <td className="r kh-num">
            {tre > 0 ? (
              <span className="kh-stop">{tre} ngày</span>
            ) : n === 0 && !la ? (
              <span className="kh-mut">hôm nay</span>
            ) : (
              <span className="kh-empty">·</span>
            )}
          </td>
        )}
        <td>
          <button
            type="button"
            className="kh-lnk"
            title={[
              'Xem hàng của đơn',
              gon && (poTemplateShort(r.template) ?? r.template),
              gon && r.owner_name && `phụ trách ${r.owner_name}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            onClick={(e) => {
              e.stopPropagation()
              setChon(r.po_id)
              moDon(r.po_id)
            }}
          >
            {r.po_code}
          </button>
          {r.su_co_mo > 0 && (
            <span
              className="kh-tag warn"
              style={{ marginLeft: 6 }}
              title={`${r.su_co_mo} sự cố giao hàng đang chờ Cung ứng xử lý với NCC`}
            >
              {r.su_co_mo} sự cố
            </span>
          )}
        </td>
        {hienLenh && (
          <td
            className="kh-mut"
            title={[r.lsx_code, ...r.extra_lsx].filter(Boolean).join(', ')}
          >
            <span className="kh-num">{r.lsx_code ?? '— ngoài lệnh'}</span>
            {r.extra_lsx.length > 0 && <span> +{r.extra_lsx.length}</span>}
          </td>
        )}
        <td title={r.supplier_name}>
          {tenNccGon(r.supplier_name)}
          {hep && (
            <span className="kh-mut" style={{ display: 'block', fontSize: 11.5 }}>
              {r.lsx_code ?? 'ngoài lệnh'}
              {r.extra_lsx.length > 0 && ` +${r.extra_lsx.length}`}
            </span>
          )}
        </td>
        {!gon && <td className="kh-mut">{poTemplateShort(r.template) ?? r.template}</td>}
        <td>
          <DotCell r={r} today={today} hep={gon} />
        </td>
        <td>
          {tuDo ? (
            <span
              className="kh-mut"
              title="Đơn chỉ có dòng theo mã SP — không vào sổ kho"
            >
              ngoài sổ kho
            </span>
          ) : (
            <>
              {!hep && (
                <span className="kh-bar" aria-hidden>
                  <i
                    style={{
                      width: `${Math.round((r.lines_done / r.lines_total) * 100)}%`,
                    }}
                  />
                </span>
              )}
              <span className="kh-num">
                {r.lines_done}/{r.lines_total}
              </span>
            </>
          )}
        </td>
        {!gon && (
          <td className="kh-mut" title={r.owner_name ?? undefined}>
            {r.owner_name ? r.owner_name.split(' ').slice(-1)[0] : '—'}
          </td>
        )}
      </tr>
    )
  }

  return (
    <KhoKhung label="Nhận hàng">
      <DauTrang
        title="Nhận hàng"
        ctx={
          <>
            <b>{rows.length}</b> đơn đang về
          </>
        }
        actions={
          <>
            {/* Điện thoại: chạm dòng là nhận — nhóm thao tác theo dòng chọn không cần. */}
            {!dien && (
              <ApNhom>
                <ApNut
                  primary
                  icon={<ArrowDownToLine size={15} aria-hidden />}
                  href={sel && lyDoNhan(sel) == null ? nhanHref(sel) : undefined}
                  why={lyDoNhan(sel)}
                >
                  {sel ? `Nhận hàng ${sel.po_code}` : 'Nhận hàng'}
                </ApNut>
                <ApNut
                  icon={<ListChecks size={15} aria-hidden />}
                  onClick={sel ? () => moDon(sel.po_id) : undefined}
                  why={sel ? null : 'Chọn một đơn trong bảng trước'}
                >
                  Hàng của đơn
                </ApNut>
                <ApNut
                  icon={<TriangleAlert size={15} aria-hidden />}
                  onClick={sel ? () => moSuCo(sel.po_id) : undefined}
                  why={
                    !sel
                      ? 'Chọn một đơn trong bảng trước'
                      : !canEdit
                        ? 'Chỉ phòng Kho báo sự cố giao hàng'
                        : null
                  }
                >
                  Báo sự cố
                </ApNut>
              </ApNhom>
            )}
            <ApNhom>
              {/* Hàng về KHÔNG có đơn (N2): có đơn thì vẫn nhận theo đơn. */}
              <ApNut href="/warehouse/nhap/ngoai-don">Nhận không theo đơn</ApNut>
              <ApNut href="/warehouse/nhap/hoan-kho">Hoàn kho từ SX</ApNut>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Phiếu đã ghi
              </ApNut>
            </ApNhom>
          </>
        }
      />

      {vuaGhi && vuaGhiMa && (
        <DaGhiSo
          code={vuaGhiMa}
          docId={vuaGhi}
          detail={`${params.get('chi_tiet') ?? 'đã vào sổ'} — tồn đã cộng.`}
          soPhieuHref="/warehouse/phieu?ro=receipt"
          onClose={dongVuaGhi}
        />
      )}

      <TabNgang label="Mốc hẹn giao" tabs={tabs} />

      <ThanhLoc>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm số đơn, NCC, lệnh…"
          aria-label="Tìm số đơn, NCC, lệnh"
        />
        <select
          value={lsx}
          className={lsx !== MOI ? 'on' : undefined}
          onChange={(e) => setLsx(e.target.value)}
          aria-label="Lệnh sản xuất"
        >
          <option value={MOI}>
            Mọi lệnh SX ({rows.filter((r) => khop(r, 'lsx')).length})
          </option>
          {lenh.map(([c, n]) => (
            <option key={c} value={c}>
              {c} ({n})
            </option>
          ))}
          {ngoaiLenh > 0 && (
            <option value={NGOAI_LENH}>Ngoài lệnh SX ({ngoaiLenh})</option>
          )}
        </select>
        <select
          value={ncc}
          className={ncc ? 'on' : undefined}
          onChange={(e) => setNcc(e.target.value)}
          aria-label="Nhà cung cấp"
          style={{ maxWidth: 220 }}
        >
          <option value="">Mọi nhà cung cấp ({nccs.length})</option>
          {nccs.map(([name, n]) => (
            <option key={name} value={name}>
              {tenNccGon(name)} ({n})
            </option>
          ))}
        </select>
        <select
          value={loai}
          className={loai !== MOI ? 'on' : undefined}
          onChange={(e) => setLoai(e.target.value)}
          aria-label="Loại hàng"
        >
          <option value={MOI}>Mọi loại hàng</option>
          {loais.map(([t, n]) => (
            <option key={t} value={t}>
              {poTemplateShort(t) ?? t} ({n})
            </option>
          ))}
        </select>
        {dangLoc && (
          <button type="button" className="clr" onClick={boLoc}>
            Bỏ lọc
          </button>
        )}
        <span className="sp">
          <select
            value={gom}
            onChange={(e) => setGom(e.target.value)}
            aria-label="Gom theo"
          >
            {(Object.keys(GOM_LABEL) as Gom[]).map((g) => (
              <option key={g} value={g}>
                Gom: {GOM_LABEL[g]}
              </option>
            ))}
          </select>
        </span>
      </ThanhLoc>

      {truncatedAt != null && (
        <div className="kh-note">
          <span className="tag">Cắt đuôi</span>
          <span>
            Sổ đơn chạm trần <b>{truncatedAt} đơn</b> khi nạp — con số trên màn có thể
            thiếu.
          </span>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {kept.length === 0 ? (
        <Rong
          tieuDe={
            rows.length === 0
              ? 'Không có hàng nào đang về'
              : hen !== MOI && !dangLoc
                ? `Không có đơn nào "${TAB_HEN[hen].ten}"`
                : 'Không có đơn nào khớp'
          }
          lyDo={
            rows.length === 0
              ? 'Chỉ đơn NCC đã xác nhận mới nằm ở đây. Khi Cung ứng ghi NCC xác nhận, đơn tự hiện ở màn này. Hàng tới mà không có đơn thì nhận không theo đơn.'
              : `Trong ${rows.length} đơn đang về, không đơn nào khớp tab và bộ lọc hiện tại${q.trim() ? ` với từ khoá “${q.trim()}”` : ''}.`
          }
          tiep={
            rows.length === 0 ? (
              <Link href="/warehouse/nhap/ngoai-don" className="kh-btn p">
                Nhận hàng không theo đơn
              </Link>
            ) : (
              <button
                type="button"
                className="kh-btn"
                onClick={() => {
                  boLoc()
                  setHen(MOI)
                }}
              >
                Xem cả {rows.length} đơn
              </button>
            )
          }
        />
      ) : dien ? (
        /* ĐIỆN THOẠI (K5): danh sách phẳng — chạm đơn là mở phiếu nhận (hoặc xem
           hàng của đơn khi không nhận được). Không cuộn ngang. */
        <div className="kh-pl" aria-label="Đơn đang về">
          {nhom.map((g) => (
            <Fragment key={g.key}>
              <div className={`kh-pl-sec ${g.mau}`}>
                {g.ten} · {g.rows.length}
              </div>
              {g.rows.map((r) => {
                const n = r.expected_at ? soNgayToi(r.expected_at, today) : null
                const tre = !ngayBatThuong(r.expected_at, today) && n != null && n < 0 ? -n : 0 // prettier-ignore
                const nhanDuoc = lyDoNhan(r) == null
                return (
                  <button
                    key={r.po_id}
                    type="button"
                    className="kh-pl-row"
                    onClick={() => (nhanDuoc ? router.push(nhanHref(r)) : moDon(r.po_id))}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="kh-ma" style={{ color: 'var(--kh-act)' }}>
                        {r.po_code}
                      </span>
                      {r.su_co_mo > 0 && (
                        <span className="kh-tag warn" style={{ marginLeft: 6 }}>
                          {r.su_co_mo} sự cố
                        </span>
                      )}
                      <span
                        className="s"
                        style={{
                          display: 'block',
                          color: 'var(--kh-ink)',
                          fontWeight: 600,
                        }}
                      >
                        {tenNccGon(r.supplier_name)}
                      </span>
                      <span className="s" style={{ display: 'block' }}>
                        {r.lsx_code ?? 'ngoài lệnh'} · về {r.lines_done}/{r.lines_total}{' '}
                        dòng
                      </span>
                    </span>
                    <span className="r">
                      <span
                        className={tre ? 'kh-stop kh-num' : 'kh-num'}
                        style={{ display: 'block' }}
                      >
                        {r.expected_at ? ngay(r.expected_at, today) : 'chưa hẹn'}
                      </span>
                      {tre > 0 && <span className="kh-stop">trễ {tre} ngày</span>}
                      <span
                        style={{
                          display: 'block',
                          color: nhanDuoc ? 'var(--kh-act)' : 'var(--kh-ink3)',
                          fontWeight: 600,
                        }}
                      >
                        {nhanDuoc ? 'Nhận ›' : chiDongTuDo(r) ? 'ngoài sổ ›' : 'xem ›'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Đơn đang về">
            <colgroup>
              <col style={{ width: hep ? 92 : 78 }} />
              {!hep && <col style={{ width: 74 }} />}
              <col style={{ width: 150 }} />
              {hienLenh && <col style={{ width: 136 }} />}
              <col />
              {!gon && <col style={{ width: 96 }} />}
              <col style={{ width: gon ? 130 : 204 }} />
              <col style={{ width: hep ? 64 : 112 }} />
              {!gon && <col style={{ width: 90 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Hẹn giao</th>
                {!hep && <th className="r">Trễ</th>}
                <th>Đơn</th>
                {hienLenh && <th>Lệnh SX</th>}
                <th>Nhà cung cấp</th>
                {!gon && <th>Loại hàng</th>}
                <th>{gon ? 'Đợt' : 'Đợt · xe tới'}</th>
                <th>Về kho</th>
                {!gon && <th>Phụ trách</th>}
              </tr>
            </thead>
            <tbody>
              {nhom.map((g) => {
                const tre = g.rows.filter((r) => r.bucket === 'overdue').length
                const done = g.rows.reduce((s, r) => s + r.lines_done, 0)
                const tot = g.rows.reduce((s, r) => s + r.lines_total, 0)
                return (
                  <Fragment key={g.key}>
                    <tr className={`grp ${g.mau}`}>
                      <td colSpan={soCot}>
                        <span className="ten">{g.ten}</span> ·{' '}
                        <b className="kh-num">{g.rows.length}</b> đơn
                        {gom !== 'moc' && tre > 0 && ` · ${tre} quá hẹn`} · về{' '}
                        <span className="kh-num">
                          {done}/{tot}
                        </span>{' '}
                        dòng
                      </td>
                    </tr>
                    {g.rows.map(dong)}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={soCot}>
                  Cộng {kept.length} đơn · {choNhan} dòng hàng chờ nhận
                  {soGo > 0 ? ` · ${soGo} đơn ngoài sổ kho` : ''} · không gồm đơn nháp,
                  đơn NCC chưa xác nhận
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Enter / bấm đúp = Nhận hàng đơn đang chọn · bấm mã đơn xem hàng của đơn · “Về kho” = dòng đã nhận đủ hoặc đã chốt thiếu / tổng dòng"
        right={
          <b>
            {kept.length} / {rows.length} đơn
          </b>
        }
      />

      {(hangCuaDon || suCo) && (
        <>
          {hangCuaDon && (
            <HangCuaDonSheet
              data={hangCuaDon}
              today={today}
              canEdit={canEdit}
              onClose={dongDon}
              onBaoSuCo={canEdit ? () => moSuCo(hangCuaDon.po.id) : undefined}
            />
          )}
          {suCo && <BaoSuCoSheet data={suCo} onClose={dongSuCo} />}
        </>
      )}
    </KhoKhung>
  )
}

/**
 * Cột "Đợt · xe tới": đợt kế tiếp đứng trước (thứ thủ kho chờ), đợt đã nhập
 * trước hạn đi sau, gọn một dòng — câu đầy đủ ở `title` và trong hộp đơn.
 */
function DotCell({ r, today, hep }: { r: HangVeRow; today: string; hep: boolean }) {
  const d = r.dot
  if (!d) return <span className="kh-mut">chưa chia đợt</span>
  const truoc = d.da_nhap_truoc.join(', ')
  const cau = [
    d.ke_tiep
      ? `Đợt kế tiếp: đợt ${d.ke_tiep.seq}/${d.so_dot}, hẹn ${ngay(d.ke_tiep.date, today)}${d.ke_tiep.arrived ? ', NCC báo xe đã tới' : ''}.`
      : 'Không còn đợt nào đang chờ.',
    truoc ? `Đợt ${truoc} hẹn trước đó nhưng hàng đã nhập đủ — không phải chờ xe.` : '',
  ].join(' ')
  return (
    <span title={cau}>
      {d.ke_tiep ? (
        <span className="kh-num">
          {hep ? '' : 'Đợt '}
          {d.ke_tiep.seq}/{d.so_dot} · {ngay(d.ke_tiep.date, today)}
        </span>
      ) : (
        !truoc && <span className="kh-mut">hết đợt đã hẹn</span>
      )}
      {d.ke_tiep?.arrived && <span className="kh-warn"> · {hep ? 'tới' : 'đã tới'}</span>}
      {truoc && (
        <span className="kh-ok">
          {d.ke_tiep ? ' · ' : ''}
          {hep ? `✓đ${truoc}` : `đợt ${truoc} đã về`}
        </span>
      )}
    </span>
  )
}
