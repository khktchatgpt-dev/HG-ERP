import { BadRequest } from '@/server/http'
import { formatBytes, maxBytesFor } from '@/modules/core/files/files.schema'

/** File .xlsx gửi lên dạng multipart — chung cho bước soi và bước thêm. */
export async function readXlsxUpload(req: Request): Promise<Buffer> {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw BadRequest('Thiếu file')
  const max = maxBytesFor(null)
  if (file.size > max) {
    throw BadRequest(`File ${formatBytes(file.size)} vượt giới hạn ${formatBytes(max)}`)
  }
  if (!/\.xlsx$/i.test(file.name)) {
    throw BadRequest(
      'Chỉ nhận file .xlsx — file .xls cũ hãy mở bằng Excel rồi lưu lại thành .xlsx',
    )
  }
  return Buffer.from(await file.arrayBuffer())
}
