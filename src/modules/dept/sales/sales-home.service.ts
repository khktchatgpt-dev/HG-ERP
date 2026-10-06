import type { User } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { db } from '@/server/db'
import { planCostService } from '@/modules/dept/technical/plan-cost.service'
import { tinhTrang, cong, thangCua, type DotXuat } from '@/lib/ke-hoach-xuat'
import { sapLan, type LanViec } from '@/lib/viec-sale'
import { shipPlanService } from './ship-plan.service'

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const usd = (v: number) => Math.round(v).toLocaleString('vi-VN')
const ngayGiua = (a: string, b: string) =>
  Math.round((Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / 86_400_000) // prettier-ignore

/** Báo giá nằm im quá ngần này ngày (nháp chưa gửi / đã gửi chưa chốt) là việc treo. */
const BAO_GIA_TREO = 14
const SAP_XUAT_LIST = 45

export type SalesHome = {
  today: string
  lans: LanViec[]
  /** Đợt xuất trong 45 ngày tới — lịch ngắn bên phải. */
  sapXuat: (DotXuat & { tt: ReturnType<typeof tinhTrang> })[]
  thangNay: { xuat: { value: number; n: number }; nhan: { value: number; n: number } }
}

export const salesHomeService = {
  /**
   * TRANG CHỦ SALE — các làn việc + lịch xuất ngắn. Mọi số tính từ CÙNG nguồn
   * với trang đích (xem `lib/viec-sale.ts`). Làn giá thành chỉ có khi người
   * xem có quyền `technical.plan_cost.view`.
   */
  async home(user: User, today: string): Promise<SalesHome> {
    const canCost = await canAction(user, 'technical.plan_cost.view')
    const [dots, plan, orders, lines, quotes] = await Promise.all([
      shipPlanService.board(user),
      canCost ? planCostService.board(user) : null,
      db().from('sales_orders').select('id, code, status, due_date, created_at, customer:sales_customers(name)').neq('status', 'cancelled').limit(5000), // prettier-ignore
      db().from('sales_order_lines').select('order_id, unit_price, qty').limit(5000),
      db().from('sales_quotes').select('id, code, status, created_at, valid_to, customer:sales_customers(name)').in('status', ['draft', 'sent']).limit(500), // prettier-ignore
    ])
    for (const r of [orders, lines, quotes]) if (r.error) throw r.error
    type One<T> = T | T[] | null
    const ten = (c: One<{ name: string }>) =>
      (Array.isArray(c) ? c[0]?.name : c?.name) ?? '—'

    const lans: LanViec[] = []

    // 1. Đợt xuất cần để ý — CÙNG `tinhTrang` với Kế hoạch xuất hàng.
    const deY = dots
      .map((d) => ({ d, t: tinhTrang(d, today) }))
      .filter((x) => x.t.canDeY)
      .sort((a, b) => (a.d.ship_date ?? '9') < (b.d.ship_date ?? '9') ? -1 : 1) // prettier-ignore
    lans.push({
      key: 'de-y',
      title: 'Đợt xuất cần để ý',
      action: 'Hỏi Cung ứng / xưởng — báo khách nếu phải dời',
      why: 'Quá ngày xuất, hoặc xuất trong 45 ngày mà đơn mua vật tư của lệnh chưa về đủ.',
      tone: deY.some((x) => x.t.tone === 'stop') ? 'stop' : 'warn',
      count: deY.length,
      items: deY.map(({ d, t }) => ({
        id: d.id,
        title: `${d.ship_date ? ngay(d.ship_date) : '—'} · ${d.customer} · ${d.label}`,
        detail: `${d.lsx_code} · ${d.value != null ? usd(d.value) + ' USD' : 'chưa có trị giá'}`,
        tag: { tone: t.tone, text: t.text },
        href: `/sales/lsx/${d.lsx_id}`,
      })),
      more: { href: '/sales/ke-hoach-xuat', label: 'Mở Kế hoạch xuất hàng' },
    })

    // 2. Đơn còn dòng chưa có giá.
    const gia0 = new Map<string, number>()
    for (const l of lines.data ?? [])
      if (!(Number(l.unit_price) > 0))
        gia0.set(l.order_id, (gia0.get(l.order_id) ?? 0) + 1)
    const donGia0 = (orders.data ?? []).filter((o) => gia0.has(o.id))
    lans.push({
      key: 'gia-0',
      title: 'Đơn còn dòng chưa có giá',
      action: 'Điền đơn giá',
      why: 'Dòng giá 0 làm trị giá đơn, kế hoạch xuất và phân tích doanh số thiếu.',
      tone: 'warn',
      count: donGia0.length,
      items: donGia0.map((o) => ({
        id: o.id,
        title: `${o.code} · ${ten(o.customer as One<{ name: string }>)}`,
        detail: `${gia0.get(o.id)} dòng giá 0`,
        href: '/sales/orders/gia',
      })),
      more: { href: '/sales/orders/gia', label: 'Mở Điền đơn giá' },
    })

    // 3. Đợt chưa có ngày xuất riêng — đang mượn ngày cuối của lệnh.
    const muon = dots.filter((d) => d.date_src === 'lenh' && d.lsx_status !== 'completed')
    lans.push({
      key: 'chua-ngay',
      title: 'Đợt chưa có ngày xuất riêng',
      action: 'Chia đợt / ghi ngày xuất ở dòng lệnh',
      why: 'Đợt đang mượn ngày xuất cuối của lệnh — kế hoạch xuất dồn sai tháng.',
      tone: 'warn',
      count: muon.length,
      items: muon.map((d) => ({
        id: d.id,
        title: `${d.lsx_code} · ${d.label}`,
        detail: `${d.customer} · mượn ${d.ship_date ? ngay(d.ship_date) : '—'}${d.value != null ? ` · ${usd(d.value)} USD` : ''}`, // prettier-ignore
        href: `/sales/lsx/${d.lsx_id}/dong`,
      })),
    })

    // 4. Đơn đang chạy chưa có hạn giao.
    const thieuHan = (orders.data ?? []).filter(
      (o) => !o.due_date && o.status !== 'completed',
    )
    lans.push({
      key: 'han-giao',
      title: 'Đơn chưa có hạn giao',
      action: 'Ghi hạn giao khách',
      why: 'Không có hạn thì không cảnh báo trễ được.',
      tone: 'neutral',
      count: thieuHan.length,
      items: thieuHan.map((o) => ({
        id: o.id,
        title: `${o.code} · ${ten(o.customer as One<{ name: string }>)}`,
        detail: `lập ${ngay(o.created_at)}`,
        href: `/sales/orders/${o.id}/edit`,
      })),
    })

    // 5. SP đang chạy chưa bóc tách giá thành — CÙNG `stats.complete` của trang Giá thành.
    if (plan) {
      const thieu = plan.rows.filter((r) => !r.complete)
      const byKhach = new Map<string, number>()
      for (const r of thieu) {
        const k = r.customer_name ?? '— chưa rõ khách —'
        byKhach.set(k, (byKhach.get(k) ?? 0) + 1)
      }
      lans.push({
        key: 'gia-thanh',
        title: 'SP đang chạy chưa bóc tách giá thành',
        action: 'Điền chi phí trực tiếp · chung · lãi',
        why: `Chỉ có giá FOB thì không tính được lãi kế hoạch — đủ bóc tách ${plan.stats.complete}/${plan.stats.total} SP.`, // prettier-ignore
        tone: 'neutral',
        count: thieu.length,
        count_note: 'gom theo khách',
        items: [...byKhach.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, n]) => ({
            id: k,
            title: k,
            detail: `${n} SP`,
            href: '/sales/gia-thanh',
          })),
        more: { href: '/sales/gia-thanh', label: 'Mở Giá thành kế hoạch' },
      })
    }

    // 6. Báo giá treo — nháp chưa gửi / đã gửi chưa chốt, nằm im ≥ 14 ngày.
    const treo = (quotes.data ?? []).filter(
      (q) => ngayGiua(today, q.created_at) >= BAO_GIA_TREO,
    )
    lans.push({
      key: 'bao-gia',
      title: 'Báo giá nằm im',
      action: 'Gửi, chốt thành đơn, hoặc huỷ cho gọn sổ',
      why: `Nháp chưa gửi hoặc đã gửi mà chưa chốt, quá ${BAO_GIA_TREO} ngày.`,
      tone: 'neutral',
      count: treo.length,
      items: treo.map((q) => ({
        id: q.id,
        title: `${q.code} · ${ten(q.customer as One<{ name: string }>)}`,
        detail: `${q.status === 'draft' ? 'nháp' : 'đã gửi'} từ ${ngay(q.created_at)} · ${ngayGiua(today, q.created_at)} ngày`, // prettier-ignore
        tag: q.valid_to && q.valid_to < today ? { tone: 'stop', text: 'hết hiệu lực' } : undefined, // prettier-ignore
        href: `/sales/quotes/${q.id}`,
      })),
      more: { href: '/sales/quotes', label: 'Mở Báo giá' },
    })

    const sapXuat = dots
      .filter(
        (d) =>
          d.lsx_status !== 'completed' &&
          d.ship_date &&
          ngayGiua(d.ship_date, today) >= 0 &&
          ngayGiua(d.ship_date, today) <= SAP_XUAT_LIST,
      ) // prettier-ignore
      .sort((a, b) => (a.ship_date! < b.ship_date! ? -1 : 1))
      .map((d) => ({ ...d, tt: tinhTrang(d, today) }))
    const m = thangCua(today)
    const xuatThang = dots.filter((d) => d.lsx_status !== 'completed' && d.ship_date && thangCua(d.ship_date) === m) // prettier-ignore
    const donThang = (orders.data ?? []).filter((o) => o.created_at.slice(0, 7) === m)
    const giaTri = new Map<string, number>()
    for (const l of lines.data ?? [])
      giaTri.set(l.order_id, (giaTri.get(l.order_id) ?? 0) + Number(l.qty) * Number(l.unit_price ?? 0)) // prettier-ignore
    return {
      today,
      lans: sapLan(lans),
      sapXuat,
      thangNay: {
        xuat: cong(xuatThang),
        nhan: {
          value: donThang.reduce((s, o) => s + (giaTri.get(o.id) ?? 0), 0),
          n: donThang.length,
        },
      },
    }
  },
}
