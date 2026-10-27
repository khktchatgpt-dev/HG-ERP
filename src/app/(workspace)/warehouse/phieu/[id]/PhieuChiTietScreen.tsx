'use client'

import { useRef, useState } from 'react'
import { isoToVn } from '@/lib/date-vn'
import { dongThieuKg, ketQuaPhieu } from '@/lib/da-ve'
import type { KetQuaDao } from '@/lib/kho-dao-phieu'
import { useBeRong } from '@/lib/use-be-rong'
import Link from 'next/link'
import { ArrowDownToLine, BookOpen, Printer, RotateCcw } from 'lucide-react'
import {
  ApNhom,
  ApNut,
  DauTrang,
  DongThoiGian,
  KhoKhung,
  MenuNut,
  TabNgang,
  ThanhTT,
} from '../../_erp/khung'
import type { ChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import { SuaPhieuSheet, type Kieu } from './sua-phieu'
import { KgCanSheet } from './kg-can-sheet'
import { DaoSheet } from './dao-sheet'
import { BangDongKho, BangDongNhap } from './dong-phieu'

export type PhieuDoc = {
  id: string
  code: string
  kind: 'receipt' | 'issue' | 'transfer' | 'stocktake'
  doc_date: string
  counterparty: string | null
  reason: string | null
  note: string | null
  status: 'pending' | 'posted' | 'rejected'
  supplier_doc_no: string | null
  reversal_of_code: string | null
  created_by_name: string | null
  created_at: string
  approved_by_name: string | null
  approved_at: string | null
  reject_reason: string | null
}

export type PhieuDong = {
  id: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  direction: 'in' | 'out'
  qty: number
  qty_rejected: number
  qty_ordered: number | null
  shelf_location: string | null
  note: string | null
  ma_ly_do: string | null
}

const LOAI: Record<PhieuDoc['kind'], string> = {
  receipt: 'Phiếu nhập kho',
  issue: 'Phiếu xuất kho',
  transfer: 'Phiếu chuyển kho',
  stocktake: 'Biên bản kiểm kê',
}

/**
 * "06/10/2026 06:02" giờ VN — cố định múi giờ để server và trình duyệt ra cùng
 * chữ. Bản cũ cắt `created_at` UTC: phiếu ghi 06:02 sáng 06/10 in "05/10".
 */
const gio = (iso: string) => {
  const vn = new Date(Date.parse(iso) + 7 * 3_600_000).toISOString()
  return `${isoToVn(vn.slice(0, 10))} ${vn.slice(11, 16)}`
}
/** Chữ dài (ghi chú, lý do) một dòng, cắt "…" — đầu trang không phình cao; `title` đọc nguyên văn. */
const chua = (s: string) => <span className="kh-warn">{s}</span>
const MAU_LOAI: Record<PhieuDoc['kind'], string> = {
  receipt: 'c-nhap',
  issue: 'c-xuat',
  transfer: 'c-kiem',
  stocktake: 'c-kiem',
}

/** Một ô nhãn–giá trị của dải đầu phiếu (chỉ đọc). */
function O({
  k,
  children,
  rong,
}: {
  k: string
  children: React.ReactNode
  rong?: number
}) {
  return (
    <div style={rong ? { maxWidth: rong } : undefined}>
      <span className="k">{k}</span>
      <span className="v">{children}</span>
    </div>
  )
}

/** Khung hẹp hơn mức này thì ẩn cột phụ (Kệ, Ghi chú) thay vì cuộn ngang. */
const HEP = 900

/**
 * CHI TIẾT PHIẾU KHO — Khuôn D (Kho đợt 2 · Bước 2, bản vẽ B2-2/B2-3
 * https://claude.ai/artifact/Me6k3W7JPPX3AHMyPzQ2Wt, duyệt 12/10/2026).
 *
 * Tờ phiếu tự kể ba chuyện: đã vào sổ chưa, ai ghi, CÒN HIỆU LỰC KHÔNG.
 *
 * Phiếu nhập THEO ĐƠN MUA (`nhap` có giá trị) sửa được NGAY TẠI KHO — trước
 * 12/10 chỉ có Đảo phiếu, ba cách sửa nằm ở khu Cung ứng. Hộp sửa là BẢN RIÊNG
 * của Kho (`./sua-phieu`, `./kg-can-sheet` — chép từ Cung ứng 12/10, chủ dự án:
 * "không dùng chung giao diện giữa 2 phòng"), cùng route ghi và cùng luật;
 * "Sửa số lượng" mở form nhận TRONG khu Kho (`/warehouse/nhap/[đơn]?sua=`).
 *
 * Luật màn hẹp: một đầu trang một hàng, đầu phiếu là dải chip tự xuống dòng (bản
 * cũ là cột FactBox bên phải — nguyên nhân cuộn ngang 800/880 ở 1280), một vùng
 * cuộn duy nhất là bảng dòng; Lịch sử là TAB chứ không xếp chồng bắt cuộn trang.
 *
 * Kho lối ERP · B6 (14/10/2026): viết tay, không kit — khung `../../_erp`; Sửa
 * phiếu là nút thả xuống ở Action Pane, mục khoá vẫn hiện kèm lý do.
 */
export function PhieuChiTietScreen({
  doc,
  lines,
  soDongKiemKe,
  reversedBy,
  dao,
  canEdit,
  nhap,
}: {
  doc: PhieuDoc
  lines: PhieuDong[]
  soDongKiemKe: number
  reversedBy: { id: string; code: string } | null
  dao: KetQuaDao
  canEdit: boolean
  /** Phiếu nhập theo đơn mua — dữ liệu của trang chi tiết Cung ứng (`loadChiTietPhieuNhap`). */
  nhap: ChiTietPhieuNhap | null
}) {
  const khung = useRef<HTMLDivElement>(null)
  const beRong = useBeRong(khung)
  const hep = beRong > 0 && beRong < HEP
  const [moDao, setMoDao] = useState(false)
  const [sua, setSua] = useState<Kieu | null>(null)
  const [moKg, setMoKg] = useState(false)
  const [tab, setTab] = useState<'hang' | 'lich-su'>('hang')

  const row = nhap?.row ?? null
  const daDao = !!reversedBy
  const tongQty = lines.reduce((s, l) => s + l.qty, 0)
  const thieu = row
    ? [
        !row.supplier_doc_no?.trim() && 'số phiếu giao NCC',
        !row.counterparty?.trim() && 'người giao',
      ].filter((v): v is string => !!v)
    : []
  const dongKg = row ? dongThieuKg(row.phieu) : []
  const kq = row && !daDao ? ketQuaPhieu(row.phieu).filter((k) => k.kind !== 'du') : []
  const dangHieuLuc = nhap?.khac.filter((k) => k.con_hieu_luc) ?? []
  const whySua = daDao
    ? `Phiếu đã đảo — sửa trên phiếu đang hiệu lực${dangHieuLuc.length ? ` (${dangHieuLuc.map((k) => k.code).join(', ')})` : ''}.`
    : undefined
  const whyDao = !dao.duoc ? `${dao.vuong}. ${dao.goBang}` : undefined

  const status =
    doc.status === 'pending' ? (
      <span className="kh-tag warn">chờ duyệt</span>
    ) : doc.status === 'rejected' ? (
      <span className="kh-tag" style={{ color: 'var(--kh-stop)' }}>
        đã từ chối
      </span>
    ) : daDao ? (
      <span className="kh-tag" style={{ color: 'var(--kh-stop)', fontWeight: 600 }}>
        đã đảo · không còn tính tồn
      </span>
    ) : (
      <span className="kh-tag done">đã ghi sổ</span>
    )

  const whyQuyen = canEdit ? null : 'Chỉ phòng Kho sửa phiếu kho'
  const suaPhieu = row ? (
    row.phieu.cho_lap_lai && canEdit ? (
      <ApNut
        primary
        icon={<ArrowDownToLine size={15} aria-hidden />}
        href={`/warehouse/nhap/${row.po_id}?sua=${row.doc_id}`}
      >
        Lập lại phiếu
      </ApNut>
    ) : (
      <MenuNut
        label="Sửa phiếu"
        items={[
          {
            label: 'Sửa thông tin',
            why: whyQuyen ?? whySua,
            onClick: () => setSua('thong-tin'),
          },
          { label: 'Sửa số lượng / dòng', why: whyQuyen ?? whySua, onClick: () => setSua('so-luong') }, // prettier-ignore
          { label: 'Điều chỉnh chênh lệch', why: whyQuyen ?? whySua, onClick: () => setSua('chenh-lech') }, // prettier-ignore
          ...(dongKg.length > 0
            ? [{ label: `Ghi kg cân (${dongKg.length} dòng)`, why: whyQuyen ?? whySua, onClick: () => setMoKg(true) }] // prettier-ignore
            : []),
          { label: 'Đảo phiếu', nguy: true, why: whyQuyen ?? whyDao, onClick: () => setMoDao(true) }, // prettier-ignore
        ]}
      />
    )
  ) : (
    <ApNut
      icon={<RotateCcw size={15} aria-hidden />}
      why={whyQuyen ?? whyDao}
      onClick={() => setMoDao(true)}
    >
      Đảo phiếu
    </ApNut>
  )

  const lenh =
    (nhap?.nhap_cho?.lenh ?? [row?.lsx_code, ...(row?.lsx_them ?? [])].filter(Boolean)).join(' · ') || 'không theo lệnh' // prettier-ignore
  const chips = row ? (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu">
      <O k="NCC" rong={260}>
        <span title={nhap?.nhap_cho?.ncc.join('; ') || row.supplier_name}>
          {nhap?.nhap_cho?.ncc.join('; ') || row.supplier_name}
        </span>
      </O>
      <O k="Đơn">
        <Link href={`/warehouse/nhap?don=${row.po_id}`} className="kh-lnk">
          {row.po_code}
        </Link>
      </O>
      <O k="Lệnh" rong={240}>
        <span title={lenh}>{lenh}</span>
      </O>
      <O k="Đợt">{nhap?.nhap_cho?.dot ?? 'không chia đợt'}</O>
      <O k="Ngày CT">
        <span className="kh-num">{isoToVn(row.doc_date.slice(0, 10))}</span>
      </O>
      <O k="Ghi sổ">
        <span className="kh-num">{gio(nhap!.created_at)}</span>
        {nhap?.nguoi_lap ? ` · ${nhap.nguoi_lap}` : ''}
      </O>
      <O k="Số phiếu NCC">
        {row.supplier_doc_no?.trim() ? (
          <span className="kh-num">{row.supplier_doc_no}</span>
        ) : canEdit && !daDao ? (
          <button
            type="button"
            className="kh-lnk"
            style={{ fontFamily: 'inherit', color: 'var(--kh-warn)' }}
            onClick={() => setSua('thong-tin')}
          >
            chưa ghi — ghi ngay
          </button>
        ) : (
          chua('chưa ghi')
        )}
      </O>
      <O k="Người giao">{row.counterparty?.trim() || chua('chưa ghi')}</O>
      {row.ghi_chu?.trim() && (
        <O k="Ghi chú" rong={440}>
          <span title={row.ghi_chu} style={{ fontWeight: 400 }}>
            {row.ghi_chu}
          </span>
        </O>
      )}
    </div>
  ) : (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu">
      <O k={doc.kind === 'receipt' ? 'Bên giao' : 'Bên nhận'} rong={280}>
        {doc.counterparty ?? '—'}
      </O>
      <O k="Ngày CT">
        <span className="kh-num">{isoToVn(doc.doc_date)}</span>
      </O>
      <O k="Ghi sổ">
        <span className="kh-num">{gio(doc.created_at)}</span>
        {doc.created_by_name ? ` · ${doc.created_by_name}` : ''}
      </O>
      {doc.reason && (
        <O k="Lý do" rong={440}>
          <span title={doc.reason} style={{ fontWeight: 400 }}>
            {doc.reason}
          </span>
        </O>
      )}
      {doc.supplier_doc_no && (
        <O k="Số phiếu NCC">
          <span className="kh-num">{doc.supplier_doc_no}</span>
        </O>
      )}
      {doc.reversal_of_code && (
        <O k="Đảo cho">
          <span className="kh-ma">{doc.reversal_of_code}</span>
        </O>
      )}
      {doc.status !== 'posted' && (
        <O k="Duyệt" rong={360}>
          {[
            doc.approved_by_name ?? 'chưa duyệt',
            doc.approved_at ? isoToVn(doc.approved_at.slice(0, 10)) : null,
            doc.reject_reason ? `“${doc.reject_reason}”` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </O>
      )}
      {doc.note && (
        <O k="Ghi chú" rong={440}>
          <span title={doc.note} style={{ fontWeight: 400 }}>
            {doc.note}
          </span>
        </O>
      )}
    </div>
  )

  return (
    <KhoKhung label={`${LOAI[doc.kind]} ${doc.code}`}>
      <DauTrang
        crumb="Kho › Phiếu đã ghi"
        title={
          <>
            <span className={`kh-sq ${MAU_LOAI[doc.kind]}`} aria-hidden />
            <span className="kh-num">{doc.code}</span>
          </>
        }
        ctx={
          <>
            {row ? `${LOAI[doc.kind]} · theo đơn mua` : LOAI[doc.kind]} {status}
          </>
        }
        actions={
          <>
            <ApNhom>{suaPhieu}</ApNhom>
            <ApNhom>
              <ApNut
                icon={<Printer size={15} aria-hidden />}
                onClick={() => window.open(`/print/warehouse/${doc.id}`, '_blank')}
              >
                In phiếu
              </ApNut>
              <ApNut icon={<BookOpen size={15} aria-hidden />} href="/warehouse/phieu">
                Phiếu đã ghi
              </ApNut>
            </ApNhom>
          </>
        }
      />
      {chips}
      <div ref={khung} style={{ height: 0, width: '100%' }} aria-hidden />

      {reversedBy && (
        <div className="kh-note stop">
          <span className="tag">Tờ này đã bị đảo</span>
          <span>
            Bút toán của phiếu đã ghi ngược bằng{' '}
            <Link href={`/warehouse/phieu/${reversedBy.id}`} className="kh-lnk">
              {reversedBy.code}
            </Link>{' '}
            — tờ này không còn tác dụng lên tồn
            {row?.thay_boi
              ? `. Phiếu ghi lại: ${row.thay_boi}`
              : dangHieuLuc.length > 0
                ? `. Phiếu nhập đang hiệu lực của đơn: ${dangHieuLuc.map((k) => k.code).join(', ')}`
                : ''}
            .
          </span>
        </div>
      )}
      {!row && !reversedBy && !dao.duoc && doc.status === 'posted' && (
        <div className="kh-note">
          <span className="tag">Không đảo được</span>
          <span>{whyDao}</span>
        </div>
      )}
      {row && !daDao && thieu.length > 0 && (
        <div className="kh-note">
          <span className="tag">Thiếu thông tin</span>
          <span>
            Chưa có <b>{thieu.join(' và ')}</b> — Kế toán đối chiếu công nợ bằng số phiếu
            giao của NCC.{' '}
            {canEdit && (
              <button
                type="button"
                className="kh-lnk"
                style={{ fontFamily: 'inherit' }}
                onClick={() => setSua('thong-tin')}
              >
                Ghi ngay
              </button>
            )}
          </span>
        </div>
      )}
      {kq.length > 0 && (
        <div className="kh-note mut">
          <span className="tag">Đơn</span>
          <span>
            {kq.map((k) => `${k.text}${k.viec ? ` — ${k.viec}` : ''}`).join(' · ')} (việc
            của Cung ứng{row?.owner_name ? `, ${row.owner_name}` : ''}).
          </span>
        </div>
      )}

      {nhap && (
        <TabNgang
          label="Nội dung phiếu"
          tabs={[
            { key: 'hang', label: 'Hàng nhập', n: nhap.dong.length, on: tab === 'hang', onClick: () => setTab('hang'), mau: 'c-nhap' }, // prettier-ignore
            { key: 'lich-su', label: 'Lịch sử', n: nhap.lich_su.length, on: tab === 'lich-su', onClick: () => setTab('lich-su'), mau: 'c-mut' }, // prettier-ignore
          ]}
        />
      )}

      {nhap && tab === 'lich-su' ? (
        <div
          className="kh-grid"
          role="tabpanel"
          aria-label="Lịch sử phiếu"
          style={{ padding: '12px 16px' }}
        >
          <DongThoiGian marks={nhap.lich_su} />
          {nhap.khac.length > 0 && (
            <div
              style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '4px 18px', alignItems: 'center', fontSize: 12.5 }} // prettier-ignore
            >
              <span className="kh-mut" style={{ fontSize: 11, fontWeight: 700 }}>
                PHIẾU NHẬP KHÁC CỦA ĐƠN
              </span>
              {nhap.khac.map((k) => (
                <span key={k.doc_id}>
                  <Link href={`/warehouse/phieu/${k.doc_id}`} className="kh-lnk">
                    {k.code}
                  </Link>{' '}
                  <span className="kh-num kh-mut">{isoToVn(k.at.slice(0, 10))}</span>{' '}
                  <span className={k.con_hieu_luc ? 'kh-tag done' : 'kh-tag'}>
                    {k.con_hieu_luc ? 'đang hiệu lực' : 'đã đảo'}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : nhap ? (
        <BangDongNhap dong={nhap.dong} daDao={daDao} hep={hep} />
      ) : (
        <BangDongKho
          lines={lines}
          kind={doc.kind}
          hep={hep}
          soDongKiemKe={soDongKiemKe}
        />
      )}

      <ThanhTT
        left={
          row
            ? 'Sửa thông tin không đổi tồn · sửa số lượng = đảo rồi lập lại · hàng đã dùng thì điều chỉnh chênh lệch'
            : 'Phiếu đã ghi không sửa, không xoá — sai thì lập phiếu đảo, cả hai tờ cùng nằm trong sổ'
        }
        right={<b>{nhap ? nhap.dong.length : lines.length} dòng</b>}
      />

      {moDao && (
        <DaoSheet
          doc={doc}
          tongQty={tongQty}
          soDong={lines.length}
          canhBao={dao.duoc ? dao.canhBao : null}
          onClose={() => setMoDao(false)}
        />
      )}
      {row && sua && (
        <SuaPhieuSheet row={row} kieuBanDau={sua} onClose={() => setSua(null)} />
      )}
      {row && moKg && <KgCanSheet row={row} onClose={() => setMoKg(false)} />}
    </KhoKhung>
  )
}
