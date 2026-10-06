import { posRepo } from '@/modules/dept/supply/pos.repo'
import { pricesRepo } from '@/modules/dept/supply/prices.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { withProductImage } from '@/modules/dept/production/lsx-lines.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { quotesRepo, lastPricesForCustomer } from '@/modules/dept/sales/quotes.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { filesService } from '@/modules/core/files/files.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { supplierFacts } from '@/modules/dept/supply/supplier-facts.repo'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { poShipmentsRepo } from '@/modules/dept/supply/po-shipments.repo'
import { filesRepo } from '@/modules/core/files/files.repo'
import { poAdjustmentsRepo } from '@/modules/dept/supply/po-adjustments.repo'
import { threadsOf } from '@/modules/dept/supply/po-signature.service'
import { docNotesRepo } from '@/modules/core/doc-notes/doc-notes.repo'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { poLineAmount, poMoneyOf } from '@/lib/po-line'
import { isBigApprovalWith } from '@/lib/exec-ops'
import { properName } from '@/lib/po-list-labels'
import type { User } from '@/modules/core/users/users.repo'
import type { PendingLsx, PendingPo, PendingQuote } from '../approval-types'

/**
 * Nạp CHI TIẾT 1 phiếu (LSX/PO) cho trang riêng /exec/approvals/{lsx,po}/[id].
 * Cùng phép làm giàu với danh sách phê duyệt nhưng cho một phiếu. LSX / báo giá
 * chỉ trả về khi còn chờ duyệt (null → trang gọi notFound()).
 *
 * ĐƠN MUA thì nạp ở MỌI TRẠNG THÁI (0218, 01/10/2026): Giám đốc mở lại đơn đã
 * ký từ Lịch sử ký để xem, thu hồi chữ ký hoặc yêu cầu xem lại — trước đó đơn
 * đã ký mở ra là 404. Màn tự chọn dải đầu theo `status`.
 */
