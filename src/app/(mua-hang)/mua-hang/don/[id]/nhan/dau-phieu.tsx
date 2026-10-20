'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import type { lichDot } from '@/lib/kho-dot-giao'
import { GHI_CHU_TOI_DA } from '@/lib/phieu-nhap-dau'
import { LUI_TOI_DA, LUI_TU_DO, type KetQuaNgay } from '@/lib/ngay-chung-tu-nhap'
import { tenNccGon } from '@/lib/theo-doi-loc'
import {
  Btn,
  DateInput,
  HeadChip,
  HeadChips,
  HeadField,
  Menu,
  Sheet,
  TextInput,
} from '@/components/kit'

/** id ô Số phiếu giao NCC — thanh chốt và hộp nhắc nhảy tới đây. */
export const O_SO_NCC = 'so-phieu-ncc'
/** id ô Lý do nhập lùi ngày — thanh chốt nhảy tới đây. */
export const O_LY_DO_LUI = 'ly-do-lui-ngay'

/** Ô trống "nên ghi" (không bắt buộc) — nền vàng nhạt, khác viền đỏ của ô bắt buộc. */
const NEN_VANG = 'border-[var(--warn-line)] bg-[var(--warn-wash)]'

/**
 * ĐẦU PHIẾU NHẬP — MỘT DẢI CHIP (05/10/2026, bản vẽ K1/K2 canvas "Cung ứng ·
 * Hàng về" › Bản 8, chủ dự án duyệt).
 *
 * Đo trước khi đổi, form PO-2026-0100 ở 1536×730: khối Đầu phiếu dạng lưới
 * nhãn–giá trị 3 cột cao 267px, cả phần ngoài lưới 543/730px (74%) — lưới
 * nhập còn 187px, thấy 4 dòng. Đây là màn GÕ (Khuôn F), không phải màn ĐỌC:
 * mỗi hàng đầu trang là một hàng lưới bị lấy mất. Nên:
 *  · giá trị kế thừa (NCC, lệnh, đợt) = `HeadChip`, rê chuột ra đủ chữ;
 *  · thứ gõ tại chỗ (ngày, số phiếu NCC, người giao, ghi chú) = `HeadField`;
 *  · câu giải thích dài thành tooltip; "Lịch giao cả đơn" thành menu của chip
 *    Đợt; ô lý do lùi ngày chỉ mọc ra khi lùi quá 7 ngày.
 * State nằm ở màn — khối này chỉ vẽ và gọi setter.
 */
export function DauPhieu({
  po,
  dot,
  lich,
  dotLabel,
  dotNgan,
  phieuUrl,
  busy,
  docDate,
  setDocDate,
  supplierDocNo,
  setSupplierDocNo,
  counterparty,
  setCounterparty,
  ghiChu,
  setGhiChu,
  ngay,
  giuNgayCu,
  lyDoLui,
  setLyDoLui,
}: {
  po: { id: string; code: string; supplier_name: string; lsx_codes: string[] }
  dot: { id: string } | null
  lich: ReturnType<typeof lichDot>
  /** Câu đợt đầy đủ — tooltip của chip Đợt. */
  dotLabel: string
  /** Câu đợt NGẮN cho chip ("đợt 1/2 · hẹn 01/10", "hẹn 05/10") — dải chip phải vừa một hàng ở 1536. */
  dotNgan: string
  /** Đường tới form phiếu của đơn (`DUONG[noi].phieu`) — để đổi đợt. */
  phieuUrl: string
  busy: boolean
  docDate: string
  setDocDate: (v: string) => void
  supplierDocNo: string
  setSupplierDocNo: (v: string) => void
  counterparty: string
  setCounterparty: (v: string) => void
  ghiChu: string
  setGhiChu: (v: string) => void
  /** Kết quả luật lùi ngày (lib/ngay-chung-tu-nhap) — màn tính, khối chỉ vẽ. */
  ngay: KetQuaNgay
  /** Phiếu lập lại đang GIỮ ngày phiếu cũ — miễn giới hạn lùi. Đổi ngày thì luật thường. */
  giuNgayCu: boolean
  lyDoLui: string
  setLyDoLui: (v: string) => void
}) {
  const router = useRouter()
  const lenh = po.lsx_codes
  const luiXa = !giuNgayCu && ngay.muc !== 'chan' && ngay.lui > LUI_TU_DO
  const chuaSo = !supplierDocNo.trim()

  return (
    <HeadChips>
      <HeadChip
        label="NCC"
        value={
          <span
            title={po.supplier_name}
            className="inline-block max-w-[150px] truncate align-bottom"
          >
            {tenNccGon(po.supplier_name)}
          </span>
        }
      />
      <HeadChip
        label="Lệnh"
        value={
          lenh.length > 0 ? (
            <span
              className="num"
              title={
                lenh.length > 1
                  ? `Đơn gom ${lenh.length} lệnh — phiếu in đủ: ${lenh.join(' · ')}`
                  : undefined
              }
            >
              {lenh[0]}
              {lenh.length > 1 && <b> +{lenh.length - 1}</b>}
            </span>
          ) : (
            'không theo lệnh'
          )
        }
        muted={lenh.length === 0}
      />
      {lich.length > 0 ? (
        // Đơn chia đợt: "Lịch giao cả đơn" thành menu của chip — không chiếm một hàng riêng.
        <Menu
          label={`Đợt: ${dotNgan} ▾`}
          ariaLabel="Lịch giao cả đơn — đổi đợt nhận"
          items={[
            ...lich.map((d) => ({
              label: `Đợt ${d.seq} · ${isoToVn(d.date).slice(0, 5)} · ${d.label}${d.current ? ' · đang nhận' : ''}`,
              onClick: () => router.push(`${phieuUrl}?dot=${d.id}`),
              disabled: d.current || d.status === 'received',
              group: 'Lịch giao cả đơn',
            })),
            {
              label: `Ngoài đợt (hàng gấp)${dot ? '' : ' · đang nhận'}`,
              onClick: () => router.push(phieuUrl),
              disabled: !dot,
              group: 'Không theo lịch',
            },
          ]}
        />
      ) : (
        <HeadChip label="Đợt" value={<span title={dotLabel}>{dotNgan}</span>} muted />
      )}

      <HeadField
        label={giuNgayCu ? 'Ngày CT · giữ ngày cũ' : 'Ngày CT'}
        need={ngay.muc === 'chan'}
        empty={ngay.muc === 'chan'}
        width={128}
      >
        <DateInput
          value={docDate}
          onChange={setDocDate}
          label="Ngày chứng từ"
          disabled={busy}
        />
      </HeadField>
      {luiXa && (
        <HeadField
          label={`Lý do lùi ${ngay.lui} ngày`}
          need
          empty={!lyDoLui.trim()}
          width={280}
        >
          <TextInput
            id={O_LY_DO_LUI}
            value={lyDoLui}
            onCommit={setLyDoLui}
            disabled={busy}
            maxLength={300}
            placeholder="vd: nhập bù hàng về trước khi dùng hệ thống"
            label="Lý do nhập lùi ngày"
            title={`Lùi ${ngay.lui} ngày — tối đa ${LUI_TOI_DA} ngày; lý do in lên phiếu 01-VT`}
          />
        </HeadField>
      )}
      <HeadField label="Số phiếu NCC" width={110}>
        <TextInput
          id={O_SO_NCC}
          value={supplierDocNo}
          onCommit={setSupplierDocNo}
          disabled={busy}
          placeholder="chưa ghi"
          mono
          label="Số phiếu giao NCC"
          title="Số trên phiếu giao / hoá đơn của NCC — Kế toán đối chiếu công nợ bằng số này. Không bắt buộc, Ghi sổ sẽ nhắc một lần."
          className={chuaSo ? NEN_VANG : undefined}
        />
      </HeadField>
      <HeadField label="Người giao" width={120}>
        <TextInput
          value={counterparty}
          onCommit={setCounterparty}
          disabled={busy}
          placeholder="tên tài xế / NV giao"
          label="Người giao"
          title="Điền sẵn tên NCC — sửa thành tên tài xế / NV giao nếu biết"
        />
      </HeadField>
      <HeadField label="Ghi chú" width={170}>
        <TextInput
          value={ghiChu}
          onCommit={(v) => setGhiChu(v.slice(0, GHI_CHU_TOI_DA))}
          disabled={busy}
          maxLength={GHI_CHU_TOI_DA}
          placeholder="in lên phiếu 01-VT"
          label="Ghi chú phiếu"
          title="In lên phiếu 01-VT. Ghi chú từng dòng hàng ở cột Ghi chú của lưới."
        />
      </HeadField>
    </HeadChips>
  )
}

