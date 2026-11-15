import { db } from '@/server/db'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import {
  buildLedger,
  ledgerDetail,
  ledgerTotals,
  monthRange,
  type LedgerEntry,
  type LedgerLine,
  type LedgerRow,
} from '@/lib/ap-ledger'
import { rateFor, type FxRate } from '@/lib/fx'
import { awaitingInvoiceSummary } from './supplier-invoices.service'
import { poCostsRepo } from '@/modules/dept/supply/po-costs.repo'
import { carrierLedgerEntries } from '@/lib/po-cost'
import { todayVn } from '@/lib/date-vn'
import { soTienDaTra } from '@/lib/mua-san'
import {
  prepayLabel,
  receiptEntries,
  rowKey,
  termsOf,
  unpricedBy,
  type ReceiptMove,
} from '@/lib/ap-receipt-ledger'
import { parseTermSetting } from '@/lib/payment-terms'
import { payablesRepo } from './payables.repo'

/**
 * Sổ tính theo đâu. `receipt` = phiếu nhập kho (mặc định từ 31/10/2026 — nguồn
 * duy nhất đang có số), `invoice` = hoá đơn NCC đã vào sổ (TK 331 đúng nghĩa).
 * Hai cơ sở KHÔNG BAO GIỜ cộng vào nhau — xem `lib/ap-receipt-ledger.ts`.
 */
export type ApLedgerBasis = 'receipt' | 'invoice'

/**
 * SỔ CHI TIẾT CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN (TK 331) — theo KỲ.
 *
 * Đây là màn trả lời đúng câu *"kế toán biết mình có những công nợ nào, tổng bao
 * nhiêu, từng NCC bao nhiêu"*. Mọi màn công nợ trước đó đều là **ảnh chụp tại
 * thời điểm này** nên không chốt sổ được, không đối chiếu được với kỳ trước, và
 * không trả lời được "tháng này nợ tăng hay giảm".
 *
 * ⭐ NGUỒN LÀ HOÁ ĐƠN ĐÃ VÀO SỔ + PHIẾU CHI, không phải phiếu nhập kho. Nợ phải
 * trả là nghĩa vụ pháp lý: nó ra đời khi NCC xuất hoá đơn và mang VAT. Hàng đã
 * về mà chưa có hoá đơn (GR/IR) là nghĩa vụ CÓ THẬT nhưng chưa đủ chứng từ để
 * ghi TK 331 — bày RIÊNG ở dải "ngoài sổ", không trộn vào số dư. Trộn vào là
 * ghi nợ hai lần khi hoá đơn về.
 *
 * ⭐ SỐ DƯ CUỐI KỲ NGOẠI TỆ ĐÁNH GIÁ LẠI THEO TỶ GIÁ CUỐI KỲ. Số dư gốc ngoại tệ
 * là số dư thật; cột quy VND chỉ để lên báo cáo, và dùng tỷ giá ngày cuối kỳ —
 * không phải tỷ giá lúc ghi hoá đơn. Thiếu tỷ giá thì để TRỐNG, không thay 0.
 */

export type LedgerScreenRow = LedgerRow & {
  /** Dư cuối quy VND theo tỷ giá CUỐI KỲ. `null` = thiếu tỷ giá, không phải 0. */
  closing_base: number | null
  /** Điều khoản thanh toán trên các đơn có phiếu (chỉ sổ theo hàng nhận): một câu thì bày, nhiều câu thì `null`. */
  terms: string | null
  /** Số câu điều khoản KHÁC NHAU — 0 = không đơn nào ghi. */
  terms_distinct: number
  /** Nhãn "cọc 30%" / "trả trước" khi điều khoản đòi trả trước mà NCC chưa có phiếu chi nào. */
  prepay: string | null
  /** Dòng nhập chưa có giá tới hết kỳ — KHÔNG nằm trong số dư. */
  unpriced: number
}

