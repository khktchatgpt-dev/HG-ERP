import { veTheoMa, type DongDonLenh } from './kho-hang-lenh'

/**
 * TỒN THEO LỆNH — logic thuần (Kho đợt 2 · Bước 5, bản vẽ
 * https://claude.ai/artifact/L2FFuzCdLzMPzQJ7ULUprF, duyệt 12/10/2026).
 *
 * Câu trả lời cho thủ kho: hàng trong kho đang là của lệnh nào, lệnh nào giữ hàng
 * mà tổ chưa lấy, lệnh đã xong còn sót gì. Đo 12/10: 168 mã có tồn thì 158 là hàng
 * đã mua cho một lệnh mà chưa ghi xuất, chỉ 10 mã là tồn chung.
 *
 *  · Đã về / đã xuất / còn của lệnh: cùng luật B4 (`veTheoMa`, xuất ròng).
 *  · CHIA TỒN (Q2): 12 mã thuộc nhiều lệnh, tồn không đủ cho cả hai — B4 từng cho
 *    cả hai lệnh thấy cùng một chỗ hàng (PKN0390: kho 9.880 = đúng phần 02-ROSCO,
 *    mà lệnh 05-MX đã xong cũng thấy 9.880). Thứ tự chia: lệnh ĐANG SX có hạn xuất
 *    hàng sớm hơn trước → cùng hạn thì mã lệnh nhỏ trước → lệnh ĐÃ XONG sau cùng.
 *    Đây là số GỢI Ý: thủ kho vẫn sửa số thật lúc xuất.
 */

const EPS = 1e-6
const tron = (n: number) => Math.round(n * 10_000) / 10_000

export type DongLenh = DongDonLenh & { lsx_id: string }

export type LenhTon = {
  id: string
  code: string
  status: string
  /** Hạn xuất hàng (ngày, YYYY-MM-DD). */
  ship_date: string | null
  khach: string | null

  /** Lần ghi xuất gần nhất cho lệnh (mốc ISO), null = chưa xuất lần nào. */
  xuat_cuoi: string | null
}

/** Một mã của một lệnh. `chia` = phần tồn dùng được chia cho lệnh (≤ con). */
export type MaLenh = {
  lsx_id: string
  material_id: string
  ve: number
  xuat: number
  con: number
  chia: number
}

export const lenhXong = (l: Pick<LenhTon, 'status'>) => l.status === 'completed'

/** Khoá xếp thứ tự chia tồn (Q2) — nhỏ hơn được chia trước. */
export function khoaChia(l: Pick<LenhTon, 'status' | 'ship_date' | 'code'>): string {
  return `${lenhXong(l) ? 1 : 0}|${l.ship_date ?? '9999-12-31'}|${l.code}`
}

/**
 * Mỗi (lệnh, mã) đã có hàng về: đã về, đã xuất ròng (≥ 0), còn (≥ 0). Mã chưa về
 * thì không có dòng — chưa về là việc của màn Hàng về. Xuất cho lệnh mà mã không
 * nằm trong đơn của lệnh (07-MX có 3 mã) không tạo dòng: không có "đã về" để trừ.
 */
export function veXuatTheoLenh(input: {
  dong: readonly DongLenh[]
  nhanTheoDong: ReadonlyMap<string, number>
  /** lệnh → (vật tư → xuất ròng). */
  xuat: ReadonlyMap<string, ReadonlyMap<string, number>>
}): Omit<MaLenh, 'chia'>[] {
  const theoLenh = new Map<string, DongLenh[]>()
  for (const d of input.dong) {
    const a = theoLenh.get(d.lsx_id) ?? []
    a.push(d)
    theoLenh.set(d.lsx_id, a)
  }
  const out: Omit<MaLenh, 'chia'>[] = []
  for (const [lsx, dong] of theoLenh) {
    const xuatLenh = input.xuat.get(lsx)
    for (const [m, ve] of veTheoMa(dong, input.nhanTheoDong)) {
      const xuat = Math.max(0, xuatLenh?.get(m) ?? 0)
      out.push({
        lsx_id: lsx,
        material_id: m,
        ve: tron(ve),
        xuat: tron(xuat),
        con: tron(Math.max(0, ve - xuat)),
      })
    }
  }
  return out
}

/** Chia tồn dùng được của từng mã cho các lệnh còn phần chưa xuất (Q2). */
export function chiaTon(
  rows: readonly Omit<MaLenh, 'chia'>[],
  ton: ReadonlyMap<string, number>,
  lenh: ReadonlyMap<string, Pick<LenhTon, 'status' | 'ship_date' | 'code'>>,
): MaLenh[] {
  const khoa = (id: string) => {
    const l = lenh.get(id)
    return l ? khoaChia(l) : `2|9999-12-31|${id}`
  }
  const theoMa = new Map<string, Omit<MaLenh, 'chia'>[]>()
  for (const r of rows) {
    const a = theoMa.get(r.material_id) ?? []
    a.push(r)
    theoMa.set(r.material_id, a)
  }
  const chia = new Map<Omit<MaLenh, 'chia'>, number>()
  for (const [m, ds] of theoMa) {
    let conLai = Math.max(0, ton.get(m) ?? 0)
    for (const r of [...ds].sort((a, b) =>
      khoa(a.lsx_id).localeCompare(khoa(b.lsx_id)),
    )) {
      const a = Math.min(conLai, r.con)
      chia.set(r, a)
      conLai -= a
    }
  }
  return rows.map((r) => ({ ...r, chia: tron(chia.get(r) ?? 0) }))
}

