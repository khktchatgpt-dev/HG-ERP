'use client'

import { useState } from 'react'
import { isoToVn } from '@/lib/date-vn'
import type { lichDot } from '@/lib/kho-dot-giao'
import { GHI_CHU_TOI_DA } from '@/lib/phieu-nhap-dau'
import { LUI_TOI_DA, LUI_TU_DO, type KetQuaNgay } from '@/lib/ngay-chung-tu-nhap'
import {
  Btn,
  Code,
  DateInput,
  FastTab,
  Field,
  FieldGrid,
  Hint,
  Sheet,
  Tag,
  TextInput,
} from '@/components/kit'
import type { NoiNhan } from './duong'

/** id ô Số phiếu giao NCC — thanh chốt và hộp nhắc nhảy tới đây. */
export const O_SO_NCC = 'so-phieu-ncc'
/** id ô Lý do nhập lùi ngày — thanh chốt nhảy tới đây. */
export const O_LY_DO_LUI = 'ly-do-lui-ngay'

const HINT_WARN = 'text-k-label mt-0.5 block font-semibold text-[var(--warn)]'
const HINT = 'mt-0.5 block'
const HINT_STOP = 'text-k-label mt-0.5 block font-semibold text-[var(--stop)]'

/**
 * ĐẦU PHIẾU NHẬP (tách khỏi PhieuNhapScreen 04/10/2026 — file chạm trần 800).
 *
 * Bản vẽ J1 (canvas "Cung ứng · Hàng về" › Bản 7): người giao điền sẵn tên NCC,
 * số phiếu NCC nói vì sao cần khi còn trống, thêm ô Ghi chú phiếu (in lên 01-VT).
 * State nằm ở màn — khối này chỉ vẽ và gọi setter.
 */
