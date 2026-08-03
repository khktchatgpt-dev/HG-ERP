import { materialsRepo, type Material } from './warehouse.repo'
import { type User } from '@/modules/core/users/users.repo'
import { hasPermission, assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { Conflict, Forbidden, NotFound } from '@/server/http'
import { type PoTemplate } from '@/lib/po-template'
import { MIN_KEY_LEN, prefixForGroup, sureKey } from '@/lib/material-key'
import { invalidateTaxonomy } from './taxonomy.service'
import { normalizeUnit } from '@/lib/unit'

// Phase 2 RBAC: guard đọc thẳng permission (bỏ hardcode tên phòng).
async function isWarehouseUser(user: User): Promise<boolean> {
  return hasPermission(user, 'warehouse.member')
}

/**
 * Xem chéo phòng ban: workspace Kho có openView (workspaces/access.ts) — mọi NV
 * đã đăng nhập xem được vật tư/tồn/phiếu (Sales tra tồn khi báo giá, Cung ứng
 * theo dõi hàng về theo PO). Ghi vẫn khoá phòng Kho ở các mutation bên dưới.
 * Giữ hàm này làm một điểm siết duy nhất nếu sau này cần thu hẹp lại.
 */
async function canViewWarehouse(user: User): Promise<boolean> {
  void user // giữ nguyên chữ ký để sau này siết lại theo user không phải sửa caller
  return true
}

type CreateInput = {
  /** Bỏ trống → server tự cấp theo nhóm (xem `nextCode`). */
  code?: string | null
  name: string
  unit: string
  barcode?: string | null
  spec?: string | null
  price_unit?: string | null
  unit2_factor?: number | null
  group_name?: string | null
  sub_group?: string | null
  min_stock: number
  max_stock?: number | null
  reorder_point?: number | null
  reorder_qty?: number | null
  shelf_location?: string | null
  vat_rate?: number | null
  default_supplier_id?: string | null
  last_purchase_price?: number | null
  po_template?: PoTemplate | null
  kg_per_m?: number | null
  /** kg mỗi đơn vị đặt (0112) — hàng tấm/cuộn khai thẳng. */
  kg_per_unit?: number | null
  default_bar_length_m?: number | null
  note?: string | null
}

type UpdateInput = Partial<CreateInput & { is_active: boolean }>

/**
 * Chia chủ quyền danh mục (1 danh mục chung — mô hình "view" của Material Master):
 * Cung ứng (không thuộc Kho) chỉ sửa được trường NỀN + MUA HÀNG; trường TỒN TRỮ
 * (min_stock, kệ, barcode, ngừng dùng) do Kho quản. Kho sửa được tất cả như cũ.
 */
const PURCHASING_EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  // nền
  'code',
  'name',
  'unit',
  'spec',
  'group_name',
  'sub_group',
  'note',
  // mua hàng
  'conversion_profile',
  'price_unit',
  'unit2_factor',
  'vat_rate',
  'default_supplier_id',
  'last_purchase_price',
  // Mẫu đơn + thông số quy đổi nhôm: quyết định BỘ CỘT và CÁCH TÍNH TIỀN khi
  // soạn đơn — việc của Cung ứng, không phải của Kho.
  'po_template',
  'kg_per_m',
  'default_bar_length_m',
])

/**
 * Cấp mã kế tiếp cho nhóm: `NK-0125`.
 *
 * Tiền tố lấy theo ĐA SỐ mã đang dùng trong nhóm; nhóm chưa có mã nào (hoặc mã
 * cũ không theo quy ước) thì tra bảng theo tên nhóm; không khớp gì thì `VT`.
 * Số thì đếm TOÀN DANH MỤC theo tiền tố — hai nhóm cùng tiền tố mà đếm riêng là
 * đụng mã nhau.
 */
async function nextCode(
  group: string | null,
  siblings: { code: string }[],
): Promise<string> {
  const count = new Map<string, number>()
  for (const m of siblings) {
    const hit = m.code?.match(/^([A-Z]{2,3})-\d+$/)
    if (hit) count.set(hit[1], (count.get(hit[1]) ?? 0) + 1)
  }
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const prefix = top ?? prefixForGroup(group) ?? 'VT'
  const no = await materialsRepo.maxCodeNo(prefix)
  return `${prefix}-${String(no + 1).padStart(4, '0')}`
}