/**
 * NHẮC SỐ PHIẾU NCC khi bấm Ghi sổ mà ô còn trống (bản vẽ J1b) — nhắc, KHÔNG
 * chặn: có ô nhập ngay trong hộp, hoặc ghi sổ không có số (bổ sung sau ở Đã
 * về › Sửa thông tin). Esc / ✕ = quay lại phiếu, chưa ghi gì.
 */
export function NhacSoNccSheet({
  poCode,
  supplierName,
  onClose,
  onGhiSo,
}: {
  poCode: string
  supplierName: string
  onClose: () => void
  /** Gọi với số vừa gõ ('' = ghi sổ không có số). */
  onGhiSo: (soNcc: string) => void
}) {
  const [so, setSo] = useState('')
  const coSo = so.trim() !== ''
  return (
    <Sheet
      open
      onClose={onClose}
      stakes="nhe"
      title="Ghi sổ khi chưa có số phiếu giao NCC?"
      subtitle={`Phiếu nhập cho ${poCode} · ${supplierName}`}
      footer={
        <>
          <Btn onClick={() => onGhiSo('')}>Ghi sổ không có số</Btn>
          <Btn
            primary
            disabled={!coSo}
            title={coSo ? undefined : 'Gõ số phiếu giao NCC trước'}
            onClick={() => onGhiSo(so.trim())}
          >
            Lưu số và ghi sổ
          </Btn>
        </>
      }
    >
      <p className="text-k-body mb-3 text-[var(--ink-2)]">
        Kế toán đối chiếu hoá đơn / công nợ bằng số này — chép số in trên phiếu giao của
        NCC nếu đang có trong tay.
      </p>
      <label className="text-k-sm flex flex-col gap-1">
        <span className="text-[var(--ink-3)]">Số phiếu giao NCC</span>
        <input
          // Hộp mở ra chỉ để gõ đúng ô này.
          autoFocus
          value={so}
          maxLength={60}
          onChange={(e) => setSo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && coSo) {
              e.preventDefault()
              onGhiSo(so.trim())
            }
          }}
          placeholder="vd 5/2026- HG/TTL"
          className="text-k-sm h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 font-[family-name:var(--font-mono)] placeholder:text-[var(--ink-3)] focus:border-[var(--act)]"
        />
      </label>
      <p className="text-k-sm mt-2 text-[var(--ink-3)]">
        Bổ sung sau vẫn được: Theo dõi đơn hàng › Đã về › Sửa phiếu › Sửa thông tin (không
        đổi tồn).
      </p>
    </Sheet>
  )
}
