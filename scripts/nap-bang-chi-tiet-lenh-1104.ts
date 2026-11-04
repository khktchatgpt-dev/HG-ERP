/**
 * Nạp bù BẢNG CHI TIẾT từ định mức Kỹ thuật cho các lệnh đang chạy mà chưa có
 * bảng (04/11/2026, chủ dự án chốt: bảng chi tiết tự nạp lúc duyệt lệnh; lệnh
 * duyệt trước ngày đó nạp bù một lượt). Đi qua đúng `componentsService.
 * autoShapeFromBom` mà nhịp duyệt dùng: có bảng rồi thì bỏ qua, SP chưa có
 * định mức thì báo tên, không gõ hộ. Không ghi ngược hồ sơ SP, không nâng rev.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/nap-bang-chi-tiet-lenh-1104.ts [--apply]
 */
import {
  componentsService,
  isUnshaped,
} from '@/modules/dept/production/components.service'

const APPLY = process.argv.includes('--apply')

async function main() {
  const rows = await componentsService.shapingOverview()
  const chua = rows.filter(isUnshaped)
  console.log(`${rows.length} lệnh đang chạy · ${chua.length} chưa có bảng chi tiết`)
  for (const r of chua)
    console.log(`  - ${r.lsx.code} · ${r.lsx.customer_name} · ${r.line_count} dòng SP`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để nạp.')
  let ok = 0
  for (const r of chua) {
    const res = await componentsService.autoShapeFromBom(r.lsx.id)
    if (res.status === 'added') ok++
    console.log(
      `  ${r.lsx.code}: ${res.status} · +${res.added} dòng` +
        (res.missing.length
          ? ` · Kỹ thuật chưa nạp định mức: ${res.missing.join(', ')}`
          : ''),
    )
  }
  console.log(`Xong: ${ok}/${chua.length} lệnh có bảng.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
