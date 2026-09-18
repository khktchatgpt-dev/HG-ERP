import { authService } from '@/modules/core/auth/auth.service'
import { worklistService } from '@/modules/dept/production/worklist.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { fileImageSrc } from '@/server/file-image'
import { Btn, Empty } from '@/components/kit'
import { resolveHolder } from '@/lib/lsx-holder'
import { LsxDocScreen } from './LsxDocScreen'

export const dynamic = 'force-dynamic'

/**
 * M3 — CHI TIẾT LỆNH SẢN XUẤT. Trang chứng từ của cả khu: mọi vai đều mở tới
 * đây, nên nó gánh nhiều nhất.
 *
 * Bản cũ (`(workspace)/thongke/lsx/[id]`) dựng bằng theme v3 với PageHeader +
 * StatsBar + Toolbar + N bảng rời. Bản này theo Khuôn D: một đầu chứng từ, dải
 * vòng đời có mốc thật, thanh người giữ, dải chỉ số có mẫu số, rồi các khối
 * gấp được.
 */
export default async function LsxDocPage({
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

  if (!lsx) {
    return (
      <Empty
        headline="Không tìm thấy lệnh sản xuất này"
        reason="Lệnh có thể đã bị xoá, hoặc đường dẫn mang một mã không còn tồn tại."
        next={
          <Btn primary href="/thongke/lenh">
            Về danh sách lệnh
          </Btn>
        }
      />
    )
  }

  if (data.rows.length === 0) {
    return (
      <Empty
        headline={`Lệnh ${lsx.code} chưa có việc nào để ghi nhận`}
        reason="Lệnh chưa ĐỊNH HÌNH chi tiết — không có bảng chi tiết thì không biết phải ghi sản lượng cho cái gì."
        next={
          <Btn primary href={`/thongke/lsx/${lsx.id}/dinh-hinh`}>
            Định hình từ BOM
          </Btn>
        }
      />
    )
  }

  // Ảnh: dòng lệnh có ảnh riêng thì dùng; không thì rơi về ảnh HỒ SƠ SP — phần
  // lớn lệnh nhập bằng script không đính ảnh nhưng thư viện SP đã có sẵn.
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

  const canRecord = user.role === 'admin' || (await isProductionStaff(user))

  return (
    <LsxDocScreen
      lsx={{
        id: lsx.id,
        code: lsx.code,
        customer_name: lsx.customer_name,
        order_codes: lsx.order_codes,
        ship_date: lsx.ship_date,
        status: lsx.status,
        created_at: lsx.created_at,
        approved_at: lsx.approved_at,
        completed_at: lsx.completed_at,
      }}
      // Người giữ tính Ở SERVER bằng cùng hàm mà màn danh sách dùng — hai màn
      // không được nói hai câu khác nhau về cùng một lệnh.
      holder={resolveHolder(lsx)}
      stages={data.stages}
      rows={data.rows}
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
      canRecord={canRecord}
      imageByLine={imageByLine}
      meId={user.id}
      meName={user.name ?? user.email}
    />
  )
}
