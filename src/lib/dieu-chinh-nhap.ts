/**
 * ĐIỀU CHỈNH CHÊNH LỆCH PHIẾU NHẬP (C, 02/10/2026 — chủ dự án duyệt đề xuất A·B·C).
 *
 * Bài toán: phiếu nhập đã ghi sổ bị gõ sai số, nhưng hàng ĐÃ XUẤT cho sản xuất nên
 * không đảo nguyên phiếu được (đảo = xuất ngược TOÀN BỘ, tồn không đủ). Cách của
 * SAP (MIGO 101/102 một phần) và Odoo (điều chỉnh tồn có nguồn): chỉ ghi ĐÚNG
 * PHẦN LỆCH của từng dòng — ghi thừa thì xuất điều chỉnh, ghi thiếu thì nhập bổ
 * sung — nối về phiếu gốc. Phiếu gốc giữ nguyên làm vết.
 *
 * Gom theo DÒNG ĐƠN (`po_line_id`), không theo dòng sổ: một dòng đơn có thể nằm ở
 * hai dòng sổ (phần dùng được + phần khoá) nhưng "đã nhận" của đơn tính theo dòng
 * đơn, và người sửa nghĩ theo dòng đơn ("thép hộp 40x40 nhận 1.030 chứ không phải
 * 1.300").
 *
 * Logic thuần — service lo đọc sổ, kiểm tồn, ghi phiếu.
 */

/** Một dòng sổ NHẬP của phiếu gốc. */
export type DongGoc = {
  po_line_id: string
  material_id: string
  qty: number
  unit_cost: number | null
  reason_code: string | null
}

/** Một dòng sổ của các phiếu điều chỉnh TRƯỚC (và phiếu đảo của chúng, nếu có). */
export type DongDaChinh = { po_line_id: string; direction: 'in' | 'out'; qty: number }

export type DongChenh = {
  po_line_id: string
  material_id: string
  /** Số đang ghi trên sổ cho dòng này của phiếu (gốc + các lần điều chỉnh trước). */
  hien: number
  /** Số đúng người dùng khai. */
  moi: number
  /** moi − hien: dương = nhập bổ sung, âm = xuất điều chỉnh. */
  chenh: number
  unit_cost: number | null
  reason_code: string | null
}

const EPS = 1e-9
const tron = (n: number) => Math.round(n * 1e6) / 1e6

/** Số đang ghi cho từng dòng đơn của phiếu: gốc + điều chỉnh trước (có dấu). */
export function soHienTai(
  goc: DongGoc[],
  daChinh: DongDaChinh[],
): Map<string, Omit<DongChenh, 'moi' | 'chenh'>> {
  const out = new Map<string, Omit<DongChenh, 'moi' | 'chenh'>>()
  for (const g of goc) {
    const cur = out.get(g.po_line_id)
    out.set(g.po_line_id, {
      po_line_id: g.po_line_id,
      material_id: cur?.material_id ?? g.material_id,
      hien: tron((cur?.hien ?? 0) + g.qty),
      unit_cost: cur?.unit_cost ?? g.unit_cost,
      reason_code: cur?.reason_code ?? g.reason_code,
    })
  }
  for (const d of daChinh) {
    const cur = out.get(d.po_line_id)
    if (!cur) continue // dòng sổ không thuộc phiếu gốc — bỏ, không bịa dòng mới
    cur.hien = tron(cur.hien + (d.direction === 'in' ? d.qty : -d.qty))
  }
  return out
}

/**
 * Chênh lệch từng dòng giữa số đang ghi và số đúng. Chỉ trả dòng CÓ đổi; dòng
 * người dùng không khai thì giữ nguyên. `loi` rỗng = ghi được.
 */
export function tinhChenhLech(
  goc: DongGoc[],
  daChinh: DongDaChinh[],
  moi: { po_line_id: string; qty: number }[],
): { dong: DongChenh[]; loi: string[] } {
  const hien = soHienTai(goc, daChinh)
  const loi: string[] = []
  const dong: DongChenh[] = []
  const daGap = new Set<string>()
  for (const m of moi) {
    const h = hien.get(m.po_line_id)
    if (!h) {
      loi.push('Có dòng không thuộc phiếu này')
      continue
    }
    if (daGap.has(m.po_line_id)) {
      loi.push('Một dòng đơn khai hai lần')
      continue
    }
    daGap.add(m.po_line_id)
    if (!Number.isFinite(m.qty) || m.qty < 0) {
      loi.push('Số đúng phải là số không âm')
      continue
    }
    const chenh = tron(m.qty - h.hien)
    if (Math.abs(chenh) <= EPS) continue
    dong.push({ ...h, moi: tron(m.qty), chenh })
  }
  if (loi.length === 0 && dong.length === 0) loi.push('Chưa đổi số dòng nào')
  return { dong, loi }
}
