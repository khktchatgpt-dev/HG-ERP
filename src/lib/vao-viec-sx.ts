import type { OverviewRow, PulseUnit } from '@/modules/dept/production/jobs.service'
import { isUnshaped, needsRoute, type ShapingRow } from './shaping-status'
import { isStale } from './lsx-holder'

/**
 * VÀO VIỆC SẢN XUẤT (khuôn A, bản vẽ 10/11/2026
 * https://claude.ai/artifact/AMZpLvxJAaZKCDimF93qJL, duyệt Q1–Q6) — phần THUẦN:
 * dải SÁU BƯỚC đường đi của lệnh (số lệnh đang CHỜ ở mỗi bước) và bảng "Việc
 * của bạn hôm nay" (≤ 5 dòng theo quyền). Mọi số đếm bằng CÙNG vị từ với chip
 * của Lệnh sản xuất (`views.ts`) và Lộ trình công đoạn (`shaping-status`), nên
 * bấm số ra đúng chừng ấy dòng. Không `'use client'` để test và server dùng.
 */

export type Row = Pick<
  OverviewRow,
  'lsx' | 'component_count' | 'jobs_total' | 'jobs_no_end' | 'qty_done' | 'holder'
>
export type Shaping = Pick<
  ShapingRow,
  'lsx' | 'component_count' | 'cluster_unrouted' | 'lines_missing_bom'
>

export type Buoc = {
  so: number
  label: string
  ai: string
  /** Số lệnh đang CHỜ ở bước này (không cộng dồn). */
  n: number
  donVi: string
  tone: 'warn' | 'stop' | 'zero' | null
  moTa: string
  href: string
  nut: string
  nut2?: { label: string; href: string }
}

