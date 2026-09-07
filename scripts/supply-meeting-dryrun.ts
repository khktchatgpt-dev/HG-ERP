/**
 * CHẠY THỬ luật rủi ro bảng họp Cung ứng trên LỆNH THẬT — bước nghiệm thu B1
 * (05/09/2026), trước khi dựng giao diện. Chỉ ĐỌC, không ghi gì.
 *
 * Chạy từ gốc repo (cần .env.local có SUPABASE_SECRET_KEY):
 *   npx tsx --env-file=.env.local scripts/supply-meeting-dryrun.ts
 *
 * Dùng đúng `buildLsxSupplyRows` mà màn /planning/lsx và file Excel họp đang
 * dùng — đo bằng đúng đường mà tính năng sẽ đi, không đếm bảng nguồn rồi suy.
 */
import { db } from '@/server/db'
import { buildLsxSupplyRows } from '@/modules/dept/supply/lsx-supply.service'
import { buildMeeting, MEETING_LEVEL } from '@/lib/supply-meeting'
import type { User } from '@/modules/core/users/users.repo'

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: admin } = await db()
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (!admin) throw new Error('Không tìm thấy tài khoản admin để đọc dữ liệu')

  const rows = await buildLsxSupplyRows(admin as User, today)
  const m = buildMeeting(rows, today)

  console.log(`Hôm nay ${today} · ${rows.length} lệnh đang chạy`)
  console.log(
    Object.entries(m.counts)
      .map(([k, v]) => `${MEETING_LEVEL[k as keyof typeof MEETING_LEVEL].label}: ${v}`)
      .join(' · '),
  )
  console.log('')
  const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
  for (const { row, risk } of m.rows) {
    const due = risk.due
      ? `${risk.due.date.slice(5)}${risk.due.source === 'ship_date' ? '*' : ''} (${risk.daysLeft})`
      : '—'
    console.log(
      [
        pad(risk.label, 16),
        pad(row.code, 24),
        pad(row.customer_name, 12),
        pad(due, 14),
        pad(
          `đơn ${row.posTotal}/nháp ${row.posUnsent}/mở ${row.posOpen}/trễ ${row.posLate}`,
          30,
        ),
        risk.owner,
      ].join(' | '),
    )
    console.log(
      `${' '.repeat(18)}↳ ${risk.reason}${risk.action ? ` → ${risk.action}` : ''}`,
    )
  }
  console.log('\n* = mốc mượn từ ngày xuất vì lệnh chưa đặt hạn vật tư')
  console.log(
    `\nVấn đề nêu trong họp: ${m.issues.length} · Cần Sản xuất quyết: ${m.decisions.length}`,
  )
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
