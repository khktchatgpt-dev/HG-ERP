import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import {
  libraryFilterFromParams,
  productImportService,
} from '@/modules/dept/technical/product-import.service'

/** Lần xuất đầu phải tạo ảnh thu nhỏ còn thiếu (ngân sách 70 giây trong service). */
export const maxDuration = 120

/**
 * Xuất SP ra Excel để sửa — nhận đúng tham số lọc của /products (q, customer,
 * type…); không tham số = cả thư viện. Kèm ảnh thu nhỏ nên file có thể ~8 MB,
 * vượt trần thân phản hồi của Vercel: đặt file lên Storage rồi CHUYỂN HƯỚNG tới
 * URL tải (link `download` của trình duyệt đi theo chuyển hướng như thường).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const filter = libraryFilterFromParams(new URL(req.url).searchParams)
  const day = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') // prettier-ignore
  const who = filter.customer_name
    ? `_${filter.customer_name.replace(/[^\p{L}\p{N}]+/gu, '-')}`
    : ''
  const { url } = await productImportService.exportToStorage(user, filter, `San-pham${who}_${day}.xlsx`) // prettier-ignore
  return NextResponse.redirect(url, 302)
})
