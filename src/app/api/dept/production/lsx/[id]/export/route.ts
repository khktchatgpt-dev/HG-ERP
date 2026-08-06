import { NextResponse } from 'next/server'
import { handle, NotFound } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { filesService } from '@/modules/core/files/files.service'
import {
  buildLsxExcel,
  lsxExcelFilename,
  type LsxExcelImage,
} from '@/modules/dept/production/lsx-excel'

/**
 * Tải phiếu LỆNH SẢN XUẤT dạng .xlsx — bày giống hệt phiếu in (mẫu chuẩn, gộp
 * ô nhóm, màu, ảnh SP). Cùng dữ liệu với /print/lsx/[id]; ai xem được phiếu
 * thì tải được file.
 */
export const GET = handle(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await params

    const lsx = await productionRepo.findById(id)
    if (!lsx) throw NotFound('LSX không tồn tại')

    const [sheet, company] = await Promise.all([
      lsxLinesService.sheet(user, id),
      settingsService.getAll(),
    ])

    // Ảnh SP: ký URL 1 lượt rồi tải về nhúng vào file — thiếu ảnh không chặn xuất.
    const fileIds = [
      ...new Set(
        sheet.groups.flatMap((g) => g.lines.map((l) => l.image_file_id).filter(Boolean)),
      ),
    ] as string[]
    const urls = await filesService.getDownloadUrls(user, fileIds)
    const images = new Map<string, LsxExcelImage>()
    await Promise.all(
      Object.entries(urls).map(async ([fid, url]) => {
        try {
          const res = await fetch(url)
          if (!res.ok) return
          const buffer = Buffer.from(await res.arrayBuffer())
          // Nhận dạng theo magic bytes — exceljs chỉ nhúng png/jpeg.
          const ext: LsxExcelImage['extension'] | null =
            buffer[0] === 0x89 && buffer[1] === 0x50
              ? 'png'
              : buffer[0] === 0xff && buffer[1] === 0xd8
                ? 'jpeg'
                : null
          if (ext) images.set(fid, { buffer, extension: ext })
        } catch {
          /* bỏ ảnh lỗi */
        }
      }),
    )

    const buf = await buildLsxExcel({
      company,
      header: {
        customer_name: lsx.customer_name,
        code: lsx.code,
        issued_at: lsx.issued_at,
        received_date: lsx.received_date,
        completed_at: lsx.completed_at,
        container_summary: lsx.container_summary,
        note: lsx.note,
        revision: lsx.revision,
        revised_at: lsx.revised_at,
      },
      template: sheet.template,
      groups: sheet.groups,
      images,
    })

    const filename = lsxExcelFilename(lsx.code)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'no-store',
      },
    })
  },
)
