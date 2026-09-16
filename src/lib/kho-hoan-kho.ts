/**
 * HOÀN KHO TỪ SẢN XUẤT — logic thuần của form `/warehouse/nhap/hoan-kho`
 * (hoàn thiện B1, `docs/kho-hoan-thien.md`). Tổ lĩnh 100 dùng 95 trả 5.
 *
 * KHÁC HẲN hai màn nhập kia ở một điểm quyết định cả bố cục: TẬP VẬT TƯ LÀ
 * ĐÓNG. Chỉ trả được thứ lệnh đã lĩnh, tối đa bằng phần đã lĩnh CHƯA HOÀN
 * (`issuedByLsx` tính NET). Nên không có ô tìm mã — lưới điền sẵn từ chính
 * thứ lệnh đang giữ, thủ kho chỉ gõ số trả.
 *
 * Server vẫn là người quyết: `createReceiptDoc` guard trạng thái lệnh, chặn
 * `po_line_id`, chặn `qty_rejected`, và kiểm lại trần từng mã.
 */

/** Một mã lệnh đang giữ — đúng hình `stockService.lsxIssuedForReturn` trả. */
export type DongDaLinh = {
  material_id: string
  code: string
  name: string
  unit: string
  /** Phần đã cấp CÒN LẠI (đã trừ các lần hoàn trước). Đây là trần của dòng. */
  issued: number
}

export type DongHoan = DongDaLinh & {
  qty: number
  note: string
}

export function dungLuoiHoan(rows: readonly DongDaLinh[]): DongHoan[] {
  return rows.map((r) => ({ ...r, qty: 0, note: '' }))
}

/**
 * Hoàn quá phần đã lĩnh — trả phần vượt, null khi trong ngưỡng.
 *
 * Chặn ở màn VÀ ở service: trả thứ chưa từng lĩnh là nhập nhầm nguồn, và nó
 * đi thẳng vào giá thành lệnh nên không thể để lọt rồi sửa sau.
 */
export function vuotDaLinh(r: Pick<DongHoan, 'qty' | 'issued'>): number | null {
  return r.qty - r.issued > 1e-6 ? r.qty - r.issued : null
}

export function tinhTongHoan(rows: readonly DongHoan[]): {
  so_dong: number
  tong: number
  tong_da_linh: number
} {
  let so_dong = 0
  let tong = 0
  let tong_da_linh = 0
  for (const r of rows) {
    tong_da_linh += r.issued
    if (r.qty > 0) {
      so_dong++
      tong += r.qty
    }
  }
  return { so_dong, tong, tong_da_linh }
}

export type DauPhieuHoan = {
  lsx_id: string
  /** Tổ trả hàng — vào ô "người giao" của mẫu 01-VT. */
  to: string
  doc_date: string
  note: string
}

export type KiemHoan =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'thieu_lenh'
        | 'thieu_to'
        | 'chua_linh_gi'
        | 'khong_dong'
        | 'so_khong_hop_le'
        | 'vuot_da_linh'
      message: string
      focus: 'lenh' | 'to' | number
    }

/**
 * Vì sao CHƯA ghi sổ được — theo thứ tự đọc của đầu phiếu rồi tới lưới.
 *
 * `chua_linh_gi` tách riêng khỏi `khong_dong` vì hai tình huống này đòi hai
 * việc khác hẳn nhau: lưới rỗng nghĩa là lệnh chưa lĩnh gì (phải đi lập phiếu
 * XUẤT trước), còn lưới có dòng mà chưa dòng nào có số chỉ là chưa gõ.
 */
export function kiemTruocGhiSoHoan(
  head: DauPhieuHoan,
  rows: readonly DongHoan[],
): KiemHoan {
  if (!head.lsx_id) {
    return {
      ok: false,
      reason: 'thieu_lenh',
      message: 'Chưa chọn lệnh sản xuất',
      focus: 'lenh',
    }
  }
  if (rows.length === 0) {
    return {
      ok: false,
      reason: 'chua_linh_gi',
      message: 'Lệnh này chưa lĩnh vật tư nào — không có gì để hoàn',
      focus: 'lenh',
    }
  }
  if (!head.to.trim()) {
    return { ok: false, reason: 'thieu_to', message: 'Chưa chọn tổ trả', focus: 'to' }
  }
  const iSai = rows.findIndex((r) => !Number.isFinite(r.qty) || r.qty < 0)
  if (iSai >= 0) {
    return {
      ok: false,
      reason: 'so_khong_hop_le',
      message: `Dòng ${iSai + 1} ${rows[iSai].code}: số Hoàn không hợp lệ`,
      focus: iSai,
    }
  }
  const iVuot = rows.findIndex((r) => vuotDaLinh(r) != null)
  if (iVuot >= 0) {
    const r = rows[iVuot]
    return {
      ok: false,
      reason: 'vuot_da_linh',
      message: `${r.code} hoàn ${r.qty} nhưng lệnh chỉ còn ghi đã cấp ${r.issued} — sửa số hoặc để 0`,
      focus: iVuot,
    }
  }
  if (!rows.some((r) => r.qty > 0)) {
    return {
      ok: false,
      reason: 'khong_dong',
      message: 'Chưa dòng nào có số Hoàn',
      focus: 0,
    }
  }
  return { ok: true }
}
