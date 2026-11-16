/**
 * BĂNG 1 (BN0229HG-IR) trên lệnh 02/26-27 - ROSCO (IBIZA) — 16/11/2026, chủ dự án
 * "bổ sung định mức cho băng 1 đi trong file có mà".
 *
 * Hồ sơ SP Băng 1 trống (0 chi tiết, 0 cụm, không file BOM; file BOM Sofa ROSCO
 * cũng không có Băng 1). File thống kê "THEO DÕI KHUNG SẮT 14.11.26" chỉ có CỤM:
 * Cụm mê ×1 · Đố trước ×1 · Chân góc ×2 — không tên chi tiết, vật liệu, quy cách,
 * kg. Nên KHÔNG ghi định mức hồ sơ SP (cấp chi tiết, Cung ứng đọc để tính vật tư):
 * chỉ khai ba dòng cụm trên BẢNG CHI TIẾT CỦA LỆNH cho mọi đợt Băng 1 — đúng đường
 * "Tự khai ở Bảng chi tiết" của thống kê. Hình dòng cụm chép bomRowsForLsx (bắt
 * đầu ở Hàn, lộ trình theo nhóm khung). Mọi dòng khác giữ nguyên, kể cả bản chụp
 * `stages` (Khung đan dây đi Đan, bước 3).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cum-bang1-02-rosco-1116.ts [--apply]
 */
import { componentsService } from '@/modules/dept/production/components.service'
import {
  componentsRepo,
  type ComponentInput,
} from '@/modules/dept/production/components.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const LSX_ID = 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c'
const ACTOR = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8' // Quản trị viên
const MA_SP = 'BN0229HG-IR' // Băng 1 (file: GHẾ BANK 1)
const CUM: [string, number][] = [
  ['Cụm mê', 1],
  ['Đố trước', 1],
  ['Chân góc', 2],
]

const n = (v: unknown) => (v == null ? null : Number(v))

async function main() {
  const user = await usersRepo.findById(ACTOR)
  if (!user) throw new Error('không thấy tài khoản thực hiện')
  const lines = await lsxLinesRepo.listLines(LSX_ID)
  const bang1 = lines.filter((l) => l.product_code === MA_SP)
  if (bang1.length === 0) throw new Error(`lệnh không có dòng ${MA_SP}`)
  const rows = await componentsRepo.listByLsx(LSX_ID)
  const ids = new Set(bang1.map((l) => l.id))
  if (rows.some((r) => ids.has(r.production_order_line_id)))
    throw new Error('Băng 1 đã có dòng trên bảng chi tiết — không khai lại')

  const giu: ComponentInput[] = rows.map((r) => ({
    production_order_line_id: r.production_order_line_id,
    kind: r.kind,
    cluster: r.cluster,
    name: r.name,
    group_code: r.group_code,
    material_id: r.material_id,
    material_type: r.material_type,
    spec_thickness_mm: n(r.spec_thickness_mm),
    spec_width_mm: n(r.spec_width_mm),
    spec_length_mm: n(r.spec_length_mm),
    wall_thickness_mm: n(r.wall_thickness_mm),
    unit: r.unit,
    qty_per_unit: Number(r.qty_per_unit),
    dm_kg: n(r.dm_kg),
    pcs_per_bar: n(r.pcs_per_bar),
    qty_per_assembly: n(r.qty_per_assembly),
    first_stage: r.first_stage,
    final_stage: r.final_stage,
    stages: r.stages,
    note: r.note,
  }))
  const moi: ComponentInput[] = bang1.flatMap((l) =>
    CUM.map(([cum, sl]) => ({
      production_order_line_id: l.id,
      kind: 'assembly' as const,
      cluster: cum,
      name: cum,
      group_code: 'FRAME',
      material_id: null,
      unit: 'cụm',
      qty_per_unit: sl,
      dm_kg: null,
      pcs_per_bar: null,
      first_stage: 'han',
      final_stage: null,
      stages: null,
      note: 'Khai theo file thống kê 14/11 — Băng 1 chưa có định mức chi tiết',
    })),
  )
  const tongSp = bang1.reduce((a, l) => a + Number(l.qty), 0)
  console.log(
    `${MA_SP}: ${bang1.length} dòng lệnh, ${tongSp} SP → +${moi.length} dòng cụm (${CUM.map(([c, s]) => `${c} ×${s} = ${tongSp * s}`).join(' · ')})`,
  )
  console.log(`Bảng chi tiết: ${rows.length} → ${rows.length + moi.length} dòng`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để lưu.')
  await componentsService.save(user, LSX_ID, [...giu, ...moi], {
    syncProfileRoutes: false,
  })
  console.log('Đã lưu.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
