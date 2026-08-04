import { db } from '@/server/db'

/**
 * NHÓM + DÒNG của lệnh sản xuất (0114) — nguồn dòng in phiếu và là gốc của
 * jobs/định hình. Xem docs/lsx-redesign.md: dòng lệnh KHÔNG phải dòng đơn hàng
 * (một mã SP lặp nhiều dòng theo đợt xuất), nên nó có bảng riêng.
 */

export type LsxGroup = {
  id: string
  production_order_id: string
  /** Nhóm gắn 1 đơn (ROSCO/YOTRIO) hoặc nhóm tự đặt tên (LAURA) → null. */
  sales_order_id: string | null
  title: string | null
  buyer_name: string | null
  po_no: string | null
  ship_date: string | null
  ship_label: string | null
  note: string | null
  sort_order: number
}

export type LsxLine = {
  id: string
  production_order_id: string
  group_id: string
  product_id: string | null
  sales_order_line_id: string | null
  product_code: string
  /** Mã SP theo cách gọi của khách (0115) — in cạnh mã HG. */
  customer_item_code: string | null
  name_foreign: string | null
  name_vi: string | null
  name_customs: string | null
  barcode: string | null
  unit: string
  qty: number
  packing: string | null
  cbm: number | null
  ship_date: string | null
  ship_label: string | null
  specs: Record<string, string>
  checks: Record<string, string>
  extras: Record<string, string>
  note: string | null
  important_note: string | null
  image_file_id: string | null
  sort_order: number
  changed_in_rev: number | null
}

// Input để trống được từng field — form soạn gửi lên phần nào có phần đó,
// repo tự đổ mặc định (null / '' / 0).
export type LsxGroupInput = Partial<Omit<LsxGroup, 'id' | 'production_order_id'>> & {
  id?: string
}
export type LsxLineInput = Partial<
  Omit<LsxLine, 'id' | 'production_order_id' | 'group_id' | 'changed_in_rev'>
> & { id?: string }

const GROUP_COLS =
  'id, production_order_id, sales_order_id, title, buyer_name, po_no, ship_date, ship_label, note, sort_order'
const LINE_COLS =
  'id, production_order_id, group_id, product_id, sales_order_line_id, product_code, customer_item_code, name_foreign, name_vi, name_customs, barcode, unit, qty, packing, cbm, ship_date, ship_label, specs, checks, extras, note, important_note, image_file_id, sort_order, changed_in_rev'

const num = (v: unknown): number => Number(v ?? 0)
const obj = (v: unknown): Record<string, string> =>
  v && typeof v === 'object' ? (v as Record<string, string>) : {}

function unwrapLine(r: Record<string, unknown>): LsxLine {
  return {
    ...(r as unknown as LsxLine),
    qty: num(r.qty),
    cbm: r.cbm == null ? null : Number(r.cbm),
    specs: obj(r.specs),
    checks: obj(r.checks),
    extras: obj(r.extras),
  }
}

