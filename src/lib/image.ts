/**
 * SVG có nên bỏ qua Next Image optimizer không.
 *
 * Optimizer từ chối SVG (400) trừ khi bật `images.dangerouslyAllowSVG`. Ta cố ý
 * KHÔNG bật: SVG chứa được `<script>`, mà optimizer serve ảnh từ origin của
 * chính app → một file SVG do nhân viên upload sẽ thành stored XSS ngay trên
 * domain mình. Để `unoptimized` thì ảnh đi thẳng từ host Supabase như trước,
 * script (nếu có) chạy trong origin của Supabase chứ không phải của ta.
 *
 * Không mất gì về chi phí: SVG là vector, vốn đã nhỏ, không cần resize.
 *
 * Nhận diện bằng đuôi file trong path vì chỗ render chỉ cầm mỗi URL, không có
 * `mime_type`. Signed URL có dạng `…/object/sign/<bucket>/<path>.svg?token=…`,
 * và `sanitizeFilename` giữ nguyên đuôi nên khớp được.
 */
export function isSvgUrl(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return path.toLowerCase().endsWith('.svg')
}
