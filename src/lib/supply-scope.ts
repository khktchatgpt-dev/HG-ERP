/**
 * "CỦA TÔI" CỦA PHÒNG CUNG ỨNG — một nghĩa cho mọi màn (27/09/2026).
 *
 * Đo trước khi dựng: 3 người mua (Nga 18 đơn đang chạy · Huy 16 · Truyền 10),
 * việc tách theo NCC rất rõ (45/46 NCC chỉ MỘT người đặt), nhưng 11 màn của
 * phòng chỉ có Hộp thư lọc theo người xem — và mỗi màn tự hiểu "của tôi" một
 * kiểu (chip "Chờ tôi xử lý" ở Yêu cầu mua thực ra lọc "phòng Cung ứng đang
 * giữ"). File này là nghĩa DUY NHẤT:
 *
 *   · ĐƠN của tôi  = tôi phụ trách (`assigned_to`, rỗng thì người tạo — CÙNG
 *     luật `assertPoOwner` của server, để nút sửa và bộ lọc không nói hai ý);
 *   · LỆNH của tôi = lệnh có ít nhất một đơn của tôi (lệnh chính hoặc gộp);
 *   · NCC của tôi  = tôi được gán phụ trách (`buyer_id`); NCC chưa gán ai thì
 *     suy từ lịch sử — NCC tôi từng có đơn;
 *   · HÀNG VỀ của tôi = hàng của đơn của tôi.
 *
 * Logic thuần, dùng được cả server (đếm badge) lẫn client (lọc màn).
 */

export type SupplyScope = 'toi' | 'phong'

/** Đọc `?pham_vi=` trên địa chỉ trang; rác hoặc thiếu → null (để mặc định quyết). */
export function parseScope(v: string | null | undefined): SupplyScope | null {
  return v === 'toi' || v === 'phong' ? v : null
}

/**
 * Phạm vi MẶC ĐỊNH theo vai (chốt 27/09/2026): người có quyền DUYỆT đơn mua
 * (chị Thảo, Giám đốc) nhìn cả phòng — việc của họ là thấy ai đang kẹt; người
 * mua nhìn việc của mình trước.
 */
export function defaultScope(v: { canApprove: boolean }): SupplyScope {
  return v.canApprove ? 'phong' : 'toi'
}

/** Người đang cầm đơn — cùng luật `assertPoOwner` (pos.service). */
export function poOwner(po: {
  assigned_to: string | null
  created_by?: string | null
}): string | null {
  return po.assigned_to ?? po.created_by ?? null
}

export function isMyPo(
  po: { assigned_to: string | null; created_by?: string | null },
  meId: string | null,
): boolean {
  return !!meId && poOwner(po) === meId
}

/**
 * Lệnh của tôi — lệnh có đơn của tôi. Tính cả lệnh GỘP (0125): đơn "LSX 9+10"
 * của tôi thì lệnh 10 cũng là của tôi, bỏ sót là tưởng lệnh 10 không ai lo.
 * Đơn đã huỷ không tính — huỷ rồi thì tôi không còn lo gì cho lệnh đó qua nó.
 */
export function myLsxIds(
  pos: {
    status: string
    assigned_to: string | null
    created_by?: string | null
    production_order_id: string | null
    extra_lsx_ids?: string[]
  }[],
  meId: string | null,
): Set<string> {
  const out = new Set<string>()
  for (const p of pos) {
    if (p.status === 'cancelled' || !isMyPo(p, meId)) continue
    if (p.production_order_id) out.add(p.production_order_id)
    for (const x of p.extra_lsx_ids ?? []) out.add(x)
  }
  return out
}

/**
 * NCC của tôi. Gán tay (`buyer_id`) thắng lịch sử: NCC đã gán cho người khác
 * thì không còn là của tôi dù tôi từng đặt một lần (đúng ca 1/46 NCC hai người
 * cùng đặt). NCC chưa gán ai: của mọi người từng có đơn với nó.
 */
export function mySupplierIds(
  suppliers: { id: string; buyer_id: string | null }[],
  pos: { supplier_id: string; assigned_to: string | null; created_by?: string | null }[],
  meId: string | null,
): Set<string> {
  const out = new Set<string>()
  if (!meId) return out
  const ordered = new Set(pos.filter((p) => isMyPo(p, meId)).map((p) => p.supplier_id))
  for (const s of suppliers) {
    if (s.buyer_id ? s.buyer_id === meId : ordered.has(s.id)) out.add(s.id)
  }
  return out
}

/**
 * Người phụ trách NCC suy từ lịch sử đơn — người có NHIỀU đơn nhất với NCC đó
 * (hoà thì người có đơn gần nhất). Dùng để hiển thị khi NCC chưa gán và để điền
 * sẵn `buyer_id` một lần (chốt Q3, 27/09/2026).
 */
export function inferSupplierBuyer(
  pos: {
    supplier_id: string
    assigned_to: string | null
    created_by?: string | null
    created_at: string
  }[],
): Map<string, string> {
  const tally = new Map<string, Map<string, { n: number; last: string }>>()
  for (const p of pos) {
    const who = poOwner(p)
    if (!who) continue
    const per = tally.get(p.supplier_id) ?? new Map()
    const cur = per.get(who) ?? { n: 0, last: '' }
    per.set(who, {
      n: cur.n + 1,
      last: p.created_at > cur.last ? p.created_at : cur.last,
    })
    tally.set(p.supplier_id, per)
  }
  const out = new Map<string, string>()
  for (const [sid, per] of tally) {
    const best = [...per.entries()].sort(
      (a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last),
    )[0]
    if (best) out.set(sid, best[0])
  }
  return out
}
