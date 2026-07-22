import {
  pricesRepo,
  type LastPurchase,
  type SupplierPrice,
  type SupplierPriceWithRefs,
} from './prices.repo'
import { suppliersRepo } from './supply.repo'
import { isSupplyStaff } from './suppliers.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/**
 * Giá HIỆN HÀNH per (NCC, vật tư) = bản ghi valid_from lớn nhất ≤ onDate.
 * Pure — có test (logic tiền theo quy định repo). Bỏ giá tương lai.
 */
export function pickCurrentPrices<
  T extends { supplier_id: string; material_id: string; valid_from: string },
>(rows: T[], onDate: string): T[] {
  const best = new Map<string, T>()
  for (const r of rows) {
    if (r.valid_from > onDate) continue
    const k = `${r.supplier_id}:${r.material_id}`
    const cur = best.get(k)
    if (!cur || r.valid_from > cur.valid_from) best.set(k, r)
  }
  return [...best.values()]
}

/** 1 vật tư trong màn so giá: giá chào hiện hành các NCC + giá mua gần nhất. */
export type PriceCompareEntry = {
  material_id: string
  offers: Array<
    Pick<
      SupplierPriceWithRefs,
      'supplier_id' | 'supplier_name' | 'price' | 'currency' | 'valid_from' | 'note'
    >
  >
  last_purchase: Omit<LastPurchase, 'material_id'> | null
}

export const pricesService = {
  /** Đọc: mọi NV đã đăng nhập (Kế toán/GĐ tra giá). */
  async list(
    _user: User,
    filter: { supplier_id?: string; material_id?: string },
  ): Promise<SupplierPriceWithRefs[]> {
    return pricesRepo.list(filter)
  },

  async create(
    user: User,
    input: {
      supplier_id: string
      material_id: string
      price: number
      currency: string
      valid_from?: string
      note?: string | null
    },
  ): Promise<SupplierPrice> {
    if (!(await isSupplyStaff(user))) {
      throw Forbidden('Chỉ phòng Kế hoạch - Cung ứng quản lý bảng giá NCC')
    }
    const supplier = await suppliersRepo.findById(input.supplier_id)
    if (!supplier) throw NotFound('NCC không tồn tại')
    if (!supplier.is_active) throw BadRequest('NCC đã ngừng giao dịch')

    const { price, duplicate } = await pricesRepo.insert({
      supplier_id: input.supplier_id,
      material_id: input.material_id,
      price: input.price,
      currency: input.currency,
      valid_from: input.valid_from ?? new Date().toISOString().slice(0, 10),
      note: input.note ?? null,
      created_by: user.id,
    })
    if (duplicate || !price) {
      throw Conflict(
        'NCC này đã có giá cho vật tư này từ đúng ngày này — sửa bản ghi cũ hoặc chọn ngày khác',
        'PRICE_EXISTS',
      )
    }
    return price
  },

  /**
   * Nhập BÁO GIÁ hàng loạt: 1 NCC + 1 ngày hiệu lực + nhiều dòng giá → upsert
   * vào bảng giá (trùng ngày = cập nhật đè). Trả số dòng đã ghi.
   */
  async bulkCreate(
    user: User,
    input: {
      supplier_id: string
      currency: string
      valid_from?: string
      lines: Array<{ material_id: string; price: number; note?: string | null }>
    },
  ): Promise<{ count: number }> {
    if (!(await isSupplyStaff(user))) {
      throw Forbidden('Chỉ phòng Kế hoạch - Cung ứng quản lý bảng giá NCC')
    }
    const supplier = await suppliersRepo.findById(input.supplier_id)
    if (!supplier) throw NotFound('NCC không tồn tại')
    if (!supplier.is_active) throw BadRequest('NCC đã ngừng giao dịch')

    const valid_from = input.valid_from ?? new Date().toISOString().slice(0, 10)
    const count = await pricesRepo.bulkUpsert(
      input.lines.map((l) => ({
        supplier_id: input.supplier_id,
        material_id: l.material_id,
        price: l.price,
        currency: input.currency,
        valid_from,
        note: l.note ?? null,
        created_by: user.id,
      })),
    )
    return { count }
  },

  async update(
    user: User,
    id: string,
    patch: {
      price?: number
      currency?: string
      valid_from?: string
      note?: string | null
    },
  ): Promise<SupplierPrice> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await pricesRepo.findById(id)
    if (!before) throw NotFound('Bản ghi giá không tồn tại')
    return pricesRepo.patch(id, patch)
  },

  async remove(user: User, id: string): Promise<void> {
    if (!(await isSupplyStaff(user))) throw Forbidden()
    const before = await pricesRepo.findById(id)
    if (!before) throw NotFound('Bản ghi giá không tồn tại')
    await pricesRepo.remove(id)
  },

  /**
   * So giá cho form tạo PO (FR-SUP-06): per vật tư — giá chào hiện hành của
   * từng NCC còn giao dịch (sort rẻ trước, KHÔNG quy đổi khác tiền tệ) + giá
   * mua gần nhất từ PO thật.
   */
  async compare(_user: User, materialIds: string[]): Promise<PriceCompareEntry[]> {
    const today = new Date().toISOString().slice(0, 10)
    const [effective, purchases] = await Promise.all([
      pricesRepo.listEffective(materialIds, today),
      pricesRepo.lastPurchases(materialIds),
    ])
    const offers = pickCurrentPrices(effective, today).filter((o) => o.supplier_active)
    const lastByMaterial = new Map(purchases.map((p) => [p.material_id, p]))

    return materialIds.map((material_id) => {
      const mine = offers
        .filter((o) => o.material_id === material_id)
        .sort((a, b) =>
          a.currency === b.currency
            ? a.price - b.price
            : a.currency.localeCompare(b.currency),
        )
        .map((o) => ({
          supplier_id: o.supplier_id,
          supplier_name: o.supplier_name,
          price: o.price,
          currency: o.currency,
          valid_from: o.valid_from,
          note: o.note,
        }))
      const lp = lastByMaterial.get(material_id)
      return {
        material_id,
        offers: mine,
        last_purchase: lp
          ? {
              unit_price: lp.unit_price,
              currency: lp.currency,
              po_code: lp.po_code,
              supplier_name: lp.supplier_name,
              at: lp.at,
            }
          : null,
      }
    })
  },
}
