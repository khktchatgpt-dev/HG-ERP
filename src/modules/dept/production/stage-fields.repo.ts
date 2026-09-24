import { db } from '@/server/db'

/**
 * Ô NHẬP RIÊNG THEO CÔNG ĐOẠN (0207) — khai bằng dữ liệu, không phải cột.
 *
 * Mỗi công đoạn ghi thứ khác nhau: phôi cần Máy và Quy cách, hàn cần Loại máy
 * hàn, sơn cần Màu và Loại sơn, đan cần biết hàng trần hay đang mây. Sổ Excel
 * của thống kê đã chia như vậy từ đầu.
 *
 * Không hệ ERP lớn nào giải bài này bằng cách thêm CỘT vào sổ sản lượng — tất
 * cả tách ra một bản ghi phụ gắn vào công đoạn và cho khai báo (SAP operation
 * user fields + field key; SAP DM data collection group; Odoo Quality Control
 * Point gắn theo Operation; NetSuite custom field trên Manufacturing Operation
 * Task). Dynamics không có nên phải đẩy sang quality order — và user-defined
 * fields của nó giới hạn 20 trường một bảng, đúng cái bẫy của hướng "thêm cột".
 *
 * Nhờ vậy, thêm một ô cho một công đoạn về sau là THÊM MỘT DÒNG DỮ LIỆU.
 */
export type StageField = {
  stage_code: string
  /** Khoá trong `production_entries.stage_meta`. Bất biến. */
  field_key: string
  label: string
  kind: 'text' | 'number' | 'select'
  /** Danh sách chọn cho `kind='select'`; null với kiểu khác. */
  options: string[] | null
  required: boolean
  /** Dung sai cho `kind='number'` — ngoài dải thì cảnh báo ngay lúc gõ. */
  min_value: number | null
  max_value: number | null
}

type Raw = Omit<StageField, 'options' | 'min_value' | 'max_value'> & {
  options: unknown
  min_value: string | number | null
  max_value: string | number | null
}

const numOrNull = (v: string | number | null) => (v == null ? null : Number(v))

export const stageFieldsRepo = {
  /**
   * Toàn bộ ô còn hiệu lực, đã xếp thứ tự. Lọc theo công đoạn ở tầng gọi:
   * bảng này vài chục dòng nên một truy vấn không điều kiện vừa rẻ hơn vừa
   * khỏi ghép chuỗi filter từ tham số bên ngoài.
   */
  async listActive(): Promise<StageField[]> {
    const { data } = await db()
      .from('production_stage_fields')
      .select(
        'stage_code, field_key, label, kind, options, required, min_value, max_value',
      )
      .eq('is_active', true)
      .order('sort_order')
    return ((data as Raw[] | null) ?? []).map((r) => ({
      ...r,
      options: Array.isArray(r.options) ? (r.options as string[]) : null,
      min_value: numOrNull(r.min_value),
      max_value: numOrNull(r.max_value),
    }))
  },
}

/** Ô của một công đoạn, giữ nguyên thứ tự đã sắp từ truy vấn. */
export function fieldsForStage(all: StageField[], stage: string): StageField[] {
  return all.filter((f) => f.stage_code === stage)
}
