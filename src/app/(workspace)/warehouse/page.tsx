import { authService } from '@/modules/core/auth/auth.service'
import { hangVeRepo } from '@/modules/dept/warehouse/hang-ve.repo'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { soPhieuRepo } from '@/modules/dept/warehouse/so-phieu.repo'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { loadWatchPos, todayIso } from '@/modules/dept/supply/watch-pos'
import { incomingBucket, isIncoming } from '@/lib/supply-watch'
import { dotKeTiep } from '@/lib/kho-hang-ve'
import { roCuaLenh, tomTatLenh } from '@/lib/kho-ton-lenh'
import { dungBanLamViec } from '@/lib/kho-ban-lam-viec'
import { thuocRo } from './kiem-ke/kiem-ke.shared'
import { BanLamViecScreen, type DongHangVe, type DongLenh } from './BanLamViecScreen'

export const metadata = { title: 'Kho · Bàn làm việc' }
export const dynamic = 'force-dynamic'

/** Số dòng tối đa của mỗi bảng dưới ô việc (bản vẽ Q3). */
const TOI_DA = 6

/**
 * BÀN LÀM VIỆC KHO — `/warehouse`, trang đầu khu Kho (B8a, bản vẽ BLV-1 duyệt
 * 19/10/2026: https://claude.ai/artifact/PvUSfGoMDrT7nMjGz4yezC). Khuôn A.
 *
 * Mọi nguồn tải SONG SONG; mỗi ô đếm bằng ĐÚNG hàm màn đích dùng (luật ở
 * `lib/kho-ban-lam-viec.ts`). Chậm nhất là hàng của lệnh (~2 s) — cùng hàm Tồn
 * kho › Theo lệnh, nên không tính lại theo cách khác cho nhanh.
 */
export default async function BanLamViecPage() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const [watch, lenhAll, ton, thieu, dot, deNghi] = await Promise.all([
    loadWatchPos(user),
    hangLenhService.tatCa(user),
    stockService.listStockPage(user, { bucket: 'has', page: 1, page_size: 1 }),
    soPhieuRepo.thieuSoNcc(today),
    stocktakesService.list(user, { page: 1, page_size: 100 }),
    deNghiService.list(user),
  ])

  // Hàng về: cùng tập + mốc với /warehouse/nhap (isIncoming + incomingBucket).
  const ve = watch.rows
    .filter(isIncoming)
    .map((p) => ({ p, b: incomingBucket(p, today) }))
  const dem = (b: string) => ve.filter((x) => x.b === b).length
  const gap = ve
    .filter((x) => x.b === 'overdue' || x.b === 'today')
    .sort((a, b) => (a.p.expected_at ?? '').localeCompare(b.p.expected_at ?? ''))
    .slice(0, TOI_DA)
  const ids = gap.map((x) => x.p.id)
  const [dotBy, lineOpen] = await Promise.all([
    hangVeRepo.dotMoTheoDon(ids),
    hangVeRepo.lineOpenByPoIds(ids),
  ])
  const hangVe: DongHangVe[] = gap.map(({ p }) => {
    const d = dotBy.get(p.id)
    const ke = d ? dotKeTiep(d.dots, d.so_dot, lineOpen)?.ke_tiep : null
    return {
      po_id: p.id,
      code: p.code,
      ncc: p.supplier_name,
      hen: p.expected_at ? p.expected_at.slice(0, 10) : null,
      phu_trach: p.assignee_name,
      href: `/warehouse/nhap/${p.id}${ke ? `?dot=${ke.id}` : ''}`,
    }
  })

  // Lệnh: cùng `tomTatLenh` + `roCuaLenh` của Tồn kho › Theo lệnh.
  const tt = tomTatLenh(lenhAll.rows, lenhAll.lenh)
  const ro = tt.map((x) => ({ x, r: roCuaLenh(x, today) }))
  const lenh: DongLenh[] = ro
    .filter(({ r }) => r.con)
    .slice(0, TOI_DA)
    .map(({ x }) => ({
      id: x.lenh.id,
      code: x.lenh.code,
      khach: x.lenh.khach,
      con: x.con_kho,
      ship_date: x.lenh.ship_date,
    }))

  const nhom = dungBanLamViec({
    hangVe: { overdue: dem('overdue'), today: dem('today'), week: dem('week') },
    thieuNcc: { tong: thieu.ids.length, ganDay: thieu.ganDay },
    lenh: {
      con: ro.filter(({ r }) => r.con).length,
      conMa: ro.filter(({ r }) => r.con).reduce((s, { x }) => s + x.con_kho, 0),
      han: ro.filter(({ r }) => r.han).length,
      hanTen: ro.filter(({ r }) => r.han).map(({ x }) => x.lenh.code),
      xong: ro.filter(({ r }) => r.xong).length,
    },
    ton: { low: ton.counts.low, short: ton.counts.short },
    kiemKe: {
      lam: dot.rows.filter((t) => thuocRo(t, 'lam')).length,
      cho: dot.rows.filter((t) => thuocRo(t, 'cho')).length,
    },
    // Rổ "Kho cần làm" của Sổ đề nghị = phiếu nháp (kể cả bị từ chối về nháp).
    deNghi: { viec: deNghi.filter((p) => p.status === 'draft').length },
  })

  return (
    <BanLamViecScreen
      today={today}
      nhom={nhom}
      hangVe={hangVe}
      conGap={Math.max(0, dem('overdue') + dem('today') - hangVe.length)}
      lenh={lenh}
      conLenh={Math.max(0, ro.filter(({ r }) => r.con).length - lenh.length)}
    />
  )
}
