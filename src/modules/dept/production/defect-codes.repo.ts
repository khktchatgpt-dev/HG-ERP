import { db } from '@/server/db'

/**
 * DANH MỤC LÝ DO LỖI (0206, dựng lại từ seed của 0067).
 *
 * `stage_code` null = áp dụng mọi công đoạn. Đây là chiều quan trọng nhất:
 * bày cả danh mục ra thì tổ sơn phải lướt qua lỗi hàn, lỗi đan, lỗi may để
 * tìm "xước sơn" — và khi danh sách dài hơn kiên nhẫn thì người ta chọn
 * "nguyên nhân khác" cho xong. Lọc theo công đoạn giữ danh sách còn 6–8 mục.
 * Đây cũng là cách NetSuite làm (Scrap Reason Details gắn theo work center),
 * hệ mạnh nhất khoản này trong bốn hệ đã đối chiếu.
 *
 * Dùng chung cho PHẾ và SỬA LẠI: cùng một hiện tượng ("lệch mối hàn"), chỉ
 * khác ở chỗ cứu được hay không. Hai danh mục là bắt người khai học hai bảng.
 */
export type DefectCode = {
  code: string
  label: string
  /** null = mọi công đoạn. */
  stage_code: string | null
}

export const defectCodesRepo = {
  /**
   * Toàn bộ mã còn hiệu lực, đã xếp thứ tự. Lọc theo công đoạn làm ở tầng
   * gọi chứ không ở đây: danh mục chỉ vài chục dòng nên một truy vấn không
   * điều kiện vừa rẻ hơn vừa khỏi ghép chuỗi filter từ tham số bên ngoài.
   */
  async listActive(): Promise<DefectCode[]> {
    const { data } = await db()
      .from('production_defect_codes')
      .select('code, label, stage_code')
      .eq('is_active', true)
      .order('sort_order')
    return (data as DefectCode[] | null) ?? []
  },
}

/**
 * Mã dùng được ở một công đoạn: mã riêng của công đoạn đó + mã dùng chung.
 * Giữ nguyên thứ tự `sort_order` đã sắp từ truy vấn.
 */
export function codesForStage(all: DefectCode[], stage: string): DefectCode[] {
  return all.filter((c) => c.stage_code === null || c.stage_code === stage)
}