export async function loadPoApprovalDetail(
  _user: User,
  id: string,
): Promise<PendingPo | null> {
  const [found, urgent] = await Promise.all([
    posRepo.findById(id),
    // Ba cột gửi gấp (0218) đọc riêng — xem `posRepo.urgentByIds`.
    posRepo.urgentByIds([id]),
  ])
  if (!found) return null
  const po = { ...found, ...urgent.get(id) }

  const [
    lines,
    creatorName,
    thresholds,
    notes,
    events,
    lsxCtx,
    supFacts,
    docs,
    adjustments,
    names,
    shipments,
    extraLsx,
    files,
  ] = await Promise.all([
    posRepo.listLines(id),
    po.created_by
      ? usersRepo
          .displayNamesByIds([po.created_by])
          .then((m) => m.get(po.created_by!) ?? null)
      : Promise.resolve(null),
    settingsService.approvalThresholds(),
    docNotesRepo.list('po', id),
    approvalEventsRepo.listByEntity('po', id),
    po.production_order_id
      ? loadLsxContext(po.production_order_id)
      : Promise.resolve(null),
    supplierFacts(po.supplier_id, id),
    supplyRepo.docsByPo(id),
    poAdjustmentsRepo.listByPo(id),
    usersRepo.displayNamesByIds(
      [po.approved_by, po.urgent_sent_by].filter((x): x is string => !!x),
    ),
    poShipmentsRepo.listByPo(id),
    posRepo.extraLsxByPoIds([id]),
    filesRepo.listByParent('purchase_order_id', id),
  ])
  const total = lines.reduce((s, l) => s + poLineAmount(l), 0)
  const m = poMoneyOf(po, total)
  const submitted = events.filter((e) => e.action === 'submitted').at(-1)
  const threads = threadsOf(notes)
  const questionIds = new Set(threads.map((q) => q.id))
  // Điều chỉnh SAU chữ ký: đơn đổi tiền sau khi người ký đã gật (0210).
  const afterSign = po.approved_at
    ? adjustments.filter((a) => a.created_at > po.approved_at!)
    : []

  /*
    GIÁ LẦN TRƯỚC — nạp sau khi đã có dòng, vì cần danh sách `material_id`.

    `excludePoId` bắt buộc: không loại chính đơn này thì nó là lần mua mới nhất
    và cột "giá lần trước" luôn bằng giá lần này. Dòng tự do (không gắn mã vật
    tư) không có `material_id` nên tự rơi ra ngoài — đúng, vì không có gì để so.
  */
  const matIds = [...new Set(lines.map((l) => l.material_id).filter(Boolean))] as string[]
  const lastPrices = await pricesRepo.lastPurchases(matIds, id)
  const last_prices = Object.fromEntries(
    lastPrices.map((p) => [
      p.material_id,
      { unit_price: p.unit_price, currency: p.currency, po_code: p.po_code, at: p.at },
    ]),
  )

  return {
    id: po.id,
    code: po.code,
    supplier_name: po.supplier_name,
    lsx_code: po.lsx_code,
    order_code: po.order_code,
    expected_at: po.expected_at,
    created_at: po.created_at,
    currency: po.currency,
    total,
    lines_count: lines.length,
    lines,
    template: po.template ?? null,
    shipments: shipments
      .filter((sh) => sh.status !== 'cancelled')
      .sort((a, b) => a.seq - b.seq)
      .map((sh) => ({
        seq: sh.seq,
        code: sh.code,
        expected_date: sh.expected_date,
        status: sh.status as 'planned' | 'arrived' | 'received',
        note: blank(sh.note),
        lines: sh.lines,
      })),
    extra_lsx: (extraLsx.get(id) ?? []).map((x) => x.code),
    confirmed_note: blank(po.confirmed_note),
    files: files.map((f) => ({ id: f.id, filename: f.filename })),
    created_by_name: properName(creatorName) || null,
    note: po.note,
    // Ngưỡng so trên TỔNG THANH TOÁN (gồm VAT) — cùng số với hộp ký (signBox).
    big: isBigApprovalWith(m.grandTotal, po.currency, thresholds),
    threshold: Object.hasOwn(thresholds, po.currency) ? thresholds[po.currency] : null,
    last_prices,
    money: {
      subtotal: m.subtotal,
      discount: m.discountAmount,
      vat_rate: Number(po.vat_rate ?? 0) || 0,
      vat_amount: m.vatAmount,
      grand: m.grandTotal,
      includes_vat: !!po.price_includes_vat,
    },
    // Tên gõ tay trong danh mục người dùng có khi viết thường ("nguyễn đình huy").
    owner_name: properName(po.assignee_name) || null,
    submitted_at: submitted?.created_at ?? null,
    terms: {
      payment: blank(po.terms_payment),
      lead_time: blank(po.terms_lead_time),
      delivery_place: blank(po.terms_delivery_place),
      invoice: blank(po.terms_invoice),
      quality: blank(po.terms_quality),
      contract_no: blank(po.contract_no),
      doc_no: blank(po.supplier_doc_no),
    },
    // Câu hỏi của GĐ và câu trả lời đi khối riêng (questions) — không lặp ở đây.
    internal_notes: notes
      .filter(
        (n) =>
          n.audience === 'internal' &&
          !n.deleted_at &&
          n.kind !== 'question' &&
          !(n.reply_to && questionIds.has(n.reply_to)),
      )
      .map((n) => ({
        author_name: properName(n.author_name) || null,
        created_at: n.created_at,
        body: n.body,
      })),
    events: events.map((e) => ({
      action: e.action,
      actor_name: properName(e.actor_name) || null,
      created_at: e.created_at,
      reason: e.reason,
    })),
    lsx: lsxCtx,
    status: po.status,
    approved_by_name: po.approved_by
      ? properName(names.get(po.approved_by)) || null
      : null,
    approved_at: po.approved_at,
    ordered_at: po.ordered_at,
    urgent: po.urgent_sent_at
      ? {
          at: po.urgent_sent_at,
          by_name: po.urgent_sent_by
            ? properName(names.get(po.urgent_sent_by)) || null
            : null,
          reason: po.urgent_reason ?? null,
        }
      : null,
    receipt_docs: docs.length,
    adjusted_after_sign: afterSign.length
      ? { count: afterSign.length, delta: afterSign.reduce((a, x) => a + adjDelta(x), 0) }
      : null,
    questions: threads.map((q) => ({
      ...q,
      author_name: properName(q.author_name) || null,
      answers: q.answers.map((a) => ({
        ...a,
        author_name: properName(a.author_name) || null,
      })),
    })),
    supplier: supFacts
      ? {
          received: supFacts.received,
          others: Math.max(0, supFacts.orders - 1),
          open_others: supFacts.openOthers,
          contact: supFacts.contact,
        }
      : null,
  }
}

