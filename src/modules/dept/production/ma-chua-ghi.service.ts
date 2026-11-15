import { productionRepo } from './production.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { componentsRepo } from './components.repo'
import { productProfileRepo } from '@/modules/dept/technical/technical.repo'
import { gomMaCuaLenh, type LenhTinhTrang } from '@/lib/ma-chua-ghi'

/**
 * Tình trạng định mức của MỌI lệnh đang chạy — Ghi sản lượng (bản vẽ 15/11/2026
 * https://claude.ai/artifact/MRFoxWghYveCnpdWf2fU3C, Q1–Q5): ô chọn lệnh hai
 * nhóm, dải "n mã chưa ghi được", màn lệnh chưa ghi được. Ba truy vấn nhẹ cho cả
 * xưởng (dòng lệnh · dòng nào có bảng · số dòng định mức của SP chưa có bảng).
 */
export const maChuaGhiService = {
  async load(): Promise<LenhTinhTrang[]> {
    const lenh = await productionRepo.listActive()
    const ids = lenh.map((l) => l.id)
    const [lines, coBang] = await Promise.all([
      lsxLinesRepo.listLinesBulk(ids),
      componentsRepo.lineIdsCoBang(ids),
    ])
    // Định mức chỉ cần đọc cho SP CHƯA có bảng — đọc cả xưởng là vài nghìn dòng.
    const spCanDoc = [
      ...new Set(
        lines
          .filter((l) => !coBang.has(l.id) && l.product_id)
          .map((l) => l.product_id as string),
      ),
    ]
    const nDm = await productProfileRepo.partsCountByProducts(spCanDoc)
    return gomMaCuaLenh(
      lenh.map((l) => ({ id: l.id, code: l.code })),
      lines.map((l) => ({
        lsx_id: l.production_order_id,
        ma: l.product_code,
        ten: l.name_vi || l.product_code,
        sl: l.qty,
        co_bang: coBang.has(l.id),
        n_dm: l.product_id ? (nDm.get(l.product_id) ?? 0) : 0,
      })),
    )
  },

  /** Lệnh trong đường dẫn KHÔNG còn chạy (Q5) — nói tên + vì sao thay vì lặng lẽ đổi. */
  async lenhKhongChay(
    id: string,
  ): Promise<{ code: string | null; status: string | null }> {
    const o = await productionRepo.findById(id).catch(() => null)
    return { code: o?.code ?? null, status: o?.status ?? null }
  },
}
