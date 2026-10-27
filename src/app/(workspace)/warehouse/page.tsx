import { authService } from '@/modules/core/auth/auth.service'
import { hangVeRepo } from '@/modules/dept/warehouse/hang-ve.repo'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { soPhieuRepo } from '@/modules/dept/warehouse/so-phieu.repo'
import {
  laTruongKho,
  stocktakesService,
} from '@/modules/dept/warehouse/stocktakes.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'
import { loadWatchPos, todayIso } from '@/modules/dept/supply/watch-pos'
import { incomingBucket, isIncoming } from '@/lib/supply-watch'
import { dotKeTiep } from '@/lib/kho-hang-ve'
import { roCuaLenh, tomTatLenh } from '@/lib/kho-ton-lenh'
import { dungDangDo, dungHomNay } from '@/lib/kho-ban-lam-viec'
import { thuocRo, TRANG_THAI } from './kiem-ke/kiem-ke.shared'
import { HomNayScreen, type DongHangVe, type DongLenh } from './HomNayScreen'

export const metadata = { title: 'Kho · Hôm nay' }
export const dynamic = 'force-dynamic'

/** Số dòng gấp tối đa dưới mỗi khối việc (bản vẽ A: khối gọn, bấm nút xem hết). */
const TOI_DA = 3

/**
 * HÔM NAY — `/warehouse`, trang đầu khu Kho (B2 "Kho cho người mới", bản vẽ A
 * https://claude.ai/artifact/QpEkCkMHdMhFhF3WYhEF7z, duyệt Q1 27/10/2026; thay
 * Bàn làm việc B8a). Khuôn A: "hôm nay tôi làm gì trước?" — bốn việc, mỗi việc
 * vài con số và một nút.
 *
 * Mọi nguồn tải SONG SONG; mỗi số đếm bằng ĐÚNG hàm màn đích (luật ở
 * `lib/kho-ban-lam-viec.ts`). Chậm nhất là hàng của lệnh (~2 s) — cùng hàm Tồn
 * kho › Theo lệnh, nên không tính lại theo cách khác cho nhanh.
 */
export default async function HomNayPage() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const [watch, lenhAll, ton, thieu, dot, deNghi, truong] = await Promise.all([
    loadWatchPos(user),
    hangLenhService.tatCa(user),
    stockService.listStockPage(user, { bucket: 'has', page: 1, page_size: 1 }),
    soPhieuRepo.thieuSoNcc(today),
    stocktakesService.list(user, { page: 1, page_size: 100 }),
    deNghiService.list(user),
    laTruongKho(user),
  ])

  // Nhận hàng: cùng tập + mốc với /warehouse/nhap (isIncoming + incomingBucket).
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
      href: `/warehouse/nhap/${p.id}${ke ? `?dot=${ke.id}` : ''}`,
    }
  })

  // Xuất: cùng `tomTatLenh` + `roCuaLenh` của Tồn kho › Theo lệnh.
  const tt = tomTatLenh(lenhAll.rows, lenhAll.lenh)
  const ro = tt.map((x) => ({ x, r: roCuaLenh(x, today) }))
  const lenh: DongLenh[] = ro
    .filter(({ r }) => r.con)
    .slice(0, TOI_DA)
    .map(({ x }) => ({
      id: x.lenh.id,
      code: x.lenh.code,
      con: x.con_kho,
      ship_date: x.lenh.ship_date,
    }))

  const khoi = dungHomNay({
    hangVe: {
      tong: ve.length,
      overdue: dem('overdue'),
      today: dem('today'),
      week: dem('week'),
    },
    thieuNcc: { tong: thieu.ids.length, ganDay: thieu.ganDay },
    lenh: {
      con: ro.filter(({ r }) => r.con).length,
      conMa: ro.filter(({ r }) => r.con).reduce((s, { x }) => s + x.con_kho, 0),
      han: ro.filter(({ r }) => r.han).length,
      hanTen: ro.filter(({ r }) => r.han).map(({ x }) => x.lenh.code),
      xong: ro.filter(({ r }) => r.xong).length,
    },
    ton: { has: ton.counts.has, low: ton.counts.low, short: ton.counts.short },
    kiemKe: {
      lam: dot.rows.filter((t) => thuocRo(t, 'lam')).length,
      cho: dot.rows.filter((t) => thuocRo(t, 'cho')).length,
    },
    deNghi: { viec: deNghi.filter((p) => p.status === 'draft').length },
  })

  const laNhanh = (t: (typeof dot.rows)[number]) =>
    t.scope_kind === 'list' && t.scope_ref.nhanh === true
  const dangDo = dungDangDo({
    laTruong: truong,
    choDuyet: dot.rows
      .filter((t) => t.status === 'review' && laNhanh(t))
      .map((t) => ({ id: t.id, code: t.code, nguoi: t.created_by_name, so_ma: t.scope_count })), // prettier-ignore
    // Đợt mình mở / được phân đếm mà chưa xong (đợt nhanh không có bước này).
    dotLam: dot.rows
      .filter(
        (t) =>
          thuocRo(t, 'lam') && (t.created_by === user.id || t.assigned_to === user.id),
      )
      .map((t) => ({
        id: t.id,
        code: t.code,
        trang_thai: TRANG_THAI[t.status].nhan.toLowerCase(),
      })),
    deNghiNhap: deNghi.filter((p) => p.status === 'draft').length,
    thieuNccGanDay: thieu.ganDay,
  })

  return (
    <HomNayScreen
      today={today}
      nguoi={user.name ?? user.email}
      laTruong={truong}
      khoi={khoi}
      hangVe={hangVe}
      lenh={lenh}
      dangDo={dangDo}
    />
  )
}