/** Phát sinh tổng thanh toán của một lần điều chỉnh (âm = giảm). */
const adjDelta = (a: {
  subtotal_before: number
  subtotal_after: number
  discount_before: number
  discount_after: number
  vat_before: number
  vat_after: number
}) =>
  a.subtotal_after -
  a.discount_after +
  a.vat_after -
  (a.subtotal_before - a.discount_before + a.vat_before)

const blank = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)

/** Đơn đã qua chữ ký Giám đốc — tiền của chúng là tiền công ty đã cam kết. */
const SIGNED = new Set(['approved', 'ordered', 'confirmed', 'received'])

/**
 * BỐI CẢNH LỆNH cho màn duyệt đơn mua: lệnh xuất khi nào, đã có bao nhiêu đơn
 * mua, các đơn đã ký tốn bao nhiêu (gồm VAT, theo từng tiền tệ — không quy đổi
 * vì hệ thống không có tỉ giá). `posRepo.list` theo lệnh đã gồm cả đơn gộp
 * nhiều lệnh (0125), nên đơn gộp cũng được đếm.
 */
async function loadLsxContext(lsxId: string): Promise<PendingPo['lsx']> {
  const [lsx, pos] = await Promise.all([
    productionRepo.findById(lsxId),
    posRepo.list({ production_order_id: lsxId, page: 1, page_size: 500 }),
  ])
  if (!lsx) return null
  const live = pos.rows.filter((p) => p.status !== 'cancelled')
  const signed = live.filter((p) => SIGNED.has(p.status))
  const totals = await posRepo.totalsByPoIds(signed.map((p) => p.id))
  const byCur = new Map<string, number>()
  for (const p of signed) {
    const v = poMoneyOf(p, totals[p.id] ?? 0).grandTotal
    byCur.set(p.currency, (byCur.get(p.currency) ?? 0) + v)
  }
  return {
    code: lsx.code,
    status: lsx.status ?? null,
    ship_date: lsx.ship_date ?? null,
    pos_total: live.length,
    pos_approved: signed.length,
    pos_draft: live.filter((p) => p.status === 'draft').length,
    approved_value: [...byCur].map(([currency, value]) => ({ currency, value })),
  }
}

export async function loadPendingQuoteDetail(
  _user: User,
  id: string,
): Promise<PendingQuote | null> {
  const quote = await quotesRepo.findById(id)
  if (!quote || quote.status !== 'pending_approval') return null

  const [lines, lastPrices, submitterName] = await Promise.all([
    quotesRepo.listLines(id),
    // Giá chào gần nhất cho CÙNG KHÁCH — bối cảnh chính GĐ cần khi ký giá.
    lastPricesForCustomer(quote.customer_id).catch(() => []),
    quote.submitted_by
      ? usersRepo
          .displayNamesByIds([quote.submitted_by])
          .then((m) => m.get(quote.submitted_by!) ?? null)
      : Promise.resolve(null),
  ])
  // Loại chính báo giá đang duyệt khỏi "lần chào trước" — tự so với mình là vô nghĩa.
  const lastByProduct = new Map(
    lastPrices.filter((p) => p.quote_code !== quote.code).map((p) => [p.product_id, p]),
  )

  return {
    id: quote.id,
    code: quote.code,
    customer_name: quote.customer_name,
    currency: quote.currency,
    created_at: quote.created_at,
    submitted_at: quote.submitted_at,
    submitted_by_name: submitterName,
    valid_from: quote.valid_from,
    valid_to: quote.valid_to,
    price_term: quote.price_term,
    payment_terms: quote.payment_terms,
    note: quote.note,
    lines: lines.map((l) => {
      const last = lastByProduct.get(l.product_id)
      return {
        product_code: l.product_code,
        product_name: l.product_name,
        product_unit: l.product_unit,
        unit_price: l.unit_price,
        discount_pct: l.discount_pct,
        note: l.note,
        last_price: last
          ? { unit_price: last.unit_price, quote_code: last.quote_code }
          : null,
      }
    }),
  }
}

