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
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
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

  return <DinhHinhScreen {...props} />
}
