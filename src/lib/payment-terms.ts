/**
 * ĐIỀU KHOẢN THANH TOÁN NCC — đọc ra HẠN dùng được.
 *
 * ⭐ KHÔNG BẮT KHAI TỪNG NHÀ CUNG CẤP. Bản đầu (11/09/2026) bắt gõ số ngày cho
 * 164 hồ sơ NCC — user chê ngay: "nhiều nhà cung cấp thì làm vậy rất khó dùng".
 * Đúng, và ERP thật không làm thế. Điều khoản được **đàm phán theo từng ĐƠN**,
 * nên nó sống trên ĐƠN; hồ sơ NCC chỉ là mặc định cho đơn sau; công ty có một
 * mặc định cuối cùng để không khoản nào rơi ra ngoài.
 *
 *     CHUỖI THỪA KẾ:   ĐƠN MUA  →  HỒ SƠ NCC  →  MẶC ĐỊNH CÔNG TY
 *
 * Đo 11/09/2026: **29/44 đơn đã nhận hàng ĐÃ ghi điều khoản** — dữ liệu vốn có
 * sẵn, chỉ là chưa ai đọc. Khai mặc định công ty MỘT LẦN là phủ nốt phần còn lại.
 *
 * ⭐ HAI GỐC TÍNH HẠN, không phải một. 13/32 đơn ghi "công nợ **cuối tháng**" —
 * đó không phải "N ngày kể từ ngày nhận". Ép nó về net-days là sai hạn tới nửa
 * tháng, và sai theo hướng giục NCC sớm.
 *
 * File thuần, có test.
 */

/** Gốc tính hạn. `net` = cộng ngày; `eom` = cuối tháng rồi mới cộng ngày. */
export type TermBasis = 'net' | 'eom'

export type Term = {
  basis: TermBasis
  /** Số ngày cộng thêm. `net 0` = trả ngay; `eom 0` = cuối tháng nhận hàng. */
  days: number
}

export type TermGuess = {
  term: Term | null
  /**
   * `true` = câu nói rõ MỘT mốc duy nhất, điền thẳng được.
   * `false` = có số nhưng còn vế khác (đặt cọc, khoảng, nhiều đợt) — phải người đọc.
   */
  confident: boolean
  /** Vì sao ra kết quả đó — bày cạnh ô để người khai kiểm bằng mắt. */
  why: string
}

const NO_GUESS: TermGuess = { term: null, confident: false, why: 'không đọc được hạn' }

/** Câu có NHIỀU vế (đặt cọc / chia đợt) → số đọc ra chỉ là một vế. */
const MULTI = /(đặt\s*cọc|tạm\s*ứng|ứng\s*trước|\bcọc\b|\d+\s*%|từng\s*đợt|phần\s*còn\s*lại)/i // prettier-ignore

/**
 * Đoán điều khoản từ câu chữ tự do.
 *
 * Nhận được các câu THẬT đang có trên đơn của HG (đo 11/09/2026):
 * "Thanh toán công nợ cuối tháng" · "Công nợ 30 ngày." · "Công nợ 30-60 ngày" ·
 * "Nhận hàng thanh toán trong vòng 15 ngày." · "Cọc 30%, … 30 ngày" · "NET 30".
 */
export function guessTerm(text: string | null | undefined): TermGuess {
  const raw = (text ?? '').trim()
  if (!raw) return NO_GUESS
  const s = raw.toLowerCase()
  const multi = MULTI.test(s)

  // ── 1. CUỐI THÁNG. Phải xét TRƯỚC số ngày: "cuối tháng sau 15 ngày" có cả hai.
  if (/cuối\s*tháng|end\s*of\s*month|\beom\b/.test(s)) {
    const plus = s.match(/cuối\s*tháng[^\d]{0,12}(\d{1,3})\s*ngày/)
    const days = plus ? Number(plus[1]) : 0
    return {
      term: { basis: 'eom', days },
      confident: !multi,
      why: days ? `cuối tháng + ${days} ngày` : 'cuối tháng',
    }
  }

  // ── 2. KHOẢNG "30-60 ngày": lấy mốc XA. Giục theo mốc gần là giục sớm, và
  //       đòi tiền sớm hơn thoả thuận làm hỏng quan hệ với NCC.
  const range = s.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*ngày/)
  if (range) {
    const hi = Math.max(Number(range[1]), Number(range[2]))
    return {
      term: { basis: 'net', days: hi },
      confident: false,
      why: `khoảng ${range[1]}–${range[2]} ngày → lấy mốc xa ${hi}`,
    }
  }

  // ── 3. "NET 30" / "NET30".
  const net = s.match(/\bnet\s*(\d{1,3})\b/)
  if (net) {
    const d = Number(net[1])
    return { term: { basis: 'net', days: d }, confident: !multi, why: `NET ${d}` }
  }

  // ── 4. "... 30 ngày ..." — dạng phổ biến nhất.
  const day = s.match(/(\d{1,3})\s*ngày/)
  if (day) {
    const d = Number(day[1])
    return { term: { basis: 'net', days: d }, confident: !multi, why: `${d} ngày` }
  }

  // ── 5. "1 tháng" → 30 ngày, KHÔNG chắc: "sau 1 tháng" khác "cuối tháng sau".
  const month = s.match(/(\d{1,2})\s*tháng/)
  if (month) {
    const d = Number(month[1]) * 30
    return {
      term: { basis: 'net', days: d },
      confident: false,
      why: `${month[1]} tháng ≈ ${d} ngày`,
    }
  }

  // ── 6. Trả ngay / trả trước — KHÔNG có số, xét SAU cùng để không nuốt mất
  //       "nhận hàng thanh toán trong vòng 15 ngày".
  if (/\bcod\b|trả\s*ngay|thanh\s*toán\s*ngay|tiền\s*mặt\s*khi/.test(s)) {
    return { term: { basis: 'net', days: 0 }, confident: !multi, why: 'trả ngay' }
  }
  if (/thanh\s*toán\s*trước\s*khi\s*nhận|trả\s*trước/.test(s)) {
    return {
      term: { basis: 'net', days: 0 },
      confident: !multi,
      why: 'trả trước khi nhận hàng',
    }
  }
  if (/nhận\s*hàng\s*thanh\s*toán|thanh\s*toán\s*khi\s*(nhận|giao)/.test(s)) {
    return {
      term: { basis: 'net', days: 0 },
      confident: !multi,
      why: 'thanh toán khi nhận hàng',
    }
  }

  return NO_GUESS
}

