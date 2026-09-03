import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { Conflict, NotFound } from '@/server/http'
import { invalidateTaxonomy } from './taxonomy.service'
import { materialGroupsRepo, type GroupItem } from './material-groups.repo'

/**
 * QUẢN LÝ NHÓM / NHÓM PHỤ VẬT TƯ — cho Cung ứng, không cần admin (03/09/2026).
 *
 * User: "thao tác chỉnh sửa không cho thêm nhóm hay xoá nhóm… chỉ có drop list
 * để chỉnh, không để admin quản lí phần này". Đo được: 14 nhóm chính đứng im
 * từ 07/2026 vì chỉ admin thêm được; 107 nhóm phụ gõ tự do đã mục (bản gõ
 * lệch một chữ, 722 mã trống nhóm phụ chỉ trong một nhóm).
 *
 * Luật:
 * · Nhóm CHÍNH là mục catalog_items; vật tư trỏ bằng NHÃN (free-text-over-fk)
 *   nên ĐỔI TÊN phải lan xuống mọi vật tư mang tên cũ — một câu update, KHÔNG
 *   ghi vết từng mã (đổi tên nhóm là việc cấu trúc, 2.858 vết "group_name
 *   A→B" chỉ làm ngập sổ vết của từng mã).
 * · Ngừng dùng / xoá nhóm chính chỉ khi KHÔNG còn mã nào — có mã thì người dùng
 *   phải đổi nhóm cho chúng trước (đã có "đổi nhóm hàng loạt"), không xoá ngầm
 *   dữ liệu phân loại của hàng nghìn mã.
 * · Nhóm PHỤ chỉ là cột text trên vật tư: đổi tên = update; đổi sang tên đã có
 *   = GỘP; xoá = về null. Đều gói trong một nhóm chính.
 * · Sau mọi thao tác: invalidateTaxonomy() để form vật tư thấy ngay.
 */
export type GroupRow = GroupItem & {
  total: number
  no_sub: number
  subs: { name: string; count: number }[]
}

export type GroupsOverview = {
  groups: GroupRow[]
  /** Mã đang mang tên nhóm KHÔNG có trong danh mục (dữ liệu cũ / gõ tay). */
  orphans: { name: string; total: number }[]
  ungrouped: number
}

const ACTION = 'warehouse.material.group_manage'

const same = (a: string, b: string) =>
  a.localeCompare(b, 'vi', { sensitivity: 'base' }) === 0

