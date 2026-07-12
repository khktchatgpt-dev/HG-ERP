import { db } from '@/server/db'

/**
 * Repo phần giao Kho ↔ Cung ứng: đọc PO đang mở để nhập theo đơn (FR-WMS-02)
 * + cập nhật trạng thái partial/received từ sổ kho (BR-08).
 * CRUD PO/NCC nằm ở pos.repo.ts / suppliers (supply.repo cùng module).
 */

export type OpenPo = {
  id: string
  code: string
  status: string
  supplier_name: string
  lsx_code: string
}

export type PoLineStatus = {
  id: string
  po_id: string
  material_id: string
  qty_ordered: number
  qty_received: number
  qty_missing: number
  material_code: string
  material_name: string
  material_unit: string
}

/** PO nhận hàng được: đã đặt trở đi, chưa về đủ / chưa huỷ. */
export const RECEIVABLE = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
] as const

export const supplyRepo = {
  async listOpenPos(): Promise<OpenPo[]> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select(
        'id, code, status, supplier:supply_suppliers(name), lsx:production_orders(code)',
      )
      .in('status', [...RECEIVABLE])
      .order('created_at', { ascending: false })
      .limit(200)
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const sp = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
      const lx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
      return {
        id: r.id as string,
        code: r.code as string,
        status: r.status as string,
        supplier_name: (sp as { name?: string } | null)?.name ?? '?',
        lsx_code: (lx as { code?: string } | null)?.code ?? '?',
      }
    })
  },

  /** Dòng PO + đã nhận/còn thiếu — từ view supply_po_line_status (BR-08). */
  async lineStatus(poId: string): Promise<PoLineStatus[]> {
    const { data } = await db()
      .from('supply_po_line_status')
      .select('id, po_id, material_id, qty_ordered, qty_received, qty_missing')
      .eq('po_id', poId)
      .order('sort_order')
    const lines = (data ?? []) as Omit<
      PoLineStatus,
      'material_code' | 'material_name' | 'material_unit'
    >[]
    if (lines.length === 0) return []

    const ids = [...new Set(lines.map((l) => l.material_id))]
    const { data: mats } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit')
      .in('id', ids)
    const byId = new Map(
      ((mats ?? []) as { id: string; code: string; name: string; unit: string }[]).map(
        (m) => [m.id, m],
      ),
    )
    return lines.map((l) => {
      const m = byId.get(l.material_id)
      return {
        ...l,
        qty_ordered: Number(l.qty_ordered ?? 0),
        qty_received: Number(l.qty_received ?? 0),
        qty_missing: Number(l.qty_missing ?? 0),
        material_code: m?.code ?? '?',
        material_name: m?.name ?? '?',
        material_unit: m?.unit ?? '',
      }
    })
  },

  /**
   * Tính lại trạng thái PO sau khi nhập kho: mọi dòng missing ≤ 0 → received,
   * ngược lại partial (view là nguồn đối chiếu — thiết kế §7).
   */
  async refreshStatusFromReceipts(poId: string): Promise<'partial' | 'received' | null> {
    const lines = await this.lineStatus(poId)
    if (lines.length === 0) return null
    const done = lines.every((l) => l.qty_missing <= 0)
    const status = done ? 'received' : 'partial'
    const { error } = await db()
      .from('supply_purchase_orders')
      .update({ status })
      .eq('id', poId)
      .in('status', [...RECEIVABLE]) // không đè lên cancelled/pending_approval
    if (error) throw new Error(error.message)
    return status
  },

  /**
   * Đã đặt / chờ duyệt của 1 LSX gộp theo vật tư (đề xuất mua §P1, Cách 2):
   *  - ordered = Σ còn phải về (qty_missing) của PO ĐÃ DUYỆT (RECEIVABLE). Dùng
   *    qty_missing (không phải qty_ordered) để không đếm trùng phần đã về — hàng
   *    đã về nằm trong tồn (on_hand) rồi.
   *  - pending = Σ qty_ordered của PO còn chờ GĐ duyệt (chỉ cảnh báo, không trừ).
   * `excludePoId` = PO đang sửa (không tự đếm chính nó).
   */
  async orderedPendingByLsx(
    productionOrderId: string,
    excludePoId?: string | null,
  ): Promise<Map<string, { ordered: number; pending: number }>> {
    const out = new Map<string, { ordered: number; pending: number }>()
    const { data: pos } = await db()
      .from('supply_purchase_orders')
      .select('id, status')
      .eq('production_order_id', productionOrderId)
    const committed: string[] = []
    const pending: string[] = []
    for (const p of (pos as { id: string; status: string }[] | null) ?? []) {
      if (excludePoId && p.id === excludePoId) continue
      if ((RECEIVABLE as readonly string[]).includes(p.status)) committed.push(p.id)
      else if (p.status === 'pending_approval') pending.push(p.id)
    }
    const bump = (mid: string, k: 'ordered' | 'pending', v: number) => {
      const e = out.get(mid) ?? { ordered: 0, pending: 0 }
      e[k] += v
      out.set(mid, e)
    }
    if (committed.length > 0) {
      const { data } = await db()
        .from('supply_po_line_status')
        .select('material_id, qty_missing')
        .in('po_id', committed)
      for (const r of (data as { material_id: string; qty_missing: number }[] | null) ??
        []) {
        bump(r.material_id, 'ordered', Math.max(Number(r.qty_missing) || 0, 0))
      }
    }
    if (pending.length > 0) {
      const { data } = await db()
        .from('supply_purchase_order_lines')
        .select('material_id, qty_ordered')
        .in('po_id', pending)
      for (const r of (data as { material_id: string; qty_ordered: number }[] | null) ??
        []) {
        bump(r.material_id, 'pending', Number(r.qty_ordered) || 0)
      }
    }
    return out
  },

  async findPoCode(poId: string): Promise<string | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('code')
      .eq('id', poId)
      .maybeSingle()
    return (data as { code: string } | null)?.code ?? null
  },

  /** code + status của PO — guard nhập kho theo đơn (chỉ RECEIVABLE). */
  async poStatus(poId: string): Promise<{ code: string; status: string } | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('code, status')
      .eq('id', poId)
      .maybeSingle()
    return (data as { code: string; status: string } | null) ?? null
  },
}

// ── Nhà cung cấp (FR-SUP-06) ────────────────────────────────────────────────

export type Supplier = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_no: string | null
  note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const SUPPLIER_COLS =
  'id, code, name, email, phone, address, tax_no, note, is_active, created_at, updated_at'

export const suppliersRepo = {
  async list(filter: {
    q?: string
    active_only: boolean
    page: number
    page_size: number
  }): Promise<{ rows: Supplier[]; total: number }> {
    let q = db()
      .from('supply_suppliers')
      .select(SUPPLIER_COLS, { count: 'exact' })
      .order('name')
    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.q) q = q.or(`name.ilike.%${filter.q}%,code.ilike.%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    return { rows: (data ?? []) as Supplier[], total: count ?? 0 }
  },

  async findById(id: string): Promise<Supplier | null> {
    const { data } = await db()
      .from('supply_suppliers')
      .select(SUPPLIER_COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Supplier | null) ?? null
  },

  async insert(row: Partial<Supplier> & Pick<Supplier, 'name'>): Promise<Supplier> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .insert(row)
      .select(SUPPLIER_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert supplier failed')
    return data as Supplier
  },

  async patch(id: string, patch: Partial<Supplier>): Promise<Supplier> {
    const { data, error } = await db()
      .from('supply_suppliers')
      .update(patch)
      .eq('id', id)
      .select(SUPPLIER_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update supplier failed')
    return data as Supplier
  },
}
