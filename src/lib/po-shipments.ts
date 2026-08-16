/**
 * ĐỢT GIAO của đơn đặt vật tư — logic thuần, có test (plan-po-giao-nhan GĐ1).
 *
 * NCC không đăng nhập: "NCC xác nhận" là nhân viên cung ứng ghi lại cam kết sau
 * cuộc gọi/Zalo. Phần thuần ở đây gác hai việc: (1) input đợt giao có hợp lệ
 * với đơn không, (2) đơn nên mang `expected_at` nào sau khi kế hoạch giao đổi.
 */

export type ShipmentLineInput = { po_line_id: string; qty: number }
export type ShipmentInput = {
  expected_date: string
  note?: string | null
  lines: ShipmentLineInput[]
}

export type PoLineForShipment = { id: string; qty_ordered: number; name: string }

export type ShipmentValidation = {
  /** Lỗi CHẶN — không ghi được. */
  errors: string[]
  /**
   * Cảnh báo KHÔNG chặn: NCC xác nhận ÍT hơn đặt là chuyện thật ngoài đời
   * (hết hàng, giao bù sau) — hiện vàng cho người mua biết mà đòi phần thiếu,
   * nhưng không bắt họ sửa số cho khớp một cam kết không có thật.
   */
  warnings: string[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/**
 * Kiểm tra bộ đợt giao so với dòng đơn. `existing` = SL đã nằm trong các đợt
 * CÒN SỐNG khác (khi thêm đợt mới vào đơn đã xác nhận) — cộng dồn để tổng mọi
 * đợt không vượt SL đặt của dòng.
 */
export function validateShipments(
  shipments: ShipmentInput[],
  poLines: PoLineForShipment[],
  existing: Map<string, number> = new Map(),
): ShipmentValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const byId = new Map(poLines.map((l) => [l.id, l]))

  if (shipments.length === 0) errors.push('Chưa có đợt giao nào')

  const total = new Map<string, number>(existing)
  for (const [i, s] of shipments.entries()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.expected_date)) {
      errors.push(`Đợt ${i + 1}: chưa chọn ngày giao`)
    }
    if (s.lines.length === 0) errors.push(`Đợt ${i + 1}: chưa có dòng hàng nào`)
    const seen = new Set<string>()
    for (const line of s.lines) {
      const po = byId.get(line.po_line_id)
      if (!po) {
        errors.push(`Đợt ${i + 1}: có dòng không thuộc đơn này`)
        continue
      }
      if (seen.has(line.po_line_id)) {
        errors.push(`Đợt ${i + 1}: "${po.name}" bị lặp hai lần trong một đợt`)
      }
      seen.add(line.po_line_id)
      if (!(line.qty > 0)) {
        errors.push(`Đợt ${i + 1}: "${po.name}" phải có số lượng > 0`)
        continue
      }
      total.set(line.po_line_id, (total.get(line.po_line_id) ?? 0) + line.qty)
    }
  }

  for (const [lineId, sum] of total) {
    const po = byId.get(lineId)
    if (!po) continue
    // So sánh có dung sai 1/10.000 — số thập phân cộng dồn không được phép
    // bật lỗi "vượt đặt" chỉ vì 0.30000000000000004.
    if (sum > po.qty_ordered + 1e-4) {
      errors.push(
        `"${po.name}": các đợt cộng lại ${fmt(sum)} vượt SL đặt ${fmt(po.qty_ordered)}`,
      )
    } else if (sum < po.qty_ordered - 1e-4) {
      warnings.push(
        `"${po.name}": NCC mới xác nhận ${fmt(sum)}/${fmt(po.qty_ordered)} — phần thiếu cần đòi giao bổ sung`,
      )
    }
  }
  // Dòng không xuất hiện trong đợt nào = NCC chưa hứa gì cho nó — cũng phải nói.
  for (const po of poLines) {
    if (!total.has(po.id)) {
      warnings.push(`"${po.name}": chưa nằm trong đợt giao nào`)
    }
  }

  return { errors, warnings }
}

/**
 * `expected_at` của ĐƠN sau khi kế hoạch giao đổi = ngày sớm nhất trong các đợt
 * còn sống. Đồng bộ về cột cũ để TOÀN BỘ cảnh báo hiện có (assessPoLate, badge,
 * Hàng sắp về) chạy nguyên không sửa dòng nào. `null` = không còn đợt sống nào
 * (caller giữ nguyên expected_at cũ — đừng xoá mốc của đơn).
 */
export function earliestExpectedDate(
  shipments: { expected_date: string; status: string }[],
): string | null {
  const alive = shipments
    .filter((s) => s.status === 'planned' || s.status === 'arrived')
    .map((s) => s.expected_date)
    .sort()
  return alive[0] ?? null
}

/** Đợt kế tiếp cần khai `seq` nào — nối tiếp lớn nhất, kể cả đợt đã huỷ. */
export function nextSeq(shipments: { seq: number }[]): number {
  return shipments.reduce((m, s) => Math.max(m, s.seq), 0) + 1
}
