import { db } from '@/server/db'
import type { LsxStatus } from './production.schema'

/**
 * Repo HEADER lệnh sản xuất (production_orders) + view theo dõi đơn + dòng in
 * LSX. Lớp thực thi (kế hoạch/chi tiết/sổ) nằm ở jobs/components/entries repo
 * — thiết kế lại theo vai 07/2026 (0084).
 */

export type ProductionOrder = {
  id: string
  code: string
  /** Khách hàng của lệnh — mọi đơn gộp vào phải cùng khách này (0113). */
  customer_id: string
  status: LsxStatus
  priority: number
  ship_date: string | null
  container_summary: string | null
  /**
   * NGƯỜI LẬP lệnh — ghi một lần lúc tạo, không bao giờ đổi (0119).
   * Khác `issued_by`: đó là người GỬI DUYỆT lần gần nhất, bị ghi đè mỗi lần
   * `resubmit()` nên không dùng để truy người lập được.
   */
  created_by: string | null
  issued_by: string | null
  issued_at: string | null
  received_date: string | null
  completed_at: string | null
  approved_by: string | null
  approved_at: string | null
  rejected_reason: string | null
  materials_received_at: string | null
  materials_received_by: string | null
  /** Hạn VẬT TƯ phải về kho để kịp SX (0126) — đèn "Kịp SX?" so với mốc này. */
  materials_due_at: string | null
  /** Số lần phát lại lệnh (0114) — >1 thì phiếu in là BẢN CHỈNH SỬA. */
  revision: number
  revised_at: string | null
  revised_by: string | null
  revision_note: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/**
 * Lệnh + các ĐƠN nó đang chạy. Từ 0113 một lệnh gộp NHIỀU đơn (cùng khách),
 * nên chỗ nào trước đây đọc `order_code` nay đọc `order_codes` (đã sắp theo mã).
 */
export type ProductionOrderWithOrders = ProductionOrder & {
  order_ids: string[]
  order_codes: string[]
  customer_name: string
}

/** 1 dòng của view v_order_tracking (FR-SAL-07) — tiến độ SX đếm theo jobs (0084). */
export type OrderTracking = {
  id: string
  code: string
  customer_id: string
  customer_name: string
  customer_po_no: string | null
  status: string
  currency: string
  due_date: string | null
  quote_code: string | null
  production_order_id: string | null
  lsx_code: string | null
  lsx_status: string | null
  lsx_priority: number | null
  ship_date: string | null
  /** Số công đoạn (jobs) của lệnh / đã xong — 0/0 = chưa lên kế hoạch SX. */
  jobs_total: number
  jobs_done: number
  lines_bom_pending: number
  /** PO ĐÃ DUYỆT chưa về đủ — vật tư thật sự đang trên đường (0133). */
  pos_open: number
  /** PO còn NHÁP / CHỜ GĐ DUYỆT — chưa gửi NCC, chưa ai bắt đầu làm gì (0133). */
  pos_unsent: number
  // Lớp thương mại (v_order_tracking mở rộng, migration 0071) — GĐ nhìn theo tiền.
  deposit_percent: number | null
  payment_method: string | null
  /** Σ(qty × đơn giá bán) của các dòng đơn, theo `currency`. */
  order_value: number
  line_count: number
  created_at: string
  updated_at: string
}

const COLS =
  'id, code, customer_id, status, priority, ship_date, container_summary, created_by, issued_by, issued_at, received_date, completed_at, approved_by, approved_at, rejected_reason, materials_received_at, materials_received_by, materials_due_at, revision, revised_at, revised_by, revision_note, note, created_at, updated_at'

// Đơn trỏ SANG lệnh (sales_orders.production_order_id) nên embed là chiều ngược
// → PostgREST trả mảng.
const SELECT = `${COLS}, customer:sales_customers(name), orders:sales_orders(id, code)`

type Raw = ProductionOrder & {
  customer: { name: string } | { name: string }[] | null
  orders: { id: string; code: string }[] | null
}

function unwrap(rows: Raw[] | null): ProductionOrderWithOrders[] {
  return (rows ?? []).map((r) => {
    const c = Array.isArray(r.customer) ? r.customer[0] : r.customer
    const orders = [...(r.orders ?? [])].sort((a, b) => a.code.localeCompare(b.code))
    return {
      ...r,
      order_ids: orders.map((o) => o.id),
      order_codes: orders.map((o) => o.code),
      customer_name: c?.name ?? '?',
    }
  })
}

export const productionRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'LSX' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async existsByCode(code: string): Promise<boolean> {
    const { data } = await db()
      .from('production_orders')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    return !!data
  },

  async list(filter: {
    q?: string
    status?: LsxStatus
    page: number
    page_size: number
  }): Promise<{ rows: ProductionOrderWithOrders[]; total: number }> {
    let q = db()
      .from('production_orders')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.ilike('code', `%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: unwrap(data as Raw[] | null), total: count ?? 0 }
  },

  /** LSX đang chạy (approved | in_progress) — ưu tiên trước, rồi hạn xuất. */
  async listActive(): Promise<ProductionOrderWithOrders[]> {
    const { data } = await db()
      .from('production_orders')
      .select(SELECT)
      .in('status', ['approved', 'in_progress'])
      .order('priority', { ascending: false })
      .order('ship_date', { ascending: true, nullsFirst: false })
      .limit(500)
    return unwrap(data as Raw[] | null)
  },

  /**
   * Id các LSX đã CAM KẾT (đã qua duyệt GĐ): approved | in_progress — dùng để
   * tính "giữ chỗ tồn" khi đề xuất mua (plan-don-dat-hang-chuan-erp §P1, Cách 2).
   * LSX pending_approval/rejected/completed/cancelled KHÔNG giữ chỗ.
   */
  async listCommittedIds(): Promise<string[]> {
    const { data } = await db()
      .from('production_orders')
      .select('id')
      .in('status', ['approved', 'in_progress'])
      .limit(1000)
    return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
  },

  /** Mã LSX theo danh sách id — nhãn cho báo cáo tháng thống kê (0090). */
  async listCodesByIds(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map()
    const { data } = await db()
      .from('production_orders')
      .select('id, code')
      .in('id', ids)
      .limit(1000)
    return new Map(
      ((data as { id: string; code: string }[] | null) ?? []).map((r) => [r.id, r.code]),
    )
  },

  async findById(id: string): Promise<ProductionOrderWithOrders | null> {
    const { data } = await db()
      .from('production_orders')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as unknown as Raw])[0]
  },

  /** LSX đang chạy 1 đơn (mỗi đơn tối đa 1 lệnh) — cho trang chi tiết đơn. */
  async findByOrder(salesOrderId: string): Promise<ProductionOrderWithOrders | null> {
    const { data } = await db()
      .from('sales_orders')
      .select('production_order_id')
      .eq('id', salesOrderId)
      .maybeSingle()
    const lsxId = (data as { production_order_id: string | null } | null)
      ?.production_order_id
    if (!lsxId) return null
    return productionRepo.findById(lsxId)
  },

  /**
   * Tạo LSX. Số lệnh unique ở DB — bắt duplicate ở đây để service trả Conflict
   * thay vì 500 (service đã kiểm tra trước, đây là chốt chặn đua).
   */
  async insert(row: {
    code: string
    customer_id: string
    /** Bỏ trống = theo default DB. Luồng Sales tạo lệnh truyền 'draft' (0117). */
    status?: LsxStatus
    ship_date?: string | null
    container_summary?: string | null
    /** Người LẬP lệnh (0119) — ghi một lần, `resubmit()` không đụng tới. */
    created_by: string
    issued_by: string
    issued_at: string
    received_date?: string | null
    note?: string | null
  }): Promise<{ order: ProductionOrder | null; duplicate: boolean }> {
    const { data, error } = await db()
      .from('production_orders')
      .insert(row)
      .select(COLS)
      .single()
    if (error) {
      if (error.code === '23505') return { order: null, duplicate: true } // unique_violation
      throw new Error(error.message)
    }
    return { order: data as ProductionOrder, duplicate: false }
  },

  /**
   * Gắn/gỡ đơn vào lệnh — quan hệ nằm ở phía đơn (`sales_orders.production_order_id`).
   * Gỡ = set null. Trigger DB `assert_lsx_same_customer` chặn gộp nhầm khách.
   */
  async attachOrders(lsxId: string, orderIds: string[]): Promise<void> {
    if (!orderIds.length) return
    const { error } = await db()
      .from('sales_orders')
      .update({ production_order_id: lsxId })
      .in('id', orderIds)
    if (error) throw new Error(error.message)
  },

  async detachOrders(orderIds: string[]): Promise<void> {
    if (!orderIds.length) return
    const { error } = await db()
      .from('sales_orders')
      .update({ production_order_id: null })
      .in('id', orderIds)
    if (error) throw new Error(error.message)
  },

  /** Id các đơn thuộc lệnh — dùng khi chỉ cần id (kế hoạch/sổ/định hình). */
  async listOrderIds(lsxId: string): Promise<string[]> {
    const { data } = await db()
      .from('sales_orders')
      .select('id, code')
      .eq('production_order_id', lsxId)
      .order('code')
    return ((data as { id: string }[] | null) ?? []).map((r) => r.id)
  },

  async patch(id: string, patch: Partial<ProductionOrder>): Promise<ProductionOrder> {
    const { data, error } = await db()
      .from('production_orders')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update LSX failed')
    return data as ProductionOrder
  },

  /** Danh mục công đoạn SX (catalog_items type 'production_stage'). */
  async listStages(): Promise<{ code: string; label: string }[]> {
    const { data } = await db()
      .from('catalog_items')
      .select('code, label')
      .eq('type', 'production_stage')
      .eq('is_active', true)
      .order('sort_order')
    return (data ?? []) as { code: string; label: string }[]
  },

  /** Số dòng SP per đơn — cho màn kế hoạch/định hình ("x/y SP đã chốt"). */
  async linesCountByOrder(orderIds: string[]): Promise<Map<string, number>> {
    if (!orderIds.length) return new Map()
    const { data } = await db()
      .from('sales_order_lines')
      .select('order_id')
      .in('order_id', orderIds)
      .limit(20000)
    const map = new Map<string, number>()
    for (const r of (data ?? []) as { order_id: string }[]) {
      map.set(r.order_id, (map.get(r.order_id) ?? 0) + 1)
    }
    return map
  },

  /** Bảng trạng thái tổng hợp (FR-SAL-07) — đọc từ view v_order_tracking. */
  async listTracking(): Promise<OrderTracking[]> {
    const { data } = await db()
      .from('v_order_tracking')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...(r as unknown as OrderTracking),
      jobs_total: Number(r.jobs_total ?? 0),
      jobs_done: Number(r.jobs_done ?? 0),
      lines_bom_pending: Number(r.lines_bom_pending ?? 0),
      pos_open: Number(r.pos_open ?? 0),
      // 0133 — cột mới; đọc phòng thủ để bản chưa apply migration vẫn về 0 thay
      // vì NaN (NaN > 0 là false nên chỉ mất cảnh báo, không vẽ số bậy).
      pos_unsent: Number(r.pos_unsent ?? 0),
      lsx_priority: r.lsx_priority == null ? null : Number(r.lsx_priority),
      order_value: Number(r.order_value ?? 0),
      line_count: Number(r.line_count ?? 0),
      deposit_percent: r.deposit_percent == null ? null : Number(r.deposit_percent),
      payment_method: (r.payment_method as string | null) ?? null,
    }))
  },
}

/**
 * Danh sách MÃ SP của một lệnh — chỉ mã/tên/SL, không kéo theo thông số kỹ thuật.
 *
 * Dùng cho ô "Mã SP" trên dòng đơn đặt hàng: phòng Cung ứng mua GỘP chi tiết của
 * cả lệnh cho rẻ (một đơn vít dùng chung cho 4 mã SP), nên dòng đơn phải chỉ ra
 * được nó phục vụ (những) sản phẩm nào. Gõ tay mã SP là sai chính tả và không
 * đối chiếu lại được — chọn từ đúng lệnh mới chắc.
 */
export async function listLsxProducts(
  salesOrderIds: string[],
): Promise<{ code: string; name: string; qty: number }[]> {
  if (!salesOrderIds.length) return []
  const { data } = await db()
    .from('sales_order_lines')
    .select('qty, sort_order, product:technical_products(code, name)')
    .in('order_id', salesOrderIds)
    .order('sort_order')

  type P = { code: string; name: string }
  const out: { code: string; name: string; qty: number }[] = []
  for (const r of (data as { qty: unknown; product: P | P[] | null }[] | null) ?? []) {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    if (!p?.code) continue
    // Cùng một mã SP có thể nằm 2 dòng đơn hàng (giao 2 đợt) — cộng dồn số lượng.
    const hit = out.find((x) => x.code === p.code)
    if (hit) hit.qty += Number(r.qty ?? 0)
    else out.push({ code: p.code, name: p.name, qty: Number(r.qty ?? 0) })
  }
  return out
}
