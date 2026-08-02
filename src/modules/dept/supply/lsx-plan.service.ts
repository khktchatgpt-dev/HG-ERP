import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'
import { isPoTemplate, type PoTemplate } from '@/lib/po-template'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxPlanRepo, type PlanInsert, type PlanRow } from './lsx-plan.repo'
import { normalizeRow, statusFromLabel } from './lsx-plan.calc'
import type { PlanRowInput } from './lsx-plan.schema'
import { posService } from './pos.service'
import { posRepo } from './pos.repo'

/**
 * BẢNG KÊ VẬT TƯ THEO LSX → TÁCH ĐƠN THEO NCC.
 *
 * Mô hình lấy từ cách phòng Cung ứng đang làm trên Excel: một sheet BKVT cho cả
 * lệnh (nhiều SP, mỗi dòng mang `Mã SP` + `đm/sp`), cột NCC gán trên từng dòng,
 * rồi lọc theo cột đó ra 7–8 đơn. Trước đây app bắt soạn tay từng đơn một.
 */

/** Chuẩn hoá tên vật tư để dò danh mục kho: bỏ dấu, gộp khoảng trắng, bỏ dấu câu. */
function matchKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Đọc TOÀN BỘ danh mục vật tư theo trang.
 *
 * PostgREST chặn cứng 1000 dòng mỗi request — `.limit(5000)` vẫn chỉ trả 1000 và
 * KHÔNG báo lỗi. Danh mục đang 1.351 vật tư nên toàn bộ nhóm ngũ kim (mã NK-*,
 * nạp sau cùng) rơi ra ngoài, và mọi dòng bảng kê đều "chưa khớp danh mục kho"
 * dù vật tư có thật.
 */
async function listAllMaterials(): Promise<{ id: string; name: string }[]> {
  const PAGE = 1000
  const out: { id: string; name: string }[] = []
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('id, name')
      .eq('is_active', true)
      .order('code')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data as { id: string; name: string }[] | null) ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Dò vật tư kho theo TÊN (file BKVT không có mã vật tư). Không đoán mờ. */
async function matchMaterials(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (names.length === 0) return out
  for (const m of await listAllMaterials()) {
    const k = matchKey(m.name)
    if (!out.has(k)) out.set(k, m.id)
  }
  const res = new Map<string, string>()
  const all = [...out.entries()]
  for (const n of names) {
    const k = matchKey(n)
    let id = out.get(k)
    if (!id) {
      /*
       * Nới MỘT nấc: danh mục kho hay ghi thêm màu/đơn vị ở đuôi so với bảng kê
       * ("Nút nhựa vuông 76" ↔ "Nút nhựa vuông 76 đen", "LĐN 6x16x2" ↔
       * "LĐN 6x16x2 đen"). Chỉ nhận khi CHỈ CÓ MỘT ứng viên — nhiều ứng viên
       * nghĩa là khác màu/khác cỡ thật, đoán bừa là đặt nhầm hàng.
       */
      const hits = all.filter(([mk]) => mk.startsWith(`${k} `) || k.startsWith(`${mk} `))
      if (hits.length === 1) id = hits[0][1]
    }
    if (id) res.set(n, id)
  }
  return res
}

/** Dò NCC theo MÃ VIẾT TẮT trên đơn (TTL, MT, TW…) rồi tới tên. */
async function matchSuppliers(labels: string[]): Promise<Map<string, string>> {
  const res = new Map<string, string>()
  if (labels.length === 0) return res
  const { data } = await db()
    .from('supply_suppliers')
    .select('id, code, name, short_name')
    .eq('is_active', true)
    .limit(2000)
  const rows =
    (data as
      | { id: string; code: string | null; name: string; short_name: string | null }[]
      | null) ?? []
  for (const label of labels) {
    const k = matchKey(label)
    const hit =
      rows.find((s) => s.code && matchKey(s.code) === k) ??
      rows.find((s) => s.short_name && matchKey(s.short_name) === k) ??
      rows.find((s) => matchKey(s.name).includes(k) && k.length >= 3)
    if (hit) res.set(label, hit.id)
  }
  return res
}

