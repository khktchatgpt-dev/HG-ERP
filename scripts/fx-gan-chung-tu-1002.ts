/**
 * GÁN TỶ GIÁ CHỐT CHO CHỨNG TỪ NGOẠI TỆ CÒN THIẾU — 02/10/2026 (chủ dự án chốt
 * "chạy gán tỷ giá luôn đi" sau khi nạp giá kế hoạch).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/fx-gan-chung-tu-1002.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/fx-gan-chung-tu-1002.ts --apply   # ghi
 *
 * Đi qua ĐÚNG `fxRatesService.assignMissing` mà màn /finance/ty-gia dùng — cùng
 * luật: mỗi chứng từ lấy dòng tỷ giá mới nhất có ngày ≤ ngày chốt (đơn mua = ngày
 * duyệt, đơn bán = ngày xác nhận); không có dòng nào ≤ ngày đó thì ĐỨNG YÊN, không
 * lấy tỷ giá tương lai. Người gán = Kế toán trưởng (ketoan3) để sổ vết đúng vai.
 */
import { usersRepo } from '@/modules/core/users/users.repo'
import { fxRatesService } from '@/modules/dept/accounting/fx-rates.service'

async function main() {
  const APPLY = process.argv.includes('--apply')
  const user = await usersRepo.findByEmail('ketoan3@hoanggia.de')
  if (!user) throw new Error('không thấy ketoan3@hoanggia.de')

  const r = await fxRatesService.assignMissing(user, !APPLY)
  for (const p of r.plan) {
    console.log(
      `${p.rate == null ? '✗' : '✓'} ${p.kind.toUpperCase()} ${p.code.padEnd(14)} ${p.fx_date} ${p.currency} ${String(p.amount).padStart(12)}  → ${p.rate == null ? 'KHÔNG CÓ TỶ GIÁ ≤ ngày chốt' : `${p.rate} (dòng ${p.rate_date}) = ${p.base?.toLocaleString('vi-VN')} đ`}`,
    )
  }
  console.log(`\n${APPLY ? 'ĐÃ GÁN' : 'Sẽ gán'} ${r.assigned} · đứng yên ${r.skipped}`)
}
void main()
