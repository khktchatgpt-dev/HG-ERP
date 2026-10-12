'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import { dongThieuKg, ketQuaPhieu } from '@/lib/da-ve'
import type { KetQuaDao } from '@/lib/kho-dao-phieu'
import { useBeRong } from '@/lib/use-be-rong'
import {
  Btn,
  Code,
  HeadChip,
  HeadChips,
  Menu,
  NoticeBar,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  Tag,
  Timeline,
} from '@/components/kit'
import type { ChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import {
  SuaPhieuSheet,
  type Kieu,
} from '@/app/(mua-hang)/mua-hang/theo-doi/da-ve/sua-phieu'
import { KgCanSheet } from '@/app/(mua-hang)/mua-hang/theo-doi/da-ve/kg-can-sheet'
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
const dai = (s: string) => (
  <span className="inline-block max-w-[440px] truncate align-bottom" title={s}>
    {s}
  </span>
)
const chua = (s: string) => <span className="font-semibold text-[var(--warn)]">{s}</span>

/** Khung hẹp hơn mức này thì ẩn cột phụ (Kệ, Ghi chú) thay vì cuộn ngang. */
const HEP = 900

/**
 * CHI TIẾT PHIẾU KHO — Khuôn D (Kho đợt 2 · Bước 2, bản vẽ B2-2/B2-3
 * https://claude.ai/artifact/Me6k3W7JPPX3AHMyPzQ2Wt, duyệt 12/10/2026).
 *
 * Tờ phiếu tự kể ba chuyện: đã vào sổ chưa, ai ghi, CÒN HIỆU LỰC KHÔNG.
 *
 * Phiếu nhập THEO ĐƠN MUA (`nhap` có giá trị) sửa được NGAY TẠI KHO — trước
 * 12/10 chỉ có Đảo phiếu, ba cách sửa nằm ở khu Cung ứng. Dùng lại đúng hộp
 * của Cung ứng (`SuaPhieuSheet`, `KgCanSheet`) và đúng route ghi; riêng "Sửa số
 * lượng" mở form nhận TRONG khu Kho (`/warehouse/nhap/[đơn]?sua=`).
 *
 * Luật màn hẹp: một đầu trang một hàng, đầu phiếu là dải chip tự xuống dòng (bản
 * cũ là cột FactBox bên phải — nguyên nhân cuộn ngang 800/880 ở 1280), một vùng
 * cuộn duy nhất là bảng dòng; Lịch sử là TAB chứ không xếp chồng bắt cuộn trang.
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
  const router = useRouter()
  const khung = useRef<HTMLDivElement>(null)
  const hep = useBeRong(khung) < HEP
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
  const khoaQuyen = canEdit ? undefined : 'Kho'
  const whyDao = !dao.duoc ? `${dao.vuong}. ${dao.goBang}` : undefined

  const status =
    doc.status === 'pending' ? (
      <Tag tone="warn">chờ duyệt</Tag>
    ) : doc.status === 'rejected' ? (
      <Tag tone="stop">đã từ chối</Tag>
    ) : daDao ? (
      <Tag tone="stop">đã đảo · không còn tính tồn</Tag>
    ) : (
      <Tag tone="done">đã ghi sổ</Tag>
    )

  const suaPhieu = row ? (
    row.phieu.cho_lap_lai && canEdit ? (
      <Btn icon="nhapKho" primary href={`/warehouse/nhap/${row.po_id}?sua=${row.doc_id}`}>
        Lập lại phiếu
      </Btn>
    ) : (
      <Menu
        label="Sửa phiếu ▾"
        items={[
          { label: 'Sửa thông tin', group: 'Sửa phiếu', blockedBy: khoaQuyen, why: whySua, onClick: () => setSua('thong-tin') }, // prettier-ignore
          { label: 'Sửa số lượng / dòng', group: 'Sửa phiếu', blockedBy: khoaQuyen, why: whySua, onClick: () => setSua('so-luong') }, // prettier-ignore
          { label: 'Điều chỉnh chênh lệch', group: 'Sửa phiếu', blockedBy: khoaQuyen, why: whySua, onClick: () => setSua('chenh-lech') }, // prettier-ignore
          ...(dongKg.length > 0
            ? [{ label: `Ghi kg cân (${dongKg.length} dòng)`, group: 'Sửa phiếu', blockedBy: khoaQuyen, why: whySua, onClick: () => setMoKg(true) }] // prettier-ignore
            : []),
          { label: 'Đảo phiếu', danger: true, blockedBy: khoaQuyen, why: whyDao, onClick: () => setMoDao(true) }, // prettier-ignore
        ]}
      />
    )
  ) : (
    <Btn
      icon="dao"
      blockedBy={khoaQuyen}
      disabled={canEdit && !dao.duoc}
      title={canEdit && !dao.duoc ? whyDao : undefined}
      onClick={() => setMoDao(true)}
    >
      Đảo phiếu
    </Btn>
  )

  const chips: ReactNode = row ? (
    <HeadChips>
      <HeadChip
        plain
        label="NCC"
        value={nhap?.nhap_cho?.ncc.join('; ') || row.supplier_name}
      />
      <HeadChip
        plain
        label="Đơn"
        value={<span className="num">{row.po_code}</span>}
        onClick={() => router.push(`/warehouse/nhap?don=${row.po_id}`)}
      />
      <HeadChip
        plain
        label="Lệnh"
        value={
          (nhap?.nhap_cho?.lenh ?? [row.lsx_code, ...(row.lsx_them ?? [])].filter(Boolean)).join(' · ') || 'không theo lệnh' // prettier-ignore
        }
      />
      <HeadChip plain label="Đợt" value={nhap?.nhap_cho?.dot ?? 'không chia đợt'} />
      <HeadChip
        plain
        label="Ngày CT"
        value={<span className="num">{isoToVn(row.doc_date.slice(0, 10))}</span>}
      />
      <HeadChip
        plain
        label="Ghi sổ"
        value={
          <span>
            <span className="num">{gio(nhap!.created_at)}</span>
            {nhap?.nguoi_lap ? ` · ${nhap.nguoi_lap}` : ''}
          </span>
        }
      />
      <HeadChip
        plain
        label="Số phiếu NCC"
        value={
          row.supplier_doc_no?.trim() ? (
            <span className="num">{row.supplier_doc_no}</span>
          ) : (
            chua('chưa ghi')
          )
        }
        onClick={canEdit && !daDao ? () => setSua('thong-tin') : undefined}
      />
      <HeadChip
        plain
        label="Người giao"
        value={row.counterparty?.trim() || chua('chưa ghi')}
      />
      {row.ghi_chu?.trim() && <HeadChip plain label="Ghi chú" value={dai(row.ghi_chu)} />}
    </HeadChips>
  ) : (
    <HeadChips>
      <HeadChip
        plain
        label={doc.kind === 'receipt' ? 'Bên giao' : 'Bên nhận'}
        value={doc.counterparty ?? '—'}
      />
      <HeadChip
        plain
        label="Ngày CT"
        value={<span className="num">{isoToVn(doc.doc_date)}</span>}
      />
      <HeadChip
        plain
        label="Ghi sổ"
        value={
          <span>
            <span className="num">{gio(doc.created_at)}</span>
            {doc.created_by_name ? ` · ${doc.created_by_name}` : ''}
          </span>
        }
      />
      {doc.reason && <HeadChip plain label="Lý do" value={dai(doc.reason)} />}
      {doc.supplier_doc_no && (
        <HeadChip
          plain
          label="Số phiếu NCC"
          value={<span className="num">{doc.supplier_doc_no}</span>}
        />
      )}
      {doc.reversal_of_code && (
        <HeadChip plain label="Đảo cho" value={<Code>{doc.reversal_of_code}</Code>} />
      )}
      {doc.status !== 'posted' && (
        <HeadChip
          plain
          label="Duyệt"
          value={[
            doc.approved_by_name ?? 'chưa duyệt',
            doc.approved_at ? isoToVn(doc.approved_at.slice(0, 10)) : null,
            doc.reject_reason ? `“${doc.reject_reason}”` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
      {doc.note && <HeadChip plain label="Ghi chú" value={dai(doc.note)} />}
    </HeadChips>
  )

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow={row ? `${LOAI[doc.kind]} · theo đơn mua` : LOAI[doc.kind]}
          title={<span className="num">{doc.code}</span>}
          status={status}
          actions={
            <>
              <Btn icon="quayLai" href="/warehouse/phieu">
                Sổ phiếu
              </Btn>
              <Btn
                icon="in"
                onClick={() => window.open(`/print/warehouse/${doc.id}`, '_blank')}
              >
                In phiếu
              </Btn>
              {suaPhieu}
            </>
          }
        >
          {chips}
        </ScreenHeader>
        <div ref={khung} className="h-0 w-full" aria-hidden />

        {reversedBy && (
          <NoticeBar
            tone="stop"
            tag="Tờ này đã bị đảo"
            action={{
              label: `Mở ${reversedBy.code}`,
              onClick: () => router.push(`/warehouse/phieu/${reversedBy.id}`),
            }}
          >
            Bút toán của phiếu đã ghi ngược bằng {reversedBy.code} — tờ này không còn tác
            dụng lên tồn
            {row?.thay_boi
              ? `. Phiếu ghi lại: ${row.thay_boi}`
              : dangHieuLuc.length > 0
                ? `. Phiếu nhập đang hiệu lực của đơn: ${dangHieuLuc.map((k) => k.code).join(', ')}`
                : ''}
            .
          </NoticeBar>
        )}
        {!row && !reversedBy && !dao.duoc && doc.status === 'posted' && (
          <NoticeBar tone="warn" tag="Không đảo được" action={{ label: 'Đã hiểu' }}>
            {whyDao}
          </NoticeBar>
        )}
        {row && !daDao && thieu.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Thiếu thông tin"
            action={
              canEdit
                ? { label: 'Ghi ngay', onClick: () => setSua('thong-tin') }
                : undefined
            }
          >
            Chưa có <b>{thieu.join(' và ')}</b> — Kế toán đối chiếu công nợ bằng số phiếu
            giao của NCC.
          </NoticeBar>
        )}
        {kq.length > 0 && (
          <NoticeBar tone="neutral" tag="Đơn">
            {kq.map((k) => `${k.text}${k.viec ? ` — ${k.viec}` : ''}`).join(' · ')} (việc
            của Cung ứng{row?.owner_name ? `, ${row.owner_name}` : ''}).
          </NoticeBar>
        )}

        {nhap && (
          <div
            role="tablist"
            aria-label="Nội dung phiếu"
            className="flex shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)] px-3"
          >
            {(
              [
                ['hang', `Hàng nhập (${nhap.dong.length})`],
                ['lich-su', `Lịch sử (${nhap.lich_su.length})`],
              ] as const
            ).map(([id, ten]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`pn-${id}`}
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? 'text-k-body -mb-px border-b-2 border-[var(--act)] px-3.5 py-2 font-semibold text-[var(--act-text)]'
                    : 'text-k-body -mb-px border-b-2 border-transparent px-3.5 py-2 text-[var(--ink-2)] hover:text-[var(--act-text)]'
                }
              >
                {ten}
              </button>
            ))}
          </div>
        )}

        {nhap && tab === 'lich-su' ? (
          <div
            role="tabpanel"
            id="pn-lich-su"
            aria-labelledby="tab-lich-su"
            className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)] px-[var(--gutter)] py-3"
          >
            <Timeline marks={nhap.lich_su} />
            {nhap.khac.length > 0 && (
              <div className="text-k-sm mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
                <span className="text-k-label font-semibold text-[var(--ink-3)] uppercase">
                  Phiếu nhập khác của đơn
                </span>
                {nhap.khac.map((k) => (
                  <span key={k.doc_id} className="flex items-center gap-1.5">
                    <Code as="a" href={`/warehouse/phieu/${k.doc_id}`}>
                      {k.code}
                    </Code>
                    <span className="num text-[var(--ink-3)]">
                      {isoToVn(k.at.slice(0, 10))}
                    </span>
                    <Tag tone={k.con_hieu_luc ? 'done' : 'neutral'}>
                      {k.con_hieu_luc ? 'đang hiệu lực' : 'đã đảo'}
                    </Tag>
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

        <StatusBar
          left={[
            row
              ? 'Sửa thông tin không đổi tồn · sửa số lượng = đảo rồi lập lại · hàng đã dùng thì điều chỉnh chênh lệch'
              : 'Phiếu đã ghi không sửa, không xoá — sai thì lập phiếu đảo, cả hai tờ cùng nằm trong sổ',
          ]}
          right={`${nhap ? nhap.dong.length : lines.length} dòng`}
        />
      </ScreenFrame>

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
        <SuaPhieuSheet
          row={row}
          kieuBanDau={sua}
          lapLaiHref={`/warehouse/nhap/${row.po_id}?sua=${row.doc_id}`}
          onClose={() => setSua(null)}
        />
      )}
      {row && moKg && <KgCanSheet row={row} onClose={() => setMoKg(false)} />}
    </div>
  )
}
