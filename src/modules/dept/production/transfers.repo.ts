import { db } from '@/server/db'

/**
 * production_transfers (0090) — sổ bàn giao nội bộ APPEND-ONLY: giao (issue)
 * phôi/WIP vào tổ để làm 1 công đoạn / tổ trả lại (return) lỗi-thừa.
 * Tồn WIP tại tổ = đại lượng dẫn xuất (src/lib/production-summary.ts
 * summarizeTeamWip) — không lưu cứng, cùng triết lý outsource.
 */

export type Transfer = {
  id: string
  production_order_id: string
  component_id: string
  stage: string
  team_department_id: string
  direction: 'issue' | 'return'
  entry_date: string
  qty: number
  reason: string | null
  note: string | null
  created_by: string | null
  created_at: string
  /** Phiếu giao tổ chứa dòng này (0289) — null = dòng rời kiểu 0090. */
  doc_id: string | null
  /** Số tổ nhận xác nhận (0289); null khi chưa nhận hoặc dòng rời. */
  received_qty: number | null
  diff_reason: string | null
}

export type TransferJoined = Transfer & {
  team_name: string | null
  component_name: string | null
  component_cluster: string | null
  created_by_name: string | null
  lsx_code: string | null
}

const COLS =
  'id, production_order_id, component_id, stage, team_department_id, direction, entry_date, qty, reason, note, created_by, created_at, doc_id, received_qty, diff_reason'
const SELECT_JOINED = `${COLS}, team:departments(name), component:production_components(name, cluster), actor:users(name), lsx:production_orders(code)`

type One<T> = T | T[] | null
type Raw = Transfer & {
  team: One<{ name: string }>
  component: One<{ name: string; cluster: string | null }>
  actor: One<{ name: string | null }>
  lsx: One<{ code: string }>
}

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function unwrap(rows: Raw[] | null): TransferJoined[] {
  return (rows ?? []).map((r) => {
    const comp = first(r.component)
    return {
      ...r,
      team: undefined,
      component: undefined,
      actor: undefined,
      lsx: undefined,
      qty: Number(r.qty),
      received_qty: r.received_qty == null ? null : Number(r.received_qty),
      team_name: first(r.team)?.name ?? null,
      component_name: comp?.name ?? null,
      component_cluster: comp?.cluster ?? null,
      created_by_name: first(r.actor)?.name ?? null,
      lsx_code: first(r.lsx)?.code ?? null,
    } as unknown as TransferJoined
  })
}

export const transfersRepo = {
  async findById(id: string): Promise<Transfer | null> {
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Transfer | null) ?? null
  },

  async listByLsx(productionOrderId: string): Promise<TransferJoined[]> {
    const { data } = await db()
      .from('production_transfers')
      .select(SELECT_JOINED)
      .eq('production_order_id', productionOrderId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /**
   * Phiếu giao nhận CÒN HIỆU LỰC của lệnh — khoá ghi đè bảng chi tiết (15/11/2026).
   * Dòng giao trỏ thẳng vào từng chi tiết với khoá ngoại ON DELETE CASCADE, mà Lưu
   * Bảng chi tiết / Lộ trình xoá rồi tạo lại TRỌN bảng: thử trên lệnh TEST, phiếu
   * PGT-2026-0002 (đã nhận 56 cái) mất sạch dòng, chỉ còn vỏ. Phiếu đã huỷ không
   * tính; dòng giao đời cũ không có phiếu (0090) thì có tính. Lỗi đọc thì NÉM —
   * trả rỗng là mở khoá nhầm.
   */
  async phieuKhoaBang(productionOrderId: string): Promise<string[]> {
    const { data, error } = await db()
      .from('production_transfers')
      .select('doc_id')
      .eq('production_order_id', productionOrderId)
      .limit(1000)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { doc_id: string | null }[]
    const out = new Set<string>()
    if (rows.some((r) => !r.doc_id)) out.add('dòng giao không phiếu')
    const ids = [...new Set(rows.map((r) => r.doc_id).filter((x): x is string => !!x))]
    if (ids.length > 0) {
      const { data: docs, error: e2 } = await db()
        .from('production_transfer_docs')
        .select('doc_no, status')
        .in('id', ids)
      if (e2) throw new Error(e2.message)
      for (const d of (docs ?? []) as { doc_no: string; status: string }[])
        if (d.status !== 'da_huy') out.add(d.doc_no)
    }
    return [...out].sort()
  },

  /** Bàn giao của 1 LSX dạng thô (không join) — tính WIP khi ghi sổ sản lượng. */
  async listRawByLsx(productionOrderId: string): Promise<Transfer[]> {
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .eq('production_order_id', productionOrderId)
      .limit(20000)
    return ((data ?? []) as Transfer[]).map((r) => ({
      ...r,
      qty: Number(r.qty),
      received_qty: r.received_qty == null ? null : Number(r.received_qty),
    }))
  },

  /** Bàn giao thô của NHIỀU lệnh — tính WIP/nghẽn ở Toàn cảnh xưởng (GĐ3). */
  async listRawByLsxBulk(ids: string[]): Promise<Transfer[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .in('production_order_id', ids)
      .limit(50000)
    return ((data ?? []) as Transfer[]).map((r) => ({
      ...r,
      qty: Number(r.qty),
      received_qty: r.received_qty == null ? null : Number(r.received_qty),
    }))
  },

  async insert(
    row: Omit<Transfer, 'id' | 'created_at' | 'doc_id' | 'received_qty' | 'diff_reason'> &
      Partial<Pick<Transfer, 'doc_id' | 'received_qty' | 'diff_reason'>>,
  ): Promise<void> {
    const { error } = await db().from('production_transfers').insert(row)
    if (error) throw new Error(error.message)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('production_transfers').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