export async function loadPendingLsxDetail(
  user: User,
  id: string,
): Promise<PendingLsx | null> {
  const lsx = await productionRepo.findById(id)
  if (!lsx || lsx.status !== 'pending_approval') return null

  const [orderLines, printLines, orders, issuedByName] = await Promise.all([
    ordersRepo.listLinesByOrders(lsx.order_ids),
    // Ảnh trên dòng lệnh chỉ là BẢN CHỤP lúc phát lệnh — hồ sơ SP có ảnh sau đó
    // thì dòng vẫn trống. Giám đốc duyệt lệnh mà không thấy hàng trông thế nào
    // là mất đúng thứ đáng nhìn nhất trên tờ trình.
    lsxLinesRepo.listLines(lsx.id).then(withProductImage),
    ordersRepo.listByProductionOrder(lsx.id),
    lsx.issued_by
      ? usersRepo
          .displayNamesByIds([lsx.issued_by])
          .then((m) => m.get(lsx.issued_by!) ?? null)
      : Promise.resolve(null),
  ])
  // Dòng lệnh trỏ ngược về dòng đơn → lấy được đơn giá bán + trạng thái BOM.
  const bomByLineId = new Map(orderLines.map((ol) => [ol.id, ol]))
  const groupTitle = new Map(
    (await lsxLinesRepo.listGroups(lsx.id)).map((g) => [g.id, g.title ?? '']),
  )

  const fileIds = [
    ...new Set(printLines.map((pl) => pl.image_file_id).filter((x): x is string => !!x)),
  ]
  let imageUrls: Record<string, string> = {}
  try {
    if (fileIds.length) imageUrls = await filesService.getDownloadUrls(user, fileIds)
  } catch {
    /* ảnh lỗi không chặn duyệt */
  }

  // Lệnh gộp nhiều đơn: khối "thông tin thương mại" bám đơn đầu tiên (điều
  // khoản thường giống nhau vì cùng khách), còn `orders` liệt kê đủ cả nhóm.
  const order = orders[0] ?? null
  const ownerName = order?.created_by
    ? ((await usersRepo.displayNamesByIds([order.created_by])).get(order.created_by) ??
      null)
    : null
  const valueByOrder = new Map<string, number>()
  const linesByOrder = new Map<string, number>()
  for (const ol of orderLines) {
    valueByOrder.set(
      ol.order_id,
      (valueByOrder.get(ol.order_id) ?? 0) + ol.qty * ol.unit_price,
    )
    linesByOrder.set(ol.order_id, (linesByOrder.get(ol.order_id) ?? 0) + 1)
  }

  return {
    id: lsx.id,
    code: lsx.code,
    order_codes: lsx.order_codes,
    customer_name: lsx.customer_name,
    created_at: lsx.created_at,
    issued_by_name: issuedByName,
    ship_date: lsx.ship_date,
    container_summary: lsx.container_summary,
    note: lsx.note,
    received_date: lsx.received_date,
    order_value: orderLines.reduce((s, ol) => s + ol.qty * ol.unit_price, 0),
    bom_pending: orderLines.filter((ol) => ol.bom_status !== 'done').length,
    order: order
      ? {
          customer_po_no: order.customer_po_no,
          order_created_at: order.created_at,
          due_date: order.due_date,
          currency: order.currency,
          payment_terms: order.payment_terms,
          deposit_percent: order.deposit_percent,
          price_term: order.price_term,
          payment_method: order.payment_method,
          port_of_loading: order.port_of_loading,
          port_of_discharge: order.port_of_discharge,
          qty_tolerance_pct: order.qty_tolerance_pct,
          partial_shipment: order.partial_shipment,
          transhipment: order.transhipment,
          required_docs: order.required_docs,
          quote_code: order.quote_code,
          owner_name: ownerName,
        }
      : null,
    orders: orders.map((o) => ({
      code: o.code,
      due_date: o.due_date,
      currency: o.currency,
      value: valueByOrder.get(o.id) ?? 0,
      line_count: linesByOrder.get(o.id) ?? 0,
    })),
    lines: printLines.map((pl) => {
      const ol = pl.sales_order_line_id
        ? bomByLineId.get(pl.sales_order_line_id)
        : undefined
      return {
        order_code: groupTitle.get(pl.group_id) ?? '',
        product_code: pl.product_code,
        product_name: pl.name_vi ?? pl.product_code,
        product_unit: pl.unit,
        qty: pl.qty,
        unit_price: ol?.unit_price ?? 0,
        bom_status: ol?.bom_status ?? 'none',
        image_url: pl.image_file_id ? (imageUrls[pl.image_file_id] ?? null) : null,
        spec: pl.specs,
      }
    }),
  }
}
