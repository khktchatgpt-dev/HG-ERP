import { db } from '@/server/db'
import { dotCuaPhieu, gopMa, type NhapCho } from '@/lib/phieu-nhap-cho'

const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// Mọi truy vấn đều kiểm lỗi: lỗi embed (FK mơ hồ…) mà nuốt thì bản in câm
// lặng mất khối "Nhập cho" và không ai biết vì sao.
const ok = <T extends { error: { message: string } | null }>(r: T): T => {
  if (r.error) throw new Error(r.error.message)
  return r
}

/**
 * NHẬP CHO của một phiếu nhập (04/10/2026) — đọc ngược từ dòng sổ:
 * `po_line_id` → đơn mua → NCC + lệnh chính + lệnh gom (0125); lệnh ghi thẳng
 * trên dòng (hoàn kho từ SX) cộng vào; đợt giao từ `warehouse_docs.shipment_id`.
 *
 * Gom theo lô, không hỏi từng dòng. Phiếu ngoài đơn, không lệnh → null.
 */
export async function loadNhapCho(
  docId: string,
  lines: { po_line_id: string | null; production_order_id: string | null }[],
): Promise<NhapCho | null> {
  const lineIds = gopMa(lines.map((l) => l.po_line_id))
  const mvLsxIds = gopMa(lines.map((l) => l.production_order_id))
  if (lineIds.length === 0 && mvLsxIds.length === 0) return null

  const [{ data: doc }, { data: poLines }, { data: mvLsx }] = (
    await Promise.all([
      db().from('warehouse_docs').select('shipment_id').eq('id', docId).maybeSingle(),
      lineIds.length
        ? db().from('supply_purchase_order_lines').select('id, po_id').in('id', lineIds)
        : Promise.resolve({ data: [], error: null }),
      mvLsxIds.length
        ? db().from('production_orders').select('id, code').in('id', mvLsxIds)
        : Promise.resolve({ data: [], error: null }),
    ])
  ).map(ok)
  const poIds = gopMa(((poLines ?? []) as { po_id: string }[]).map((l) => l.po_id))

  const rong = Promise.resolve({ data: [], error: null })
  const [{ data: pos }, { data: extra }, { data: dots }] = (
    await Promise.all([
      poIds.length
        ? db()
            .from('supply_purchase_orders')
            .select(
              // BẪY: hai FK sang production_orders — hint đích danh FK lệnh chính.
              'id, code, supplier:supply_suppliers(name), lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)',
            )
            .in('id', poIds)
        : rong,
      poIds.length
        ? db()
            .from('supply_po_extra_lsx')
            .select('po_id, lsx:production_orders(code)')
            .in('po_id', poIds)
        : rong,
      poIds.length
        ? db()
            .from('supply_po_shipments')
            .select('id, po_id, seq, expected_date')
            .in('po_id', poIds)
        : rong,
    ])
  ).map(ok)

  type PoRow = {
    id: string
    code: string
    supplier: { name: string } | { name: string }[] | null
    lsx: { code: string } | { code: string }[] | null
  }
  // Giữ thứ tự xuất hiện của dòng sổ — đơn đầu tiên trên phiếu đứng đầu.
  const poById = new Map(((pos ?? []) as PoRow[]).map((p) => [p.id, p]))
  const poRows = poIds.map((id) => poById.get(id)).filter((p): p is PoRow => !!p)
  const extraRows = (extra ?? []) as {
    po_id: string
    lsx: { code: string } | { code: string }[] | null
  }[]
  const dotRows = (dots ?? []) as {
    id: string
    po_id: string
    seq: number
    expected_date: string
  }[]

  const shipmentId = (doc as { shipment_id: string | null } | null)?.shipment_id ?? null
  const dot = shipmentId ? (dotRows.find((d) => d.id === shipmentId) ?? null) : null
  const tongDot = dotRows.filter((d) => d.po_id === (dot?.po_id ?? poRows[0]?.id)).length

  return {
    ncc: gopMa(poRows.map((p) => one(p.supplier)?.name)),
    don: gopMa(poRows.map((p) => p.code)),
    lenh: gopMa([
      ...poRows.flatMap((p) => [
        one(p.lsx)?.code,
        ...extraRows.filter((e) => e.po_id === p.id).map((e) => one(e.lsx)?.code),
      ]),
      ...((mvLsx ?? []) as { code: string }[]).map((l) => l.code),
    ]),
    // Phiếu trải nhiều đơn (hiếm) thì "ngoài đợt" của đơn đầu là sai nghĩa — bỏ dòng.
    dot: poRows.length > 1 && !dot ? null : dotCuaPhieu(dot, tongDot),
  }
}