export const lsxLinesRepo = {
  async listGroups(lsxId: string): Promise<LsxGroup[]> {
    const { data } = await db()
      .from('production_order_groups')
      .select(GROUP_COLS)
      .eq('production_order_id', lsxId)
      .order('sort_order')
    return ((data ?? []) as unknown as LsxGroup[]).map((g) => ({
      ...g,
      sort_order: num(g.sort_order),
    }))
  },

  async listLines(lsxId: string): Promise<LsxLine[]> {
    const { data } = await db()
      .from('production_order_lines')
      .select(LINE_COLS)
      .eq('production_order_id', lsxId)
      .order('sort_order')
      .limit(5000)
    return ((data ?? []) as Record<string, unknown>[]).map(unwrapLine)
  },

  /** Dòng của nhiều lệnh — màn toàn cảnh/việc của tổ đọc một phát. */
  async listLinesBulk(lsxIds: string[]): Promise<LsxLine[]> {
    if (!lsxIds.length) return []
    const { data } = await db()
      .from('production_order_lines')
      .select(LINE_COLS)
      .in('production_order_id', lsxIds)
      .order('sort_order')
      .limit(20000)
    return ((data ?? []) as Record<string, unknown>[]).map(unwrapLine)
  },

  /**
   * Số dòng + tổng SL của NHIỀU lệnh — cột "Dòng SP / SL" ở danh sách lệnh,
   * một truy vấn cho cả bảng thay vì đọc dòng từng lệnh.
   */
  async summaryByLsx(
    lsxIds: string[],
  ): Promise<Map<string, { lines: number; qty: number }>> {
    const out = new Map<string, { lines: number; qty: number }>()
    if (!lsxIds.length) return out
    const { data } = await db()
      .from('production_order_lines')
      .select('production_order_id, qty')
      .in('production_order_id', lsxIds)
      .limit(20000)
    for (const r of (data ?? []) as { production_order_id: string; qty: number }[]) {
      const cur = out.get(r.production_order_id) ?? { lines: 0, qty: 0 }
      cur.lines += 1
      cur.qty += Number(r.qty) || 0
      out.set(r.production_order_id, cur)
    }
    return out
  },

  async findLine(id: string): Promise<LsxLine | null> {
    const { data } = await db()
      .from('production_order_lines')
      .select(LINE_COLS)
      .eq('id', id)
      .maybeSingle()
    return data ? unwrapLine(data as Record<string, unknown>) : null
  },

  /**
   * GHI ĐÈ trọn bộ nhóm + dòng của một lệnh (pattern editor như BOM).
   * Giữ nguyên `id` của nhóm/dòng client gửi lên → jobs/định hình đã gắn vào
   * dòng cũ KHÔNG bị đứt; dòng bị bỏ khỏi payload mới bị xoá (cascade kéo theo
   * job/định hình của nó — service phải chặn trước nếu dòng đã chạy).
   */
  async replaceAll(
    lsxId: string,
    groups: (LsxGroupInput & {
      lines: (LsxLineInput & { changed_in_rev?: number | null })[]
    })[],
  ): Promise<void> {
    const keepGroupIds: string[] = []
    const keepLineIds: string[] = []

    for (const [gi, g] of groups.entries()) {
      const groupRow = {
        production_order_id: lsxId,
        sales_order_id: g.sales_order_id ?? null,
        title: g.title ?? null,
        buyer_name: g.buyer_name ?? null,
        po_no: g.po_no ?? null,
        ship_date: g.ship_date ?? null,
        ship_label: g.ship_label ?? null,
        note: g.note ?? null,
        sort_order: gi,
      }
      let groupId = g.id
      if (groupId) {
        const { error } = await db()
          .from('production_order_groups')
          .update(groupRow)
          .eq('id', groupId)
        if (error) throw new Error(error.message)
      } else {
        const { data, error } = await db()
          .from('production_order_groups')
          .insert(groupRow)
          .select('id')
          .single()
        if (error || !data) throw new Error(error?.message ?? 'Insert nhóm lỗi')
        groupId = (data as { id: string }).id
      }
      keepGroupIds.push(groupId)

      for (const [li, l] of g.lines.entries()) {
        const lineRow = {
          production_order_id: lsxId,
          group_id: groupId,
          product_id: l.product_id ?? null,
          sales_order_line_id: l.sales_order_line_id ?? null,
          product_code: l.product_code ?? '',
          customer_item_code: l.customer_item_code ?? null,
          name_foreign: l.name_foreign ?? null,
          name_vi: l.name_vi ?? null,
          name_customs: l.name_customs ?? null,
          barcode: l.barcode ?? null,
          unit: l.unit ?? '',
          qty: l.qty ?? 0,
          packing: l.packing ?? null,
          cbm: l.cbm ?? null,
          ship_date: l.ship_date ?? null,
          ship_label: l.ship_label ?? null,
          specs: l.specs ?? {},
          checks: l.checks ?? {},
          extras: l.extras ?? {},
          note: l.note ?? null,
          important_note: l.important_note ?? null,
          image_file_id: l.image_file_id ?? null,
          sort_order: li,
          changed_in_rev: l.changed_in_rev ?? null,
        }
        if (l.id) {
          const { error } = await db()
            .from('production_order_lines')
            .update(lineRow)
            .eq('id', l.id)
          if (error) throw new Error(error.message)
          keepLineIds.push(l.id)
        } else {
          const { data, error } = await db()
            .from('production_order_lines')
            .insert(lineRow)
            .select('id')
            .single()
          if (error || !data) throw new Error(error?.message ?? 'Insert dòng lệnh lỗi')
          keepLineIds.push((data as { id: string }).id)
        }
      }
    }

    // Xoá phần không còn trong payload. Postgrest không có "not in ()" với mảng
    // rỗng → chỉ lọc khi có phần tử giữ lại.
    const delLines = db()
      .from('production_order_lines')
      .delete()
      .eq('production_order_id', lsxId)
    const { error: delLineErr } = keepLineIds.length
      ? await delLines.not('id', 'in', `(${keepLineIds.join(',')})`)
      : await delLines
    if (delLineErr) throw new Error(delLineErr.message)

    const delGroups = db()
      .from('production_order_groups')
      .delete()
      .eq('production_order_id', lsxId)
    const { error: delGroupErr } = keepGroupIds.length
      ? await delGroups.not('id', 'in', `(${keepGroupIds.join(',')})`)
      : await delGroups
    if (delGroupErr) throw new Error(delGroupErr.message)
  },

  /** Xoá nhóm (cascade kéo theo dòng, job và dòng định hình của nó). */
  async deleteGroups(groupIds: string[]): Promise<void> {
    if (!groupIds.length) return
    const { error } = await db()
      .from('production_order_groups')
      .delete()
      .in('id', groupIds)
    if (error) throw new Error(error.message)
  },

  /** Đánh dấu dòng vừa đổi ở bản phát lại (revision) — cho phiếu in tô vàng. */
  async markChanged(lineIds: string[], revision: number): Promise<void> {
    if (!lineIds.length) return
    const { error } = await db()
      .from('production_order_lines')
      .update({ changed_in_rev: revision })
      .in('id', lineIds)
    if (error) throw new Error(error.message)
  },
}