/** Dòng đủ điều kiện vào đơn: đã gán NCC, khớp vật tư kho, còn số phải mua. */
function orderable(r: PlanRow): boolean {
  return (
    r.status === 'assigned' &&
    !!r.supplier_id &&
    !!r.material_id &&
    !r.po_line_id &&
    r.qty_to_order > 0
  )
}

/**
 * Mẫu đơn cho nhóm dòng của một NCC: lấy mẫu chiếm đa số trong các vật tư đã
 * khai. Không khai gì thì 'accessory' — BKVT là bảng kê phụ kiện/ngũ kim, mẫu
 * phụ kiện có sẵn đúng bộ cột đm/sp · SL · tồn · hao.
 */
function pickTemplate(rows: PlanRow[]): PoTemplate {
  const count = new Map<PoTemplate, number>()
  for (const r of rows) {
    if (isPoTemplate(r.material_template)) {
      count.set(r.material_template, (count.get(r.material_template) ?? 0) + 1)
    }
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]
  return top?.[0] ?? 'accessory'
}

export const lsxPlanService = {
  /** Đọc: mọi nhân viên đã đăng nhập (Kho/Kế toán cũng cần tra bảng kê). */
  async list(_user: User, productionOrderId: string): Promise<PlanRow[]> {
    return lsxPlanRepo.listByLsx(productionOrderId)
  },

  /**
   * Nạp bảng kê. `replace` = thay hết dòng cùng nguồn (nạp lại file đã sửa) —
   * dòng đã vào đơn được giữ lại, đơn đang chạy còn trỏ vào nó.
   *
   * Tự dò vật tư theo tên và NCC theo mã viết tắt. KHÔNG khớp thì vẫn nạp dòng
   * (material_id null) — bỏ dòng nghĩa là quên mua.
   */
  async importRows(
    user: User,
    input: {
      production_order_id: string
      source: 'excel' | 'bom' | 'manual'
      replace: boolean
      rows: PlanRowInput[]
    },
  ): Promise<{ inserted: number; matched_material: number; matched_supplier: number }> {
    await assertAction(user, 'supply.po.manage')
    const lsx = await productionRepo.findById(input.production_order_id)
    if (!lsx) throw NotFound('LSX không tồn tại')

    const mats = await matchMaterials(
      [...new Set(input.rows.map((r) => r.material_name))].filter(Boolean),
    )
    const sups = await matchSuppliers([
      ...new Set(input.rows.map((r) => r.supplier_label ?? '').filter(Boolean)),
    ])

    let matchedMaterial = 0
    let matchedSupplier = 0
    const toInsert: PlanInsert[] = input.rows.map((raw) => {
      const row = normalizeRow(raw)
      const materialId = row.material_id ?? mats.get(row.material_name) ?? null
      if (materialId) matchedMaterial++
      const supplierId = row.supplier_id ?? sups.get(row.supplier_label ?? '') ?? null
      if (supplierId) matchedSupplier++
      // Mã trong cột NCC có thể là "xưởng tự làm"/"tồn đủ"/"hàng TQ" — dòng đã
      // quyết nhưng không sinh đơn.
      const special = statusFromLabel(row.supplier_label)
      return {
        production_order_id: input.production_order_id,
        product_id: row.product_id ?? null,
        product_code: row.product_code ?? null,
        product_name: row.product_name ?? null,
        material_id: materialId,
        material_name: row.material_name,
        unit: row.unit ?? null,
        qty_per_product: row.qty_per_product ?? null,
        product_qty: row.product_qty ?? null,
        qty_required: row.qty_required,
        waste_pct: row.waste_pct,
        qty_on_hand: row.qty_on_hand ?? null,
        qty_to_order: row.qty_to_order,
        unit_price: row.unit_price ?? null,
        supplier_id: supplierId,
        supplier_label: row.supplier_label ?? null,
        status: row.status ?? special ?? (supplierId ? 'assigned' : 'pending'),
        note: row.note ?? null,
        source: input.source,
        created_by: user.id,
      }
    })

    if (input.replace) {
      await lsxPlanRepo.deleteBySource(input.production_order_id, input.source)
    }
    const inserted = await lsxPlanRepo.insertMany(toInsert)
    return {
      inserted,
      matched_material: matchedMaterial,
      matched_supplier: matchedSupplier,
    }
  },

  /** Gán NCC / sửa số hàng loạt. Gán NCC thì trạng thái tự về 'assigned'. */
  async assign(
    user: User,
    input: {
      ids: string[]
      supplier_id?: string | null
      material_id?: string | null
      status?: PlanRow['status']
      waste_pct?: number | null
      qty_to_order?: number | null
      unit_price?: number | null
      note?: string | null
    },
  ): Promise<number> {
    await assertAction(user, 'supply.po.manage')
    const rows = await lsxPlanRepo.byIds(input.ids)
    if (rows.length === 0) throw NotFound('Không tìm thấy dòng nào')
    const locked = rows.filter((r) => r.po_line_id)
    if (locked.length > 0) {
      throw BadRequest(
        `${locked.length} dòng đã vào đơn — sửa trên đơn hoặc huỷ đơn trước`,
      )
    }

    const patch: Parameters<typeof lsxPlanRepo.updateMany>[1] = { updated_by: user.id }
    if (input.supplier_id !== undefined) {
      patch.supplier_id = input.supplier_id
      // Gán NCC = quyết định mua của dòng; bỏ gán thì quay lại "chưa quyết".
      patch.status = input.supplier_id ? 'assigned' : 'pending'
    }
    if (input.status !== undefined) patch.status = input.status
    if (input.material_id !== undefined) patch.material_id = input.material_id
    if (input.waste_pct != null) patch.waste_pct = input.waste_pct
    if (input.qty_to_order != null) patch.qty_to_order = input.qty_to_order
    if (input.unit_price != null) patch.unit_price = input.unit_price
    if (input.note != null) patch.note = input.note

    await lsxPlanRepo.updateMany(
      rows.map((r) => r.id),
      patch,
    )
    return rows.length
  },

  /**
   * TÁCH ĐƠN: mỗi NCC một đơn đặt, gắn LSX.
   *
   * Gộp dòng theo VẬT TƯ trước khi tạo: cùng một con vít dùng cho 3 sản phẩm là
   * 3 dòng bảng kê nhưng phải là MỘT dòng đơn (`poCreateSchema` cũng chặn trùng
   * vật tư). Ghi chú dòng đơn giữ vết từng SP để người nhận hàng còn đối chiếu.
   */
  async split(
    user: User,
    input: {
      production_order_id: string
      supplier_ids?: string[]
      expected_at?: string | null
      currency: string
    },
  ): Promise<{ supplier_id: string; po_id: string; code: string; lines: number }[]> {
    await assertAction(user, 'supply.po.manage')
    const all = await lsxPlanRepo.listByLsx(input.production_order_id)
    const rows = all.filter(
      (r) =>
        orderable(r) &&
        (!input.supplier_ids?.length || input.supplier_ids.includes(r.supplier_id!)),
    )
    if (rows.length === 0) {
      throw BadRequest(
        'Không có dòng nào để tách: dòng phải đã gán NCC, khớp vật tư kho và còn SL cần đặt',
      )
    }

    const bySupplier = new Map<string, PlanRow[]>()
    for (const r of rows) {
      const list = bySupplier.get(r.supplier_id!) ?? []
      list.push(r)
      bySupplier.set(r.supplier_id!, list)
    }

    /*
     * MỘT LƯỢT TÁCH = N ĐƠN CHẠY SONG SONG.
     *
     * UAT 01/08: tách 6 đơn tuần tự mất ~13 giây — mỗi vòng phải tra NCC, tra
     * LSX, sinh mã, insert, gọi danh sách người duyệt rồi notify, xong mới update
     * từng vật tư một. Không có ràng buộc nào bắt xếp hàng: `next_doc_code()` là
     * một câu upsert nguyên tử (`0011_catalogs.sql`) nên hai đơn xin mã cùng lúc
     * vẫn ra hai số khác nhau.
     *
     * Đánh đổi: SỐ đơn giữa các NCC không còn theo thứ tự nhóm — cùng một lượt
     * bấm thì thứ tự đó vốn không mang nghĩa gì. Một NCC lỗi vẫn để lại đơn của
     * các NCC khác (y như bản tuần tự), nhưng dòng bảng kê chỉ đổi trạng thái sau
     * khi đơn của chính nó tạo xong nên không có nhóm nào "đã vào đơn" mà thiếu đơn.
     */
    const out = await Promise.all(
      [...bySupplier.entries()].map(async ([supplierId, group]) => {
        const byMaterial = new Map<string, PlanRow[]>()
        for (const r of group) {
          const list = byMaterial.get(r.material_id!) ?? []
          list.push(r)
          byMaterial.set(r.material_id!, list)
        }

        const lines = [...byMaterial.entries()].map(([materialId, rs]) => {
          const first = rs[0]
          return {
            material_id: materialId,
            qty_ordered: rs.reduce((s, r) => s + r.qty_to_order, 0),
            unit_price: rs.find((r) => r.unit_price != null)?.unit_price ?? null,
            // Gộp mã SP của mọi dòng dồn vào đây — dòng đơn mua chung cho nhiều SP
            // vẫn chỉ ra được nó phục vụ những sản phẩm nào (cùng quy ước " · " với
            // ô "Mã SP" trên form soạn đơn).
            product_code:
              [...new Set(rs.map((r) => r.product_code).filter(Boolean))]
                .join(' · ')
                .slice(0, 200) || null,
            dm_per_sp: rs.length === 1 ? first.qty_per_product : null,
            qty_demand: rs.reduce((s, r) => s + r.qty_required, 0),
            qty_on_hand: first.qty_on_hand,
            waste_pct: first.waste_pct,
            // Vết truy nguồn: "Bàn Santorin (4/sp) · XC Keros (2/sp)".
            note:
              rs
                .map((r) =>
                  [
                    r.product_name ?? r.product_code,
                    r.qty_per_product && `(${r.qty_per_product}/sp)`,
                  ]
                    .filter(Boolean)
                    .join(' '),
                )
                .filter(Boolean)
                .join(' · ')
                .slice(0, 500) || null,
          }
        })

        const po = await posService.create(user, {
          production_order_id: input.production_order_id,
          supplier_id: supplierId,
          template: pickTemplate(group),
          currency: input.currency,
          price_includes_vat: false,
          expected_at: input.expected_at ?? null,
          note: `Tách từ bảng kê vật tư của lệnh sản xuất`,
          lines,
        })

        // Gắn dòng bảng kê vào đúng dòng đơn vừa tạo — sau này sửa/huỷ còn lần ra.
        // Mỗi vật tư một câu update (po_line_id khác nhau nên không gộp `.in()`
        // được), nhưng bắn cùng lúc: 20 dòng đơn từng là 20 lượt đi-về nối đuôi.
        const poLines = await posRepo.listLines(po.id)
        const lineByMaterial = new Map(poLines.map((l) => [l.material_id, l.id]))
        await Promise.all(
          [...byMaterial.entries()].map(([materialId, rs]) =>
            lsxPlanRepo.updateMany(
              rs.map((r) => r.id),
              {
                status: 'ordered',
                po_line_id: lineByMaterial.get(materialId) ?? null,
                updated_by: user.id,
              },
            ),
          ),
        )
        return {
          supplier_id: supplierId,
          po_id: po.id,
          code: po.code,
          lines: lines.length,
        }
      }),
    )
    return out
  },
}
