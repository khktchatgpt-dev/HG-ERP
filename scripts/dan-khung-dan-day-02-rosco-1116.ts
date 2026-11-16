/**
 * BƯỚC 3 định hình lệnh 02/26-27 - ROSCO (IBIZA) theo file thống kê "THEO DÕI
 * KHUNG SẮT 14.11.26" (16/11/2026, chủ dự án "Làm bước 3 Đan"): cụm "Khung đan
 * dây" của Bàn vuông (2723874) đi thêm Đan, đếm theo CỤM như cột Đan của file.
 *
 * Hai việc, đi ĐÚNG đường màn dùng:
 *  1. Công đoạn Đan đổi bậc đếm chi tiết → cụm (`stageConfigService.update` — màn
 *     /production/cau-hinh/cong-doan). Đang ở bậc chi tiết thì ô Đan trên dòng cụm
 *     của ma trận Lộ trình là "·" (không bật được). Áp mọi lệnh — đo 16/11: 0 chi
 *     tiết / cụm / sổ / phiếu giao / việc tổ nào đi Đan, không nhóm vật tư nào mặc
 *     định đi Đan (lib/stage-route).
 *  2. Dòng cụm Khung đan dây (mọi đợt) khai lộ trình Hàn → Nguội → Sơn → Đan, như
 *     `setStages` của màn Lộ trình (first/final = hai đầu lộ trình), lưu qua
 *     `componentsService.save` với bản chụp `stages` của MỌI dòng giữ nguyên.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/dan-khung-dan-day-02-rosco-1116.ts [--apply]
 */
import { componentsService } from '@/modules/dept/production/components.service'
import {
  componentsRepo,
  type ComponentInput,
} from '@/modules/dept/production/components.repo'
import { stageConfigService } from '@/modules/dept/production/stage-config.service'
import { stageMetaSchema } from '@/modules/dept/production/stage-config.schema'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const LSX_ID = 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c'
const ACTOR = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8' // Quản trị viên
const MA_SP = '2723874' // Bàn vuông
const CUM = 'Khung đan dây'
const LO_TRINH = ['han', 'nguoi', 'son', 'dan']

const n = (v: unknown) => (v == null ? null : Number(v))

async function main() {
  const user = await usersRepo.findById(ACTOR)
  if (!user) throw new Error('không thấy tài khoản thực hiện')

  // 1 · Đan → đếm cụm.
  const cfg = await stageConfigService.get(user)
  const dan = cfg.stages.find((s) => s.code === 'dan')
  if (!dan) throw new Error('danh mục công đoạn không có Đan')
  console.log(`Đan: bậc đếm ${dan.meta.count_level}, ${dan.doc_count} phiếu sản lượng`)
  const canDoiBac = dan.meta.count_level !== 'cluster'

  // 2 · Lộ trình cụm Khung đan dây.
  const lines = await lsxLinesRepo.listLines(LSX_ID)
  const lineIds = new Set(lines.filter((l) => l.product_code === MA_SP).map((l) => l.id))
  const rows = await componentsRepo.listByLsx(LSX_ID)
  if (rows.length === 0) throw new Error('lệnh chưa có bảng chi tiết')
  let nDoi = 0
  const out: ComponentInput[] = rows.map((r) => {
    const laCum =
      r.kind === 'assembly' &&
      lineIds.has(r.production_order_line_id) &&
      (r.cluster ?? '').trim().toLowerCase() === CUM.toLowerCase()
    if (laCum) nDoi++
    return {
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
      ...(laCum
        ? { stages: LO_TRINH, first_stage: LO_TRINH[0], final_stage: LO_TRINH.at(-1)! }
        : { stages: r.stages, first_stage: r.first_stage, final_stage: r.final_stage }),
      note: r.note,
    }
  })
  console.log(
    `${rows.length} dòng bảng chi tiết · ${nDoi} dòng cụm "${CUM}" (${lineIds.size} dòng lệnh ${MA_SP}) → ${LO_TRINH.join(' → ')}`,
  )
  if (nDoi !== lineIds.size)
    throw new Error(`chờ ${lineIds.size} dòng cụm (mỗi dòng lệnh một), thấy ${nDoi}`)

  if (!APPLY) return console.log('Dò khô — thêm --apply để lưu.')
  if (canDoiBac) {
    const meta = stageMetaSchema.parse({ ...dan.meta, count_level: 'cluster' })
    await stageConfigService.update(user, 'dan', { meta })
    console.log('Đã đổi Đan sang đếm cụm.')
  }
  await componentsService.save(user, LSX_ID, out, { syncProfileRoutes: false })
  console.log(`Đã lưu bảng chi tiết (${out.length} dòng).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
