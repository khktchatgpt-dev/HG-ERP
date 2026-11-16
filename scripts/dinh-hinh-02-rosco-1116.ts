/**
 * BƯỚC 2 định hình lệnh 02/26-27 - ROSCO (IBIZA) theo file thống kê "THEO DÕI
 * KHUNG SẮT 14.11.26" (16/11/2026, chủ dự án "Chốt theo đề xuất"): nạp bảng chi
 * tiết từ định mức (ĐÚNG hàm nút "Nạp từ BOM kỹ thuật" dùng — componentsService.
 * suggest 'bom') rồi GHÉP CỤM theo cách xưởng đếm, lưu qua componentsService.save.
 *
 * Hình dữ liệu cụm chép đúng bomRowsForLsx: dòng cụm (assembly) bắt đầu ở Hàn,
 * chi tiết trong cụm dừng ở Phôi, qty_per_assembly = CT/SP ÷ cụm/SP. Chi tiết khung
 * nào không khớp bản ghép → DỪNG, không đoán. Băng 1 chưa có định mức → bỏ qua.
 * Ghế xoay giữ cụm của hồ sơ, chỉ ghi SL cụm/SP = 1 (ghi ngược hồ sơ như Lưu ở màn).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/dinh-hinh-02-rosco-1116.ts [--apply]
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

type Cum = { cum: string; n: number }
const C = (cum: string, n: number): Cum => ({ cum, n })
const vao = (name: string, prefixes: string[]) =>
  prefixes.some((p) => name.trim().toLowerCase().startsWith(p.toLowerCase()))
const la = (name: string, names: string[]) =>
  names.some((p) => name.trim().toLowerCase() === p.toLowerCase())

/** Mã khách trên dòng lệnh → hàm ghép chi tiết KHUNG vào cụm (null = để rời). */
const GHEP: Record<string, ((name: string) => Cum | null) | 'giu'> = {
  // Sofa — hồ sơ gộp cả SP thành cụm "Sofa"; tên chi tiết đã có tiền tố cụm.
  '2723876-A': (n) =>
    vao(n, ['Cụm mê/'])
      ? C('Cụm mê', 1)
      : vao(n, ['Cụm chân giữa/'])
        ? C('Chân giữa', 2)
        : vao(n, ['Cụm chân trước/'])
          ? C('Đố trước', 1)
          : vao(n, ['Cụm chân sau/'])
            ? C('Chân góc', 2)
            : null,
  // Bàn tròn — cụm "Table": thanh U → Chân trên; thanh L + la bịt chân L → Chân dưới.
  '2723876-B': (n) =>
    vao(n, ['Cụm chân/ thanh U'])
      ? C('Chân trên', 1)
      : vao(n, ['Cụm chân/ thanh L', 'la bịt chân L'])
        ? C('Chân dưới', 1)
        : null,
  // Bàn chữ nhật — định mức phẳng.
  '2722239': (n) =>
    la(n, ['Chân', 'Pát chân'])
      ? C('Cụm chân', 2)
      : la(n, ['Giằng chân', 'Pát Giằng'])
        ? C('Giằng chân', 1)
        : la(n, [
              'Khung viền bàn ngang +thanh đỡ giữa',
              'Khung viền bàn dọc',
              'Thanh đỡ dọc + thanh LK Chân',
              'Giằng chéo góc',
              'giằng giữa ngang dài',
              'giằng giữa dọc ngắn',
            ])
          ? C('Khung mặt bàn', 1)
          : null,
  // Bàn vuông — định mức phẳng.
  '2723874': (n) =>
    la(n, ['Chân bàn', 'Giằng chéo', 'la bịt đầu chân trên'])
      ? C('Cụm chân', 1)
      : la(n, ['khung đan dây', 'Khung đan'])
        ? C('Khung đan dây', 4)
        : null,
  // Ghế xoay — cụm của hồ sơ đã khớp file.
  '2722875': 'giu',
}