export const materialGroupsService = {
  /** Đọc: mọi người đã đăng nhập — cùng mức với xem danh mục vật tư. */
  async overview(_user: User): Promise<GroupsOverview> {
    const [items, counts] = await Promise.all([
      materialGroupsRepo.listItems(),
      materialGroupsRepo.counts(),
    ])
    const groups: GroupRow[] = items.map((it) => {
      const c = counts.get(it.label)
      return {
        ...it,
        total: c?.total ?? 0,
        no_sub: c?.noSub ?? 0,
        subs: [...(c?.subs ?? new Map<string, number>())]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')),
      }
    })
    const known = new Set(items.map((i) => i.label))
    const orphans: GroupsOverview['orphans'] = []
    let ungrouped = 0
    for (const [name, c] of counts) {
      if (name === '') ungrouped = c.total
      else if (!known.has(name)) orphans.push({ name, total: c.total })
    }
    return { groups, orphans, ungrouped }
  },

  async create(user: User, name: string): Promise<GroupItem> {
    await assertAction(user, ACTION)
    const items = await materialGroupsRepo.listItems()
    const dup = items.find((i) => same(i.label, name))
    if (dup) {
      throw Conflict(
        dup.is_active
          ? `Nhóm "${dup.label}" đã có`
          : `Nhóm "${dup.label}" đang ngừng dùng — bật lại thay vì tạo mới`,
        'GROUP_EXISTS',
      )
    }
    const code = await materialGroupsRepo.nextCode()
    const sort = items.reduce((m, i) => Math.max(m, i.sort_order), 0) + 1
    const created = await materialGroupsRepo.insertItem({
      code,
      label: name,
      sort_order: sort,
    })
    invalidateTaxonomy()
    return created
  },

  async rename(
    user: User,
    id: string,
    name: string,
  ): Promise<{ item: GroupItem; moved: number }> {
    await assertAction(user, ACTION)
    const it = await materialGroupsRepo.findItem(id)
    if (!it) throw NotFound('Nhóm không tồn tại')
    if (it.label === name) return { item: it, moved: 0 }
    const items = await materialGroupsRepo.listItems()
    const dup = items.find((i) => i.id !== id && same(i.label, name))
    if (dup) throw Conflict(`Đã có nhóm "${dup.label}"`, 'GROUP_EXISTS')
    // Đổi nhãn ở danh mục TRƯỚC rồi lan xuống vật tư: nếu bước 2 hỏng thì vật tư
    // còn tên cũ, hiện ra như "nhóm mồ côi" ở màn này chứ không mất.
    const item = await materialGroupsRepo.patchItem(id, { label: name })
    const moved = await materialGroupsRepo.renameGroupOnMaterials(it.label, name)
    invalidateTaxonomy()
    return { item, moved }
  },

  /**
   * Mẫu đơn mua mặc định của nhóm (0183). Chỉ là GIÁ TRỊ KHỞI ĐẦU cho vật tư
   * mới — vật tư đã có mẫu riêng không bị đổi (mẫu là của vật tư/đơn, không
   * phải của nhóm; xem `po-template-not-on-material` trong sổ nhớ).
   */
  async setTemplate(user: User, id: string, tpl: string | null): Promise<GroupItem> {
    await assertAction(user, ACTION)
    const it = await materialGroupsRepo.findItem(id)
    if (!it) throw NotFound('Nhóm không tồn tại')
    const item = await materialGroupsRepo.patchItem(id, {
      meta: { ...it.meta, po_template: tpl },
    })
    invalidateTaxonomy()
    return item
  },

  async setActive(user: User, id: string, isActive: boolean): Promise<GroupItem> {
    await assertAction(user, ACTION)
    const it = await materialGroupsRepo.findItem(id)
    if (!it) throw NotFound('Nhóm không tồn tại')
    if (!isActive) {
      const n = await materialGroupsRepo.countByGroup(it.label)
      if (n > 0) {
        throw Conflict(
          `Nhóm còn ${n.toLocaleString('vi-VN')} mã — đổi nhóm cho chúng trước rồi mới ngừng`,
          'GROUP_IN_USE',
        )
      }
    }
    const item = await materialGroupsRepo.patchItem(id, { is_active: isActive })
    invalidateTaxonomy()
    return item
  },

  async remove(user: User, id: string): Promise<void> {
    await assertAction(user, ACTION)
    const it = await materialGroupsRepo.findItem(id)
    if (!it) throw NotFound('Nhóm không tồn tại')
    const n = await materialGroupsRepo.countByGroup(it.label)
    if (n > 0) {
      throw Conflict(
        `Nhóm còn ${n.toLocaleString('vi-VN')} mã — đổi nhóm cho chúng trước rồi mới xoá`,
        'GROUP_IN_USE',
      )
    }
    await materialGroupsRepo.deleteItem(id)
    invalidateTaxonomy()
  },

  /** Đổi tên nhóm phụ; `to` đã tồn tại trong nhóm = GỘP. Trả số mã đã chuyển. */
  async renameSubGroup(
    user: User,
    groupName: string,
    from: string,
    to: string,
  ): Promise<{ moved: number; merged: boolean }> {
    await assertAction(user, ACTION)
    if (from === to) return { moved: 0, merged: false }
    const counts = await materialGroupsRepo.counts()
    const g = counts.get(groupName)
    if (!g || !g.subs.has(from))
      throw NotFound(`Nhóm "${groupName}" không có nhóm phụ "${from}"`)
    const merged = g.subs.has(to)
    const moved = await materialGroupsRepo.setSubGroup(groupName, from, to)
    invalidateTaxonomy()
    return { moved, merged }
  },

  /** Xoá nhóm phụ: các mã đang mang nó về TRỐNG (không mất mã, chỉ mất nhãn). */
  async deleteSubGroup(
    user: User,
    groupName: string,
    name: string,
  ): Promise<{ moved: number }> {
    await assertAction(user, ACTION)
    const moved = await materialGroupsRepo.setSubGroup(groupName, name, null)
    if (moved === 0) throw NotFound(`Nhóm "${groupName}" không có nhóm phụ "${name}"`)
    invalidateTaxonomy()
    return { moved }
  },
}
