/**
 * PHIẾU NHẬP THEO ĐƠN — logic thuần của form `/warehouse/nhap/[poId]`
 * (Bước 1 Kho, việc 3). Không chạm DB; server vẫn là người quyết
 * (`stockService.createReceiptDoc` + `lib/po-receipt`). Ở đây chỉ là những
 * gì màn cần để NÓI TRƯỚC KHI BẤM: điền sẵn, cộng tổng, và vì sao chưa ghi
 * sổ được — câu nào cũng phải chỉ được tới dòng.
 *
 * Ba cột số của SAP GR / Dynamics BC: Đặt · Đã về · Lần này. "Lần này" điền
 * sẵn phần CÒN MỞ (`qty_open`, 0154 — dòng đã chốt thiếu là 0), hoặc phần
 * của ĐỢT nếu đi từ một đợt giao; người nhận không phải nhớ đã về bao nhiêu.
 */

export type DongDon = {
  id: string
  /** null = dòng tự do (0134): nghiệm thu ngoài sổ kho, KHÔNG lên phiếu nhập. */
  material_id: string | null
  material_code: string
  material_name: string
  material_unit: string
  qty_ordered: number
  qty_received: number
  qty_open: number
  closed_short_at: string | null
  over_tolerance_pct: number
}

export type TinhTrang = 'ok' | 'blocked'

export type DongNhan = {
  po_line_id: string
  material_id: string
  code: string
  name: string
  unit: string
  qty_ordered: number
  qty_received: number
  qty_open: number
  over_tolerance_pct: number
  /** Đã chốt thiếu — phần còn lại không giao nữa, nhưng NCC vẫn có thể mang tới. */
  closed_short: boolean
  /** Còn phần mở → có ô nhập. Đã đủ → chỉ nhãn, không nhập. */
  editable: boolean
  qty: number
  status: TinhTrang
  note: string
}

/** Dựng lưới từ dòng đơn (+ dòng của đợt giao nếu đi từ một đợt). */
export function dungLuoi(
  lines: DongDon[],
  shipmentLines?: { po_line_id: string; qty: number }[] | null,
): { rows: DongNhan[]; bo_qua_tu_do: number } {
  const theoDot = shipmentLines
    ? new Map(shipmentLines.map((l) => [l.po_line_id, l.qty]))
    : null
  const rows: DongNhan[] = []
  let bo_qua_tu_do = 0
  for (const l of lines) {
    if (!l.material_id) {
      bo_qua_tu_do++
      continue
    }
    const editable = l.qty_open > 0
    let qty = 0
    if (editable) {
      if (theoDot) {
        const cuaDot = theoDot.get(l.id)
        // Dòng không thuộc đợt: để 0, người nhận tự gõ nếu NCC chở kèm.
        qty = cuaDot != null ? Math.min(cuaDot, l.qty_open) : 0
      } else qty = l.qty_open
    }
    rows.push({
      po_line_id: l.id,
      material_id: l.material_id,
      code: l.material_code,
      name: l.material_name,
      unit: l.material_unit,
      qty_ordered: l.qty_ordered,
      qty_received: l.qty_received,
      qty_open: l.qty_open,
      over_tolerance_pct: l.over_tolerance_pct ?? 0,
      closed_short: l.closed_short_at != null,
      editable,
      qty,
      status: 'ok',
      note: '',
    })
  }
  return { rows, bo_qua_tu_do }
}

export function tinhTong(rows: DongNhan[]) {
  let so_dong_nhan = 0
  let lan_nay = 0
  let vao_khoa = 0
  let tong_dat = 0
  let tong_da_ve = 0
  for (const r of rows) {
    tong_dat += r.qty_ordered
    tong_da_ve += r.qty_received
    if (r.qty > 0) {
      so_dong_nhan++
      lan_nay += r.qty
      if (r.status === 'blocked') vao_khoa += r.qty
    }
  }
  return {
    so_dong_nhan,
    lan_nay,
    vao_khoa,
    dung_duoc: lan_nay - vao_khoa,
    tong_dat,
    tong_da_ve,
  }
}

/**
 * Nhận vượt phần còn mở — tính theo đúng công thức server (`lib/po-receipt`):
 * ngưỡng trên SL ĐẶT cộng dồn, đã về + lần này ≤ đặt × (1 + dung sai).
 * Trả null khi không vượt.
 */
export function danhGiaVuot(
  r: Pick<DongNhan, 'qty' | 'qty_open' | 'qty_ordered' | 'over_tolerance_pct'>,
): { vuot: number; pct: number; trong_dung_sai: boolean } | null {
  if (r.qty <= r.qty_open) return null
  const vuot = r.qty - r.qty_open
  const pct = r.qty_ordered > 0 ? (vuot / r.qty_ordered) * 100 : Infinity
  const eps = 1e-6
  return { vuot, pct, trong_dung_sai: pct <= r.over_tolerance_pct + eps }
}

export type KiemKetQua =
  | { ok: true }
  | {
      ok: false
      reason: 'khong_dong' | 'so_khong_hop_le' | 'thieu_ghi_chu' | 'vuot_dung_sai'
      message: string
      /** Chỉ số dòng để thanh chốt nhảy tới. */
      line?: number
    }

/**
 * Vì sao CHƯA ghi sổ được — theo thứ tự người dùng gỡ được nhanh nhất.
 * Vượt dung sai không chặn ở đây khi đã có lý do nhận vượt (`coLyDoVuot`) —
 * server nhận `allow_over` + `over_reason`.
 */
export function kiemTruocGhiSo(rows: DongNhan[], coLyDoVuot = false): KiemKetQua {
  const iSai = rows.findIndex((r) => !Number.isFinite(r.qty) || r.qty < 0)
  if (iSai >= 0) {
    return {
      ok: false,
      reason: 'so_khong_hop_le',
      message: `Dòng ${iSai + 1} ${rows[iSai].code}: số Lần này không hợp lệ`,
      line: iSai,
    }
  }
  if (!rows.some((r) => r.qty > 0)) {
    return {
      ok: false,
      reason: 'khong_dong',
      message: 'Chưa nhận dòng nào — gõ số vào cột Lần này',
      line: rows.findIndex((r) => r.editable),
    }
  }
  const iKhoa = rows.findIndex(
    (r) => r.qty > 0 && r.status === 'blocked' && !r.note.trim(),
  )
  if (iKhoa >= 0) {
    return {
      ok: false,
      reason: 'thieu_ghi_chu',
      message: `Dòng ${iKhoa + 1} ${rows[iKhoa].code} Sai quy cách chưa có ghi chú — lý do đi theo lô`,
      line: iKhoa,
    }
  }
  if (!coLyDoVuot) {
    const iVuot = rows.findIndex((r) => {
      const v = danhGiaVuot(r)
      return v != null && !v.trong_dung_sai
    })
    if (iVuot >= 0) {
      const v = danhGiaVuot(rows[iVuot])!
      return {
        ok: false,
        reason: 'vuot_dung_sai',
        message: `${rows[iVuot].code} vượt ${v.pct.toFixed(0)}%, dung sai ${rows[iVuot].over_tolerance_pct}% — ghi lý do để ghi sổ`,
        line: iVuot,
      }
    }
  }
  return { ok: true }
}
