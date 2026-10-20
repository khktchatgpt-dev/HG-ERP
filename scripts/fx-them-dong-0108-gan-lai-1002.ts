/**
 * THÊM DÒNG TỶ GIÁ TRƯỚC 05/08 RỒI GÁN LẠI — 02/10/2026 (chủ dự án: "thêm dòng tỷ
 * giá trước 05/08 rồi gán lại đi").
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/fx-them-dong-0108-gan-lai-1002.ts
 *
 * Dòng thêm: USD · 01/08/2026 · 25.400 · nguồn "Nhập tay". Số 25.400 là CHÉP từ
 * dòng 12/08 (dòng duy nhất Kế toán đã khai) để 20 đơn bán xác nhận 05/08 có tỷ
 * giá chốt — không phải tỷ giá thị trường ngày 01/08. Ghi rõ trong `note` để Kế
 * toán biết mà sửa nếu muốn; dòng đã bị chứng từ dùng thì khoá (FX_IN_USE), muốn
 * đổi phải gỡ chứng từ trước. Rồi `assignMissing` ghi thật (cùng luật màn Tỷ giá).
 */
import { usersRepo } from '@/modules/core/users/users.repo'
import { fxRatesService } from '@/modules/dept/accounting/fx-rates.service'

async function main() {
  const user = await usersRepo.findByEmail('ketoan3@hoanggia.de')
  if (!user) throw new Error('không thấy ketoan3@hoanggia.de')

  const row = await fxRatesService.create(user, {
    currency: 'USD',
    rate_date: '2026-08-01',
    rate: 25400,
    source: 'tay',
    note: 'Chép từ dòng 12/08 để gán cho đơn bán xác nhận 05/08 (02/10/2026, theo chủ dự án) — Kế toán kiểm lại nếu có tỷ giá thật',
  })
  console.log('Đã thêm dòng', row.currency, row.rate_date, row.rate)

  const r = await fxRatesService.assignMissing(user, false)
  for (const p of r.plan) {
    console.log(
      `${p.rate == null ? '✗' : '✓'} ${p.kind.toUpperCase()} ${p.code.padEnd(20)} ${p.fx_date} ${p.currency} → ${p.rate == null ? 'KHÔNG CÓ TỶ GIÁ' : `${p.rate} (dòng ${p.rate_date})`}`,
    )
  }
  console.log(`\nĐÃ GÁN ${r.assigned} · đứng yên ${r.skipped}`)
}
void main()
