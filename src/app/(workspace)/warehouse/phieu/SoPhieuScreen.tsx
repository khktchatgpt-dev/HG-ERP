'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, FileText, Printer } from 'lucide-react'
import { useBeRong } from '@/lib/use-be-rong'
import { isoToVn } from '@/lib/date-vn'
import { MA_LY_DO_KHO, nhanLyDo } from '@/lib/kho-ma-ly-do'
import {
  ApNhom,
  ApNut,
  DauTrang,
  KhoKhung,
  PhanTrang,
  Rong,
  TabNgang,
  ThanhLoc,
  ThanhTT,
  type TabMuc,
} from '../_erp/khung'
import { RO_PHIEU, RO_PHIEU_NHAN, type RoPhieu } from './ro-phieu'
import { OSoNcc } from './ghi-so-ncc'

export type PhieuRow = {
  id: string
  code: string
  kind: 'receipt' | 'issue' | 'transfer' | 'stocktake'
  doc_date: string
  counterparty: string | null
  reason: string | null
  status: 'pending' | 'posted' | 'rejected'
  /** Có = phiếu NÀY LÀ phiếu đảo của tờ kia. */
  reversal_of_code: string | null
  /** Ngược lại: tờ NÀY đã bị một phiếu đảo huỷ hiệu lực. */
  da_bi_dao: boolean
  created_by_name: string | null
  ma_ly_do: string[]
  supplier_doc_no: string | null
  /** Đơn mua + lệnh của phiếu (nhập/trả theo đơn); null = phiếu không nối đơn. */
  don: { po_id: string; po_code: string; lsx: string[] } | null
  /** Thuộc rổ "Thiếu số phiếu NCC" — cùng tập với badge menu. */
  thieu_ncc: boolean
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/** Màu ô vuông theo LOẠI phiếu (bảng màu Kho: nhập xanh ngọc · xuất hồng · kiểm kê xám). */
const MAU_LOAI: Record<PhieuRow['kind'], string> = {
  receipt: 'c-nhap',
  issue: 'c-xuat',
  transfer: 'c-kiem',
  stocktake: 'c-kiem',
}
const TAB_MAU: Record<RoPhieu, { mau: string; tone?: TabMuc['tone'] }> = {
  all: { mau: 'c-mut' },
  receipt: { mau: 'c-nhap' },
  issue: { mau: 'c-xuat' },
  stocktake: { mau: 'c-kiem' },
  thieu_ncc: { mau: 'c-warn', tone: 'warn' },
  reversed: { mau: 'c-stop' },
}

/** Mã lý do đeo màu theo HƯỚNG — vào xanh, ra / chuyển xám. */
function MaLyDo({ ma }: { ma: string }) {
  const huong = MA_LY_DO_KHO.find((x) => x.ma === ma)?.huong
  return <span className={huong === 'in' ? 'kh-tag done' : 'kh-tag'}>{ma}</span>
}

/**
 * SỔ PHIẾU KHO — Kho lối ERP · B4 (bản vẽ K-4
 * https://claude.ai/artifact/F2uVKzc4tb28FhHZY6BDiR), viết tay không kit.
 *
 * Tab theo LOẠI PHIẾU + việc dở (Thiếu số phiếu NCC, Đã đảo); bộ lọc chính là
 * MÃ LÝ DO, không phải ngày — người soát hỏi "tháng này bao nhiêu phiếu huỷ". Số
 * phiếu NCC còn thiếu GÕ NGAY TRONG Ô của dòng (Enter lưu, con trỏ xuống phiếu
 * sau). K1: chọn dòng rồi Mở / In ở Action Pane; Enter / bấm đúp = mở phiếu.
 *
 * Phiếu đảo và phiếu gốc nằm cạnh nhau, phiếu gốc gạch ngang — sổ phải cộng lại
 * đúng bằng những gì đã xảy ra, kể cả cái sai. Tab Nhập / Xuất chỉ phiếu GỐC;
 * phiếu đảo (đảo phiếu nhập mang mã PXK) chỉ ở Tất cả và Đã đảo (K5, 28/10/2026).
 */
export function SoPhieuScreen({
  rows,
  dem,
  total,
  trang,
  soTrang,
  ro,
  lyDo,
  canEdit,
  thieuGanDay,
  nguoi,
  nguoiLap,
  meId,
}: {
  rows: PhieuRow[]
  dem: Record<RoPhieu, number>
  total: number
  trang: number
  soTrang: number
  ro: RoPhieu
  lyDo: string
  canEdit: boolean
  /** Phần của rổ có ngày chứng từ trong 14 ngày — đúng số badge menu Sổ phiếu. */
  thieuGanDay: number
  /** Ô Người lập: '' mọi người · 'toi' · id người lập. */
  nguoi: string
  nguoiLap: { id: string; name: string; n: number }[]
  meId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  // < 1120px (laptop 125%: khung ~985): mã lý do không kèm nhãn chữ + ẩn Người lập —
  // đo 15/10: tổng cột cố định 1020 > 985, cột Đối ứng còn 0px và lưới cuộn ngang.
  // < 960px: ẩn thêm Lệnh SX; < 600px: danh sách phẳng.
  const gon = beRong > 0 && beRong < 1120
  const hep = beRong > 0 && beRong < 960
  const dien = beRong > 0 && beRong < 600
  const [chon, setChon] = useState<string | null>(null)

  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    setChon(null)
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const mo = (id: string) => router.push(`/warehouse/phieu/${id}`)
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault()
      mo(id)
    }
  }
  /** Ghi xong số NCC ở một dòng → con trỏ sang ô của phiếu thiếu kế tiếp. */
  const sangO = (id: string) => {
    const ds = rows.filter((r) => r.thieu_ncc && !r.supplier_doc_no?.trim())
    const i = ds.findIndex((r) => r.id === id)
    const sau = ds[i + 1]
    if (sau)
      setTimeout(
        () => (document.querySelector(`[data-so-ncc="${sau.id}"]`) as HTMLInputElement | null)?.focus(), // prettier-ignore
        0,
      )
  }

  const sel = rows.find((r) => r.id === chon) ?? null
  const dangLoc = !!lyDo || !!nguoi
  const canChon = 'Chọn một phiếu trong bảng trước'
  const soCot = hep ? 6 : gon ? 7 : 8

  const tabs: TabMuc[] = RO_PHIEU.map((id) => ({
    key: id,
    label: RO_PHIEU_NHAN[id],
    on: ro === id,
    onClick: () => dat({ ro: id === 'all' ? null : id }),
    n: dem[id],
    tone: dem[id] > 0 ? (TAB_MAU[id].tone ?? 'mut') : undefined,
    mau: TAB_MAU[id].mau,
    note:
      id === 'thieu_ncc' && thieuGanDay > 0
        ? `${fmt(thieuGanDay)} trong 14 ngày`
        : undefined,
  }))

  /*
    Ô gõ số phiếu NCC (B4 "Kho cho người mới", 27/10/2026): đo trước 40 ô gõ sẵn
    trên các dòng ở tab Tất cả — sổ trông như một tờ khai. Nay ô chỉ mở ở tab
    "Thiếu số phiếu NCC" (gõ hàng loạt: Enter sang dòng kế) và ở dòng đang chọn;
    chỗ khác nói "chưa ghi".
  */
  const soNcc = (d: PhieuRow) =>
    d.supplier_doc_no?.trim() ? (
      <span className="kh-num">{d.supplier_doc_no}</span>
    ) : d.thieu_ncc ? (
      canEdit && !d.da_bi_dao && (ro === 'thieu_ncc' || d.id === chon) ? (
        <OSoNcc doc={{ id: d.id, code: d.code }} onXong={() => sangO(d.id)} />
      ) : (
        <span className="kh-warn">chưa ghi</span>
      )
    ) : (
      <span className="kh-empty">—</span>
    )

  const soPhieu = (d: PhieuRow) => (
    <span
      style={d.da_bi_dao ? { textDecoration: 'line-through', textDecorationColor: 'var(--kh-ink3)' } : undefined} // prettier-ignore
      title={d.reversal_of_code ? `Đảo của ${d.reversal_of_code}` : undefined}
    >
      <span className={`kh-sq ${MAU_LOAI[d.kind]}`} aria-hidden />
      <Link
        href={`/warehouse/phieu/${d.id}`}
        className="kh-lnk"
        onClick={(e) => e.stopPropagation()}
      >
        {d.code}
      </Link>
      {d.da_bi_dao && (
        <span className="kh-tag" style={{ marginLeft: 6, color: 'var(--kh-stop)' }}>
          đã đảo
        </span>
      )}
      {d.reversal_of_code && <span className="kh-mut"> · đảo</span>}
      {d.status === 'pending' && (
        <span className="kh-tag warn" style={{ marginLeft: 6 }}>
          chờ duyệt
        </span>
      )}
      {d.status === 'rejected' && (
        <span className="kh-tag" style={{ marginLeft: 6, color: 'var(--kh-stop)' }}>
          từ chối
        </span>
      )}
    </span>
  )

  return (
    <KhoKhung label="Phiếu đã ghi">
      <DauTrang
        title="Phiếu đã ghi"
        ctx={
          <>
            <b>{fmt(dem.all)}</b> phiếu · sổ chỉ cộng thêm, sai thì lập phiếu đảo
          </>
        }
        actions={
          <>
            {!dien && (
              <ApNhom>
                <ApNut
                  primary
                  icon={<FileText size={15} aria-hidden />}
                  href={sel ? `/warehouse/phieu/${sel.id}` : undefined}
                  why={sel ? null : canChon}
                >
                  {sel ? `Mở ${sel.code}` : 'Mở phiếu'}
                </ApNut>
                <ApNut
                  icon={<Printer size={15} aria-hidden />}
                  href={sel ? `/print/warehouse/${sel.id}` : undefined}
                  why={sel ? null : canChon}
                >
                  In phiếu
                </ApNut>
              </ApNhom>
            )}
            {canEdit && (
              <ApNhom>
                <ApNut
                  icon={<ArrowDownToLine size={15} aria-hidden />}
                  href="/warehouse/nhap"
                >
                  Nhận hàng
                </ApNut>
                <ApNut
                  icon={<ArrowUpFromLine size={15} aria-hidden />}
                  href="/warehouse/xuat"
                >
                  Xuất hàng
                </ApNut>
              </ApNhom>
            )}
          </>
        }
      />

      <TabNgang label="Loại phiếu" tabs={tabs} />

      <ThanhLoc>
        <select
          value={lyDo}
          className={lyDo ? 'on' : undefined}
          onChange={(e) => dat({ ly_do: e.target.value || null })}
          aria-label="Mã lý do"
          style={{ maxWidth: 280 }}
        >
          <option value="">Mọi lý do</option>
          {MA_LY_DO_KHO.map((x) => (
            <option key={x.ma} value={x.ma}>
              {x.ma} · {x.nhan}
            </option>
          ))}
        </select>
        <select
          value={nguoi}
          className={nguoi ? 'on' : undefined}
          onChange={(e) => dat({ nguoi: e.target.value || null })}
          aria-label="Người lập"
          style={{ maxWidth: 240 }}
        >
          <option value="">Mọi người lập</option>
          <option value="toi">
            Tôi lập ({fmt(nguoiLap.find((x) => x.id === meId)?.n ?? 0)})
          </option>
          {nguoiLap
            .filter((x) => x.id !== meId)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({fmt(x.n)})
              </option>
            ))}
        </select>
        {dangLoc && (
          <button
            type="button"
            className="clr"
            onClick={() => dat({ ly_do: null, nguoi: null })}
          >
            Bỏ lọc
          </button>
        )}
      </ThanhLoc>

      {/* Chỉ hiện khi ĐANG LỌC — treo thường trực thì vàng thành hình nền. */}
      {dangLoc && (
        <div className="kh-note">
          <span className="tag">Đang lọc</span>
          <span>
            Thu lại còn {lyDo && `mã lý do ${lyDo} · ${nhanLyDo(lyDo)}`}
            {lyDo && nguoi && ' · '}
            {nguoi &&
              `người lập: ${nguoi === 'toi' ? 'tôi' : (nguoiLap.find((x) => x.id === nguoi)?.name ?? '—')}`}
            . Số trên tab vẫn là số của CẢ SỔ, không phải của phần đang lọc.
          </span>
        </div>
      )}

      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />
      {rows.length === 0 ? (
        <Rong
          tieuDe={`Không có phiếu nào trong “${RO_PHIEU_NHAN[ro]}”`}
          lyDo={
            lyDo
              ? `Chưa phiếu nào mang mã lý do “${lyDo} · ${nhanLyDo(lyDo)}”. Mã lý do bật từ 15/09/2026; phiếu cũ hơn được suy mã từ loại chứng từ.`
              : `Sổ đang có ${fmt(dem.all)} phiếu, tab này trống.`
          }
          tiep={
            <button
              type="button"
              className="kh-btn"
              onClick={() => dat({ ro: null, ly_do: null, nguoi: null })}
            >
              Xem cả {fmt(dem.all)} phiếu
            </button>
          }
        />
      ) : dien ? (
        <div className="kh-pl" aria-label="Sổ phiếu">
          {rows.map((d) => (
            <div key={d.id} className="kh-pl-row" style={{ cursor: 'default' }}>
              <span style={{ minWidth: 0 }}>
                {soPhieu(d)}
                <span className="s" style={{ display: 'block' }}>
                  {d.ma_ly_do[0] ? `${d.ma_ly_do[0]} · ${nhanLyDo(d.ma_ly_do[0])}` : '—'}
                  {d.don && ` · ${d.don.po_code}`}
                </span>
                <span className="s" style={{ display: 'block' }}>
                  {d.counterparty ?? d.reason ?? '—'}
                </span>
                {d.thieu_ncc && (
                  <span style={{ display: 'block', marginTop: 4 }}>{soNcc(d)}</span>
                )}
              </span>
              <span className="r kh-num kh-mut">{isoToVn(d.doc_date).slice(0, 5)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="kh-grid">
          <table className="kh-tb" aria-label="Sổ phiếu kho">
            <colgroup>
              <col style={{ width: 62 }} />
              <col style={{ width: 186 }} />
              <col style={{ width: gon ? 64 : 178 }} />
              <col style={{ width: 120 }} />
              {!hep && <col style={{ width: 152 }} />}
              <col />
              <col style={{ width: 172 }} />
              {!gon && <col style={{ width: 150 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Số phiếu</th>
                <th>Lý do</th>
                <th>Đơn</th>
                {!hep && <th>Lệnh SX</th>}
                <th>Đối ứng</th>
                <th>Số phiếu NCC</th>
                {!gon && <th>Người lập</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const on = d.id === chon
                return (
                  <tr
                    key={d.id}
                    className={on ? 'd on' : 'd'}
                    tabIndex={0}
                    aria-selected={on}
                    onClick={() => setChon(d.id)}
                    onDoubleClick={() => mo(d.id)}
                    onKeyDown={(e) => phim(e, d.id)}
                  >
                    <td className="kh-num kh-mut">{isoToVn(d.doc_date).slice(0, 5)}</td>
                    <td>{soPhieu(d)}</td>
                    <td title={d.ma_ly_do.map((m) => `${m} · ${nhanLyDo(m)}`).join(', ')}>
                      {d.ma_ly_do.length === 0 ? (
                        <span className="kh-empty">—</span>
                      ) : (
                        <>
                          <MaLyDo ma={d.ma_ly_do[0]} />
                          {!gon && (
                            <span className="kh-mut">{nhanLyDo(d.ma_ly_do[0])}</span>
                          )}
                          {d.ma_ly_do.length > 1 && (
                            <span className="kh-mut kh-num">
                              {' '}
                              +{d.ma_ly_do.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="kh-num" title={d.don?.lsx.join(', ') || undefined}>
                      {d.don ? d.don.po_code : <span className="kh-empty">—</span>}
                    </td>
                    {!hep && (
                      <td className="kh-mut" title={d.don?.lsx.join(', ') || undefined}>
                        {d.don && d.don.lsx.length > 0 ? (
                          <span className="kh-num">
                            {d.don.lsx[0]}
                            {d.don.lsx.length > 1 && ` +${d.don.lsx.length - 1}`}
                          </span>
                        ) : d.don ? (
                          'ngoài lệnh'
                        ) : (
                          ''
                        )}
                      </td>
                    )}
                    <td className="kh-mut" title={d.counterparty ?? d.reason ?? ''}>
                      {d.counterparty ?? d.reason ?? '—'}
                    </td>
                    <td
                      className={
                        d.thieu_ncc && !d.supplier_doc_no?.trim() ? 'go' : undefined
                      }
                    >
                      {soNcc(d)}
                    </td>
                    {!gon && <td className="kh-mut">{d.created_by_name ?? '—'}</td>}
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={soCot}>
                  {rows.length} phiếu trang này · ô vuông:{' '}
                  <span className="kh-sq c-nhap" />
                  nhập <span className="kh-sq c-xuat" style={{ marginLeft: 6 }} />
                  xuất <span className="kh-sq c-kiem" style={{ marginLeft: 6 }} />
                  kiểm kê / chuyển · gạch ngang = đã bị đảo
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ThanhTT
        left="Enter / bấm đúp mở phiếu · số phiếu NCC: gõ trong ô rồi Enter (không đổi tồn) · mã lý do bật từ 15/09/2026"
        right={
          <>
            <PhanTrang
              trang={trang}
              soTrang={soTrang}
              onDoi={(t) => dat({ trang: t > 1 ? String(t) : null })}
            />
            <b>
              {rows.length} / {fmt(total)}
            </b>{' '}
            phiếu
          </>
        }
      />
    </KhoKhung>
  )
}
