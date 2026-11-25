import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden } from '@/server/http'
import {
  macDinhCuaToi,
  nguoiCuaDon,
  nhomCuaToi,
  thuKhoCua,
  type NguoiKho,
  type PhanCong,
} from '@/lib/kho-phu-trach'
import { isIncoming } from '@/lib/supply-watch'
import { loadWatchPos } from '@/modules/dept/supply/watch-pos'
import { canViewWarehouse } from './warehouse.service'
import { materialGroupsRepo } from './material-groups.repo'
import { phuTrachRepo } from './phu-trach.repo'
import type { LuuPhuTrachInput } from './phu-trach.schema'

export type NhomPhuTrach = {
  group_name: string
  so_ma: number
  /** Đơn đang về (cùng tập màn Nhận hàng) có ít nhất một dòng thuộc nhóm. */
  don_ve: number
  /** Người được gán; null = chưa gán (thuộc thủ kho). */
  user_id: string | null
}

export type TrangPhuTrach = {
  nhom: NhomPhuTrach[]
  nguoi: NguoiKho[]
  thu_kho: string | null
  /** Mã chưa có nhóm — thuộc thủ kho. */
  ma_khong_nhom: number
  /** Tổng đơn đang về khác nhau (đơn nhiều nhóm đếm một lần). */
  tong_don_ve: number
  can_manage: boolean
}

/** Phân công + người Kho — dùng chung cho mọi màn lọc "Của tôi". */
export async function taiPhanCong(): Promise<{
  pc: PhanCong
  nguoi: NguoiKho[]
  thuKho: string | null
}> {
  const [pc, nguoi] = await Promise.all([phuTrachRepo.phanCong(), phuTrachRepo.nguoiKho()])
  return { pc, nguoi, thuKho: thuKhoCua(nguoi) }
}

/** Người giữ từng đơn mua (theo nhóm của dòng). */
export async function nguoiGiuTheoDon(
  poIds: string[],
  pc: PhanCong,
  thuKho: string | null,
): Promise<Map<string, { giu: string[]; nhom: string[] }>> {
  const theoDon = await phuTrachRepo.nhomTheoDon(poIds)
  const out = new Map<string, { giu: string[]; nhom: string[] }>()
  for (const id of poIds) {
    const g = theoDon.get(id) ?? []
    out.set(id, {
      giu: nguoiCuaDon(g, pc, thuKho),
      nhom: g.filter((x): x is string => !!x),
    })
  }
  return out
}

/**
 * Quyền action (thành viên Kho + vai manager) chưa đủ: trưởng Cung ứng cũng là manager
 * và mang quyền phòng Kho. Phải là THỦ KHO thật (trưởng phòng Kho) hoặc quản trị.
 */
function laThuKho(user: User, nguoi: NguoiKho[]): boolean {
  return user.role === 'admin' || nguoi.some((n) => n.id === user.id && n.thu_kho)
}

export const phuTrachService = {
  async trang(user: User): Promise<TrangPhuTrach> {
    if (!(await canViewWarehouse(user))) throw Forbidden()
    const [{ pc, nguoi, thuKho }, counts, watch, coQuyen] = await Promise.all([
      taiPhanCong(),
      materialGroupsRepo.counts(),
      loadWatchPos(user),
      canAction(user, 'warehouse.keeper.manage'),
    ])
    const ve = watch.rows.filter(isIncoming).map((p) => p.id)
    const theoDon = await phuTrachRepo.nhomTheoDon(ve)
    const donVe = new Map<string, number>()
    for (const gs of theoDon.values())
      for (const g of gs) if (g) donVe.set(g, (donVe.get(g) ?? 0) + 1)
    const ten = new Set([...counts.keys()].filter((g) => g.trim()))
    for (const g of Object.keys(pc)) ten.add(g)
    const nhom = [...ten]
      .map((g) => ({
        group_name: g,
        so_ma: counts.get(g)?.total ?? 0,
        don_ve: donVe.get(g) ?? 0,
        user_id: pc[g] ?? null,
      }))
      .sort((a, b) => b.don_ve - a.don_ve || b.so_ma - a.so_ma || a.group_name.localeCompare(b.group_name, 'vi')) // prettier-ignore
    return {
      nhom,
      nguoi,
      thu_kho: thuKho,
      ma_khong_nhom: counts.get('')?.total ?? 0,
      tong_don_ve: ve.length,
      can_manage: coQuyen && laThuKho(user, nguoi),
    }
  },

  async luu(user: User, input: LuuPhuTrachInput): Promise<{ changed: number }> {
    await assertAction(user, 'warehouse.keeper.manage')
    const nguoi = await phuTrachRepo.nguoiKho()
    if (!laThuKho(user, nguoi)) throw Forbidden('Chỉ thủ kho phân nhóm vật tư')
    const hop = new Set(nguoi.map((n) => n.id))
    const sai = input.items.find((i) => i.user_id && !hop.has(i.user_id))
    if (sai)
      throw BadRequest(
        `Người được gán cho nhóm “${sai.group_name}” không thuộc phòng Kho — chọn lại trong danh sách.`,
      )
    await phuTrachRepo.luu(input.items, user.id)
    return { changed: input.items.length }
  },
}

/**
 * PHẠM VI "CỦA TÔI" của người xem — một nguồn cho mọi màn Kho bước 2 (Hôm nay, Tồn
 * kho, số menu Nhận hàng). `macDinh` = mở màn là "của tôi" (nhân viên đã được gán).
 */
export async function phamViCuaToi(user: User): Promise<{
  pc: PhanCong
  nguoi: NguoiKho[]
  thuKho: string | null
  nhom: { in?: string[]; notIn?: string[] } | null
  macDinh: boolean
}> {
  const { pc, nguoi, thuKho } = await taiPhanCong()
  return {
    pc,
    nguoi,
    thuKho,
    nhom: nhomCuaToi(user.id, nguoi, pc),
    macDinh: macDinhCuaToi(user.id, nguoi, pc),
  }
}
