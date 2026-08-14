/**
 * Giới hạn dung lượng upload theo loại tài liệu — NGUỒN DUY NHẤT cho cả client
 * lẫn server.
 *
 * Ở `src/lib` chứ không ở `src/modules/core/files` vì Client Component không được
 * import từ `src/modules/*` (xem CLAUDE.md). Trước đây hằng số 10 MB bị chép ở 3
 * chỗ (files.schema, upload.ts, FileUploader.tsx) và đã bắt đầu lệch nhau.
 *
 * File này phải là hằng số thuần — không import server, không import zod.
 */

const MB = 1024 * 1024

export const DOC_TYPES = ['drawing', 'bom', 'assembly', 'image', 'cert', 'other'] as const
export type DocType = (typeof DOC_TYPES)[number]

/**
 * Cố ý KHÔNG nén ảnh khi upload — bản vẽ và ảnh SP là dữ liệu gốc, nén là mất
 * chi tiết không lấy lại được. Chặn file quá khổ từ đầu, còn chi phí egress xử
 * lý ở tầng phân phối (Next Image resize + cache). Xem
 * docs/ke-hoach-toi-uu-file-anh.md.
 *
 * 14/08/2026 — user yêu cầu bỏ giới hạn upload trên hồ sơ SP. Mọi loại nâng lên
 * 50 MB (trần global của Supabase Storage ở gói Free, không nâng thêm được nếu
 * chưa lên Pro). CƠ CHẾ tách theo loại vẫn giữ nguyên — chỉ số đổi — để sau này
 * muốn siết lại một loại nào đó thì sửa đúng một dòng, không phải dựng lại
 * đường kiểm tra ở finalize.
 */
const HARD_MAX = 50 * MB

export const DOC_TYPE_MAX_BYTES: Record<DocType, number> = {
  image: HARD_MAX, // trước 5 MB — ảnh SP chụp máy ảnh/scan hay vượt
  drawing: HARD_MAX, // trước 20 MB — bản vẽ scan A3 300dpi / PDF nhiều trang
  assembly: HARD_MAX, // trước 20 MB
  bom: HARD_MAX, // trước 10 MB
  cert: HARD_MAX, // trước 10 MB
  other: HARD_MAX, // trước 10 MB
}

/** Chưa phân loại (doc_type null) → mức mặc định. */
export const DEFAULT_MAX_BYTES = HARD_MAX

/**
 * Trần cứng = mức cao nhất trong bảng. Phải khớp `file_size_limit` của bucket
 * trong migration 0147 (trước đó là 0060): bucket chỉ nhận MỘT giá trị, không
 * tách theo loại được, nên phần chênh giữa các loại do `filesService.finalize`
 * đo object thật. Hiện mọi loại bằng nhau nên phần chênh đó = 0, nhưng bước đo
 * vẫn cần: nó chặn client khai size nhỏ rồi PUT file to.
 */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(DOC_TYPE_MAX_BYTES),
  DEFAULT_MAX_BYTES,
)

/**
 * Nhận `string` (không chỉ `DocType`) vì `files.doc_type` đọc từ DB là string
 * thô. Giá trị lạ → mức mặc định, không nới trần.
 *
 * Phải dùng `Object.hasOwn` chứ không phải `?? DEFAULT`: tra thẳng key sẽ đụng
 * prototype chain, nên `maxBytesFor('__proto__')` trả về `Object.prototype` —
 * một object, không phải undefined, nên `??` không đỡ. Khi đó `size > max` so
 * số với object luôn ra false và MỌI giới hạn bị bỏ qua.
 */
export function maxBytesFor(docType: string | null | undefined): number {
  if (!docType) return DEFAULT_MAX_BYTES
  if (!Object.hasOwn(DOC_TYPE_MAX_BYTES, docType)) return DEFAULT_MAX_BYTES
  return DOC_TYPE_MAX_BYTES[docType as DocType]
}

export function formatBytes(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${Math.round((bytes / MB) * 10) / 10} MB`
}