async function main() {
  const user = await usersRepo.findById(ACTOR)
  if (!user) throw new Error('không thấy tài khoản thực hiện')
  if ((await componentsRepo.listByLsx(LSX_ID)).length > 0)
    throw new Error('lệnh đã có bảng chi tiết — script chỉ chạy trên bảng trống')
  const lines = await lsxLinesRepo.listLines(LSX_ID)
  const codeOf = new Map(lines.map((l) => [l.id, l.product_code]))
  const goc = await componentsService.suggest(user, LSX_ID, 'bom')

  const out: ComponentInput[] = []
  const tom = new Map<string, Map<string, Set<string>>>() // mã → cụm → tên chi tiết
  const clusterQty: { production_order_line_id: string; cluster: string; qty: number }[] =
    []
  for (const l of lines) {
    const rows = goc.filter((r) => r.production_order_line_id === l.id)
    const ghep = GHEP[l.product_code]
    if (rows.length === 0) continue // Băng 1: chưa có định mức
    if (!ghep) throw new Error(`mã lạ: ${l.product_code}`)
    if (ghep === 'giu') {
      out.push(...rows)
      for (const r of rows)
        if (r.kind === 'assembly' && r.cluster)
          clusterQty.push({ production_order_line_id: l.id, cluster: r.cluster, qty: 1 })
      continue
    }
    const cums = new Map<string, number>()
    for (const r of rows) {
      if (r.kind === 'assembly') continue // bỏ cụm gộp cũ ("Sofa", "Table")
      if (r.group_code !== 'FRAME') {
        out.push({ ...r, cluster: null, final_stage: null, qty_per_assembly: null })
        continue
      }
      const g = ghep(r.name)
      if (!g)
        throw new Error(
          `${l.product_code}: chi tiết khung "${r.name}" không khớp bản ghép`,
        )
      cums.set(g.cum, g.n)
      const per = Number(r.qty_per_unit) / g.n
      if (!Number.isInteger(per))
        throw new Error(
          `${l.product_code}: "${r.name}" ${r.qty_per_unit}/SP không chia hết cho ${g.n} cụm`,
        )
      out.push({
        ...r,
        cluster: g.cum,
        final_stage: 'phoi',
        qty_per_assembly: per,
        stages: null,
      })
      const m = tom.get(l.product_code) ?? new Map()
      m.set(g.cum, (m.get(g.cum) ?? new Set()).add(`${r.name} ×${per}`))
      tom.set(l.product_code, m)
    }
    for (const [cum, n] of cums)
      out.push({
        production_order_line_id: l.id,
        kind: 'assembly',
        cluster: cum,
        name: cum,
        group_code: 'FRAME',
        material_id: null,
        unit: 'cụm',
        qty_per_unit: n,
        dm_kg: null,
        pcs_per_bar: null,
        first_stage: 'han',
        final_stage: null,
        stages: null,
        note: null,
      })
  }

  for (const [ma, m] of tom) {
    console.log(`\n${ma}`)
    for (const [cum, s] of m) console.log(`  ${cum}: ${[...s].join(' · ')}`)
  }
  const nCum = out.filter((r) => r.kind === 'assembly').length
  const nLine = new Set(out.map((r) => r.production_order_line_id)).size
  console.log(
    `\n${goc.length} dòng nạp từ định mức → ${out.length} dòng (${nCum} dòng cụm) trên ${nLine}/${lines.length} dòng lệnh · Ghế xoay ghi SL cụm/SP=1 cho ${clusterQty.length} cụm`,
  )
  if (!APPLY) return console.log('Dò khô — thêm --apply để lưu.')
  const res = await componentsService.save(user, LSX_ID, out, {
    syncProfileRoutes: false,
    clusterQty,
  })
  console.log('Đã lưu.', JSON.stringify({ qty_synced: res.qty_synced }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
