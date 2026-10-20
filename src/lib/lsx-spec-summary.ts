/**
 * THÔNG SỐ KỸ THUẬT CỦA LỆNH — gom từ DÒNG LỆNH cho người MUA đọc.
 *
 * Người mua cần bốn thứ này để soạn đơn: sơn màu gì, gỗ loại nào, kính quy cách
 * ra sao, nệm vải gì. Hôm nay chúng nằm trong `production_order_lines.specs`
 * (đo 16/09/2026: 217/291 dòng có khai) nhưng KHÔNG màn nào của khu Mua hàng
 * bày ra — người mua phải mở màn của phòng khác để tra, rồi chép tay sang đơn.
 *
 * VÌ SAO PHẢI GOM chứ không bày thẳng bảng dòng lệnh: một lệnh có 6–17 dòng mà
 * phần lớn dùng CHUNG một mã sơn, một loại gỗ. Bày 17 dòng giống hệt nhau thì
 * người đọc phải tự so từng ô để biết "có ngoại lệ nào không" — đúng việc máy
 * nên làm. Nên:
 *
 *   · mọi dòng cùng một giá trị → nói MỘT câu cho cả lệnh;
 *   · có dòng khác → nói ra ĐÚNG những dòng khác, vì đó mới là thứ đáng đọc;
 *   · không dòng nào khai → nói THẲNG là chưa khai, không giấu ô trống. Chỗ
 *     trống đó là việc của Bán hàng/Kỹ thuật, giấu đi thì không ai biết mà đòi.
 *
 * Thuần, không chạm DB — để test được cả ba nhánh trên.
 */

/** Khoá trong `specs` của dòng lệnh, kèm nhãn tiếng Việt người mua đọc. */
export const SPEC_FIELDS = [
  { key: 'son', label: 'Sơn' },
  { key: 'go', label: 'Gỗ' },
  { key: 'kinh', label: 'Kính' },
  { key: 'nem', label: 'Nệm' },
  { key: 'may', label: 'Mây / dây' },
] as const

export type SpecKey = (typeof SPEC_FIELDS)[number]['key']

export type SpecLine = {
  code: string
  name: string
  specs: Record<string, string | null | undefined>
}

export type SpecGroup = {
  key: SpecKey
  label: string
  /** Mọi dòng CÓ KHAI đều cùng một giá trị — bày một câu cho cả lệnh. */
  chung: string | null
  /**
   * Các giá trị KHÁC NHAU, mỗi giá trị kèm những mã dùng nó — chỉ có khi cả
   * lệnh không dùng chung một thông số.
   *
   * GOM THEO GIÁ TRỊ, không theo mã: đo trên lệnh 01/26-27 ROSCO ngày
   * 16/09/2026, ô "Mây" có 20 mã nhưng chỉ HAI giá trị. Liệt kê theo mã ra 20
   * dòng, 18 dòng trong đó lặp lại chữ y hệt dòng trên — người mua phải tự
   * đọc hết mới biết "à, chỉ có hai loại". Việc so sánh đó là việc của máy.
   */
  theoGiaTri: { value: string; codes: string[] }[]
  /** Số dòng bỏ trống ô này. */
  thieu: number
}

const sach = (v: string | null | undefined): string => (v ?? '').trim()

/**
 * Gom thông số của một lệnh.
 *
 * Trả ĐỦ năm khoá kể cả khi không dòng nào khai (`chung` null, `theoDong` rỗng,
 * `thieu` = tổng số dòng) — màn cần biết để nói "chưa khai" thay vì lặng lẽ bỏ
 * mục đó đi.
 */
export function gomThongSo(lines: SpecLine[]): SpecGroup[] {
  return SPEC_FIELDS.map(({ key, label }) => {
    const coKhai = lines
      .map((l) => ({ code: l.code, name: l.name, value: sach(l.specs?.[key]) }))
      .filter((x) => x.value !== '')
    const thieu = lines.length - coKhai.length
    if (coKhai.length === 0) return { key, label, chung: null, theoGiaTri: [], thieu }

    const khac = new Set(coKhai.map((x) => x.value))
    /*
      MỘT giá trị duy nhất VÀ không dòng nào bỏ trống → mới gọi là "cả lệnh".
      Còn 16/17 dòng ghi "PT-7476" và một dòng để trống thì KHÔNG được nói cả
      lệnh dùng PT-7476: dòng trống kia có thể là mã không sơn, mà cũng có thể
      là Bán hàng quên khai — hai chuyện khác hẳn nhau, và người mua phải thấy
      để còn đi hỏi.
    */
    if (khac.size === 1 && thieu === 0) {
      return { key, label, chung: [...khac][0], theoGiaTri: [], thieu: 0 }
    }
    // Giữ THỨ TỰ XUẤT HIỆN, không sắp xếp: thứ tự dòng lệnh là thứ tự Bán hàng
    // soạn, và người mua đọc đối chiếu với tờ lệnh in ra.
    const theoGiaTri: SpecGroup['theoGiaTri'] = []
    for (const x of coKhai) {
      const hit = theoGiaTri.find((g) => g.value === x.value)
      if (hit) hit.codes.push(x.code)
      else theoGiaTri.push({ value: x.value, codes: [x.code] })
    }
    return { key, label, chung: null, theoGiaTri, thieu }
  })
}

/** Lệnh có khai được ô nào không — để màn chọn giữa bày bảng và bày trạng thái rỗng. */
export function coThongSo(groups: SpecGroup[]): boolean {
  return groups.some((g) => g.chung != null || g.theoGiaTri.length > 0)
}
