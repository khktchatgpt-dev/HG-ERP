/**
 * Tự thu nhỏ ẢNH CHỤP ở client TRƯỚC khi upload — để người dùng đưa thẳng ảnh
 * máy ảnh 13MB vào cũng không bị dội lỗi "quá 5MB" rồi phải tự đi resize
 * (docs/ke-hoach-toi-uu-file-anh.md). Chỉ dùng cho doc_type='image'; bản vẽ /
 * tài liệu KHÔNG bao giờ đi qua đây — chúng là dữ liệu gốc.
 *
 * Nguyên tắc: đây là tối ưu tốt-thì-làm, hỏng-thì-thôi — mọi nhánh lỗi đều trả
 * về file gốc và để trần 5MB ở tầng sau quyết định. Không bao giờ chặn upload
 * vì chính bước thu nhỏ.
 */

/** Cạnh dài tối đa sau thu nhỏ — 2560px dư nét cho màn 4K lẫn phiếu in. */
const MAX_DIM = 2560
/** Dưới mức này khỏi đụng vào — decode ảnh chỉ tốn pin người dùng. */
const SKIP_UNDER_BYTES = 1.5 * 1024 * 1024

/** Định dạng nén được bằng canvas. GIF (mất animation) và SVG (vector) bỏ qua. */
const COMPRESSIBLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

function renameExt(name: string, ext: string): string {
  const dot = name.lastIndexOf('.')
  return `${dot > 0 ? name.slice(0, dot) : name}.${ext}`
}

async function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function downscaleImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.has(file.type)) return file
  if (file.size <= SKIP_UNDER_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const scale = Math.min(1, MAX_DIM / Math.max(width, height))

    // Đã nhỏ về kích thước mà vẫn nặng (chụp quality cao) → vẫn re-encode.
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    // WebP trước (giữ trong suốt của PNG, nén tốt hơn); trình duyệt không encode
    // được WebP thì toBlob trả PNG nguyên — nhánh đó rơi xuống JPEG, trừ khi ảnh
    // gốc là PNG (JPEG mất trong suốt) thì đành giữ nguyên file gốc.
    let blob = await encode(canvas, 'image/webp', 0.85)
    let ext = 'webp'
    if (!blob || blob.type !== 'image/webp') {
      if (file.type === 'image/png') return file
      blob = await encode(canvas, 'image/jpeg', 0.82)
      ext = 'jpg'
      if (!blob || blob.type !== 'image/jpeg') return file
    }

    if (blob.size >= file.size) return file
    return new File([blob], renameExt(file.name, ext), { type: blob.type })
  } catch {
    return file
  }
}
