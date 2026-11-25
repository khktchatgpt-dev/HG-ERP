'use client'

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { nhanLyDo } from '@/lib/kho-ma-ly-do'
import {
  gomTheoNgay,
  laGhiHo,
  lyDoPhieu,
  thuNgay,
  type SoPhieuDong,
  type SoPhieuLoai,
} from '@/lib/kho-so-phieu'
import { OSoNcc } from '../phieu/ghi-so-ncc'

const fmt = (n: number) => n.toLocaleString('vi-VN')

/** Ô lý do: chấm màu theo chiều + chữ; mã đầy đủ ở tooltip. */
function OLyDo({ d, children }: { d: SoPhieuDong; children?: ReactNode }) {
  const ld = lyDoPhieu(d)
  const cls = ld.dao ? 'd' : !ld.ma ? 'z' : d.kind === 'receipt' ? 'n' : 'x'
  const title = ld.dao
    ? `Phiếu đảo của ${d.dao_cua?.code}`
    : d.ma.map((m) => `${m} · ${nhanLyDo(m)}`).join(', ') || 'Dòng ghi trước 15/09/2026, không suy được lý do' // prettier-ignore
  return (
    <td title={title}>
      <span className={`sp-ld ${cls}`}>{ld.nhan}</span>
      {ld.them > 0 && <span className="kh-mut kh-num"> +{ld.them}</span>}
      {children}
    </td>
  )
}

/** Mã phiếu + nhãn trạng thái hiếm (chờ duyệt / từ chối). */
function OSoPhieu({ d }: { d: SoPhieuDong }) {
  return (
    <td>
      <Link
        href={`/warehouse/phieu/${d.id}`}
        className="kh-lnk sp-ma"
        onClick={(e) => e.stopPropagation()}
      >
        {d.code}
      </Link>
      {d.status === 'pending' && <span className="sp-tag w">chờ duyệt</span>}
      {d.status === 'rejected' && <span className="sp-tag s">từ chối</span>}
    </td>
  )
}

/** Nhãn "đảo bởi …" — đặt ở cột rộng nhất của dòng (Nhà cung cấp / Diễn giải), cột Lý do không đủ chỗ. */
function DaoBoi({ d }: { d: SoPhieuDong }) {
  if (!d.dao_boi) return null
  return (
    <span className="sp-tag" style={{ marginLeft: 0, marginRight: 6 }}>
      đảo bởi {d.dao_boi.code}
    </span>
  )
}

function OLenh({ lenh }: { lenh: string[] }) {
  if (lenh.length === 0) return <td className="kh-mut">ngoài lệnh</td>
  return (
    <td title={lenh.join(', ')}>
      {lenh[0]}
      {lenh.length > 1 && <span className="kh-mut kh-num"> +{lenh.length - 1}</span>}
    </td>
  )
}

/**
 * LƯỚI SỔ PHIẾU — gom theo ngày, dòng ngày dính dưới tiêu đề cột. Phiếu nhập và
 * phiếu xuất có bộ cột riêng (Dynamics: mỗi loại chứng từ một trang, chỉ cột của
 * loại đó). Phiếu đã bị đảo gạch ngang, không cộng vào số ngày lẫn chân bảng.
 */
