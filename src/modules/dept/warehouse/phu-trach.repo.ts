import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import type { NguoiKho, PhanCong } from '@/lib/kho-phu-trach'

/**
 * Người phụ trách nhóm vật tư của Kho (0305). Bảng nhỏ (≤ ~30 nhóm) — đọc trọn.
 * Mọi truy vấn kiểm `error`: phân công rỗng câm là "Của tôi" rỗng mà không ai biết.
 */
const ok = <T>(
  r: { data: T | null; error: { message: string } | null },
  viec: string,
): T => {
  if (r.error) throw new Error(`phuTrachRepo.${viec}: ${r.error.message}`)
  return r.data as T
}

export const phuTrachRepo = {
  async phanCong(): Promise<PhanCong> {
    const rows = ok<{ group_name: string; user_id: string }[]>(
      await db().from('warehouse_group_keepers').select('group_name, user_id'),
      'phanCong',
    )
    return Object.fromEntries(rows.map((r) => [r.group_name, r.user_id]))
  },

  /**
   * Nhân viên Kho = người còn làm thuộc phòng ban của khu Kho (`departments.workspace_id
   * = 'warehouse'`). Thủ kho = trưởng phòng (`head_user_id`); phòng chưa khai trưởng thì
   * người có vai `manager`. KHÔNG lấy theo quyền `warehouse.member`: 4 người Cung ứng
   * cũng mang quyền đó (đang ghi phiếu hộ Kho) — đo 24/11/2026 ra 6 "người Kho".
   */
  async nguoiKho(): Promise<NguoiKho[]> {
    const phong = ok<{ id: string; head_user_id: string | null }[]>(
      await db().from('departments').select('id, head_user_id').eq('workspace_id', 'warehouse'),
      'nguoiKho.phong',
    )
    if (phong.length === 0) return []
    const users = ok<{ id: string; name: string | null; role: string }[]>(
      await db()
        .from('users')
        .select('id, name, role')
        .in('department_id', phong.map((d) => d.id))
        .eq('is_active', true)
        .is('deleted_at', null),
      'nguoiKho.users',
    )
    const truong = new Set(phong.map((d) => d.head_user_id).filter(Boolean))
    const coTruong = users.some((u) => truong.has(u.id))
    return users
      .filter((u) => u.role !== 'admin')
      .map((u) => ({
        id: u.id,
        name: u.name ?? '—',
        thu_kho: coTruong ? truong.has(u.id) : u.role === 'manager',
      }))
      .sort((a, b) => Number(b.thu_kho) - Number(a.thu_kho) || a.name.localeCompare(b.name, 'vi')) // prettier-ignore
  },

  /** Ghi thay đổi: user_id null = bỏ gán (nhóm về thủ kho). */
  async luu(
    items: { group_name: string; user_id: string | null }[],
    by: string,
  ): Promise<void> {
    const gan = items.filter((i) => i.user_id)
    const bo = items.filter((i) => !i.user_id).map((i) => i.group_name)
    if (gan.length)
      ok(
        await db()
          .from('warehouse_group_keepers')
          .upsert(
            gan.map((i) => ({
              group_name: i.group_name,
              user_id: i.user_id!,
              updated_by: by,
            })),
            { onConflict: 'group_name' },
          ),
        'luu.gan',
      )
    if (bo.length)
      ok(
        await db().from('warehouse_group_keepers').delete().in('group_name', bo),
        'luu.bo',
      )
  },

  /**
   * Nhóm vật tư trên các dòng của từng đơn mua — theo thứ tự dòng, không lặp.
   * Dòng tự do (không mã vật tư) bỏ qua. `null` = mã chưa có nhóm.
   */
  async nhomTheoDon(poIds: string[]): Promise<Map<string, (string | null)[]>> {
    const out = new Map<string, (string | null)[]>()
    if (poIds.length === 0) return out
    const lines = await theoLo<{ po_id: string; material_id: string | null }>(
      poIds,
      (lo) =>
        db()
          .from('supply_purchase_order_lines')
          .select('po_id, material_id')
          .in('po_id', lo)
          .order('id'),
    )
    const matIds = [...new Set(lines.map((l) => l.material_id).filter((x): x is string => !!x))] // prettier-ignore
    const mats = await theoLo<{ id: string; group_name: string | null }>(matIds, (lo) =>
      db().from('warehouse_materials').select('id, group_name').in('id', lo).order('id'),
    )
    const nhom = new Map(mats.map((m) => [m.id, m.group_name?.trim() || null]))
    for (const l of lines) {
      if (!l.material_id) continue
      const g = nhom.get(l.material_id) ?? null
      const ds = out.get(l.po_id) ?? []
      if (!ds.includes(g)) ds.push(g)
      out.set(l.po_id, ds)
    }
    return out
  },
}