export type Viec = {
  tone: 'stop' | 'warn' | 'act'
  viec: string
  lenh: string
  moc: string
  mocTone: 'stop' | 'warn' | null
  href: string
  nut: string
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * "Đạt hôm nay" bày THEO ĐƠN VỊ — "600 chi tiết · 40 cụm · 160 bộ", không cộng
 * dọc thành một số (10/11/2026: "800 đạt hôm nay" là số vô nghĩa). Thứ tự
 * bộ → cụm → chi tiết như Khối lượng theo công đoạn. Không có gì → "0".
 */
export function datHomNayText(byUnit: PulseUnit[]): string {
  const parts = byUnit.filter((u) => u.qty > 0).map((u) => `${fmt(u.qty)} ${u.unit}`)
  return parts.length ? parts.join(' · ') : '0'
}

/** Bậc đếm CHÍNH để vẽ % ngày: bộ nếu có số, rồi cụm, rồi chi tiết. */
export function pulseChinh(byUnit: PulseUnit[]): PulseUnit | null {
  return byUnit.find((u) => u.qty > 0 || u.target > 0) ?? null
}
const dm = (iso: string) => iso.slice(5, 10).split('-').reverse().join('/')
const dmy2 = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`

export function daysBetween(today: string, iso: string): number {
  return Math.round(
    (Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  )
}

/** Mốc hạn xuất: "19/10 · trễ 22đ" (stop) · "29/11 · còn 19đ" (warn ≤ 30) · "11/01/27 · còn 62đ". */
export function mocHan(
  shipDate: string | null,
  today: string,
): { text: string; tone: Viec['mocTone'] } {
  if (!shipDate) return { text: 'chưa có hạn', tone: null }
  const d = daysBetween(today, shipDate)
  const sameYear = shipDate.slice(0, 4) === today.slice(0, 4)
  const date = sameYear ? dm(shipDate) : dmy2(shipDate)
  if (d < 0) return { text: `${date} · trễ ${fmt(-d)}đ`, tone: 'stop' }
  if (d === 0) return { text: `${date} · hôm nay`, tone: 'warn' }
  return { text: `${date} · còn ${fmt(d)}đ`, tone: d <= 30 ? 'warn' : null }
}

/** Mã lệnh gọn: "01/26-27 - JAWOLL" → "JAWOLL 01"; "13/26-27 - MX" → "MX 13". */
export function maGon(code: string): string {
  const m = code.match(/^(\d+)\/\S+\s*-\s*(.+)$/)
  return m ? `${m[2].trim()} ${m[1]}` : code
}

function byShip<T extends { lsx: { ship_date: string | null } }>(a: T, b: T): number {
  return (a.lsx.ship_date ?? '9999').localeCompare(b.lsx.ship_date ?? '9999')
}

/** Dải SÁU BƯỚC — số ở mỗi ô là lệnh đang CHỜ bước đó. */
export function duongDiCuaLenh(
  rows: Row[],
  shaping: Shaping[],
  today: string,
  datHomNay: string,
): Buoc[] {
  const late = rows.filter((r) => r.lsx.late === 'overdue')
  const dueSoon = rows.filter((r) => {
    if (!r.lsx.ship_date || r.lsx.late === 'overdue') return false
    return daysBetween(today, r.lsx.ship_date) <= 30
  })
  const unshaped = shaping.filter(isUnshaped)
  const choKT = unshaped.filter((r) => r.lines_missing_bom > 0)
  const chuaNap = unshaped.filter((r) => r.lines_missing_bom === 0)
  const canRoute = shaping.filter(needsRoute)
  const phang = shaping.filter((r) => !needsRoute(r) && !isUnshaped(r))
  const noPlan = rows.filter((r) => r.jobs_total === 0)
  const coToKhongHan = rows.filter((r) => r.jobs_total > 0 && r.jobs_no_end > 0)
  const coSo = rows.filter((r) => r.qty_done > 0)

  return [
    {
      so: 1,
      label: 'Lệnh duyệt',
      ai: 'Giám đốc',
      n: rows.length,
      donVi: 'đang chạy',
      tone: null,
      moTa: `${fmt(late.length)} đã trễ hạn xuất · ${fmt(dueSoon.length)} hạn trong 30 ngày`,
      href: '/thongke/lenh',
      nut: 'Lệnh sản xuất ›',
    },
    {
      so: 2,
      label: 'Bảng chi tiết',
      ai: 'Kỹ thuật nạp định mức',
      n: unshaped.length,
      donVi: 'chờ',
      tone: unshaped.length > 0 ? 'warn' : 'zero',
      moTa: `${fmt(choKT.length)} chưa định mức · ${fmt(chuaNap.length)} chưa nạp bảng`,
      href: '/thongke/lenh?view=noshape',
      nut: `Xem ${fmt(unshaped.length)} lệnh ›`,
      ...(choKT.length > 0
        ? { nut2: { label: 'Giao việc', href: '/phan-cong-viec?muc=giao' } }
        : {}),
    },
    {
      so: 3,
      label: 'Lộ trình cụm',
      ai: 'Kế hoạch',
      n: canRoute.length,
      donVi: 'chờ khai',
      tone: canRoute.length > 0 ? 'warn' : 'zero',
      moTa:
        (canRoute.length > 0
          ? `${canRoute
              .slice(0, 2)
              .map((r) => maGon(r.lsx.code))
              .join(', ')}${canRoute.length > 2 ? ` +${canRoute.length - 2}` : ''} · `
          : '') + `${fmt(phang.length)} lệnh phẳng không cần`,
      href: '/thongke/lo-trinh',
      nut: 'Lộ trình công đoạn ›',
    },
    {
      so: 4,
      label: 'Giao tổ & hạn',
      ai: 'Kế hoạch',
      n: noPlan.length,
      donVi: 'chưa giao',
      tone: noPlan.length > 0 ? 'warn' : 'zero',
      moTa:
        coToKhongHan.length > 0
          ? `${coToKhongHan
              .map((r) => maGon(r.lsx.code))
              .slice(0, 2)
              .join(', ')} có tổ, chưa hạn`
          : `${fmt(rows.length - noPlan.length)} lệnh đã giao`,
      href: '/kehoach-sx',
      nut: 'Giao tổ & hạn ›',
    },
    {
      so: 5,
      label: 'Ghi sổ hằng ngày',
      ai: 'Thống kê tổ · khu TK',
      n: coSo.length,
      donVi: 'lệnh có sổ',
      tone: coSo.length > 0 ? null : 'zero',
      moTa: coSo.length > 0 ? `hôm nay đạt ${datHomNay}` : 'chỉ ghi được sau bước 4',
      href: '/thongke/bao-cao',
      nut: 'Báo cáo ›',
    },
    {
      so: 6,
      label: 'Xuất hàng',
      ai: 'Bán hàng · Kho',
      n: late.length,
      donVi: 'trễ hạn',
      tone: late.length > 0 ? 'stop' : 'zero',
      moTa:
        late.length > 0
          ? late
              .slice(0, 2)
              .map(
                (r) =>
                  `${maGon(r.lsx.code)} ${mocHan(r.lsx.ship_date, today).text.split(' · ')[1]}`,
              )
              .join(' · ')
          : 'không lệnh nào quá hạn',
      href: '/thongke/lenh?view=late',
      nut: 'Lệnh trễ ›',
    },
  ]
}

/** Việc hôm nay của KẾ HOẠCH (production.plan.manage) — ≤ 5 dòng, lệnh trễ trước. */
export function viecKeHoach(rows: Row[], shaping: Shaping[], today: string): Viec[] {
  const sh = new Map(shaping.map((s) => [s.lsx.id, s]))
  const out: Viec[] = []
  const coBang = rows.filter((r) => r.component_count > 0)
  const chuaGiao = coBang.filter((r) => r.jobs_total === 0).sort(byShip)

  // 1 · Lệnh đã trễ hạn xuất mà chưa có kế hoạch — mỗi lệnh một dòng.
  for (const r of chuaGiao.filter((r) => r.lsx.late === 'overdue')) {
    const s = sh.get(r.lsx.id)
    const canRoute = s ? needsRoute(s) : false
    const moc = mocHan(r.lsx.ship_date, today)
    out.push({
      tone: 'stop',
      viec: canRoute
        ? `Khai lộ trình ${fmt(s!.cluster_unrouted)} cụm rồi giao tổ & hạn — lệnh đã trễ, chưa có kế hoạch`
        : 'Giao tổ & hạn — lệnh đã trễ, có bảng chi tiết, chưa ai làm',
      lenh: maGon(r.lsx.code),
      moc: moc.text,
      mocTone: moc.tone,
      href: canRoute ? `/thongke/lo-trinh?lsx=${r.lsx.id}` : `/kehoach-sx/${r.lsx.id}`,
      nut: canRoute ? 'Lộ trình công đoạn ›' : 'Giao tổ & hạn ›',
    })
  }
  // 2 · Còn lại chưa giao: gom theo hạn xuất (Q5), sớm nhất trước.
  const conLai = chuaGiao.filter((r) => r.lsx.late !== 'overdue')
  const nhom = new Map<string, Row[]>()
  for (const r of conLai) {
    const k = r.lsx.ship_date ?? ''
    nhom.set(k, [...(nhom.get(k) ?? []), r])
  }
  for (const [, rs] of nhom) {
    const moc = mocHan(rs[0].lsx.ship_date, today)
    out.push({
      tone: moc.tone === 'warn' ? 'warn' : 'act',
      viec:
        rs.length > 1
          ? `Giao tổ & hạn cho ${fmt(rs.length)} lệnh cùng hạn ${moc.text.split(' · ')[0]} — đã có bảng chi tiết`
          : 'Giao tổ & hạn — đã có bảng chi tiết',
      lenh: rs.map((r) => maGon(r.lsx.code)).join(' · '),
      moc: moc.text,
      mocTone: moc.tone,
      href: rs.length > 1 ? '/kehoach-sx' : `/kehoach-sx/${rs[0].lsx.id}`,
      nut: 'Giao tổ & hạn ›',
    })
  }
  // 3 · Chờ Kỹ thuật: một dòng, nhắc qua Phân công việc.
  const choKT = shaping
    .filter((s) => isUnshaped(s) && s.lines_missing_bom > 0)
    .sort(byShip)
  if (choKT.length > 0) {
    const gan = choKT.filter(
      (s) => s.lsx.ship_date && daysBetween(today, s.lsx.ship_date) <= 30,
    )
    const moc = mocHan(choKT[0].lsx.ship_date, today)
    out.push({
      tone: gan.length > 0 ? 'warn' : 'act',
      viec: `Nhắc Kỹ thuật nạp định mức ${fmt(choKT.length)} lệnh${gan.length > 0 ? ` — ${fmt(gan.length)} lệnh hạn trong 30 ngày` : ''}`,
      lenh: choKT.map((s) => maGon(s.lsx.code)).join(' · '),
      moc: moc.text,
      mocTone: moc.tone,
      href: '/phan-cong-viec?muc=giao',
      nut: 'Giao việc cho Kỹ thuật ›',
    })
  }
  // 4 · Có định mức nhưng chưa nạp bảng.
  const chuaNap = shaping
    .filter((s) => isUnshaped(s) && s.lines_missing_bom === 0)
    .sort(byShip)
  if (chuaNap.length > 0) {
    const moc = mocHan(chuaNap[0].lsx.ship_date, today)
    out.push({
      tone: moc.tone === 'warn' ? 'warn' : 'act',
      viec: `Nạp bảng chi tiết cho ${fmt(chuaNap.length)} lệnh đã có định mức (mở lệnh là tự nạp)`,
      lenh: chuaNap.map((s) => maGon(s.lsx.code)).join(' · '),
      moc: moc.text,
      mocTone: moc.tone,
      href: '/thongke/lo-trinh',
      nut: 'Lộ trình công đoạn ›',
    })
  }
  // 5 · Đã giao tổ nhưng việc chưa có hạn.
  for (const r of rows
    .filter((r) => r.jobs_total > 0 && r.jobs_no_end > 0)
    .sort(byShip)) {
    const moc = mocHan(r.lsx.ship_date, today)
    out.push({
      tone: 'warn',
      viec: `Đặt hạn cho ${fmt(r.jobs_no_end)} việc đã giao tổ`,
      lenh: maGon(r.lsx.code),
      moc: moc.text,
      mocTone: moc.tone,
      href: `/kehoach-sx/${r.lsx.id}`,
      nut: 'Giao tổ & hạn ›',
    })
  }
  const rank = { stop: 0, warn: 1, act: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5)
}

/** Việc hôm nay của QUẢN ĐỐC (production.overview) — ≤ 5 dòng. */
export function viecQuanDoc(
  rows: Row[],
  opts: {
    today: string
    /** Nhãn công đoạn chưa có tổ nào gắn `stage_code`. */
    congDoanChuaTo: string[]
    /** Số tổ có việc hôm nay mà chưa chốt sổ. */
    toChuaChot: number
    /** Lệnh có kế hoạch ĐỦ hạn để thống kê ghi theo (jobs có planned_end). */
    lenhDuKeHoach: number
  },
): Viec[] {
  const out: Viec[] = []
  const late = rows.filter((r) => r.lsx.late === 'overdue').sort(byShip)
  const stale = rows.filter((r) => isStale(r.holder))
  if (rows.length > 0 && rows.every((r) => r.qty_done === 0)) {
    out.push({
      tone: 'stop',
      viec: `Chọn lệnh thí điểm ghi sổ cùng Kế hoạch — hôm nay ${fmt(opts.lenhDuKeHoach)} lệnh có kế hoạch đủ tổ & hạn để thống kê ghi`,
      lenh: `${fmt(rows.length)} lệnh`,
      moc: dm(opts.today),
      mocTone: null,
      href: '/kehoach-sx',
      nut: 'Giao tổ & hạn ›',
    })
  }
  if (opts.congDoanChuaTo.length > 0) {
    out.push({
      tone: 'warn',
      viec: `Gắn tổ cho ${fmt(opts.congDoanChuaTo.length)} công đoạn chưa có tổ (${opts.congDoanChuaTo.join(' · ')})`,
      lenh: 'Cấu hình công đoạn',
      moc: '—',
      mocTone: null,
      href: '/production/cau-hinh/cong-doan',
      nut: 'Công đoạn ›',
    })
  }
  if (late.length > 0) {
    out.push({
      tone: 'stop',
      viec: `${fmt(late.length)} lệnh đã trễ hạn xuất — hỏi Kế hoạch hay Bán hàng dời hạn`,
      lenh: late.map((r) => maGon(r.lsx.code)).join(' · '),
      moc: late
        .map((r) => mocHan(r.lsx.ship_date, opts.today).text.split(' · ')[1])
        .join(' · '),
      mocTone: 'stop',
      href: '/thongke/lenh?view=late',
      nut: 'Lệnh trễ ›',
    })
  }
  if (opts.toChuaChot > 0) {
    out.push({
      tone: 'warn',
      viec: `${fmt(opts.toChuaChot)} tổ có việc hôm nay chưa chốt sổ`,
      lenh: 'Sổ ngày',
      moc: dm(opts.today),
      mocTone: 'warn',
      href: '/thongke/ngay',
      nut: 'Sổ ngày & chốt sổ ›',
    })
  }
  if (stale.length > 0) {
    out.push({
      tone: 'warn',
      viec: `${fmt(stale.length)} lệnh nằm im — bóng ở một phòng mà không ai động vào`,
      lenh:
        stale
          .slice(0, 3)
          .map((r) => maGon(r.lsx.code))
          .join(' · ') + (stale.length > 3 ? ` +${stale.length - 3}` : ''),
      moc: '≥ 3 ngày',
      mocTone: 'warn',
      href: '/thongke/lenh?view=stale',
      nut: 'Lệnh nằm im ›',
    })
  }
  const rank = { stop: 0, warn: 1, act: 2 }
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5)
}

/** Số tổ có việc hôm nay mà chưa chốt sổ — cùng vị từ với ô "Tổ chưa chốt sổ" của Khi xưởng chạy. */
export function toChuaChot(
  workload: { locked_today: boolean; today_qty: number; todo: number; doing: number }[],
): number {
  return workload.filter(
    (w) => !w.locked_today && (w.today_qty > 0 || w.todo + w.doing > 0),
  ).length
}
