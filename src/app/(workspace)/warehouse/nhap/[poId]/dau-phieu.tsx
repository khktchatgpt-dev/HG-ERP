'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import type { lichDot } from '@/lib/kho-dot-giao'
import { GHI_CHU_TOI_DA } from '@/lib/phieu-nhap-dau'
import { LUI_TOI_DA, LUI_TU_DO, type KetQuaNgay } from '@/lib/ngay-chung-tu-nhap'
import { tenNccGon } from '@/lib/theo-doi-loc'
import { HopThoai, OChu, ONgay } from '../../_erp/o-nhap'

/** id ô Số phiếu giao NCC — thanh chốt và hộp nhắc nhảy tới đây. */
export const O_SO_NCC = 'so-phieu-ncc'
/** id ô Lý do nhập lùi ngày — thanh chốt nhảy tới đây. */
export const O_LY_DO_LUI = 'ly-do-lui-ngay'

/**
 * ĐẦU PHIẾU NHẬP — MỘT DẢI Ô NHÃN–GIÁ TRỊ (Kho lối ERP · B2, bản vẽ K-3; khung
 * gốc K1/K2 05/10/2026). Màn GÕ (khuôn F): mỗi hàng đầu trang là một hàng lưới
 * bị lấy mất, nên giá trị kế thừa (NCC, lệnh, đợt) đứng thành ô chữ đậm, thứ gõ
 * tại chỗ (ngày, số phiếu NCC, người giao, ghi chú) là ô nhập ngay trong dải;
 * ô lý do lùi ngày chỉ mọc ra khi lùi quá 7 ngày. Đơn chia đợt: ô Đợt là hộp
 * chọn — đổi đợt là mở lại phiếu của đợt đó. State nằm ở màn.
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
  /** Câu đợt đầy đủ — tooltip của ô Đợt. */
  dotLabel: string
  /** Câu đợt NGẮN ("đợt 1/2 · hẹn 01/10", "hẹn 05/10"). */
  dotNgan: string
  /** Đường tới form phiếu của đơn — để đổi đợt. */
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
  /** Phiếu lập lại đang GIỮ ngày phiếu cũ — miễn giới hạn lùi. */
  giuNgayCu: boolean
  lyDoLui: string
  setLyDoLui: (v: string) => void
}) {
  const router = useRouter()
  const lenh = po.lsx_codes
  const luiXa = !giuNgayCu && ngay.muc !== 'chan' && ngay.lui > LUI_TU_DO
  const chuaSo = !supplierDocNo.trim()
  const dangDot = lich.find((d) => d.current)?.id ?? ''

  return (
    <div className="kh-hc" role="group" aria-label="Đầu phiếu nhập">
      <div style={{ maxWidth: 220 }}>
        <span className="k">Nhà cung cấp</span>
        <span className="v" title={po.supplier_name}>
          {tenNccGon(po.supplier_name)}
        </span>
      </div>
      <div style={{ maxWidth: 200 }}>
        <span className="k">Lệnh SX</span>
        {lenh.length > 0 ? (
          <span
            className="v kh-num"
            title={lenh.length > 1 ? `Đơn gom ${lenh.length} lệnh — phiếu in đủ: ${lenh.join(' · ')}` : undefined} // prettier-ignore
          >
            {lenh[0]}
            {lenh.length > 1 && <b> +{lenh.length - 1}</b>}
          </span>
        ) : (
          <span className="v mut">không theo lệnh</span>
        )}
      </div>
      <div>
        <span className="k">Đợt</span>
        {lich.length > 0 ? (
          <select
            className="kh-o"
            value={dot ? dangDot : ''}
            disabled={busy}
            aria-label="Lịch giao cả đơn — đổi đợt nhận"
            title={dotLabel}
            onChange={(e) =>
              router.push(e.target.value ? `${phieuUrl}?dot=${e.target.value}` : phieuUrl)
            }
            style={{ width: 210 }}
          >
            {lich.map((d) => (
              <option
                key={d.id}
                value={d.id}
                disabled={!d.current && d.status === 'received'}
              >
                Đợt {d.seq} · {isoToVn(d.date).slice(0, 5)} · {d.label}
              </option>
            ))}
            <option value="">Ngoài đợt (hàng gấp)</option>
          </select>
        ) : (
          <span className="v mut" title={dotLabel}>
            {dotNgan}
          </span>
        )}
      </div>
      <div style={{ width: 128 }}>
        <span className={ngay.muc === 'chan' ? 'k need' : 'k'}>
          {giuNgayCu ? 'Ngày CT · giữ ngày cũ' : 'Ngày CT'}
        </span>
        <ONgay
          value={docDate}
          onChange={setDocDate}
          label="Ngày chứng từ"
          disabled={busy}
          tone={ngay.muc === 'chan' ? 'need' : undefined}
        />
      </div>
      {luiXa && (
        <div style={{ width: 280 }}>
          <span className="k need">{`Lý do lùi ${ngay.lui} ngày`}</span>
          <OChu
            id={O_LY_DO_LUI}
            value={lyDoLui}
            onCommit={setLyDoLui}
            disabled={busy}
            maxLength={300}
            placeholder="vd: nhập bù hàng về trước khi dùng hệ thống"
            label="Lý do nhập lùi ngày"
            title={`Lùi ${ngay.lui} ngày — tối đa ${LUI_TOI_DA} ngày; lý do in lên phiếu 01-VT`}
            tone={lyDoLui.trim() ? undefined : 'need'}
          />
        </div>
      )}
      <div style={{ width: 130 }}>
        <span className="k">Số phiếu NCC</span>
        <OChu
          id={O_SO_NCC}
          value={supplierDocNo}
          onCommit={setSupplierDocNo}
          disabled={busy}
          placeholder="chưa ghi"
          mono
          label="Số phiếu giao NCC"
          title="Số trên phiếu giao / hoá đơn của NCC — Kế toán đối chiếu công nợ bằng số này. Không bắt buộc, Ghi sổ sẽ nhắc một lần."
          tone={chuaSo ? 'nen' : undefined}
        />
      </div>
      <div style={{ width: 150 }}>
        <span className="k">Người giao</span>
        <OChu
          value={counterparty}
          onCommit={setCounterparty}
          disabled={busy}
          placeholder="tên tài xế / NV giao"
          label="Người giao"
          title="Điền sẵn tên NCC — sửa thành tên tài xế / NV giao nếu biết"
        />
      </div>
      <div style={{ flex: '1 1 180px' }}>
        <span className="k">Ghi chú</span>
        <OChu
          value={ghiChu}
          onCommit={(v) => setGhiChu(v.slice(0, GHI_CHU_TOI_DA))}
          disabled={busy}
          maxLength={GHI_CHU_TOI_DA}
          placeholder="in lên phiếu 01-VT"
          label="Ghi chú phiếu"
          title="In lên phiếu 01-VT. Ghi chú từng dòng hàng ở cột Ghi chú của lưới."
        />
      </div>
      {ngay.muc === 'chan' && (
        <div style={{ flexBasis: '100%', borderTop: '1px solid var(--kh-hair)' }}>
          <span className="loi">{ngay.message}</span>
        </div>
      )}
    </div>
  )
}

