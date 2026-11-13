import type { User } from '@/modules/core/users/users.repo'
import { canEnterWorkspace } from '@/workspaces/access'
import { Forbidden } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { chieuDong, doiChieuSo, dungNxt, giaVnd, laCotNhap, type Cot, type DongNxt } from '@/lib/kho-nxt' // prettier-ignore
import { kiemKy, thangDaQua, type DotKiemKeMo, type KiemKy, type KiemThang } from '@/lib/kho-kiem-ky' // prettier-ignore
import { nxtRepo } from './nxt.repo'
import { stocktakesRepo } from './stocktakes.repo'

/**
 * BÁO CÁO NHẬP–XUẤT–TỒN (Kho đợt 2 · B6) — luật ở `lib/kho-nxt.ts`.
 *
 * Q4: ai vào được khu Kho đều xem được cả cột tiền (Kho đã thấy giá từ đợt
 * nhập/xuất go-live); Kế toán vào qua quyền `workspace.view.warehouse` (0247).
 */

export type NxtDong = DongNxt & {
  code: string
  name: string
  unit: string
  group_name: string | null
}

/** Một dòng sổ trong kỳ — phần "thẻ kho" mở dưới dòng mã. */
export type NxtChiTiet = {
  id: string
  ngay: string
  doc_id: string | null
  doc_code: string | null
  ma: string | null
  suy: boolean
  cot: Cot | null
  /** Có dấu; dòng đảo âm. Null = không thuộc phía này. */
  nhap: number | null
  xuat: number | null
  gia: number | null
  la_dao: boolean
  dien_giai: string | null
}

export type NxtBaoCao = {
  tu: string
  den: string
  homNay: string
  rows: NxtDong[]
  chiTiet: Record<string, NxtChiTiet[]>
  doiChieu: { bao_cao: number; so: number; khop: boolean }
  /** Số dòng sổ trong kỳ. */
  soDong: number
  /** Kỳ có phát sinh gần nhất TRƯỚC `tu` — cho trạng thái rỗng. */
  kyGanNhat: string | null
  /** Tháng `YYYY-MM` của dòng sổ đầu tiên — mốc đầu của ô chọn kỳ. */
  thangDau: string | null
  /**
   * Kiểm trước khi chốt (B1, chỉ đọc) — chỉ khi kỳ là MỘT tháng trọn đã qua.
   * Null với tháng đang chạy hoặc kỳ tuỳ chọn ngày.
   */
  kiemKy: KiemKyHien | null
}

type VtHien = { id: string; code: string; name: string }

/** `KiemKy` đã gắn mã/tên để bày — client chỉ nhận phần này. */
export type KiemThangHien = Omit<
  KiemThang,
  'tonAm' | 'lenhNhan' | 'lenhChuaXuat' | 'maThieuGia'
> & {
  tonAm: VtHien[]
  lenhNhan: number
  lenhChuaXuat: { id: string; code: string }[]
  maThieuGia: VtHien[]
}
export type KiemKyHien = Omit<KiemKy, 'thangs'> & { thangs: KiemThangHien[] }

