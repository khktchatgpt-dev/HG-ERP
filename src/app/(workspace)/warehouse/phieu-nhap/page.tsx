import { TrangSoPhieu, type SoPhieuSearch } from '../_so-phieu/trang'

export const metadata = { title: 'Kho · Phiếu nhập' }
export const dynamic = 'force-dynamic'

/** SỔ PHIẾU NHẬP theo kỳ tháng — bản vẽ JG1wTjeF… (23/11/2026). */
export default function PhieuNhapSoPage({
  searchParams,
}: {
  searchParams: SoPhieuSearch
}) {
  return <TrangSoPhieu loai="receipt" searchParams={searchParams} />
}
