import { db } from '@/server/db'
import type { DotMo } from '@/lib/kho-hang-ve'

/**
 * Nguồn cột "Đợt" của màn Kho › Hàng về (Kho đợt 2 · Bước 1, 12/10/2026).
 *
 * Đặt ở module Kho chứ không chen vào `po-shipments.repo` của Cung ứng: đây là
 * câu hỏi của THỦ KHO ("xe kế tiếp chở gì, đợt nào đã nhập trước"), hai truy vấn
 * gộp cho cả tập đơn đang về thay vì `listByPo` từng đơn (N+1).
 *
 * Mọi truy vấn kiểm `error` và ném: lỗi bị nuốt thì cột Đợt im lặng thành
 * "chưa chia đợt" trên mọi dòng — đúng kiểu màn rỗng câm đã dính ở Đã về (01/10).
 */
export const hangVeRepo = {
  /** Đợt CÒN MỞ (planned/arrived) theo đơn + số đợt còn sống (trừ huỷ) làm mẫu số. */
  async dotMoTheoDon(
    poIds: string[],
  ): Promise<Map<string, { dots: DotMo[]; so_dot: number }>> {
    const out = new Map<string, { dots: DotMo[]; so_dot: number }>()
    if (poIds.length === 0) return out
    const { data, error } = await db()
      .from('supply_po_shipments')
      .select('id, po_id, seq, expected_date, status')
      .in('po_id', poIds)
      .neq('status', 'cancelled')
      .limit(5000)
    if (error) throw new Error(`hangVeRepo.dotMoTheoDon: ${error.message}`)
    const rows = (data ?? []) as {
      id: string
      po_id: string
      seq: number
      expected_date: string
      status: string
    }[]
    const mo = rows.filter((r) => r.status === 'planned' || r.status === 'arrived')
    const linesBy = new Map<string, string[]>()
    if (mo.length > 0) {
      const { data: ls, error: e2 } = await db()
        .from('supply_po_shipment_lines')
        .select('shipment_id, po_line_id')
        .in(
          'shipment_id',
          mo.map((r) => r.id),
        )
        .limit(10000)
      if (e2) throw new Error(`hangVeRepo.dotMoTheoDon lines: ${e2.message}`)
      for (const l of (ls ?? []) as { shipment_id: string; po_line_id: string }[])
        linesBy.set(l.shipment_id, [...(linesBy.get(l.shipment_id) ?? []), l.po_line_id])
    }
    for (const r of rows) {
      const cur = out.get(r.po_id) ?? { dots: [], so_dot: 0 }
      cur.so_dot++
      if (r.status === 'planned' || r.status === 'arrived')
        cur.dots.push({
          id: r.id,
          seq: r.seq,
          date: r.expected_date.slice(0, 10),
          arrived: r.status === 'arrived',
          line_ids: linesBy.get(r.id) ?? [],
        })
      out.set(r.po_id, cur)
    }
    return out
  },

  /**
   * Số sự cố giao hàng CÒN MỞ theo đơn (sổ 0213) — nhãn "N sự cố" trên dòng Hàng
   * về: lô đang chờ Cung ứng xử lý với NCC, thủ kho khỏi nhận nhầm (Bước 3).
   */
  async suCoMoTheoDon(poIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (poIds.length === 0) return out
    const { data, error } = await db()
      .from('supply_po_issues')
      .select('po_id')
      .in('po_id', poIds)
      .eq('status', 'mo')
      .limit(5000)
    if (error) throw new Error(`hangVeRepo.suCoMoTheoDon: ${error.message}`)
    for (const r of (data ?? []) as { po_id: string }[])
      out.set(r.po_id, (out.get(r.po_id) ?? 0) + 1)
    return out
  },

  /** Phần CÒN CHỜ (`qty_open`, 0154) theo dòng đơn — chốt thiếu đếm là xong. */
  async lineOpenByPoIds(poIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (poIds.length === 0) return out
    const { data, error } = await db()
      .from('supply_po_line_status')
      .select('id, qty_open')
      .in('po_id', poIds)
      .limit(10000)
    if (error) throw new Error(`hangVeRepo.lineOpenByPoIds: ${error.message}`)
    for (const r of (data ?? []) as { id: string; qty_open: unknown }[])
      out.set(r.id, Number(r.qty_open ?? 0))
    return out
  },
}
