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
      purpose: l.purpose ?? '',
      note: l.note ?? '',
      gia_goi_y: l.gia_gan_nhat,
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
