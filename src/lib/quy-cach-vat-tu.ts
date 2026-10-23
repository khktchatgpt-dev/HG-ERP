/**
 * QUY CÁCH KIM LOẠI ĐỌC TỪ TÊN VẬT TƯ (22/10/2026) — để so giá NHÔM / THÉP giữa
 * các NCC theo đ/kg.
 *
 * Vì sao không so theo mã: mỗi NCC một mã, một cách đặt tên ("Nhôm vuông 20 x 20
 * T1.0", "Nhôm vuông 20 x1.0 (dài 5.0m)", mã cắt sẵn từng chiều dài NH-0569…).
 * Đo 21/10 trên đơn của cả phòng: theo mã chỉ 17 mặt hàng mua của ≥ 2 NCC; gom
 * theo quy cách thì nhôm vuông 20×20 T1.0 hiện ra ở 3 NCC (108k / 113k / 113k).
 *
 * Quy cách = kim loại + dạng (hộp/vuông/tròn/oval/tấm) + kích thước + độ dày,
 * BỎ chiều dài cây (giá/kg không đổi theo chiều dài) + cờ mềm / có gân / kẽm.
 * Profile riêng của NCC (TD-A648, QM-HGGL-…, DTBD05) không có quy cách chung —
 * khoá theo chính tên.
 */

export type QuyCach = {
  /** Khoá gom: hai vật tư cùng khoá = cùng hàng, so được đ/kg. */
  key: string
  /** Nhãn người đọc: "Nhôm vuông 20×20 T1.0 mềm". */
  label: string
  kimLoai: 'Nhôm' | 'Thép'
  dang: 'hộp' | 'vuông' | 'tròn' | 'oval' | 'tấm' | 'profile'
}

const num = (s: string) => Number(s.replace(',', '.'))
const fmtT = (t: number) => (Number.isInteger(t) ? t.toFixed(1) : String(t))

/** Tên có phải vật tư kim loại dạng thanh/tấm không (nhôm, thép, sắt, inox). */
export function laKimLoai(name: string, groupName?: string | null): boolean {
  const s = `${name} ${groupName ?? ''}`.toLowerCase()
  if (/tấm lót|bulon|bu lông|vít|tán |ốc|long đền|lđs|lđn/.test(s)) return false
  return /nhôm|thép|sắt|inox/.test(s)
}

/**
 * Đọc quy cách. `extra` = chữ phụ (quy cách / bề mặt trên dòng đơn) để bắt cờ
 * "kẽm". Trả null khi tên không phải kim loại.
 */
export function docQuyCach(
  name: string,
  extra?: string | null,
  groupName?: string | null,
): QuyCach | null {
  if (!laKimLoai(name, groupName)) return null
  const s0 = name.toLowerCase().normalize('NFC').trim()
  const kimLoai: QuyCach['kimLoai'] = /nhôm/.test(
    `${s0} ${groupName ?? ''}`.toLowerCase(),
  )
    ? 'Nhôm'
    : 'Thép'
  // Bỏ chiều dài cây: "dài 5.48m", "(dài 5.8 mét)", "(5.5m)", "mềm 4.6m", "x6m".
  const s = s0
    .replace(/\(?\s*dài\s*[\d.,]+\s*m(ét)?\s*\)?/g, ' ')
    .replace(/\(\s*[\d.,]+\s*m\s*\)/g, ' ')
    .replace(/\s[\d.,]+\s*m\s*$/g, ' ')
    .replace(/x\s*[\d.,]+\s*m\b/g, ' ')
    .replace(/\*/g, 'x')
    .replace(/(\d+)\s*dem/g, (_, d: string) => String(Number(d) / 10))
  const mem = /mềm/.test(s) ? ' mềm' : ''
  const gan = /gân/.test(s) ? ' có gân' : ''
  const kem = /kẽm/.test(s) || /kẽm/i.test(extra ?? '') ? ' kẽm' : ''
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(num)

  if (/\b(td|qm|dtbd)[\s-]?[a-z-]*\d/.test(s))
    return { key: `profile|${s0}`, label: `${name.trim()} (profile riêng)`, kimLoai, dang: 'profile' } // prettier-ignore

  if (/tấm/.test(s)) {
    const t = nums.find((n) => n <= 20) ?? null
    return { key: `${kimLoai}|tấm|${t}`, label: `${kimLoai} tấm dày ${t ?? '?'} mm`, kimLoai, dang: 'tấm' } // prettier-ignore
  }
  let dang: QuyCach['dang'] | '' = /oval/.test(s)
    ? 'oval'
    : /ống|phi|ø/.test(s)
      ? 'tròn'
      : /vuông/.test(s)
        ? 'vuông'
        : /hộp/.test(s)
          ? 'hộp'
          : ''
  let dims: number[]
  let t: number | null
  if (dang === 'tròn') {
    dims = nums.slice(0, 1)
    t = nums[1] ?? null
  } else if (dang === 'vuông' && nums.length <= 2) {
    dims = [nums[0], nums[0]]
    t = nums[1] ?? null
  } else {
    dims = nums.slice(0, 2)
    t = nums[2] ?? null
    // Không ghi dạng ("Nhôm 25x25xT1.0R1.5") hoặc "Thép hộp vuông 20x40": hai
    // cạnh bằng nhau là vuông, khác nhau là hộp.
    if (!dang || dang === 'vuông') dang = dims[0] === dims[1] ? 'vuông' : 'hộp'
  }
  if (dims.length === 0 || dims.some((n) => !Number.isFinite(n)))
    return { key: `ten|${s0}`, label: name.trim(), kimLoai, dang: 'profile' }
  const kt = dang === 'tròn' ? `phi ${dims[0]}` : `${dang} ${dims.join('×')}`
  const label = `${kimLoai} ${kt}${t != null ? ` T${fmtT(t)}` : ''}${mem}${gan}${kem}`
  return { key: `${kimLoai}|${label}`, label, kimLoai, dang: dang as QuyCach['dang'] }
}