export const materialsService = {
  async list(
    user: User,
    opts: {
      q?: string
      group_name?: string
      active_only?: boolean
      page: number
      page_size: number
    },
  ) {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return materialsRepo.list({
      q: opts.q,
      group_name: opts.group_name,
      active_only: opts.active_only ?? false,
      page: opts.page,
      page_size: opts.page_size,
    })
  },

  /** Số liệu StatsBar — đếm ở DB theo bộ lọc, không cộng từ trang đang xem. */
  async counts(user: User, opts: { q?: string; group_name?: string }) {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return materialsRepo.counts(opts)
  },

  async create(user: User, input: CreateInput): Promise<Material> {
    // Tạo vật tư: permission warehouse.material.create (seed gán Kho + Cung ứng
    // + Ban QL). Cung ứng thêm nhanh hàng mới ngay lúc lên đơn đặt (form PO).
    await assertAction(user, 'warehouse.material.create')

    const group = input.group_name ?? null
    const siblings = await materialsRepo.namesInGroup(group)

    /*
     * CHẶN TRÙNG TÊN Ở MỨC "CHẮC CHẮN".
     *
     * Trước đây chỉ chặn trùng MÃ, còn tên thì để form cảnh báo mềm — bấm tiếp
     * vẫn tạo được. Kết quả là cùng một con long đền có bốn mã, mỗi đơn trỏ một
     * mã, tồn kho và giá mua vỡ vụn (xem `scripts/materials-dedupe.mjs`, viết ra
     * để đi dọn hậu quả đó). Mức "chắc chắn" chỉ bỏ qua dấu câu / khoảng trắng /
     * chữ "màu" / đuôi "ly|li" nên nghĩa không đổi, chặn là chặn đúng.
     *
     * Mức "nghi ngờ" vẫn chỉ cảnh báo trên form: "LĐN 6x16x2 đen" và "… xám" là
     * hai mặt hàng thật, chặn nhầm thì không khai được hàng mới.
     */
    const key = sureKey(input.name)
    if (key.length >= MIN_KEY_LEN) {
      const same = siblings.find((m) => sureKey(m.name) === key)
      if (same) {
        throw Conflict(
          `Vật tư này đã có trong danh mục: ${same.code} — ${same.name}. ` +
            `Dùng lại mã đó thay vì tạo mã mới (khác nhau mỗi dấu câu/khoảng trắng).`,
        )
      }
    }

    /*
     * MÃ: người dùng khai thì tôn trọng, bỏ trống thì server tự cấp.
     *
     * Gõ tay mã là một hạng lỗi không cần tồn tại — quy ước thật là `XX-0000`
     * nối tiếp theo nhóm, gõ `NH999` là lệch khỏi cả danh mục. Tiền tố suy từ
     * chính các mã đang dùng TRONG NHÓM (đa số thắng) chứ không từ bảng cứng:
     * nhóm nào cũng tự bám theo nếp sẵn có, thêm nhóm mới không phải sửa code.
     */
    const code = input.code?.trim() || (await nextCode(group, siblings))
    const dup = await materialsRepo.findByCode(code)
    if (dup) throw Conflict(`Mã vật tư "${code}" đã tồn tại`)

    const created = await materialsRepo.insert({
      code,
      name: input.name,
      // Gọn khoảng trắng + NFC + khớp nhãn chuẩn không phân biệt hoa/thường.
      // Không có bước này thì "cái" dựng sẵn và "cái" dấu rời là hai ĐVT khác
      // nhau trong DB mà mắt không phân biệt được.
      unit: normalizeUnit(input.unit),
      // '' → null để unique partial index (0078) không bắt trùng chuỗi rỗng.
      barcode: input.barcode?.trim() || null,
      spec: input.spec ?? null,
      price_unit: input.price_unit ?? null,
      unit2_factor: input.unit2_factor ?? null,
      group_name: input.group_name ?? null,
      sub_group: input.sub_group ?? null,
      min_stock: input.min_stock,
      max_stock: input.max_stock ?? null,
      reorder_point: input.reorder_point ?? null,
      reorder_qty: input.reorder_qty ?? null,
      shelf_location: input.shelf_location ?? null,
      vat_rate: input.vat_rate ?? null,
      default_supplier_id: input.default_supplier_id ?? null,
      last_purchase_price: input.last_purchase_price ?? null,
      /*
       * BA TRƯỜNG NÀY TRƯỚC ĐÂY BỊ NUỐT. `materialCreateSchema` nhận chúng và
       * form "Vật tư mới" trong đơn đặt vẫn gửi `po_template` lên, nhưng
       * `CreateInput` không khai nên chúng rơi ở đây và DB nhận null. Hậu quả:
       * vật tư vừa khai xong đã mang nhãn "chưa khai mẫu", lần đặt sau bị xếp
       * cuối danh sách tìm — trong khi màn hình vừa báo tạo thành công.
       */
      po_template: input.po_template ?? null,
      kg_per_m: input.kg_per_m ?? null,
      kg_per_unit: input.kg_per_unit ?? null,
      default_bar_length_m: input.default_bar_length_m ?? null,
      note: input.note ?? null,
    })

    // Vật tư mới có thể mang nhóm phụ chưa từng có — xoá cache để form kế tiếp
    // thấy ngay, không phải chờ hết 5 phút.
    invalidateTaxonomy()
    return created
  },

  async update(user: User, id: string, patch: UpdateInput): Promise<Material> {
    // Kho (full) hoặc Cung ứng (chỉ nhóm trường nền + mua hàng — enforce bên dưới).
    const full = await canAction(user, 'warehouse.material.update')
    if (!full) {
      await assertAction(user, 'warehouse.material.update_purchasing')
      const blocked = Object.keys(patch).filter((k) => !PURCHASING_EDITABLE_FIELDS.has(k))
      if (blocked.length > 0) {
        throw Forbidden(
          `Trường thuộc quản lý của Kho, Cung ứng không sửa được: ${blocked.join(', ')}`,
        )
      }
    }
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    if (patch.code && patch.code !== before.code) {
      const dup = await materialsRepo.findByCode(patch.code)
      if (dup) throw Conflict(`Mã vật tư "${patch.code}" đã tồn tại`)
    }
    if ('barcode' in patch) patch.barcode = patch.barcode?.trim() || null
    /*
     * `code` nay cho phép bỏ trống khi TẠO (server tự cấp). Lúc SỬA thì bỏ trống
     * nghĩa là "giữ nguyên mã", tuyệt đối không phải "xoá mã" — mã là thứ mọi
     * chứng từ in ra đang trỏ vào. Gỡ khỏi patch chứ không ghi null xuống.
     */
    const { code, ...rest } = patch
    return materialsRepo.patch(id, code ? { ...rest, code } : rest)
  },

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.material.update')
    const before = await materialsRepo.findById(id)
    if (!before) throw NotFound('Vật tư không tồn tại')
    await materialsRepo.delete(id)
  },
}

export { isWarehouseUser, canViewWarehouse }