export type ApLedgerResult = {
  /** Sổ đang tính theo đâu. */
  basis: ApLedgerBasis
  /** Số hoá đơn NCC đã vào sổ — nhãn công tắc "Hoá đơn NCC · N tờ". */
  invoice_count: number
  /** Số phiếu chi NCC trong ERP — 0 thì dư cuối chưa trừ đồng nào đã trả. */
  payment_count: number
  /** NCC có điều khoản cọc / trả trước mà chưa ghi phiếu chi (dư đang cao hơn thật). */
  prepay_count: number
  /** Tổng dòng nhập chưa giá tới hết kỳ — chân bảng nói tổng KHÔNG gồm chúng. */
  unpriced_total: number
  /** Kỳ đang xem, dạng `YYYY-MM`. */
  month: string
  from: string
  to: string
  rows: LedgerScreenRow[]
  totals: (ReturnType<typeof ledgerTotals>[number] & { closing_base: number | null })[]
  /**
   * Tổng dư cuối quy VND — CON SỐ ĐƯA LÊN BẢNG CÂN ĐỐI. `null` khi còn tiền tệ
   * chưa quy đổi được: một tổng thiếu mất khoản USD thì sai, mà không ai biết.
   */
  closing_base_total: number | null
  /** Tiền tệ chưa quy đổi được vì thiếu tỷ giá tại ngày cuối kỳ. */
  missing_fx: string[]
  /**
   * NGOÀI SỔ — đã nhận hàng, NCC chưa xuất hoá đơn. Nghĩa vụ có thật, chưa đủ
   * chứng từ để ghi TK 331. Việc phải làm là đi đòi hoá đơn, không phải cộng vào.
   */
  off_book: { currency: string; amount: number; line_count: number }[]
  off_book_suppliers: number
  /** Các kỳ CÓ giao dịch — để chọn, thay vì cho gõ tháng rỗng rồi ra bảng trắng. */
  months: { month: string; entry_count: number }[]
  /** Sổ chi tiết của một NCC × tiền tệ khi người xem bấm vào một dòng. */
  detail: {
    supplier_id: string
    supplier_name: string
    currency: string
    opening: number
    lines: LedgerLine[]
  } | null
  /**
   * Thứ chặn sổ này khỏi đúng hoàn toàn. `banner: true` = màn đã có dải cảnh
   * báo riêng cho nó, nên WhyBox KHÔNG lặp lại (cùng một câu hai lần trên một
   * màn là người đọc bắt đầu bỏ qua cả hai). Bản Excel thì lấy HẾT: người cầm
   * tờ giấy không có dải cảnh báo nào.
   */
  gaps: { label: string; detail: string; banner?: boolean }[]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export const apLedgerService = {
  /**
   * @param month Kỳ `YYYY-MM`. Bỏ trống thì lấy kỳ CÓ GIAO DỊCH gần nhất chứ
   *   không lấy tháng hiện tại — mở sổ ra thấy trắng tinh thì người dùng tưởng
   *   hỏng, trong khi chỉ là tháng này chưa phát sinh gì.
   */
  async overview(
    user: User,
    opts: {
      month?: string
      supplier_id?: string
      currency?: string
      /** Bỏ trống = `receipt` (hàng đã nhận) — cơ sở có số từ 31/10/2026. */
      basis?: ApLedgerBasis
    } = {},
  ): Promise<ApLedgerResult> {
    await assertAction(user, 'accounting.payable.view')
    const basis: ApLedgerBasis = opts.basis ?? 'receipt'

    const [book, rates, awaiting] = await Promise.all([
      loadBook(basis),
      fxRates(),
      // Dải "ngoài sổ" (GR/IR) chỉ có nghĩa với sổ theo hoá đơn: sổ theo hàng
      // nhận đã đếm chính phần đó. Nuốt lỗi: thông tin thêm không được làm chết sổ.
      basis === 'invoice'
        ? awaitingInvoiceSummary().catch(() => ({ by_currency: [], supplier_count: 0 }))
        : Promise.resolve({ by_currency: [], supplier_count: 0 }),
    ])
    const { entries } = book

    const months = monthsOf(entries)
    const month =
      opts.month || months.at(-1)?.month || new Date().toISOString().slice(0, 7)
    const { from, to } = monthRange(month)

    const rows = buildLedger(entries, from, to)
    const baseOf = (currency: string, amount: number): number | null => {
      if (currency === 'VND') return r2(amount)
      const rate = rateFor(rates, currency, to)
      return rate == null ? null : r2(amount * rate)
    }

    const meta = rowMeta(book, to)
    const screenRows: LedgerScreenRow[] = rows.map((r) => {
      const m = meta.get(rowKey(r.supplier_id, r.currency))
      return {
        ...r,
        closing_base: baseOf(r.currency, r.closing),
        terms: m?.terms ?? null,
        terms_distinct: m?.terms_distinct ?? 0,
        prepay: m?.prepay ?? null,
        unpriced: m?.unpriced ?? 0,
      }
    })
    const totals = ledgerTotals(rows).map((t) => ({
      ...t,
      closing_base: baseOf(t.currency, t.closing),
    }))
    const missingFx = totals.filter((t) => t.closing_base == null).map((t) => t.currency)
    const closingBaseTotal = missingFx.length
      ? null
      : r2(totals.reduce((s, t) => s + (t.closing_base ?? 0), 0))

    const detail = detailOf(entries, rows, opts, from, to)
    const prepayCount = screenRows.filter((r) => r.prepay).length
    const unpricedTotal = screenRows.reduce((s, r) => s + r.unpriced, 0)

    return {
      basis,
      invoice_count: book.invoice_count,
      payment_count: book.payment_count,
      prepay_count: prepayCount,
      unpriced_total: unpricedTotal,
      month,
      from,
      to,
      rows: screenRows,
      totals,
      closing_base_total: closingBaseTotal,
      missing_fx: missingFx,
      off_book: awaiting.by_currency,
      off_book_suppliers: awaiting.supplier_count,
      months,
      detail,
      gaps: gapsOf(basis, entries, awaiting.by_currency.length > 0, {
        payments: book.payment_count,
        prepay: prepayCount,
        unpriced: unpricedTotal,
      }),
    }
  },

  /**
   * Sổ ĐẦY ĐỦ của một kỳ — thêm chi tiết của MỌI dòng, cho bản xuất Excel.
   *
   * Màn hình chỉ mở chi tiết một NCC mỗi lượt (mở hết là bảng vài nghìn dòng
   * không đọc nổi), nhưng tờ giấy thì ngược lại: kế toán in cả sổ ra để đối
   * chiếu và lưu hồ sơ, nên phải có đủ.
   */
  async fullBook(
    user: User,
    month?: string,
    basis: ApLedgerBasis = 'receipt',
  ): Promise<ApLedgerResult & { details: NonNullable<ApLedgerResult['detail']>[] }> {
    const head = await this.overview(user, { month, basis })
    const { entries } = await loadBook(basis)
    const details = head.rows.map((r) => {
      const d = ledgerDetail(entries, r.supplier_id, r.currency, head.from, head.to)
      return {
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        currency: r.currency,
        opening: d.opening,
        lines: d.lines,
      }
    })
    return { ...head, details }
  },
}

function detailOf(
  entries: LedgerEntry[],
  rows: LedgerRow[],
  opts: { supplier_id?: string; currency?: string },
  from: string,
  to: string,
): ApLedgerResult['detail'] {
  if (!opts.supplier_id || !opts.currency) return null
  /*
   * NCC không có giao dịch nào thì KHÔNG mở khay. Không có chốt này, một đường
   * dẫn gõ sai (kế toán gửi link cho nhau rất nhiều) mở ra một sổ trống mang tên
   * "—" với số dư 0 — trông y hệt một NCC thật đã trả hết nợ.
   */
  const name = entries.find((e) => e.supplier_id === opts.supplier_id)?.supplier_name
  if (!name) return null
  const d = ledgerDetail(entries, opts.supplier_id, opts.currency, from, to)
  const shown = rows.find((r) => r.supplier_id === opts.supplier_id)?.supplier_name ?? name // prettier-ignore
  return { supplier_id: opts.supplier_id, supplier_name: shown, currency: opts.currency, opening: d.opening, lines: d.lines } // prettier-ignore
}

type Book = {
  entries: LedgerEntry[]
  /** Movement của sổ theo hàng nhận (rỗng với sổ theo hoá đơn) — để đếm dòng chưa giá + điều khoản. */
  moves: ReceiptMove[]
  invoice_count: number
  payment_count: number
  /** NCC × tiền tệ đã có ít nhất một phiếu chi — để biết "cọc chưa ghi". */
  paid: Set<string>
}

/**
 * Mọi giao dịch của sổ, hai chiều, theo cơ sở đã chọn.
 *
 * Phần CHUNG cả hai cơ sở: phiếu chi + phiếu phí nhà xe. Phần TĂNG khác nhau:
 * hoá đơn đã vào sổ (`invoice`) hoặc phiếu nhập kho (`receipt`) — không bao
 * giờ cả hai, vì một lô hàng sẽ lên sổ hai lần.
 *
 * Hoá đơn lấy `status = 'posted'`: hoá đơn nháp chưa vào sổ thì chưa là nợ. Đây
 * khác hẳn màn ước tính (`/finance/bao-cao`) vốn cố ý đếm cả đơn nháp — sổ kế
 * toán không có chỗ cho "tạm tính".
 */
async function loadBook(basis: ApLedgerBasis): Promise<Book> {
  const [{ data: invRaw }, { data: payRaw }, costs, moves, { data: termSetting }] =
    await Promise.all([
      db()
        .from('accounting_supplier_invoices')
        .select('id, invoice_no, supplier_id, currency, total, invoice_date, note')
        .eq('status', 'posted')
        .limit(10000),
      db()
        .from('accounting_supplier_payments')
        .select('id, supplier_id, currency, amount, paid_on, ref_no, method, note, kind')
        .limit(10000),
      // Phiếu phí trả NHÀ XE (0211) — chính là chứng từ đòi tiền của nhà xe.
      // Lấy CẢ phiếu đã huỷ: phiếu gốc giữ ở kỳ của nó, dòng đảo vào kỳ huỷ.
      poCostsRepo.forAccounting({ includeVoided: true }),
      basis === 'receipt' ? payablesRepo.receiptMovesForLedger() : Promise.resolve([]),
      db().from('settings').select('value').eq('key', 'ap_default_payment_term').maybeSingle(), // prettier-ignore
    ])
  const carrierCosts = costs.filter((c) => c.role === 'carrier')

  type Inv = { id: string; invoice_no: string; supplier_id: string; currency: string; total: unknown; invoice_date: string; note: string | null } // prettier-ignore
  type Pay = { id: string; supplier_id: string; currency: string; amount: unknown; paid_on: string; ref_no: string | null; method: string | null; note: string | null; kind: string | null } // prettier-ignore
  const invs = (invRaw ?? []) as Inv[]
  const pays = (payRaw ?? []) as Pay[]

  const names = await supplierNames([
    ...invs.map((i) => i.supplier_id),
    ...pays.map((p) => p.supplier_id),
    ...carrierCosts.flatMap((c) => (c.payee_supplier_id ? [c.payee_supplier_id] : [])),
  ])
  const nameOf = (id: string) => names.get(id) ?? '—'

  const increases: LedgerEntry[] =
    basis === 'receipt'
      ? receiptEntries(moves, parseTermSetting((termSetting as { value?: unknown } | null)?.value)) // prettier-ignore
      : invs.map((i): LedgerEntry => ({
          supplier_id: i.supplier_id,
          supplier_name: nameOf(i.supplier_id),
          currency: i.currency || 'VND',
          date: i.invoice_date,
          kind: 'invoice',
          doc_no: i.invoice_no,
          amount: Number(i.total ?? 0),
          note: i.note,
        }))

  const entries: LedgerEntry[] = [
    ...increases,
    /*
      PHIẾU PHÍ TRẢ NHÀ XE = PHÁT SINH TĂNG (chốt 26/09/2026). Tổng GỒM VAT, như
      hoá đơn. Phiếu mà người nhận là NCC của đơn thì KHÔNG vào đây — nó chờ hoá
      đơn NCC (dải "Ngoài sổ"), vào thẳng là ghi nợ hai lần.
    */
    ...carrierCosts.flatMap((c) =>
      carrierLedgerEntries(
        {
          ...c,
          // Vai `carrier` = chưa trả + người thu trong danh mục (ràng buộc DB 0215).
          payee_supplier_id: c.payee_supplier_id ?? '',
          po_codes: c.allocations.map((a) => a.po_code),
          voided_on: c.voided_at ? todayVn(new Date(c.voided_at)) : null,
        },
        nameOf(c.payee_supplier_id ?? ''),
      ),
    ),
    ...pays.map((p): LedgerEntry => ({
      supplier_id: p.supplier_id,
      supplier_name: nameOf(p.supplier_id),
      currency: p.currency || 'VND',
      date: p.paid_on,
      kind: 'payment',
      // Phiếu chi không bắt buộc số tham chiếu; rơi về phương thức rồi mới
      // tới gạch ngang, để cột "Số chứng từ" không trống trơn cả sổ.
      doc_no: `${p.kind === 'refund' ? 'Hoàn tiền · ' : ''}${p.ref_no || p.method || '—'}`,
      // Phiếu hoàn (0279) là phiếu chi mang dấu âm: trả lại phần nợ đã giảm.
      amount: soTienDaTra(p),
      note: p.note,
    })),
  ]

  return {
    entries,
    moves,
    invoice_count: invs.length,
    payment_count: pays.length,
    paid: new Set(pays.map((p) => rowKey(p.supplier_id, p.currency || 'VND'))),
  }
}

/**
 * Thông tin kèm từng dòng NCC × tiền tệ của sổ theo hàng nhận: điều khoản trên
 * các đơn có phiếu, cờ "cọc chưa ghi", số dòng nhập chưa giá. Sổ theo hoá đơn
 * không có (Map rỗng) — hoá đơn tự mang hạn của nó.
 */
function rowMeta(
  book: Book,
  to: string,
): Map<
  string,
  {
    terms: string | null
    terms_distinct: number
    prepay: string | null
    unpriced: number
  }
> {
  const out = new Map<string, { terms: string | null; terms_distinct: number; prepay: string | null; unpriced: number }>() // prettier-ignore
  if (book.moves.length === 0) return out
  const unpriced = unpricedBy(book.moves, to)
  const termTexts = new Map<string, Map<string, string | null>>()
  for (const m of book.moves) {
    if (m.doc_date > to) continue
    const k = rowKey(m.supplier_id, m.currency)
    const byPo = termTexts.get(k) ?? new Map<string, string | null>()
    byPo.set(m.po_id, m.terms_payment)
    termTexts.set(k, byPo)
  }
  for (const [k, byPo] of termTexts) {
    const texts = [...byPo.values()]
    const t = termsOf(texts)
    // Cọc chưa ghi = có đơn đòi trả trước mà NCC chưa có phiếu chi nào.
    const prepay = book.paid.has(k)
      ? null
      : (texts.map(prepayLabel).find((x) => x != null) ?? null)
    out.set(k, { terms: t.text, terms_distinct: t.distinct, prepay, unpriced: unpriced.get(k) ?? 0 }) // prettier-ignore
  }
  return out
}

/** Kỳ nào CÓ giao dịch — xếp tăng dần, kỳ gần nhất ở cuối. */
function monthsOf(entries: LedgerEntry[]): { month: string; entry_count: number }[] {
  const by = new Map<string, number>()
  for (const e of entries) {
    const m = e.date.slice(0, 7)
    by.set(m, (by.get(m) ?? 0) + 1)
  }
  return [...by]
    .map(([month, entry_count]) => ({ month, entry_count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Thứ CHẶN sổ này khỏi đúng hoàn toàn — nói ra thay vì để người đọc tự phát
 * hiện (nguyên tắc 6: số nào không kiểm được thì không ai tin).
 */
function gapsOf(
  basis: ApLedgerBasis,
  entries: LedgerEntry[],
  hasOffBook: boolean,
  n: { payments: number; prepay: number; unpriced: number },
): ApLedgerResult['gaps'] {
  const gaps: ApLedgerResult['gaps'] = []
  if (basis === 'receipt') {
    if (n.payments === 0) {
      gaps.push({
        label: 'Chưa có lần thanh toán nào',
        detail:
          'ERP chưa có phiếu chi NCC nào, nên dư cuối đang bằng mọi hàng đã nhận — kể cả khoản đã trả ngoài hệ thống.',
        banner: true,
      })
    }
    if (n.prepay > 0) {
      gaps.push({
        label: 'Cọc chưa ghi',
        detail: `${n.prepay} NCC có điều khoản cọc / trả trước nhưng chưa có phiếu chi nào — dư của họ đang cao hơn thật.`,
        banner: true,
      })
    }
    if (n.unpriced > 0) {
      gaps.push({
        label: 'Dòng nhập chưa có giá',
        detail: `${n.unpriced} dòng nhập gắn đơn mua chưa có đơn giá — không cộng vào sổ (không thay bằng 0). Cung ứng bổ sung giá trên đơn.`,
      })
    }
    gaps.push({
      label: 'Chưa có số dư trước ERP',
      detail:
        'Sổ chỉ có phiếu nhập từ khi dùng ERP (09/2026); nợ từ trước đó chưa được chuyển sang.',
    })
    return gaps
  }
  if (entries.length === 0) {
    gaps.push({
      label: 'Sổ đang trống',
      detail:
        'Chưa hoá đơn NCC nào vào sổ. Công nợ chỉ phát sinh khi có hoá đơn — trước đó là cam kết mua, xem ở Báo cáo mua hàng.',
      banner: true, // màn đã bày ở trạng thái rỗng
    })
  }
  if (hasOffBook) {
    gaps.push({
      label: 'Có khoản ngoài sổ',
      detail:
        'Hàng đã về nhưng NCC chưa xuất hoá đơn (GR/IR). Nghĩa vụ có thật, chưa đủ chứng từ ghi TK 331 — đi đòi hoá đơn, đừng cộng vào số dư.',
      banner: true, // màn đã bày ở dải NGOÀI SỔ
    })
  }
  gaps.push({
    label: 'Chi chưa gắn hoá đơn',
    detail:
      'Sổ chi (0167) mới gắn ĐƠN MUA, chưa gắn hoá đơn. Nên trừ được ở mức NCC (đúng số dư), chưa trừ được theo từng tờ hoá đơn (tuổi nợ vì vậy còn bày nguyên số).',
  })
  return gaps
}

async function supplierNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  if (uniq.length === 0) return new Map()
  const { data } = await db()
    .from('supply_suppliers')
    .select('id, name, short_name')
    .in('id', uniq)
  type S = { id: string; name: string; short_name: string | null }
  return new Map(((data ?? []) as S[]).map((s) => [s.id, s.name || s.short_name || '—']))
}

async function fxRates(): Promise<FxRate[]> {
  const { data } = await db()
    .from('fx_rates')
    .select('currency, rate_date, rate')
    .order('rate_date', { ascending: false })
    .limit(2000)
  type R = { currency: string; rate_date: string; rate: unknown }
  return ((data ?? []) as R[]).map((r) => ({
    currency: r.currency,
    rate_date: r.rate_date,
    rate: Number(r.rate),
  }))
}
