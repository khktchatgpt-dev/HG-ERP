import { handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesRepo } from '@/modules/core/files/files.repo'
import { filesService } from '@/modules/core/files/files.service'
import {
  buildProductExcel,
  productExcelFilename,
} from '@/modules/dept/technical/product-excel'

/**
 * TẢI HỒ SƠ SẢN PHẨM dạng .xlsx — sheet 1 dựng theo biểu mẫu BOM của công ty,
 * các sheet sau chở thông số / đóng gói / tài liệu.
 *
 * Quyền: đọc được hồ sơ thì tải được, y như trang chi tiết — `getProfile` đã tự
 * gác. Hồ sơ SP là khu DÙNG CHUNG nên mọi phòng đều xem được.
 */
export const GET = handle(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await params

    const profile = await productsService.getProfile(user, id)
    if (!profile.product) throw NotFound('Sản phẩm không tồn tại')
    const p = profile.product

    const files = await filesRepo.listByProduct(id)

    /*
     * Ảnh đại diện: ký URL rồi tải về nhúng vào file. NUỐT LỖI có chủ ý — thiếu
     * ảnh thì file vẫn phải xuất được, chứ không để cả lượt tải hỏng vì Storage
     * chậm một nhịp.
     */
    let image: { buffer: Buffer; extension: 'png' | 'jpeg' } | null = null
    if (p.image_file_id) {
      try {
        const urls = await filesService.getDownloadUrls(user, [p.image_file_id])
        const url = urls[p.image_file_id]
        if (url) {
          const res = await fetch(url)
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer())
            const f = files.find((x) => x.id === p.image_file_id)
            image = {
              buffer,
              extension: /png$/i.test(f?.mime_type ?? '') ? 'png' : 'jpeg',
            }
          }
        }
      } catch {
        /* không có ảnh thì thôi — phần còn lại của hồ sơ vẫn xuất đủ */
      }
    }

    const buffer = await buildProductExcel({
      product: p as never,
      parts: profile.parts as never,
      groups: profile.groups,
      clusters: profile.clusters,
      setItems: profile.setItems as never,
      files: files.map((f) => ({
        filename: f.filename,
        doc_type: f.doc_type,
        size_bytes: f.size_bytes,
      })),
      image,
      exportedBy: user.name ?? user.email,
      exportedAt: new Date(),
    })

    return new Response(new Uint8Array(buffer), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // Tên có dấu tiếng Việt đã bị lột ở `productExcelFilename`, nên không
        // cần filename* — nhưng vẫn giữ quote để tên có khoảng trắng không vỡ.
        'content-disposition': `attachment; filename="${productExcelFilename(p.code, p.name)}"`,
        'cache-control': 'no-store',
      },
    })
  },
)
