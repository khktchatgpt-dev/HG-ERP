import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'
import {
  laTruongKho,
  stocktakesService,
} from '@/modules/dept/warehouse/stocktakes.service'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { onHandMany } from '@/modules/dept/warehouse/stock.repo'
import { LSX_XUAT_DUOC } from '@/lib/kho-phieu-xuat'
import { taoDong, type LenhCuaMa } from '@/lib/kho-cap-nhat-ton'
import { CapNhatTonScreen, type ChoDuyet } from './CapNhatTonScreen'

export const metadata = { title: 'Kho · Cập nhật số thực tế' }
export const dynamic = 'force-dynamic'

/**
 * CẬP NHẬT SỐ THỰC TẾ — `/warehouse/cap-nhat-ton` (B1 "Kho cho người mới", bản
 * vẽ C https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z, duyệt Q1–Q6 27/10/2026).
 *
 * Trang nạp song song: quyền ghi, có phải trưởng kho (Q2), lệnh nào đang được
 * chia tồn của từng mã (Q3 — cùng hàm Tồn kho › Theo lệnh, ~2 s), các mã mở sẵn
 * từ `?ma=` (Tồn kho dẫn sang), và các lần cập nhật đang chờ trưởng kho duyệt.
 */
export default async function CapNhatTonPage({
  searchParams,
}: {
  searchParams: Promise<{ ma?: string | string[] }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const maUrl = [sp.ma ?? []]
    .flat()
    .flatMap((s) => s.split(','))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50)

  const [canEdit, truong, lenhAll, cho, vts] = await Promise.all([
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    laTruongKho(user),
    hangLenhService.tatCa(user),
    stocktakesService.list(user, { status: 'review', page: 1, page_size: 50 }),
    Promise.all(maUrl.map((c) => materialsRepo.findByCode(c))),
  ])

  // Lệnh xuất được và đang được CHIA tồn của mã — phần lớn trước (`taoDong` xếp lại).
  const lenhXuat = new Map(
    lenhAll.lenh
      .filter((l) => (LSX_XUAT_DUOC as readonly string[]).includes(l.status))
      .map((l) => [l.id, l.code]),
  )
  const lenhTheoMa: Record<string, LenhCuaMa[]> = {}
  for (const r of lenhAll.rows) {
    const code = lenhXuat.get(r.lsx_id)
    if (!code || r.chia <= 1e-9) continue
    ;(lenhTheoMa[r.material_id] ??= []).push({ lsx_id: r.lsx_id, code, chia: r.chia })
  }

  const coMa = vts.filter((v): v is NonNullable<typeof v> => v != null)
  const ton = await onHandMany(coMa.map((v) => v.id))
  const banDau = coMa.map((v) =>
    taoDong(
      { id: v.id, code: v.code, name: v.name, unit: v.unit },
      ton.get(v.id) ?? 0,
      lenhTheoMa[v.id] ?? [],
    ),
  )

  const choDuyet: ChoDuyet[] = cho.rows
    .filter((t) => t.scope_kind === 'list' && t.scope_ref.nhanh === true)
    .map((t) => ({
      id: t.id,
      code: t.code,
      nguoi: t.created_by_name,
      so_ma: t.scope_count,
      luc: t.created_at,
    }))

  return (
    <CapNhatTonScreen
      nguoiGhi={user.name ?? user.email}
      laTruong={truong}
      canEdit={canEdit}
      lenhTheoMa={lenhTheoMa}
      banDau={banDau}
      maKhongThay={maUrl.filter((_, i) => vts[i] == null)}
      choDuyet={choDuyet}
    />
  )
}
