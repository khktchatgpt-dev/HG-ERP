import { Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { poLineAmount } from '@/lib/po-line'
import { docQuyCach } from '@/lib/quy-cach-vat-tu'
import {
  goiYNcc,
  type DongLichSu,
  type NccTheoNhom,
  type UngVienNcc,
} from '@/lib/goi-y-ncc'
import { isSupplyStaff } from './suppliers.service'
import { keHoachMuaRepo, type ChonNccRow } from './ke-hoach-mua.repo'
import type { ChonNccDeleteInput, ChonNccUpsertInput } from './ke-hoach-mua.schema'

/** Một mã cần chọn NCC — chỉ thứ gợi ý cần biết. */
export type MaCanChon = {
  material_id: string
  material_name: string
  /** ĐVT mua của mã (danh mục). */
  unit: string
  sub_group: string | null
  group_name: string | null
  spec: string | null
}

export type NguonNccLenh = {
  /** Ứng viên đã xếp theo thứ tự gợi ý — phần tử đầu là gợi ý của máy. */
  goiY: Record<string, UngVienNcc[]>
  /** Khối lượng một ĐVT mua của mã (đổi đ/kg ↔ đ/cây). */
  kgMoiDv: Record<string, number | null>
  /** Lựa chọn đã lưu của lệnh (0275). */
  chon: (ChonNccRow & { supplier_name: string })[]
  /** Mọi NCC còn đặt hàng được — cho ô "NCC khác…" và gán hàng loạt. */
  nccs: { id: string; code: string | null; name: string }[]
}

async function assertCanEdit(user: User): Promise<void> {
  if (user.role === 'admin') return
  if (await isSupplyStaff(user)) return
  throw Forbidden('Chỉ phòng Cung ứng mới chọn NCC cho kế hoạch mua')
}

async function assertLsx(id: string): Promise<void> {
  if (!(await productionRepo.findById(id))) throw NotFound('Không tìm thấy lệnh sản xuất')
}

/**
 * KẾ HOẠCH MUA · BƯỚC 2 (22/10/2026) — gợi ý NCC + lựa chọn đã lưu.
 * Lịch sử đọc MỘT lần cho cả lệnh (≈700 dòng cả phòng), gợi ý tính bằng
 * `lib/goi-y-ncc` (thuần, có test).
 */
export const keHoachMuaService = {
  async nguonNcc(lsxId: string, mas: MaCanChon[]): Promise<NguonNccLenh> {
    const ids = mas.map((m) => m.material_id)
    const [dong, nccAll, kg, chon] = await Promise.all([
      keHoachMuaRepo.dongDonGiaChot(),
      keHoachMuaRepo.tenNcc(),
      keHoachMuaRepo.kgMoiDv(ids),
      keHoachMuaRepo.chonCuaLenh(lsxId),
    ])
    const ten = new Map(nccAll.map((s) => [s.id, s.name]))

    const lichSu: DongLichSu[] = dong
      .filter((l) => l.qty_ordered > 0)
      .map((l) => {
        const kimLoai = l.template === 'aluminium' || l.template === 'metal_kg'
        return {
          material_id: l.material_id,
          supplier_id: l.supplier_id,
          supplier_name: ten.get(l.supplier_id) ?? '—',
          po_code: l.po_code,
          at: l.at,
          qty: l.qty_ordered,
          amount: poLineAmount({
            ...l,
            price_basis: l.price_basis === 'unit2' ? 'unit2' : 'unit',
          }),
          kg: l.unit2 === 'kg' && l.qty2 ? l.qty2 : null,
          dv: l.dv,
          quyCach: kimLoai
            ? (docQuyCach(l.mat_name, [l.spec, l.finish].filter(Boolean).join(' '), l.group_name)?.key ?? null) // prettier-ignore
            : null,
        }
      })
      .filter((l) => l.amount > 0)

    // NCC theo tiểu nhóm (rơi về nhóm khi mã chưa chia tiểu nhóm) — đếm dòng.
    const theoNhom = new Map<string, Map<string, number>>()
    for (const l of dong) {
      const k = l.sub_group ?? l.group_name
      if (!k) continue
      const m = theoNhom.get(k) ?? new Map<string, number>()
      m.set(l.supplier_id, (m.get(l.supplier_id) ?? 0) + 1)
      theoNhom.set(k, m)
    }
    const nhomCua = (k: string | null): NccTheoNhom[] =>
      [...(theoNhom.get(k ?? '') ?? new Map<string, number>()).entries()].map(
        ([supplier_id, soLan]) => ({
          supplier_id,
          supplier_name: ten.get(supplier_id) ?? '—',
          soLan,
        }),
      )

    const goiY: Record<string, UngVienNcc[]> = {}
    for (const m of mas) {
      goiY[m.material_id] = goiYNcc(
        {
          material_id: m.material_id,
          quyCach: docQuyCach(m.material_name, m.spec, m.group_name)?.key ?? null,
          kgMoiDv: kg.get(m.material_id) ?? null,
          unit: m.unit,
        },
        lichSu,
        nhomCua(m.sub_group ?? m.group_name),
      )
    }
    return {
      goiY,
      kgMoiDv: Object.fromEntries(ids.map((id) => [id, kg.get(id) ?? null])),
      chon: chon.map((c) => ({ ...c, supplier_name: ten.get(c.supplier_id) ?? '—' })),
      nccs: nccAll
        .filter((s) => s.can_order)
        .map(({ id, code, name }) => ({ id, code, name })),
    }
  },

  async luuChon(user: User, input: ChonNccUpsertInput): Promise<void> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    // Cùng mã lặp trong payload → lấy dòng cuối (upsert không nhận trùng khoá).
    const byMat = new Map(input.rows.map((r) => [r.material_id, r]))
    await keHoachMuaRepo.upsertChon(
      input.production_order_id,
      [...byMat.values()].map((r) => ({
        material_id: r.material_id,
        supplier_id: r.supplier_id,
        price: r.price,
        price_basis: r.price_basis,
        note: r.note?.trim() ? r.note.trim() : null,
      })),
      user.id,
    )
  },

  async xoaChon(user: User, input: ChonNccDeleteInput): Promise<void> {
    await assertCanEdit(user)
    await assertLsx(input.production_order_id)
    await keHoachMuaRepo.xoaChon(input.production_order_id, input.material_ids)
  },
}
