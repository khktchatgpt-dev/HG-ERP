import { docSo, laSoSai } from './so-o-luoi'

/**
 * DÁN SỔ EXCEL — phần THUẦN (đọc vùng dán, khớp chi tiết). Màn /thongke/dan-so
 * dùng chung hai phía (bản vẽ 17/11/2026, https://claude.ai/artifact/TN9FdcN5S1mJBDAvwQcsS4).
 *
 * Dạng đọc được: TỜ CÔNG ĐOẠN của sổ thống kê — một hàng tiêu đề (Cụm · Tên chi
 * tiết · ĐM · CT/SP · Tổng cần · …) và các CỘT NGÀY ("26/07", "4/5", "2026-07-26"),
 * mỗi dòng một chi tiết. Hàng tiêu đề có thể trải 1–3 hàng (ngày nằm hàng dưới).
 * Sổ phẳng (mỗi dòng một ngày) là bước sau.
 */

export type CotNgay = { col: number; iso: string; nhan: string }

export type DongDan = {
  /** Số dòng trong vùng dán (từ 1) — để chỉ cho người dùng đúng dòng. */
  hang: number
  cum: string
  ten: string
  ma_sp: string | null
  /** Người dùng xác nhận là chi tiết MỚI (không phải gõ sai tên) — đặt ở màn xem trước. */
  them_moi?: boolean
  /** Cụm của LỆNH người dùng chọn thay cho chữ ở cột Cụm của file. */
  cum_ten?: string
  ct_sp: number | null
  dm: number | null
  can: number | null
  /** ngày ISO → số làm. Ô trống không có khoá. */
  o: Record<string, number>
  /** Ô có chữ không đọc được thành số. */
  sai: { iso: string; raw: string }[]
}

export type KetQuaDoc = {
  ok: boolean
  dong: DongDan[]
  cot: CotNgay[]
  /** Cột nhận được: tiêu đề trong file → hiểu là gì. */
  hieu: { tieu_de: string; la: string }[]
  loi: string[]
  /** Dòng trống / dòng tiêu đề nhóm / dòng tổng đã bỏ qua. */
  bo_qua: number
}

/** Chữ so khớp: không dấu, thường, chỉ chữ+số, gọn khoảng trắng. */
export function chuan(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function lev(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[n]
}

const two = (n: number) => String(n).padStart(2, '0')

/** "26/07" · "4/5" · "26-7-2026" · "2026-07-26" → ISO; null nếu không phải ngày. */
export function docNgay(raw: string, nam: number): string | null {
  const s = raw.trim()
  let y: number
  let m: number
  let d: number
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else {
    const v = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(s)
    if (!v) return null
    d = Number(v[1])
    m = Number(v[2])
    y = v[3] ? (v[3].length === 2 ? 2000 + Number(v[3]) : Number(v[3])) : nam
  }
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) {
    return null
  }
  return `${y}-${two(m)}-${two(d)}`
}

