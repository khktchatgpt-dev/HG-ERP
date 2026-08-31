/**
 * KIỂM ĐỊNH DẠNG THẬT của file — hai lớp độc lập với kiểu MIME do trình duyệt khai.
 *
 * Vì sao cần: `mime_type` gửi lên server là thứ TRÌNH DUYỆT đoán từ đuôi file,
 * client sửa được tuỳ ý. Đổi tên `virus.exe` thành `banve.pdf` rồi khai
 * `application/pdf` là lọt cả allowlist MIME lẫn trần dung lượng — ba tầng kiểm
 * tra hiện có không tầng nào mở file ra xem bên trong là gì.
 *
 * Hai lớp ở đây bù đúng chỗ đó:
 *   1. `extensionIssue`  — soát ĐUÔI file (rẻ, chạy được cả ở client).
 *   2. `signatureIssue`  — soát BYTE ĐẦU của object đã nằm trên Storage (chỉ
 *      server, gọi lúc finalize).
 *
 * File hằng số thuần: không import server, không zod — client dùng chung được.
 */

/** Đuôi file được nhận, gom theo nhóm để thông báo lỗi nói được "nhận cái gì". */
export const ALLOWED_EXTENSIONS = [
  // ảnh
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  // tài liệu
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  // bản vẽ / mô hình (mở bằng CAD, không chạy được)
  'dwg',
  'dxf',
  'step',
  'stp',
  'igs',
  'iges',
  'skp',
  // artwork nhãn & mã vạch (Illustrator / Photoshop)
  'ai',
  'psd',
  // video quay mẫu / hướng dẫn lắp
  'mp4',
  // text
  'txt',
  'csv',
  'json',
  // nén
  'zip',
] as const

/**
 * Đuôi Office CÓ MACRO — chặn thẳng, không chờ tới lúc quét virus.
 *
 * Đây là ERP mà mọi phòng tải file của nhau về mở bằng Excel/PowerPoint: một
 * file nhiễm macro lan cả công ty. Kho hiện SẠCH (0 file macro đo ngày
 * 15/08/2026) — chặn lúc còn sạch rẻ hơn nhiều so với lúc đã lỡ có.
 *
 * Người thật sự cần macro thì lưu bản .xlsx (Excel tự bỏ macro khi lưu lại) —
 * ERP giữ số liệu, không giữ công cụ chạy được.
 */
export const MACRO_EXTENSIONS = ['xlsm', 'xlsb', 'docm', 'dotm', 'pptm', 'potm'] as const

/** Đuôi chạy được / kịch bản — chặn kèm câu nói rõ vì sao, tránh user tưởng lỗi vặt. */
const EXECUTABLE_EXTENSIONS = [
  'exe',
  'msi',
  'bat',
  'cmd',
  'com',
  'scr',
  'ps1',
  'vbs',
  'js',
  'jar',
  'sh',
  'apk',
  'dll',
  'lnk',
  'html',
  'htm',
  'svg', // ảnh duy nhất chạy được <script> — xem ALLOWED_MIME
]

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase()
}

/**
 * Lý do TỪ CHỐI theo đuôi file, hoặc null nếu chấp nhận được.
 * Trả về câu tiếng Việt hoàn chỉnh để cả client lẫn server hiện thẳng.
 */