/**
 * NHẮC SỐ PHIẾU NCC khi bấm Ghi sổ mà ô còn trống (bản vẽ J1b) — nhắc, KHÔNG
 * chặn: có ô nhập ngay trong hộp, hoặc ghi sổ không có số (bổ sung sau ở Sổ
 * phiếu). Esc / ✕ = quay lại phiếu, chưa ghi gì.
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
    <HopThoai
      title="Ghi sổ khi chưa có số phiếu giao NCC?"
      subtitle={`Phiếu nhập cho ${poCode} · ${supplierName}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="kh-btn" onClick={() => onGhiSo('')}>
            Ghi sổ không có số
          </button>
          <button
            type="button"
            className="kh-btn p"
            disabled={!coSo}
            title={coSo ? undefined : 'Gõ số phiếu giao NCC trước'}
            onClick={() => onGhiSo(so.trim())}
          >
            Lưu số và ghi sổ
          </button>
        </>
      }
    >
      <p>
        Kế toán đối chiếu hoá đơn / công nợ bằng số này — chép số in trên phiếu giao của
        NCC nếu đang có trong tay.
      </p>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="kh-mut" style={{ fontSize: 12 }}>
          Số phiếu giao NCC
        </span>
        <input
          className="kh-o mono"
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
        />
      </label>
      <p className="kh-mut" style={{ fontSize: 12 }}>
        Bổ sung sau vẫn được: Phiếu đã ghi › mở phiếu › ghi số phiếu NCC (không đổi tồn).
      </p>
    </HopThoai>
  )
}