/** Lệnh khác đang được chia tồn của mỗi mã: lsx → (vật tư → mã lệnh khác). */
export function giuChoLenhKhac(
  rows: readonly MaLenh[],
  lenh: ReadonlyMap<string, Pick<LenhTon, 'code'>>,
): Map<string, Map<string, string[]>> {
  const coChia = new Map<string, string[]>()
  for (const r of rows) {
    if (r.chia <= EPS) continue
    const a = coChia.get(r.material_id) ?? []
    a.push(r.lsx_id)
    coChia.set(r.material_id, a)
  }
  const out = new Map<string, Map<string, string[]>>()
  for (const r of rows) {
    const khac = (coChia.get(r.material_id) ?? []).filter((id) => id !== r.lsx_id)
    if (khac.length === 0) continue
    const m = out.get(r.lsx_id) ?? new Map<string, string[]>()
    m.set(
      r.material_id,
      khac.map((id) => lenh.get(id)?.code ?? '?'),
    )
    out.set(r.lsx_id, m)
  }
  return out
}

export type TomTatLenh = {
  lenh: LenhTon
  /** Số mã đã có hàng về cho lệnh. */
  ma_ve: number
  /** Mã đã xuất đủ phần đã về. */
  xuat_du: number
  /** Mã còn phần của lệnh VÀ kho còn hàng chia cho lệnh. */
  con_kho: number
  /** Trong `con_kho`: phần chia ít hơn phần còn của lệnh. */
  thieu: number
  /** Mã còn phần của lệnh mà kho không còn hàng chia cho lệnh. */
  het: number
}

export const RO_LENH = ['con', 'han', 'xong', 'all'] as const
export type RoLenh = (typeof RO_LENH)[number]

const congNgay = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lệnh thuộc rổ nào. `today` là ngày VN (YYYY-MM-DD). */
export function roCuaLenh(t: TomTatLenh, today: string): Record<RoLenh, boolean> {
  const mo = !lenhXong(t.lenh)
  return {
    con: t.con_kho > 0,
    han:
      mo &&
      t.con_kho > 0 &&
      t.lenh.ship_date != null &&
      t.lenh.ship_date <= congNgay(today, 7),
    xong: !mo && t.con_kho + t.het > 0,
    all: true,
  }
}

/**
 * Tóm tắt từng lệnh đã có hàng về (Q5: lệnh chưa có gì về không hiện). Xếp theo
 * việc gấp: lệnh đang SX theo hạn xuất hàng (quá hạn tự lên đầu), lệnh đã xong
 * xuống cuối.
 */
export function tomTatLenh(
  rows: readonly MaLenh[],
  lenh: readonly LenhTon[],
): TomTatLenh[] {
  const theoLenh = new Map<string, MaLenh[]>()
  for (const r of rows) {
    const a = theoLenh.get(r.lsx_id) ?? []
    a.push(r)
    theoLenh.set(r.lsx_id, a)
  }
  const out: TomTatLenh[] = []
  for (const l of lenh) {
    const ds = (theoLenh.get(l.id) ?? []).filter((r) => r.ve > EPS)
    if (ds.length === 0) continue
    const conPhan = ds.filter((r) => r.con > EPS)
    const coKho = conPhan.filter((r) => r.chia > EPS)
    out.push({
      lenh: l,
      ma_ve: ds.length,
      xuat_du: ds.length - conPhan.length,
      con_kho: coKho.length,
      thieu: coKho.filter((r) => r.chia < r.con - EPS).length,
      het: conPhan.length - coKho.length,
    })
  }
  return out.sort((a, b) => khoaChia(a.lenh).localeCompare(khoaChia(b.lenh)))
}

/** Theo mã: lệnh nào đang được chia bao nhiêu (cột "Của lệnh", Q4). */
export function cuaLenhTheoMa(
  rows: readonly MaLenh[],
  lenh: ReadonlyMap<string, Pick<LenhTon, 'code' | 'status' | 'ship_date'>>,
): Map<string, { lsx_id: string; code: string; qty: number }[]> {
  const out = new Map<
    string,
    { lsx_id: string; code: string; qty: number; k: string }[]
  >()
  for (const r of rows) {
    if (r.chia <= EPS) continue
    const l = lenh.get(r.lsx_id)
    const a = out.get(r.material_id) ?? []
    a.push({
      lsx_id: r.lsx_id,
      code: l?.code ?? '?',
      qty: r.chia,
      k: l ? khoaChia(l) : '',
    })
    out.set(r.material_id, a)
  }
  return new Map(
    [...out].map(([m, a]) => [
      m,
      a
        .sort((x, y) => x.k.localeCompare(y.k))
        .map(({ lsx_id, code, qty }) => ({ lsx_id, code, qty })),
    ]),
  )
}
