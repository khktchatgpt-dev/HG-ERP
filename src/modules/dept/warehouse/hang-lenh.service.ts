import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'
import { tinhHangLenh, type HangLenhRow } from '@/lib/kho-hang-lenh'
import {
  chiaTon,
  giuChoLenhKhac,
  veXuatTheoLenh,
  type DongLenh,
  type LenhTon,
  type MaLenh,
} from '@/lib/kho-ton-lenh'
import { hangLenhRepo } from './hang-lenh.repo'
import { canViewWarehouse } from './warehouse.service'

/** Toàn cảnh hàng của mọi lệnh — một lượt tải, mọi số B4/B5 rút từ đây. */
export type TonLenhAll = {
  lenh: LenhTon[]
  rows: MaLenh[]
  ton: Map<string, number>
  vatTu: Map<string, { code: string; name: string; unit: string }>
  /** Nguồn thô để B4 dựng lại dòng của MỘT lệnh bằng đúng `tinhHangLenh`. */
  dong: DongLenh[]
  nhanTheoDong: Map<string, number>
  xuat: Map<string, Map<string, number>>
}

async function taiTatCa(): Promise<TonLenhAll> {
  const lenh = await hangLenhRepo.lenh()
  const ids = lenh.map((l) => l.id)
  const [dong, { xuat, cuoi }] = await Promise.all([
    hangLenhRepo.dongCacLenh(ids),
    hangLenhRepo.xuatTheoLenh(ids),
  ])
  const mats = [...new Set(dong.map((d) => d.material_id))]
  const [nhanTheoDong, { ton, vatTu }] = await Promise.all([
    hangLenhRepo.nhanTheoDong([...new Set(dong.map((d) => d.line_id))]),
    hangLenhRepo.tonVaTen(mats),
  ])
  for (const l of lenh) l.xuat_cuoi = cuoi.get(l.id) ?? null
  const byId = new Map(lenh.map((l) => [l.id, l]))
  const rows = chiaTon(veXuatTheoLenh({ dong, nhanTheoDong, xuat }), ton, byId)
  return { lenh, rows, ton, vatTu, dong, nhanTheoDong, xuat }
}

/**
 * HÀNG CỦA LỆNH — Kho đợt 2. B4: "Lấy hàng của lệnh" trên phiếu xuất. B5: Tồn
 * kho theo lệnh. Ghép các nguồn rồi giao cho luật thuần (`lib/kho-hang-lenh`,
 * `lib/kho-ton-lenh`, có test). Đã xuất = xuất ròng như `issuedByLsx`.
 *
 * B4 cũng tải MỌI lệnh: gợi ý lấy dùng phần tồn đã CHIA giữa các lệnh (Q2 B5) —
 * tính riêng một lệnh thì hai lệnh chung một mã cùng thấy cả tồn.
 */
export const hangLenhService = {
  async tatCa(user: User): Promise<TonLenhAll> {
    if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
    return taiTatCa()
  },

  async get(user: User, lsxId: string): Promise<HangLenhRow[]> {
    const t = await hangLenhService.tatCa(user)
    const cuaLenh = t.rows.filter((r) => r.lsx_id === lsxId)
    if (cuaLenh.length === 0) return []
    const byId = new Map(t.lenh.map((l) => [l.id, l]))
    return tinhHangLenh({
      dong: t.dong.filter((d) => d.lsx_id === lsxId),
      nhanTheoDong: t.nhanTheoDong,
      daXuat: t.xuat.get(lsxId) ?? new Map(),
      ton: t.ton,
      vatTu: t.vatTu,
      chia: new Map(cuaLenh.map((r) => [r.material_id, r.chia])),
      giuCho: giuChoLenhKhac(t.rows, byId).get(lsxId),
    })
  },
}