/** Nguồn của điều khoản đang áp — màn BẮT BUỘC nói ra, không để số đứng trơ. */
export type TermSource = 'don' | 'ncc' | 'mac_dinh' | 'khong_co'

export const SOURCE_LABEL: Record<TermSource, string> = {
  don: 'theo đơn mua',
  ncc: 'theo hồ sơ NCC',
  mac_dinh: 'mặc định công ty',
  khong_co: 'chưa có',
}

/**
 * CHUỖI THỪA KẾ — điều khoản của một khoản nợ lấy từ đâu.
 *
 * Đơn thắng hồ sơ, hồ sơ thắng mặc định. Lý do thứ tự đó: điều khoản là thứ
 * **đàm phán cho từng đơn**; hồ sơ NCC chỉ ghi "thường thì bên này cho nợ bao
 * lâu"; mặc định công ty là lưới an toàn để không khoản nợ nào không có hạn.
 *
 * Câu chữ trên đơn chỉ được nhận khi đọc CHẮC CHẮN. Câu mơ hồ ("cọc 30%, còn
 * lại theo từng đợt") rơi xuống tầng dưới thay vì áp một con số đoán mò — đoán
 * sai ở đây là giục NCC theo hạn chưa ai thoả thuận.
 */
export function resolveTerm(input: {
  /** Câu điều khoản ghi trên ĐƠN MUA. */
  poTerms?: string | null
  /** Số ngày khai ở HỒ SƠ NCC (đã là số, không phải đoán). */
  supplierDays?: number | null
  /** Mặc định công ty. `null` = chưa khai. */
  companyDefault?: Term | null
}): { term: Term | null; source: TermSource; why: string } {
  const g = guessTerm(input.poTerms)
  if (g.term && g.confident) {
    return { term: g.term, source: 'don', why: `${SOURCE_LABEL.don}: ${g.why}` }
  }
  if (input.supplierDays != null) {
    return {
      term: { basis: 'net', days: input.supplierDays },
      source: 'ncc',
      why: `${SOURCE_LABEL.ncc}: ${input.supplierDays} ngày`,
    }
  }
  if (input.companyDefault) {
    return {
      term: input.companyDefault,
      source: 'mac_dinh',
      why: `${SOURCE_LABEL.mac_dinh}: ${termLabel(input.companyDefault)}`,
    }
  }
  /*
   * Không tầng nào đỡ. Phân biệt HAI ca, vì việc phải làm khác hẳn nhau:
   *  · đơn CÓ ghi điều khoản mà máy đọc không nổi → người đọc tay là xong;
   *  · đơn TRỐNG → phải đi hỏi NCC, hoặc khai mặc định công ty.
   * Gộp hai ca thành một câu "chưa có hạn" là giấu mất thông tin đã có sẵn.
   */
  const written = (input.poTerms ?? '').trim()
  return {
    term: null,
    source: 'khong_co',
    why: written ? `đơn ghi "${written}" — cần đọc tay` : 'chưa có điều khoản ở đâu cả',
  }
}

/**
 * Hạn thanh toán = ngày gốc + điều khoản.
 *
 * Ngày gốc là **ngày nhận hàng** khi tính theo phiếu nhập, **ngày hoá đơn** khi
 * tính theo hoá đơn — người gọi quyết, hàm này không đoán.
 * `term = null` → `null`, KHÔNG rơi về hôm nay: không có hạn khác hẳn đến hạn.
 */
export function dueDate(baseDate: string, term: Term | null): string | null {
  if (!term || !Number.isFinite(term.days) || term.days < 0) return null
  const d = new Date(`${baseDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (term.basis === 'eom') {
    // Ngày 0 của tháng SAU = ngày cuối tháng NÀY.
    d.setUTCFullYear(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  }
  d.setUTCDate(d.getUTCDate() + Math.trunc(term.days))
  return d.toISOString().slice(0, 10)
}

/**
 * Số ngày QUÁ HẠN tính tới `today`. Âm = chưa tới hạn, 0 = đúng hôm nay.
 * `null` = không có hạn → KHÔNG có tuổi, và không được coi là "chưa tới hạn".
 */
export function overdueDays(due: string | null, today: string): number | null {
  if (!due) return null
  const a = Date.parse(`${due}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/** Nhãn ngắn — để mỗi màn không tự chế một kiểu chữ. */
export function termLabel(term: Term | null): string {
  if (!term) return 'chưa có hạn'
  if (term.basis === 'eom') {
    return term.days ? `cuối tháng + ${term.days} ngày` : 'cuối tháng'
  }
  return term.days === 0 ? 'trả ngay' : `${term.days} ngày`
}

/** Đọc mặc định công ty từ `settings` (chuỗi "net:30" / "eom:0"). */
export function parseTermSetting(v: unknown): Term | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(net|eom):(\d{1,3})$/i)
  if (!m) return null
  return { basis: m[1].toLowerCase() as TermBasis, days: Number(m[2]) }
}

export const formatTermSetting = (t: Term): string => `${t.basis}:${t.days}`