export function extensionIssue(filename: string): string | null {
  const ext = fileExtension(filename)
  if (!ext) return 'File không có phần mở rộng nên không xác định được định dạng.'
  if ((MACRO_EXTENSIONS as readonly string[]).includes(ext)) {
    return `File .${ext} có chứa macro nên không được đưa lên hệ thống. Mở bằng Excel/Word/PowerPoint rồi lưu lại thành .${ext.replace(/m$|b$/, 'x')} (macro sẽ bị bỏ) rồi tải lên bản đó.`
  }
  if (EXECUTABLE_EXTENSIONS.includes(ext)) {
    return `File .${ext} chạy được mã lệnh nên hệ thống không nhận.`
  }
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Không nhận file .${ext}. Hệ thống nhận: PDF, ảnh, Word, Excel, PowerPoint, CAD (dwg/dxf/step/igs/skp), artwork (ai/psd), video mp4, CSV, ZIP.`
  }
  return null
}

/**
 * ĐUÔI QUYẾT ĐỊNH MIME cho những định dạng trình duyệt không biết.
 *
 * Vì sao cần: `.dwg` được các trình duyệt trả về `''`, `application/acad`,
 * `image/vnd.dwg`, `drawing/x-dwg`… tuỳ máy và tuỳ phần mềm CAD đã cài. Bắt
 * đúng một chuỗi trong số đó là chặn nhầm phần lớn người dùng. Đo thật
 * 31/08/2026: chính vì vậy mà ngăn "Bản vẽ" của hồ sơ SP có ĐÚNG 0 file — API
 * trả 400 cho mọi biến thể, kèm một đống enum thô không ai đọc được.
 *
 * Nên với các đuôi ở đây thì bỏ qua thứ trình duyệt khai và chốt theo đuôi —
 * đuôi vốn đã phải qua `extensionIssue` (chặn macro + file chạy được) nên không
 * mở thêm cửa nào.
 *
 * CỐ Ý không có mime nào bắt đầu bằng `image/`: `/api/files/[id]/img` phục vụ
 * file `image/*` qua URL ký KHÔNG gác phiên. Gắn `image/vnd.dwg` cho bản vẽ là
 * biến toàn bộ bản vẽ thành thứ tải được chỉ bằng một đường link.
 */
export const EXT_CANONICAL_MIME: Record<string, string> = {
  dwg: 'application/acad',
  dxf: 'application/dxf',
  step: 'model/step',
  stp: 'model/step',
  igs: 'model/iges',
  iges: 'model/iges',
  skp: 'application/vnd.sketchup.skp',
  ai: 'application/postscript',
  psd: 'application/x-photoshop',
}

/**
 * MIME sẽ được LƯU cho file này. Với đuôi ở `EXT_CANONICAL_MIME` thì lấy theo
 * đuôi; còn lại giữ nguyên thứ trình duyệt khai (ảnh/PDF/Office đều đoán đúng).
 */
export function canonicalMime(filename: string, mime: string): string {
  return EXT_CANONICAL_MIME[fileExtension(filename)] ?? mime
}

/**
 * Chữ ký byte đầu file (magic number) theo từng nhóm định dạng.
 *
 * `null` = định dạng KHÔNG có chữ ký ổn định (text/csv/json thuần, và dwg/dxf
 * mỗi phiên bản CAD một kiểu) → bỏ qua bước này thay vì đoán bừa rồi chặn nhầm
 * file thật của người dùng.
 */
const SIGNATURES: Record<string, number[][] | null> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47]], // \x89PNG
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]], // GIF8
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (byte 8-11 là WEBP)
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  // Office 2007+ (docx/xlsx/pptx) là ZIP; nhận cả 3 biến thể header ZIP.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  'application/zip': [
    [0x50, 0x4b, 0x03, 0x04],
    [0x50, 0x4b, 0x05, 0x06],
    [0x50, 0x4b, 0x07, 0x08],
  ],
  // Office 97-2003 (doc/xls/ppt): container OLE2 dùng chung một chữ ký.
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  'application/vnd.ms-excel': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  'application/vnd.ms-powerpoint': [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  // Không có chữ ký ổn định — cố ý bỏ qua.
  'text/plain': null,
  'text/csv': null,
  'application/json': null,
}

/** Số byte cần đọc để đủ so mọi chữ ký ở trên. */
export const SIGNATURE_HEAD_BYTES = 8

/**
 * Lý do TỪ CHỐI theo byte đầu, hoặc null nếu khớp (hoặc không có gì để so).
 *
 * `head` là mảng byte đầu của object THẬT trên Storage — không phải thứ client
 * gửi kèm. Đây là lớp duy nhất bắt được "đổi đuôi để qua mặt".
 */
export function signatureIssue(mime: string, head: Uint8Array): string | null {
  const expected = SIGNATURES[mime]
  if (expected == null) return null // không khai chữ ký cho loại này
  const matched = expected.some((sig) => sig.every((b, i) => head[i] === b))
  if (matched) return null
  return 'Nội dung file không khớp với định dạng của phần mở rộng — file có thể đã bị đổi đuôi hoặc hỏng.'
}