export function BangSoPhieu({
  loai,
  ds,
  today,
  chon,
  onChon,
  onMo,
  goSoNcc,
  gon,
  chan,
  tongDong,
}: {
  loai: SoPhieuLoai
  ds: SoPhieuDong[]
  today: string
  chon: string | null
  onChon: (id: string) => void
  onMo: (id: string) => void
  /** Mở ô gõ số phiếu NCC trên dòng (rổ "Thiếu số NCC" + có quyền). */
  goSoNcc: boolean
  /** Khung hẹp (< 1000px): ẩn cột Người lập. */
  gon: boolean
  /** Câu chân bảng — nói tổng KHÔNG gồm gì. */
  chan: ReactNode
  tongDong: number
}) {
  const khung = useRef<HTMLDivElement>(null)
  // Dòng ngày dính ngay dưới tiêu đề cột: đo chiều cao thead thật (font, phóng to).
  useLayoutEffect(() => {
    const el = khung.current
    const th = el?.querySelector('thead')
    if (el && th)
      el.style.setProperty('--sp-th', `${th.getBoundingClientRect().height}px`)
  })

  const nhap = loai === 'receipt'
  const nhom = gomTheoNgay(ds)
  const soCot = nhap ? (gon ? 7 : 8) : gon ? 5 : 6

  /** Ghi xong số NCC ở một dòng → con trỏ sang ô của phiếu thiếu kế tiếp. */
  const sangO = (id: string) => {
    const con = ds.filter((r) => r.thieu_ncc && !r.supplier_doc_no)
    const sau = con[con.findIndex((r) => r.id === id) + 1]
    if (sau)
      setTimeout(
        () => (document.querySelector(`[data-so-ncc="${sau.id}"]`) as HTMLInputElement | null)?.focus(), // prettier-ignore
        0,
      )
  }
  const phim = (e: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault()
      onMo(id)
    }
  }

  return (
    <div className="kh-grid" ref={khung}>
      <table className="kh-tb" aria-label={nhap ? 'Phiếu nhập' : 'Phiếu xuất'}>
        {nhap ? (
          <colgroup>
            <col style={{ width: 142 }} />
            <col style={{ width: 124 }} />
            <col style={{ width: 112 }} />
            <col style={{ width: 154 }} />
            <col />
            <col style={{ width: 52 }} />
            <col style={{ width: 132 }} />
            {!gon && <col style={{ width: 150 }} />}
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: 142 }} />
            <col style={{ width: 190 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 56 }} />
            <col />
            {!gon && <col style={{ width: 160 }} />}
          </colgroup>
        )}
        <thead>
          {nhap ? (
            <tr>
              <th>Số phiếu</th>
              <th>Lý do</th>
              <th>Đơn mua</th>
              <th>Lệnh</th>
              <th>Nhà cung cấp</th>
              <th className="r">Dòng</th>
              <th>Số phiếu NCC</th>
              {!gon && <th>Người lập</th>}
            </tr>
          ) : (
            <tr>
              <th>Số phiếu</th>
              <th>Lý do</th>
              <th>Lệnh / phiếu gốc</th>
              <th className="r">Dòng</th>
              <th>Diễn giải</th>
              {!gon && <th>Người lập</th>}
            </tr>
          )}
        </thead>
        <tbody>
          {nhom.map((g) => [
            <tr key={`n${g.ngay}`} className="sp-ngay">
              <td colSpan={soCot}>
                {thuNgay(g.ngay, today)}
                <span className="m">
                  {fmt(g.soPhieu)} phiếu{nhap && ` · ${fmt(g.soDong)} dòng`}
                </span>
              </td>
            </tr>,
            ...g.ds.map((d) => {
              const cls = ['d', d.id === chon && 'on', d.dao_boi && 'sp-dao']
                .filter(Boolean)
                .join(' ')
              return (
                <tr
                  key={d.id}
                  className={cls}
                  tabIndex={0}
                  aria-selected={d.id === chon}
                  data-id={d.id}
                  onClick={() => onChon(d.id)}
                  onDoubleClick={() => onMo(d.id)}
                  onKeyDown={(e) => phim(e, d.id)}
                >
                  <OSoPhieu d={d} />
                  {nhap ? (
                    <>
                      <OLyDo d={d} />
                      <td className="sp-po">
                        {d.don?.po_code ?? <span className="kh-empty">—</span>}
                      </td>
                      {d.don ? <OLenh lenh={d.lenh} /> : <td className="kh-empty">—</td>}
                      <td title={d.counterparty ?? undefined}>
                        <DaoBoi d={d} />
                        {d.counterparty ?? <span className="kh-empty">—</span>}
                      </td>
                      <td className="r kh-num">{fmt(d.so_dong)}</td>
                      <td
                        className={
                          goSoNcc && d.thieu_ncc && !d.supplier_doc_no ? 'go' : undefined
                        }
                      >
                        {d.supplier_doc_no ? (
                          <span className="kh-num">{d.supplier_doc_no}</span>
                        ) : goSoNcc && d.thieu_ncc && !d.dao_boi ? (
                          <OSoNcc
                            doc={{ id: d.id, code: d.code }}
                            onXong={() => sangO(d.id)}
                          />
                        ) : (
                          <span className="kh-empty">—</span>
                        )}
                      </td>
                      {!gon && <td className="kh-mut">{d.created_by_name ?? '—'}</td>}
                    </>
                  ) : (
                    <>
                      <OLyDo d={d}>
                        {laGhiHo(d) && <span className="sp-tag">ghi hộ</span>}
                      </OLyDo>
                      {d.dao_cua ? (
                        <td>
                          <Link
                            href={`/warehouse/phieu/${d.dao_cua.id}`}
                            className="kh-lnk sp-po"
                            onClick={(e) => e.stopPropagation()}
                            title={`Mở phiếu gốc ${d.dao_cua.code}`}
                          >
                            {d.dao_cua.code}
                          </Link>
                        </td>
                      ) : (
                        <OLenh lenh={d.lenh} />
                      )}
                      <td className="r kh-num">{fmt(d.so_dong)}</td>
                      <td
                        className={d.dao_cua ? undefined : 'kh-mut'}
                        title={d.dien_giai ?? d.team_name ?? d.counterparty ?? undefined}
                      >
                        <DaoBoi d={d} />
                        {d.dien_giai ?? d.team_name ?? d.counterparty ?? (
                          <span className="kh-empty">—</span>
                        )}
                      </td>
                      {!gon && <td className="kh-mut">{d.created_by_name ?? '—'}</td>}
                    </>
                  )}
                </tr>
              )
            }),
          ])}
        </tbody>
        <tfoot>
          {nhap ? (
            <tr>
              <td colSpan={5}>{chan}</td>
              <td className="r kh-num">{fmt(tongDong)}</td>
              <td colSpan={soCot - 6} />
            </tr>
          ) : (
            // Phiếu xuất: câu chân dài (đảo / đã bị đảo) — trải hết bề ngang, số dòng nằm trong câu.
            <tr>
              <td colSpan={soCot}>{chan}</td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  )
}
