import Link from 'next/link'
import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { Rong, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import { DinhHinhScreen } from './DinhHinhScreen'
import { loadDinhHinhProps } from './load'

export const dynamic = 'force-dynamic'

/**
 * BẢNG CHI TIẾT của lệnh (định mức Kỹ thuật chụp sang lệnh, 0096): tự nạp lúc
 * duyệt lệnh; thống kê sửa ngoại lệ ở đây. 04/11/2026: LỘ TRÌNH công đoạn rời
 * sang màn gộp `/thongke/lo-trinh?lsx=` (việc của Kế hoạch) — màn này chỉ còn
 * lưới chi tiết, có link sang đó. Bản vẽ gộp:
 * https://claude.ai/artifact/A4U5vgYDeUwYrnDUkzfCq1
 */
export default async function DinhHinhPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  /** `sp` = mã hàng mở sẵn (lối "Tự khai ›" từ Ghi sản lượng, 15/11/2026). */
  searchParams: Promise<{ sp?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const props = await loadDinhHinhProps(user, id)
  if (!props) notFound()

  if (props.orderLines.length === 0) {
    return (
      <SxKhung bare label="Bảng chi tiết">
        <Rong
          tieuDe={`Lệnh ${props.lsx.code} chưa có dòng sản phẩm`}
          lyDo="Soạn dòng lệnh trước rồi mới có bảng chi tiết — không có SP thì không có gì để bóc."
          tiep={
            <Link href={`/thongke/lsx/${props.lsx.id}`} className="sx-btn p">
              Về hồ sơ lệnh
            </Link>
          }
        />
      </SxKhung>
    )
  }

  // Gom đợt cùng mã (bản vẽ 15/11 SNZSog1E… Q2) chỉ ở màn này — màn Lộ trình công
  // đoạn dùng chung hook nhưng làm việc theo từng dòng lệnh.
  return <DinhHinhScreen {...props} gomTheoMa initialSp={sp.sp ?? props.initialSp} />
}
