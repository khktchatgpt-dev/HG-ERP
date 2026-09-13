import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { dieCatalogRepo } from '@/modules/dept/technical/dies.repo'
import { canEditDies } from '@/modules/dept/technical/dies.service'
import { fileImageSrc } from '@/server/file-image'
import { KhuonDetailScreen } from './KhuonDetailScreen'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Params) {
  const { id } = await params
  const die = await dieCatalogRepo.getById(id)
  return { title: die ? `Khuôn ${die.code}` : 'Khuôn nhôm' }
}

/**
 * HỒ SƠ MỘT CÁI KHUÔN (Khuôn E). Xem docs/quan-ly-khuon-ke-hoach.md §5.2.
 *
 * Ba lượt đọc song song: nhật ký, dòng định mức đang trỏ vào mã, và tổng số hồ
 * sơ SP. Tổng SP nạp để làm MẪU SỐ của ô "đang dùng ở" — "4 SP" không nói lên
 * gì, "4 trên 779 hồ sơ" thì có.
 */
export default async function Page({ params }: Params) {
  const { id } = await params
  const user = await authService.requirePageUser()

  const die = await dieCatalogRepo.getById(id)
  if (!die) notFound()

  const [events, usage, productTotal, canEdit, all] = await Promise.all([
    dieCatalogRepo.listEvents(die.id),
    dieCatalogRepo.usage(die.code, die.legacy_codes),
    dieCatalogRepo.productTotal(),
    canEditDies(user),
    // Gợi ý cho form sửa: nơi giữ và nhóm chi tiết ĐÃ CÓ trong danh mục — để
    // người sửa không gõ ra "Diềm Bàn" bên cạnh "Diềm bàn".
    dieCatalogRepo.listAll(),
  ])

  return (
    <KhuonDetailScreen
      die={die}
      events={events}
      usage={usage}
      imageUrl={die.image_file_id ? fileImageSrc(die.image_file_id) : null}
      productTotal={productTotal}
      canEdit={canEdit}
      holderOptions={[...new Set(all.map((d) => d.holder_name).filter((v): v is string => !!v))].sort()}
      groupOptions={[...new Set(all.map((d) => d.part_group).filter((v): v is string => !!v))].sort()}
    />
  )
}
