import { TrangSoPhieu, type SoPhieuSearch } from '../_so-phieu/trang'

export const metadata = { title: 'Kho · Phiếu xuất' }
export const dynamic = 'force-dynamic'

/** SỔ PHIẾU XUẤT theo kỳ tháng (gồm phiếu đảo phiếu nhập) — bản vẽ JG1wTjeF… (23/11/2026). */
export default function PhieuXuatSoPage({
  searchParams,
}: {
  searchParams: SoPhieuSearch
}) {
  return <TrangSoPhieu loai="issue" searchParams={searchParams} />
}