export const nxtService = {
  async baoCao(user: User, ky: { tu: string; den: string }): Promise<NxtBaoCao> {
    if (!(await canEnterWorkspace(user, 'warehouse'))) {
      throw Forbidden(
        'Báo cáo nhập–xuất–tồn thuộc khu Kho. Nhờ quản trị cấp quyền xem khu Kho.',
      )
    }
    const homNay = todayVn()
    const dong = await nxtRepo.dongSoDen(ky.den)
    const tinh = dungNxt(dong, ky.tu, ky.den)
    const thangKiem = thangDaQua(ky, homNay)
    const [vt, lenhDon, dotKiemKe] = await Promise.all([
      nxtRepo.vatTu(tinh.map((r) => r.material_id)),
      thangKiem
        ? nxtRepo.lenhCuaDongDon(
            dong.flatMap((d) => (d.direction === 'in' && d.po_line_id && !d.la_dao ? [d.po_line_id] : [])), // prettier-ignore
          )
        : null,
      thangKiem ? stocktakesRepo.listOpen() : null,
    ])
    const rows: NxtDong[] = tinh.map((r) => {
      const m = vt.get(r.material_id)
      return {
        ...r,
        code: m?.code ?? '?',
        name: m?.name ?? '(vật tư không còn trong danh mục)',
        unit: m?.unit ?? '',
        group_name: m?.group_name ?? null,
      }
    })
    rows.sort(
      (a, b) =>
        (a.group_name ?? '￿').localeCompare(b.group_name ?? '￿', 'vi') ||
        a.code.localeCompare(b.code, 'vi'),
    )

    const chiTiet: Record<string, NxtChiTiet[]> = {}
    let soDong = 0
    let kyGanNhat: string | null = null
    let thangDau: string | null = null
    for (const d of dong) {
      if (!thangDau || d.ngay < thangDau) thangDau = d.ngay
      if (d.ngay < ky.tu) {
        if (!kyGanNhat || d.ngay > kyGanNhat) kyGanNhat = d.ngay
        continue
      }
      soDong++
      const c = chieuDong(d)
      const nhapPhia = c.cot ? laCotNhap(c.cot) : d.direction === 'in'
      ;(chiTiet[d.material_id] ??= []).push({
        id: d.id,
        ngay: d.ngay,
        doc_id: d.doc_id,
        doc_code: d.doc_code,
        ma: c.ma,
        suy: c.suy,
        cot: c.cot,
        nhap: c.cot && nhapPhia ? c.sl : null,
        xuat: c.cot && !nhapPhia ? c.sl : null,
        gia: giaVnd(d),
        la_dao: d.la_dao,
        dien_giai: d.dien_giai,
      })
    }
    for (const ds of Object.values(chiTiet)) {
      ds.sort((a, b) => a.ngay.localeCompare(b.ngay) || (a.doc_code ?? '').localeCompare(b.doc_code ?? '')) // prettier-ignore
    }

    let kiem: KiemKyHien | null = null
    if (thangKiem && lenhDon && dotKiemKe) {
      const k = kiemKy({
        dong,
        thangDau: thangDau ? thangDau.slice(0, 7) : thangKiem,
        thang: thangKiem,
        lenhCuaDong: lenhDon.lenh,
        dotKiemKe: dotKiemKe.map((t): DotKiemKeMo => ({
          id: t.id,
          code: t.code,
          status: t.status,
          freeze_ngay: t.freeze_at ? todayVn(new Date(t.freeze_at)) : null,
        })),
      })
      // Mã lệnh đã nhúng cùng lượt đọc dòng đơn; chỉ đọc thêm cho lệnh gắn thẳng trên dòng sổ (hiếm).
      const maLenh = lenhDon.ma
      const thieuMa = k.thangs
        .flatMap((t) => t.lenhChuaXuat)
        .filter((id) => !maLenh.has(id))
      if (thieuMa.length > 0) for (const [id, code] of await nxtRepo.maLenh(thieuMa)) maLenh.set(id, code) // prettier-ignore
      const hienVt = (id: string): VtHien => {
        const m = vt.get(id)
        return { id, code: m?.code ?? '?', name: m?.name ?? '(vật tư không còn trong danh mục)' } // prettier-ignore
      }
      kiem = {
        ...k,
        thangs: k.thangs.map((t) => ({
          ...t,
          tonAm: t.tonAm.map(hienVt),
          lenhNhan: t.lenhNhan.length,
          lenhChuaXuat: t.lenhChuaXuat
            .map((id) => ({ id, code: maLenh.get(id) ?? id }))
            .sort((a, b) => a.code.localeCompare(b.code, 'vi')),
          maThieuGia: t.maThieuGia
            .map(hienVt)
            .sort((a, b) => a.code.localeCompare(b.code, 'vi')),
        })),
      }
    }

    return {
      tu: ky.tu,
      den: ky.den,
      homNay,
      rows,
      chiTiet,
      doiChieu: doiChieuSo(tinh, dong, ky.tu, ky.den),
      soDong,
      kyGanNhat: kyGanNhat ? kyGanNhat.slice(0, 7) : null,
      thangDau: thangDau ? thangDau.slice(0, 7) : null,
      kiemKy: kiem,
    }
  },
}