export function DauPhieu({
  po,
  dot,
  lich,
  dotLabel,
  phieuUrl,
  nguoiNhan,
  noi,
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
  laLapLai,
  lyDoLui,
  setLyDoLui,
}: {
  /** Kết quả luật lùi ngày (lib/ngay-chung-tu-nhap) — màn tính, khối chỉ vẽ. */
  ngay: KetQuaNgay
  /** Phiếu lập lại để sửa — giữ ngày phiếu cũ, không giới hạn lùi. */
  laLapLai: boolean
  lyDoLui: string
  setLyDoLui: (v: string) => void
  po: { id: string; code: string; supplier_name: string; lsx_codes: string[] }
  dot: { id: string } | null
  lich: ReturnType<typeof lichDot>
  dotLabel: string
  /** Đường tới form phiếu của đơn (`DUONG[noi].phieu`) — để đổi đợt. */
  phieuUrl: string
  nguoiNhan: string
  noi: NoiNhan
  busy: boolean
  docDate: string
  setDocDate: (v: string) => void
  supplierDocNo: string
  setSupplierDocNo: (v: string) => void
  counterparty: string
  setCounterparty: (v: string) => void
  ghiChu: string
  setGhiChu: (v: string) => void
}) {
  const laTenNcc = counterparty.trim() === po.supplier_name.trim()
  return (
    <FastTab title="Đầu phiếu" defaultOpen>
      <FieldGrid
        note={
          lich.length > 0 ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-[var(--ink-label)]">
                Lịch giao cả đơn
              </span>
              {lich.map((d) => {
                const text = `Đợt ${d.seq} · ${isoToVn(d.date).slice(0, 5)} · ${d.label}`
                const tone =
                  d.tone === 'done' || d.tone === 'stop' || d.tone === 'warn'
                    ? d.tone
                    : 'neutral'
                // Đợt còn nhận được mà không phải đợt đang mở → bấm là đổi đợt.
                return d.current || d.status === 'received' ? (
                  <span key={d.id} className={d.current ? 'font-semibold' : undefined}>
                    <Tag tone={tone}>{text}</Tag>
                  </span>
                ) : (
                  <Code key={d.id} as="a" href={`${phieuUrl}?dot=${d.id}`}>
                    {text}
                  </Code>
                )
              })}
              {/* HÀNG GẤP / NCC chở không theo đợt (27/09/2026): nhận theo
                  phần còn mở của CẢ ĐƠN, không gắn đợt — số tự rót vào các
                  đợt theo thứ tự hẹn (po-shipments.sync). */}
              {dot ? (
                <Code as="a" href={phieuUrl}>
                  Ngoài đợt (hàng gấp)
                </Code>
              ) : (
                <span className="font-semibold">
                  <Tag tone="neutral">Ngoài đợt — đang mở</Tag>
                </span>
              )}
            </span>
          ) : (
            'Đơn chưa khai đợt giao — nhận theo phần còn mở của cả đơn; Cung ứng khai đợt ở trang đơn mua.'
          )
        }
      >
        <Field label="Đơn mua">
          <Code as="a" href={`/mua-hang/don/${po.id}`}>
            {po.code}
          </Code>
        </Field>
        <Field label="Nhà cung cấp">{po.supplier_name}</Field>
        <Field label="Lệnh SX">
          {po.lsx_codes.length > 0 ? (
            <>
              <span className="num">{po.lsx_codes.join(' · ')}</span>
              {po.lsx_codes.length > 1 && (
                <span className={HINT}>
                  <Hint>đơn gom {po.lsx_codes.length} lệnh — phiếu in đủ</Hint>
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--ink-3)]">không theo lệnh</span>
          )}
        </Field>
        <Field label="Đợt giao">{dotLabel}</Field>
        <Field label="Ngày chứng từ">
          <DateInput
            value={docDate}
            onChange={setDocDate}
            label="Ngày chứng từ"
            disabled={busy || laLapLai}
          />
          {laLapLai ? (
            <span className={HINT}>
              <Hint>giữ ngày của phiếu cũ — phiếu lập lại không đổi ngày</Hint>
            </span>
          ) : ngay.muc === 'chan' ? (
            <span className={HINT_STOP}>{ngay.message}</span>
          ) : ngay.lui > LUI_TU_DO ? (
            <>
              <span className={HINT_WARN}>
                Lùi {ngay.lui} ngày — ghi lý do (in lên phiếu). Tối đa {LUI_TOI_DA} ngày.
              </span>
              <TextInput
                id={O_LY_DO_LUI}
                value={lyDoLui}
                onCommit={setLyDoLui}
                disabled={busy}
                maxLength={300}
                placeholder="vd: nhập bù hàng về trước khi dùng hệ thống"
                label="Lý do nhập lùi ngày"
                className={
                  lyDoLui.trim()
                    ? 'mt-1'
                    : 'mt-1 border-[var(--warn-line)] bg-[var(--warn-wash)]'
                }
              />
            </>
          ) : null}
        </Field>
        <Field label="Số phiếu giao NCC">
          <TextInput
            id={O_SO_NCC}
            value={supplierDocNo}
            onCommit={setSupplierDocNo}
            disabled={busy}
            placeholder="số trên phiếu giao / hoá đơn"
            mono
            label="Số phiếu giao NCC"
            className={
              supplierDocNo.trim()
                ? undefined
                : 'border-[var(--warn-line)] bg-[var(--warn-wash)]'
            }
          />
          {!supplierDocNo.trim() && (
            <span className={HINT_WARN}>
              Chưa ghi — Kế toán đối chiếu công nợ bằng số này. Không bắt buộc.
            </span>
          )}
        </Field>
        <Field label="Người giao">
          <TextInput
            value={counterparty}
            onCommit={setCounterparty}
            disabled={busy}
            placeholder="tên tài xế / NV giao"
            label="Người giao"
          />
          {laTenNcc && (
            <span className={HINT}>
              <Hint>điền sẵn tên NCC — sửa thành tên tài xế / NV giao nếu biết</Hint>
            </span>
          )}
        </Field>
        <Field label="Người nhận">
          <span className="text-[var(--ink-3)]">
            {nguoiNhan} · theo phiên đăng nhập
            {noi === 'cung-ung' ? ' · Cung ứng nhận thay Kho' : ''}
          </span>
        </Field>
        <Field label="Ghi chú phiếu">
          <TextInput
            value={ghiChu}
            onCommit={(v) => setGhiChu(v.slice(0, GHI_CHU_TOI_DA))}
            disabled={busy}
            maxLength={GHI_CHU_TOI_DA}
            placeholder="vd: hàng về 2 xe · thùng 3 móp, đã chụp ảnh"
            label="Ghi chú phiếu"
          />
          <span className={HINT}>
            <Hint>
              in lên phiếu 01-VT · ghi chú từng dòng hàng ở cột Ghi chú của lưới
            </Hint>
          </span>
        </Field>
      </FieldGrid>
    </FastTab>
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
