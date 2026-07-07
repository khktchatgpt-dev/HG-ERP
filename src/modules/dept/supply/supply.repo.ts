import { db } from '@/server/db'

/**
 * Repo Cung ứng — GĐ1 mới có phần Kho cần: đọc PO đang mở để nhập theo đơn
 * (FR-WMS-02) + cập nhật trạng thái partial/received từ sổ kho (BR-08).
 * Sprint Cung ứng sẽ mở rộng thêm CRUD PO/NCC tại đây.
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
const RECEIVABLE = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial'] as const

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

  async findPoCode(poId: string): Promise<string | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('code')
      .eq('id', poId)
      .maybeSingle()
    return (data as { code: string } | null)?.code ?? null
  },
}
