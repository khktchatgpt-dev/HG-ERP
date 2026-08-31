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

/**
 * Thứ tự khai = thứ tự tab/menu trong hồ sơ SP.
 * 'packing' (0150) — quy cách đóng gói + kích thước, thường là PowerPoint mỗi
 * slide một SP. Trước đó loại này rơi vào "Khác" nên nằm lẫn tài liệu tạp.
 */
export const DOC_TYPES = [
  'drawing',
  'bom',
  'packing',
  'assembly',
  'sample_photo',
  'label',
  'loading',
  'cert',
  'approval',
  'video',
  'image',
  'other',
] as const
export type DocType = (typeof DOC_TYPES)[number]

/**
 * Nhãn tiếng Việt của loại tài liệu — ở đây (không ở files.schema) để Client
 * Component dùng được: CLAUDE.md cấm client import từ `src/modules/*`.
 * files.schema re-export lại cho các chỗ gọi cũ.
 */
export const DOC_TYPE_LABEL: Record<DocType, string> = {
  drawing: 'Bản vẽ kỹ thuật',
  bom: 'File BOM / định mức',
  packing: 'Đóng gói / kích thước',
  assembly: 'Hướng dẫn lắp ráp',
  // 0180 — năm loại dưới đây trước không có chỗ nào để đứng nên nằm ngoài hệ
  // thống. `sample_photo` KHÁC `image`: ảnh SP là ảnh đại diện trong thư viện,
  // còn đây là ảnh mẫu thật đã chốt với khách.
  sample_photo: 'Ảnh mẫu đã duyệt',
  label: 'Nhãn / mã vạch',
  loading: 'Sơ đồ xếp cont',
  cert: 'Chứng chỉ / test report',
  approval: 'Hồ sơ khách duyệt',
  video: 'Video',
  image: 'Ảnh sản phẩm',
  other: 'Khác',
}

/**
 * Cố ý KHÔNG nén ảnh khi upload — bản vẽ và ảnh SP là dữ liệu gốc, nén là mất
 * chi tiết không lấy lại được. Chặn file quá khổ từ đầu, còn chi phí egress xử
 * lý ở tầng phân phối (Next Image resize + cache). Xem
 * docs/ke-hoach-toi-uu-file-anh.md.
 *
 * 14/08/2026 — user yêu cầu bỏ giới hạn upload trên hồ sơ SP: mọi loại lên 50MB
 * (trần global của Supabase Storage gói Free). NGAY HÔM ĐÓ một ảnh DSLR 12.8MB
 * làm vỡ trình xem ảnh, và user chốt lại: ẢNH quay về trần 5MB — ảnh gốc gửi
 * khách lưu ở Google Drive, ERP chỉ cần bản đủ nét để nhận diện SP (xem
 * docs/ke-hoach-toi-uu-file-anh.md). Các loại tài liệu khác giữ 50MB.
 */
const HARD_MAX = 50 * MB

export const DOC_TYPE_MAX_BYTES: Record<DocType, number> = {
  // Ảnh chụp SP/mẫu: 5MB đã dư cho ảnh điện thoại; ảnh máy ảnh phải thu nhỏ
  // trước khi đưa lên. Bản gốc đầy đủ nằm ở Drive — ERP không phải kho ảnh gốc.
  image: 5 * MB,
  drawing: HARD_MAX, // bản vẽ là dữ liệu gốc — không siết
  assembly: HARD_MAX,
  bom: HARD_MAX,
  // PowerPoint đóng gói nhúng nhiều ảnh xếp thùng — dễ vượt 20MB (0150).
  packing: HARD_MAX,
  cert: HARD_MAX,
  // Ảnh mẫu đã duyệt cũng là ẢNH — cùng lý do siết như `image`, đừng để thành
  // cửa sau đưa ảnh DSLR 13MB lên bằng cách chọn loại khác.
  sample_photo: 5 * MB,
  label: HARD_MAX,
  loading: HARD_MAX,
  approval: HARD_MAX,
  // Trần chung 50MB là `file_size_limit` của bucket (0147) — không nới riêng
  // cho video được, bucket chỉ nhận MỘT giá trị. Clip dài hơn thì cắt đoạn
  // hoặc để link Drive vào ghi chú.
  video: HARD_MAX,
  other: HARD_MAX,
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

/**
 * Kiểu MIME được nhận — allowlist DUY NHẤT, server chặn theo đây
 * (`filesService.assertBucketAllowed`). Đặt cạnh bảng giới hạn dung lượng vì
 * cùng một câu hỏi: "file này có đưa lên được không, tối đa bao nhiêu?".
 * files.schema re-export cho zod dùng.
 */
export const ALLOWED_MIME = [
  // ảnh — KHÔNG có image/svg+xml: SVG là định dạng ảnh duy nhất chạy được
  // <script>, và signed URL trỏ thẳng host Supabase nên mở tab là script chạy
  // trong origin đó. Bỏ ngày 15/08/2026 lúc kho có ĐÚNG 0 file SVG, tức không
  // mất gì. Xem thêm `lib/image.ts` (vì sao SVG không đi qua Next optimizer).
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  // tài liệu Office + PDF
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // CAD / mô hình 3D — MIME suy từ ĐUÔI, không lấy thứ trình duyệt khai (xem
  // `EXT_CANONICAL_MIME` ở lib/file-signature để biết vì sao). Không dùng tiền
  // tố `image/` cho nhóm này: route ảnh phục vụ `image/*` bằng URL ký không gác
  // phiên, gắn image/* cho bản vẽ là biến bản vẽ thành thứ ai có link cũng tải.
  'application/acad',
  'application/dxf',
  'model/step',
  'model/iges',
  'application/vnd.sketchup.skp',
  'application/postscript',
  'application/x-photoshop',
  // video quay mẫu / hướng dẫn lắp
  'video/mp4',
  // text
  'text/plain',
  'text/csv',
  'application/json',
  // nén
  'application/zip',
] as const

/**
 * Trình duyệt đoán MIME từ đuôi file qua registry của máy; máy không cài Office
 * có thể trả CHUỖI RỖNG cho .pptx/.xlsx. Chặn sớm ở client để báo câu dễ hiểu,
 * thay vì để zod dội về lỗi enum khó đọc sau khi đã gửi request.
 */
export function isAllowedMime(mime: string): boolean {
  return (ALLOWED_MIME as readonly string[]).includes(mime)
}

export function formatBytes(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${Math.round((bytes / MB) * 10) / 10} MB`
}
