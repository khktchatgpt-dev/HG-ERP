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
}

export type ApLedgerResult = {
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
    opts: { month?: string; supplier_id?: string; currency?: string } = {},
  ): Promise<ApLedgerResult> {
    await assertAction(user, 'accounting.payable.view')

    const [entries, rates, awaiting] = await Promise.all([
      loadEntries(),
      fxRates(),
      // Nuốt lỗi: dải "ngoài sổ" là thông tin thêm, không được làm chết cả sổ.
      awaitingInvoiceSummary().catch(() => ({ by_currency: [], supplier_count: 0 })),
    ])

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

    const screenRows: LedgerScreenRow[] = rows.map((r) => ({
      ...r,
      closing_base: baseOf(r.currency, r.closing),
    }))
    const totals = ledgerTotals(rows).map((t) => ({
      ...t,
      closing_base: baseOf(t.currency, t.closing),
    }))
    const missingFx = totals.filter((t) => t.closing_base == null).map((t) => t.currency)
    const closingBaseTotal = missingFx.length
      ? null
      : r2(totals.reduce((s, t) => s + (t.closing_base ?? 0), 0))

    const detail = detailOf(entries, rows, opts, from, to)

    return {
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
      gaps: gapsOf(entries, awaiting.by_currency.length > 0),
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
  ): Promise<ApLedgerResult & { details: NonNullable<ApLedgerResult['detail']>[] }> {
    const head = await this.overview(user, { month })
    const entries = await loadEntries()
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

/**
 * Mọi giao dịch của TK 331, hai chiều.
 *
 * Hoá đơn lấy `status = 'posted'`: hoá đơn nháp chưa vào sổ thì chưa là nợ. Đây
 * khác hẳn màn ước tính (`/finance/bao-cao`) vốn cố ý đếm cả đơn nháp — sổ kế
 * toán không có chỗ cho "tạm tính".
 */
async function loadEntries(): Promise<LedgerEntry[]> {
  const [{ data: invRaw }, { data: payRaw }] = await Promise.all([
    db()
      .from('accounting_supplier_invoices')
      .select('id, invoice_no, supplier_id, currency, total, invoice_date, note')
      .eq('status', 'posted')
      .limit(10000),
    db()
      .from('accounting_supplier_payments')
      .select('id, supplier_id, currency, amount, paid_on, ref_no, method, note')
      .limit(10000),
  ])

  type Inv = { id: string; invoice_no: string; supplier_id: string; currency: string; total: unknown; invoice_date: string; note: string | null } // prettier-ignore
  type Pay = { id: string; supplier_id: string; currency: string; amount: unknown; paid_on: string; ref_no: string | null; method: string | null; note: string | null } // prettier-ignore
  const invs = (invRaw ?? []) as Inv[]
  const pays = (payRaw ?? []) as Pay[]

  const names = await supplierNames([
    ...invs.map((i) => i.supplier_id),
    ...pays.map((p) => p.supplier_id),
  ])
  const nameOf = (id: string) => names.get(id) ?? '—'

  return [
    ...invs.map((i): LedgerEntry => ({
      supplier_id: i.supplier_id,
      supplier_name: nameOf(i.supplier_id),
      currency: i.currency || 'VND',
      date: i.invoice_date,
      kind: 'invoice',
      doc_no: i.invoice_no,
      amount: Number(i.total ?? 0),
      note: i.note,
    })),
    ...pays.map((p): LedgerEntry => ({
      supplier_id: p.supplier_id,
      supplier_name: nameOf(p.supplier_id),
      currency: p.currency || 'VND',
      date: p.paid_on,
      kind: 'payment',
      // Phiếu chi không bắt buộc số tham chiếu; rơi về phương thức rồi mới
      // tới gạch ngang, để cột "Số chứng từ" không trống trơn cả sổ.
      doc_no: p.ref_no || p.method || '—',
      amount: Number(p.amount ?? 0),
      note: p.note,
    })),
  ]
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
function gapsOf(entries: LedgerEntry[], hasOffBook: boolean): ApLedgerResult['gaps'] {
  const gaps: ApLedgerResult['gaps'] = []
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
  return new Map(((data ?? []) as S[]).map((s) => [s.id, s.short_name || s.name]))
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