/** TSV của Excel: ô có xuống dòng / tab được bọc "…" — gỡ ra. */
export function tachBang(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const t = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"' && cell === '') q = true
    else if (c === '\t') {
      row.push(cell)
      cell = ''
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

type Vai = 'cum' | 'ten' | 'ma_sp' | 'dm' | 'ct_sp' | 'can'

function vaiCuaCot(h: string): Vai | null {
  const c = chuan(h)
  if (!c) return null
  if (/\b(ct|chi tiet|sl)\b.*\bsp\b/.test(c) || c === 'ct sp') return 'ct_sp'
  if (c.includes('ten chi tiet') || c === 'chi tiet' || c === 'ten') return 'ten'
  if (c === 'cum' || c.startsWith('cum ') || c === 'parts' || c.includes('bo phan'))
    return 'cum'
  if (c === 'ma sp' || c === 'ma hang' || c === 'ma san pham') return 'ma_sp'
  if (c === 'dm' || c.startsWith('dm ') || c.includes('dinh muc')) return 'dm'
  if (c === 'tong can' || c === 'can') return 'can'
  return null
}

const TEN_VAI: Record<Vai, string> = {
  cum: 'Cụm',
  ten: 'Chi tiết',
  ma_sp: 'Mã SP',
  dm: 'Định mức kg',
  ct_sp: 'Số chi tiết / SP',
  can: 'Chỉ để đối chiếu',
}

const SO_CUC = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Đọc vùng dán. `nam` = năm điền cho cột ngày chỉ có "d/m". */
export function docDan(text: string, nam: number): KetQuaDoc {
  const bang = tachBang(text)
  const rong: KetQuaDoc = { ok: false, dong: [], cot: [], hieu: [], loi: [], bo_qua: 0 }
  if (bang.length === 0) return { ...rong, loi: ['Chưa có dữ liệu để đọc'] }

  // Hàng tiêu đề = hàng đầu (trong 15 hàng) có cột "Tên chi tiết".
  let h = -1
  const vai = new Map<number, Vai>()
  for (let r = 0; r < Math.min(bang.length, 15) && h < 0; r++) {
    const m = new Map<number, Vai>()
    bang[r].forEach((c, i) => {
      const v = vaiCuaCot(c)
      if (v && ![...m.values()].includes(v)) m.set(i, v)
    })
    if ([...m.values()].includes('ten')) {
      h = r
      m.forEach((v, i) => vai.set(i, v))
    }
  }
  if (h < 0) {
    return {
      ...rong,
      loi: ['Không thấy cột "Tên chi tiết" — dán cả hàng tiêu đề của tờ Excel'],
    }
  }

  // Cột ngày: ô nào trong hàng tiêu đề và 2 hàng dưới đọc được thành ngày.
  const cot: CotNgay[] = []
  const loi: string[] = []
  let cuoiTieuDe = h
  const ngayTai = new Map<number, string>()
  for (let r = h; r <= Math.min(h + 2, bang.length - 1); r++) {
    bang[r].forEach((c, i) => {
      if (vai.has(i)) return
      const iso = docNgay(c, nam)
      if (iso && !ngayTai.has(i)) {
        ngayTai.set(i, iso)
        cuoiTieuDe = Math.max(cuoiTieuDe, r)
      }
    })
  }
  const daCo = new Set<string>()
  for (const [col, iso] of [...ngayTai].sort((a, b) => a[0] - b[0])) {
    if (daCo.has(iso)) {
      loi.push(`Ngày ${iso.slice(8)}/${iso.slice(5, 7)} có hai cột — giữ cột đầu`)
      continue
    }
    daCo.add(iso)
    cot.push({ col, iso, nhan: `${iso.slice(8)}/${iso.slice(5, 7)}` })
  }
  if (cot.length === 0) {
    return {
      ...rong,
      loi: ['Không thấy cột ngày (vd 26/07) — dán cả hàng ngày của tờ Excel'],
    }
  }

  const cotCua = (v: Vai) => [...vai].find(([, x]) => x === v)?.[0] ?? -1
  const cCum = cotCua('cum')
  const cTen = cotCua('ten')
  const cSp = cotCua('ma_sp')
  const cDm = cotCua('dm')
  const cCt = cotCua('ct_sp')
  const cCan = cotCua('can')
  const lay = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')

  const dong: DongDan[] = []
  let boQua = 0
  let cumDang = ''
  for (let r = cuoiTieuDe + 1; r < bang.length; r++) {
    const row = bang[r]
    const ten = SO_CUC(lay(row, cTen))
    const cumRaw = SO_CUC(lay(row, cCum))
    if (cumRaw) cumDang = cumRaw
    const o: Record<string, number> = {}
    const sai: { iso: string; raw: string }[] = []
    for (const c of cot) {
      const raw = (row[c.col] ?? '').trim()
      if (!raw) continue
      const n = docSo(raw)
      if (laSoSai(raw) || n == null || n < 0) sai.push({ iso: c.iso, raw })
      else if (n > 0) o[c.iso] = n
    }
    const coSo = Object.keys(o).length > 0 || sai.length > 0
    if (!ten || /^tong\b/.test(chuan(ten)) || chuan(ten) === 'ten chi tiet') {
      // dòng trống, dòng tiêu đề nhóm, dòng tổng, hàng tiêu đề phụ — bỏ, trừ khi
      // có số mà không có tên (người dùng cần biết).
      if (ten === '' && coSo) loi.push(`Dòng ${r + 1}: có số nhưng không có tên chi tiết`)
      else boQua++
      continue
    }
    if (!coSo) {
      boQua++
      continue
    }
    dong.push({
      hang: r + 1,
      cum: cumRaw || cumDang,
      ten,
      ma_sp: lay(row, cSp) || null,
      ct_sp: docSo(lay(row, cCt)),
      dm: docSo(lay(row, cDm)),
      can: docSo(lay(row, cCan)),
      o,
      sai,
    })
  }

  const hieu = [...vai]
    .sort((a, b) => a[0] - b[0])
    .map(([i, v]) => ({ tieu_de: SO_CUC(bang[h][i] ?? ''), la: TEN_VAI[v] }))
  if (dong.length === 0) loi.push('Không có dòng nào mang số làm')
  return { ok: dong.length > 0, dong, cot, hieu, loi, bo_qua: boQua }
}

// ── Khớp chi tiết của lệnh ───────────────────────────────────────────────────

export type CtLenh = {
  id: string
  ten: string
  cum: string | null
  kind: 'part' | 'assembly'
}

export type Khop =
  | { kieu: 'khop'; id: string }
  | { kieu: 'gan'; id: string; ten: string }
  | { kieu: 'trung' }
  | { kieu: 'moi' }

/**
 * Khớp một dòng dán với chi tiết của lệnh (đã lọc theo dòng SP). Trùng tên ở
 * nhiều cụm thì dùng cột Cụm để chọn; không khớp hẳn mà có tên GẦN GIỐNG duy
 * nhất (sai dấu, sai một vài ký tự) thì gợi ý, không tự nhận.
 */
export function khopChiTiet(d: { cum: string; ten: string }, ds: CtLenh[]): Khop {
  const chi = ds.filter((c) => c.kind === 'part')
  const t = chuan(d.ten)
  const cung = chi.filter((c) => chuan(c.ten) === t)
  if (cung.length === 1) return { kieu: 'khop', id: cung[0].id }
  if (cung.length > 1) {
    const cu = chuan(d.cum)
    const theoCum = cu ? cung.filter((c) => chuan(c.cum) === cu) : []
    return theoCum.length === 1 ? { kieu: 'khop', id: theoCum[0].id } : { kieu: 'trung' }
  }
  if (t.length >= 4) {
    const nguong = Math.max(1, Math.floor(t.length / 6))
    let tot: { c: CtLenh; k: number }[] = []
    let min = Infinity
    for (const c of chi) {
      const k = lev(t, chuan(c.ten))
      if (k > nguong) continue
      if (k < min) {
        min = k
        tot = [{ c, k }]
      } else if (k === min) tot.push({ c, k })
    }
    if (tot.length === 1) return { kieu: 'gan', id: tot[0].c.id, ten: tot[0].c.ten }
  }
  return { kieu: 'moi' }
}

/** Một tờ mẫu tải về (B3): một mã hàng × một công đoạn. */
export type MauTo = {
  ten: string
  ma: string
  cot: string[]
  dong: { cum: string; ten: string; ct_sp: number; can: number; o: Record<string, number> }[]
}

const ngayDich = (iso: string, d: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + d)
  return t.toISOString().slice(0, 10)
}

/**
 * Các cột ngày của tờ mẫu: từ ngày đã có sổ SỚM NHẤT (hoặc 13 ngày trước hôm nay,
 * lấy ngày nào sớm hơn) tới hôm nay, tối đa 92 cột (chừa phần cũ nhất).
 */
export function cotNgayMau(daCo: string[], today: string): string[] {
  const dau = [...daCo.filter((d) => d <= today), ngayDich(today, -13)].sort()[0]
  const out: string[] = []
  for (let d = dau; d <= today; d = ngayDich(d, 1)) out.push(d)
  return out.slice(-92)
}
