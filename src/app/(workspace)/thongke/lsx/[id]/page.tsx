import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { worklistService } from '@/modules/dept/production/worklist.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { EmptyState } from '@/components/erp/EmptyState'
import { LsxWorkScreen } from './LsxWorkScreen'
import { LsxDocsCard } from './LsxDocsCard'

export const dynamic = 'force-dynamic'

/**
 * Tầng 2 — MỘT LỆNH: thông tin lệnh + tiến độ từng sản phẩm theo công đoạn.
 * Từ đây chọn một (sản phẩm × công đoạn) để sang màn ghi sổ.
 */
export default async function LsxWorkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [data, lsx, docs] = await Promise.all([
    worklistService.list(user, { lsxId: id }),
    productionRepo.findById(id),
    entriesService.docsOfLsx(user, id),
  ])

  if (!lsx || data.rows.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          icon="▦"
          title="Lệnh chưa có việc ghi nhận"
          description="Lệnh chưa ĐỊNH HÌNH chi tiết (hoặc đã kết thúc). Định hình = nạp từ BOM kỹ thuật / chép lệnh trước rồi soát lại — xong là sổ tự mở việc."
        />
        <p className="mt-2 flex justify-center gap-4 text-center">
          {lsx && (
            <Link
              href={`/thongke/lsx/${lsx.id}/dinh-hinh`}
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Định hình chi tiết →
            </Link>
          )}
          <Link href="/thongke" className="text-sm text-[var(--primary)] hover:underline">
            Về danh sách lệnh
          </Link>
        </p>
      </div>
    )
  }

  const canRecord = user.role === 'admin' || (await isProductionStaff(user))

  return (
    <div className="flex flex-col gap-4">
      <LsxWorkScreen
        lsx={{
          id: lsx.id,
          code: lsx.code,
          customer_name: lsx.customer_name,
          order_codes: lsx.order_codes,
          ship_date: lsx.ship_date,
          status: lsx.status,
        }}
        stages={data.stages}
        rows={data.rows}
        canRecord={canRecord}
      />
      <LsxDocsCard
        docs={docs.map((d) => ({
          id: d.id,
          doc_no: d.doc_no,
          entry_date: d.entry_date,
          stage: d.stage,
          status: d.status,
          team_name: d.team_name,
          created_by_name: d.created_by_name,
          note: d.note,
          total_qty: d.total_qty,
          total_defect: d.total_defect,
          line_count: d.line_count,
        }))}
        stageLabels={Object.fromEntries(data.stages.map((s) => [s.code, s.label]))}
        canRecord={canRecord}
      />
    </div>
  )
}
