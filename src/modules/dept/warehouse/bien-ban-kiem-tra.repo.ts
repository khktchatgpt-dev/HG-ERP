import { db } from '@/server/db'
import type { DongKiemTra } from '@/lib/bien-ban-kiem-tra'

/**
 * Dữ liệu cho bản in "Phiếu nhập kho kiêm biên bản kiểm tra đầu vào"
 * (`BienBanKiemTraSheet`). Chỉ ĐỌC — biên bản không ghi gì vào sổ.
 */

const ok = <T extends { error: { message: string } | null }>(r: T): T => {
  if (r.error) throw new Error(`bienBanKiemTra: ${r.error.message}`)
  return r
}
const one = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
const num = (v: unknown) => (v == null ? 0 : Number(v))

export type NccDon = {
  ncc: string | null
  ncc_tax_no: string | null
  ncc_address: string | null
  don: string[]
  lenh: string[]
}

type PoRow = {
  id: string
  code: string
  supplier: { name: string; tax_no: string | null; address: string | null } | null
  lsx: { code: string } | null
}

/** NCC (tên, MST, địa chỉ) + mã đơn + mã lệnh chính của các đơn mua. */
export async function nccCuaDon(poIds: string[]): Promise<NccDon> {
  if (poIds.length === 0)
    return { ncc: null, ncc_tax_no: null, ncc_address: null, don: [], lenh: [] }
  const { data } = ok(
    await db()
      .from('supply_purchase_orders')
      .select(
        // BẪY: hai FK sang production_orders — hint đích danh FK lệnh chính.
        'id, code, supplier:supply_suppliers(name, tax_no, address), lsx:production_orders!supply_purchase_orders_production_order_id_fkey(code)',
      )
      .in('id', poIds),
  )
  const rows = ((data ?? []) as Record<string, unknown>[]).map(
    (r) =>
      ({
        id: r.id as string,
        code: r.code as string,
        supplier: one(r.supplier as PoRow['supplier'] | PoRow['supplier'][]),
        lsx: one(r.lsx as PoRow['lsx'] | PoRow['lsx'][]),
      }) satisfies PoRow,
  )
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = poIds.map((id) => byId.get(id)).filter((r): r is PoRow => !!r)
  const sup = ordered.find((r) => r.supplier)?.supplier ?? null
  const tenNcc = [...new Set(ordered.map((r) => r.supplier?.name).filter(Boolean))]
  return {
    ncc: tenNcc.join('; ') || null,
    // Phiếu trải nhiều NCC (hiếm) thì MST/địa chỉ chỉ đúng một bên — để trống cho ghi tay.
    ncc_tax_no: tenNcc.length === 1 ? (sup?.tax_no ?? null) : null,
    ncc_address: tenNcc.length === 1 ? (sup?.address ?? null) : null,
    don: ordered.map((r) => r.code),
    lenh: [...new Set(ordered.map((r) => r.lsx?.code).filter((c): c is string => !!c))],
  }
}

/** Quy cách + nhóm của các mã vật tư (bản in cần, dòng sổ không giữ). */
export async function thongTinVatTu(
  ids: string[],
): Promise<Map<string, { spec: string | null; group: string | null }>> {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return new Map()
  const { data } = ok(
    await db().from('warehouse_materials').select('id, spec, group_name').in('id', uniq),
  )
  return new Map(
    (
      (data ?? []) as { id: string; spec: string | null; group_name: string | null }[]
    ).map((m) => [m.id, { spec: m.spec, group: m.group_name }]),
  )
}

/** Đơn mua của các dòng PO (theo thứ tự gặp). */
export async function donCuaDongPo(poLineIds: string[]): Promise<string[]> {
  const uniq = [...new Set(poLineIds)]
  if (uniq.length === 0) return []
  const { data } = ok(
    await db().from('supply_purchase_order_lines').select('id, po_id').in('id', uniq),
  )
  const byLine = new Map(((data ?? []) as { id: string; po_id: string }[]).map((r) => [r.id, r.po_id])) // prettier-ignore
  return [...new Set(uniq.map((id) => byLine.get(id)).filter((p): p is string => !!p))]
}

/**
 * Dòng còn chờ về của một đơn mua — bản in TRƯỚC khi ghi sổ (QC cầm ra xe).
 * SL = phần còn mở; dòng phí / chưa gắn mã vật tư không có gì để kiểm đếm.
 */
export async function dongConChoCuaDon(poId: string): Promise<DongKiemTra[]> {
  const { data } = ok(
    await db()
      .from('supply_po_line_status')
      .select('id, material_id, qty_open, spec, sort_order')
      .eq('po_id', poId)
      .gt('qty_open', 0)
      .not('material_id', 'is', null)
      .order('sort_order'),
  )
  const rows = (data ?? []) as {
    id: string
    material_id: string
    qty_open: unknown
    spec: string | null
  }[]
  if (rows.length === 0) return []
  const { data: mats } = ok(
    await db()
      .from('warehouse_materials')
      .select('id, code, name, unit, spec, group_name')
      .in('id', [...new Set(rows.map((r) => r.material_id))]),
  )
  const byId = new Map(
    (
      (mats ?? []) as {
        id: string
        code: string
        name: string
        unit: string
        spec: string | null
        group_name: string | null
      }[]
    ).map((m) => [m.id, m]),
  )
  return rows.map((r) => {
    const m = byId.get(r.material_id)
    return {
      id: r.id,
      code: m?.code ?? '',
      name: m?.name ?? '',
      // Quy cách trên dòng đơn đúng lô này hơn quy cách chung của mã.
      spec: r.spec ?? m?.spec ?? null,
      group: m?.group_name ?? null,
      unit: m?.unit ?? '',
      qty_doc: num(r.qty_open),
      qty: null,
    }
  })
}
