import { redirect } from 'next/navigation'
import { HREF_THIEU_NCC, URL_PHIEU_NHAP, URL_PHIEU_XUAT } from '@/lib/kho-so-phieu'

/**
 * `/warehouse/phieu` cũ ("Phiếu đã ghi" trộn mọi loại) — tách thành hai trang
 * Phiếu nhập / Phiếu xuất theo kỳ (bản vẽ JG1wTjeF…, 23/11/2026). Link cũ còn
 * nằm trong tin nhắn, dấu trang, chuông: chuyển theo rổ cũ `?ro=`.
 * Trang chi tiết `/warehouse/phieu/[id]` giữ nguyên.
 */
export default async function PhieuCuPage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string }>
}) {
  const { ro } = await searchParams
  if (ro === 'issue') redirect(URL_PHIEU_XUAT)
  if (ro === 'stocktake') redirect('/warehouse/kiem-ke')
  if (ro === 'thieu_ncc') redirect(HREF_THIEU_NCC)
  if (ro === 'reversed') redirect(`${URL_PHIEU_NHAP}?ro=dao`)
  redirect(URL_PHIEU_NHAP)
}
