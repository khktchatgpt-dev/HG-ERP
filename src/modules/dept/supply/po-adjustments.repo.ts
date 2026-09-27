import { db } from '@/server/db'
import type { AdjChange } from '@/lib/po-adjust'

/**
 * SỔ ĐIỀU CHỈNH ĐƠN MUA (0210) — mỗi lần áp dụng một bản ghi, lưu vĩnh viễn.
 * Ghi đi qua hàm DB `supply_po_apply_adjustment` (một giao dịch, có khoá đơn);
 * repo này chỉ gọi hàm, đọc sổ và đóng dấu "đã gửi NCC".
 */
export type PoAdjustment = {
  id: string
  po_id: string
  seq: number
  reason: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
  po_status: string
  currency: string
  subtotal_before: number
  subtotal_after: number
  discount_before: number
  discount_after: number
  vat_before: number
  vat_after: number
  total_before: number
  total_after: number
  delta_by_price: number
  delta_by_qty: number
  lines: AdjChange[]
  header_changes: Record<string, [unknown, unknown]> | null
  sent_at: string | null
  sent_by: string | null
  sent_by_name: string | null
  sent_note: string | null
}

const MONEY = [
  'subtotal_before',
  'subtotal_after',
  'discount_before',
  'discount_after',
  'vat_before',
  'vat_after',
  'total_before',
  'total_after',
  'delta_by_price',
  'delta_by_qty',
] as const

/** Lỗi nghiệp vụ hàm DB ném ra — service dịch sang 400 / 409. */
export class PoAdjustDbError extends Error {
  constructor(
    message: string,
    readonly stale: boolean,
  ) {
    super(message)
  }
}

export const poAdjustmentsRepo = {
  async listByPo(poId: string): Promise<PoAdjustment[]> {
    const { data, error } = await db()
      .from('supply_po_adjustments')
      .select(
        '*, creator:users!supply_po_adjustments_created_by_fkey(name, email), sender:users!supply_po_adjustments_sent_by_fkey(name, email)',
      )
      .eq('po_id', poId)
      .order('seq')
    if (error) throw new Error(error.message)
    type U = { name: string | null; email: string } | null
    return ((data ?? []) as (Record<string, unknown> & { creator: U; sender: U })[]).map(
      ({ creator, sender, ...r }) => {
        const out = { ...r } as Record<string, unknown>
        for (const k of MONEY) out[k] = Number(r[k] ?? 0)
        out.created_by_name = creator?.name ?? creator?.email ?? null
        out.sent_by_name = sender?.name ?? sender?.email ?? null
        return out as PoAdjustment
      },
    )
  },

  /** Lần điều chỉnh mới nhất của đơn (0 = chưa lần nào). */
  async lastSeq(poId: string): Promise<number> {
    const { data, error } = await db()
      .from('supply_po_adjustments')
      .select('seq')
      .eq('po_id', poId)
      .order('seq', { ascending: false })
      .limit(1)
    if (error) throw new Error(error.message)
    return Number(data?.[0]?.seq ?? 0)
  },

  /** Dòng đơn đã nằm trên hoá đơn NCC (0188) — không bỏ được khỏi đơn. */
  async invoicedLineIds(lineIds: string[]): Promise<Set<string>> {
    if (lineIds.length === 0) return new Set()
    const { data, error } = await db()
      .from('accounting_supplier_invoice_lines')
      .select('po_line_id')
      .in('po_line_id', lineIds)
    if (error) throw new Error(error.message)
    return new Set(
      ((data ?? []) as { po_line_id: string | null }[])
        .map((r) => r.po_line_id)
        .filter((x): x is string => !!x),
    )
  },

  /** Mã / tên / ĐVT vật tư của dòng MỚI — cho ảnh chụp trong sổ. */
  async materialLabels(
    ids: string[],
  ): Promise<Map<string, { code: string; name: string; unit: string | null }>> {
    if (ids.length === 0) return new Map()
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('id, code, name, unit')
      .in('id', ids)
    if (error) throw new Error(error.message)
    return new Map(
      (
        (data ?? []) as { id: string; code: string; name: string; unit: string | null }[]
      ).map((m) => [m.id, { code: m.code, name: m.name, unit: m.unit }]),
    )
  },

  async apply(args: {
    poId: string
    baseSeq: number
    actorId: string
    reason: string
    updates: Record<string, unknown>[]
    inserts: Record<string, unknown>[]
    deleteIds: string[]
    splits: Record<string, unknown>[]
    header: Record<string, unknown>
    record: Record<string, unknown>
  }): Promise<number> {
    const { data, error } = await db().rpc('supply_po_apply_adjustment', {
      p_po_id: args.poId,
      p_base_seq: args.baseSeq,
      p_actor: args.actorId,
      p_reason: args.reason,
      p_updates: args.updates,
      p_inserts: args.inserts,
      p_delete_ids: args.deleteIds,
      p_splits: args.splits,
      p_header: args.header,
      p_record: args.record,
    } as never)
    if (error) {
      const m = error.message ?? ''
      if (m.startsWith('PO_ADJ_STALE:')) {
        throw new PoAdjustDbError(m.slice('PO_ADJ_STALE:'.length).trim(), true)
      }
      if (m.startsWith('PO_ADJ:'))
        throw new PoAdjustDbError(m.slice('PO_ADJ:'.length).trim(), false)
      // unique (po_id, seq): hai lượt áp dụng lọt qua cùng lúc.
      if (error.code === '23505') {
        throw new PoAdjustDbError(
          'Đơn vừa được điều chỉnh trong lúc bạn đang sửa — tải lại đơn rồi sửa tiếp',
          true,
        )
      }
      throw new Error(m)
    }
    return Number(data)
  },

  /** Đóng dấu đã gửi NCC — chỉ lần chưa gửi; trả false nếu không có gì để đóng. */
  async markSent(
    poId: string,
    seq: number,
    userId: string,
    note: string | null,
  ): Promise<boolean> {
    const { data, error } = await db()
      .from('supply_po_adjustments')
      .update({ sent_at: new Date().toISOString(), sent_by: userId, sent_note: note })
      .eq('po_id', poId)
      .eq('seq', seq)
      .is('sent_at', null)
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },
}
