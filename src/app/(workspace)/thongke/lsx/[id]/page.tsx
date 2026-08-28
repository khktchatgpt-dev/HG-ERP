import Link from 'next/link'
import { authService } from '@/modules/core/auth/auth.service'
import { worklistService } from '@/modules/dept/production/worklist.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { fileImageSrc } from '@/server/file-image'
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
  const [data, lsx, docs, lines] = await Promise.all([
    worklistService.list(user, { lsxId: id }),
    productionRepo.findById(id),
    entriesService.docsOfLsx(user, id),
    lsxLinesRepo.listLines(id),
  ])
  // Ảnh: dòng lệnh có ảnh riêng thì dùng; không thì rơi về ảnh HỒ SƠ SP —
  // phần lớn lệnh nhập script không đính ảnh nhưng thư viện SP đã có 154 ảnh.
  const needProduct = lines.filter((l) => !l.image_file_id && l.product_id)
  const products = await productsRepo.listPickByIds([
    ...new Set(needProduct.map((l) => l.product_id as string)),
  ])
  const productImg = new Map(products.map((p) => [p.id, p.image_file_id]))
  const imageByLine = Object.fromEntries(
    lines
      .map((l) => {
        const fid =
          l.image_file_id ?? (l.product_id ? productImg.get(l.product_id) : null)
        return fid ? [l.id, fileImageSrc(fid)] : null
      })
      .filter((x): x is [string, string] => !!x),
  )

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
        imageByLine={imageByLine}
        docStats={{
          count: docs.length,
          drafts: docs.filter((d) => d.status === 'nhap' || d.status === 'tu_choi')
            .length,
          defect: Math.round(docs.reduce((a, d) => a + d.total_defect, 0) * 100) / 100,
        }}
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
