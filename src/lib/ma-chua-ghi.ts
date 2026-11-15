/**
 * MÃ HÀNG CHƯA GHI ĐƯỢC — Ghi sản lượng nói thật khi sản phẩm chưa có định mức
 * (bản vẽ 15/11/2026 https://claude.ai/artifact/MRFoxWghYveCnpdWf2fU3C, duyệt
 * Q1–Q5). Thuần, client và server dùng chung, có test.
 *
 * Ghi sản lượng dựng dòng ghi từ BẢNG CHI TIẾT của lệnh (production_components).
 * Mã hàng không có bảng thì không có dòng nào — trước đây biến mất không một chữ.
 * Hai lý do, hai người gỡ:
 *  - `chua_nap`: hồ sơ SP CÓ định mức, chỉ chưa nạp vào lệnh → bấm "Nạp từ BOM"
 *    ở Bảng chi tiết (người định hình lệnh);
 *  - `chua_dm`: hồ sơ SP chưa có định mức → Kỹ thuật.
 */

export type TinhTrangMa = 'co_bang' | 'chua_nap' | 'chua_dm'

export type MaCuaLenh = {
  ma: string
  ten: string
  sl: number
  /** Số dòng lệnh (đợt) của mã này — một mã lặp ở nhiều đợt gộp một hàng. */
  dot: number
  tinh_trang: TinhTrangMa
  /** Số dòng định mức ở hồ sơ SP (để nói "có định mức (25 dòng)"). */
  n_dm: number
}

export type LenhTinhTrang = {
  lsx_id: string
  lsx_code: string
  ma: MaCuaLenh[]
  /** Mã chưa ghi được (chưa có bảng chi tiết). */
  chua: MaCuaLenh[]
  sl_chua: number
  n_chua_dm: number
  n_chua_nap: number
}

/** Một dòng SP của lệnh, đã đếm sẵn bảng chi tiết và định mức. */
export type DongDinhMuc = {
  lsx_id: string
  ma: string
  ten: string
  sl: number
  co_bang: boolean
  n_dm: number
}

export function gomMaCuaLenh(
  lenh: { id: string; code: string }[],
  dong: DongDinhMuc[],
): LenhTinhTrang[] {
  return lenh.map((L) => {
    const by = new Map<
      string,
      { ma: string; ten: string; sl: number; dot: number; co_bang: boolean; n_dm: number }
    >()
    for (const d of dong) {
      if (d.lsx_id !== L.id) continue
      const g = by.get(d.ma) ?? {
        ma: d.ma,
        ten: d.ten,
        sl: 0,
        dot: 0,
        co_bang: false,
        n_dm: 0,
      }
      g.sl += d.sl
      g.dot++
      g.co_bang ||= d.co_bang
      g.n_dm = Math.max(g.n_dm, d.n_dm)
      by.set(d.ma, g)
    }
    const ma: MaCuaLenh[] = [...by.values()]
      .map((g) => ({
        ma: g.ma,
        ten: g.ten,
        sl: g.sl,
        dot: g.dot,
        n_dm: g.n_dm,
        tinh_trang: (g.co_bang
          ? 'co_bang'
          : g.n_dm > 0
            ? 'chua_nap'
            : 'chua_dm') as TinhTrangMa,
      }))
      .sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }))
    const chua = ma.filter((m) => m.tinh_trang !== 'co_bang')
    return {
      lsx_id: L.id,
      lsx_code: L.code,
      ma,
      chua,
      sl_chua: chua.reduce((a, m) => a + m.sl, 0),
      n_chua_dm: chua.filter((m) => m.tinh_trang === 'chua_dm').length,
      n_chua_nap: chua.filter((m) => m.tinh_trang === 'chua_nap').length,
    }
  })
}

/** "26 mã chưa có định mức · 5 mã chưa nạp" — dùng ở ô chọn lệnh và câu báo. */
export function lyDoChuaGhi(t: Pick<LenhTinhTrang, 'n_chua_dm' | 'n_chua_nap'>): string {
  return [
    t.n_chua_dm ? `${t.n_chua_dm} mã chưa có định mức` : null,
    t.n_chua_nap ? `${t.n_chua_nap} mã chưa nạp` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Một lệnh trong ô chọn. `open_count` null = chưa ghi được (chưa có bảng chi tiết). */
export type LenhOption = {
  id: string
  code: string
  open_count: number | null
  /** Mã chưa ghi được / tổng mã của lệnh. */
  chua: number
  tong: number
  ly_do: string
}

/** Từ tình trạng định mức + thẻ lệnh có việc → ô chọn lệnh hai nhóm (Q1). */
export function lenhOptions(
  tinhTrang: LenhTinhTrang[],
  coViec: { lsx_id: string; lsx_code: string; open_count: number }[],
): LenhOption[] {
  const viec = new Map(coViec.map((c) => [c.lsx_id, c.open_count]))
  const tt = new Map(tinhTrang.map((t) => [t.lsx_id, t]))
  const ghiDuoc = coViec.map((c) => {
    const t = tt.get(c.lsx_id)
    return {
      id: c.lsx_id,
      code: c.lsx_code,
      open_count: c.open_count,
      chua: t?.chua.length ?? 0,
      tong: t?.ma.length ?? 0,
      ly_do: t ? lyDoChuaGhi(t) : '',
    }
  })
  const chuaGhi = tinhTrang
    .filter((t) => !viec.has(t.lsx_id))
    .map((t) => ({
      id: t.lsx_id,
      code: t.lsx_code,
      open_count: null,
      chua: t.chua.length,
      tong: t.ma.length,
      ly_do: lyDoChuaGhi(t) || 'chưa có dòng việc nào',
    }))
  return [...ghiDuoc, ...chuaGhi]
}
