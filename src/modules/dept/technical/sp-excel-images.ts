import sharp from 'sharp'

/**
 * Ảnh của luồng Excel SP (09/10/2026). Byte → byte, không chạm DB.
 *
 * Xuất cả thư viện với ảnh GỐC là 40 MB (144 SP, đo 09/10) — Excel mở ì, gửi
 * Zalo không nổi. Ảnh trong file chỉ để NHẬN RA sản phẩm, nên xuất ảnh thu nhỏ
 * 200 px JPEG (~10 KB/ảnh). Ảnh mới người dùng dán vào thì giữ chất lượng, chỉ
 * thu về khi quá 2000 px (ảnh điện thoại 4000 px không cần cho hồ sơ).
 */
export const THUMB_PX = 200
export const MAX_IMAGE_PX = 2000

/** Ảnh thu nhỏ JPEG, xoay đúng chiều theo EXIF, không phóng to ảnh nhỏ. */
export async function thumbJpeg(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 75 })
    .toBuffer()
}

/** Ảnh mới quá lớn → thu về MAX_IMAGE_PX (JPEG); ảnh vừa thì giữ nguyên byte. */
export async function fitForUpload(
  buf: Buffer,
  ext: 'png' | 'jpeg',
): Promise<{ buffer: Buffer; ext: 'png' | 'jpeg' }> {
  try {
    const m = await sharp(buf).metadata()
    if (m.width && m.height && Math.max(m.width, m.height) <= MAX_IMAGE_PX)
      return { buffer: buf, ext }
    const out = await sharp(buf)
      .rotate()
      .resize(MAX_IMAGE_PX, MAX_IMAGE_PX, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer()
    return { buffer: out, ext: 'jpeg' }
  } catch {
    return { buffer: buf, ext }
  }
}
