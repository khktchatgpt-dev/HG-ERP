import type { DeNghiChiTiet } from '@/modules/dept/warehouse/de-nghi.service'
import type { PhieuForm } from './de-nghi.shared'

/** Phiếu từ service → dạng form của màn (một chỗ đổi, hai trang dùng). */
export function phieuForm(p: DeNghiChiTiet): PhieuForm {
  return {
    id: p.id,
    code: p.code,
    status: p.status,
    department: p.department,
    need_by: p.need_by ?? '',
    note: p.note ?? '',
    production_order_id: p.production_order_id,
    shipping_fee: p.shipping_fee,
    approve_note: p.approve_note,
    nguoi_de_nghi: p.requested_by_name ?? '—',
    created_at: p.created_at,
    submitted_at: p.submitted_at,
    approved_at: p.approved_at,
    approved_by_name: p.approved_by_name,
    rejected_at: p.rejected_at,
    rejected_by_name: p.rejected_by_name,
    rejected_reason: p.rejected_reason,
    cancelled_at: p.cancelled_at,
    cancel_reason: p.cancel_reason,
    closed_at: p.closed_at,
    closed_reason: p.closed_reason,
    closed_by_name: p.closed_by_name,
    lines: p.lines.map((l) => ({
      key: l.id,
      material_id: l.material_id,
      code: l.code,
      name: l.name,
      unit: l.unit,
      ton: l.ton,
      qty: l.qty,
      approved_qty: l.approved_qty,
      unit_price: l.unit_price,
      vat_rate: l.vat_rate,
      purpose: l.purpose ?? '',
      note: l.note ?? '',
      gia_goi_y: l.gia_gan_nhat,
      theo_doi: l.theo_doi,
      trung: l.trung,
      dang_ve: l.dang_ve,
      can: l.can,
      da_nhap: l.da_nhap,
      phieu_nhap: l.phieu_nhap,
    })),
  }
}

/** Phiếu trống cho màn "Lập đề nghị". */
export function phieuMoi(nguoi: string): PhieuForm {
  return {
    id: null,
    code: null,
    status: 'draft',
    department: 'Kho vật tư',
    need_by: '',
    note: '',
    production_order_id: null,
    shipping_fee: 0,
    nguoi_de_nghi: nguoi,
    created_at: null,
    submitted_at: null,
    rejected_at: null,
    rejected_by_name: null,
    rejected_reason: null,
    cancelled_at: null,
    cancel_reason: null,
    lines: [],
  }
}

/**
 * LẬP LẠI TỪ PHIẾU CŨ (Đ8, Q22): bản nháp MỚI (chưa lưu) chép dòng của phiếu cũ —
 * hàng tiêu hao mua lặp hằng tháng, khỏi gõ lại 9 dòng.
 *
 *   · Số lượng = số ĐÃ DUYỆT lần trước (lãnh đạo sửa 200 → 150 thì lấy 150).
 *     Dòng duyệt 0 (lãnh đạo bảo không mua) thì bỏ.
 *   · Đơn giá = giá lần mua gần nhất (đơn Cung ứng hoặc Kho tự mua) nếu có, không
 *     thì giữ giá dự kiến cũ. VAT, mục đích, phí vận chuyển chép nguyên.
 *   · Không chép: cần trước ngày, lệnh SX, ghi chú dòng — đó là chuyện của lần cũ.
 *
 * Không ghi gì vào DB: bấm Lưu nháp / Gửi mới tạo phiếu, bỏ ngang thì không sinh
 * phiếu rác. Tồn, giá, trùng đã được service tính lại cho HÔM NAY.
 */
export function phieuLapLai(nguoi: string, src: DeNghiChiTiet): PhieuForm {
  // Phiếu cũ còn mở (chờ duyệt / đang mua) thì chính nó là một phiếu trùng của
  // bản mới — service đã loại nó khỏi danh sách trùng (lúc đó nó là phiếu đang xem).
  const conMo =
    src.status === 'pending' || src.status === 'approved' || src.status === 'ordering'
  return {
    ...phieuMoi(nguoi),
    department: src.department,
    note: src.note ?? '',
    shipping_fee: src.shipping_fee,
    lines: src.lines
      .filter((l) => (l.approved_qty ?? l.qty) > 0)
      .map((l, i) => ({
        key: `lai-${i}-${l.id}`,
        material_id: l.material_id,
        code: l.code,
        name: l.name,
        unit: l.unit,
        ton: l.ton,
        qty: l.approved_qty ?? l.qty,
        unit_price: l.gia_gan_nhat?.unit_price ?? l.unit_price,
        vat_rate: l.vat_rate,
        purpose: l.purpose ?? '',
        note: '',
        gia_goi_y: l.gia_gan_nhat,
        theo_doi: l.theo_doi,
        trung: conMo
          ? [
              { code: src.code, status: src.status, qty: l.approved_qty ?? l.qty },
              ...l.trung,
            ]
          : l.trung,
        dang_ve: l.dang_ve,
      })),
  }
}
