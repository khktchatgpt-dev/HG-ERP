import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadEntrySheet } from '@/modules/dept/production/worklist.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { EmptyState } from '@/components/erp/EmptyState'
import { EntrySheetScreen } from './EntrySheetScreen'

export const dynamic = 'force-dynamic'

/**
 * MÀN LẬP PHIẾU báo sản lượng (Sổ Sản Lượng v2 — B1): 1 lệnh × 1 công đoạn.
 * Hệ bày sẵn đúng dòng phải gõ theo thang đơn vị đếm — phôi ra chi tiết, từ
 * hàn ra dòng cụm đếm BỘ. Ghi qua POST /api/dept/production/lsx/[id]/entries.
 */
export default async function GhiSoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ stage?: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const { stage } = await searchParams

  // Cùng điều kiện với nút "Ghi sổ" ở màn tiến độ — server route vẫn gác RBAC
  // thật (production.entries.record) khi lưu.
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect(`/thongke/lsx/${id}`)

  const sheet = await loadEntrySheet(id, stage ?? null)
  if (!sheet) {
    return (
      <div className="py-10">
        <EmptyState
          icon="▦"
          title="Lệnh không có việc để ghi sổ"
          description="Lệnh chưa định hình chi tiết, hoặc chi tiết chưa được phân nhóm nên chưa biết đi công đoạn nào."
        />
        <p className="mt-2 text-center">
          <Link
            href={`/thongke/lsx/${id}`}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Về tiến độ lệnh
          </Link>
        </p>
      </div>
    )
  }

  // key theo công đoạn: đổi chip là REMOUNT màn — tổ mặc định + số đang gõ
  // reset theo phiếu mới (phiếu là per công đoạn, giữ state cũ là ghi nhầm tổ).
  return (
    <EntrySheetScreen
      key={sheet.stage}
      sheet={sheet}
      userTeamId={user.department_id ?? null}
    />
  )
}
