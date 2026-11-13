import type { User } from '@/modules/core/users/users.repo'
import { canEnterWorkspace } from '@/workspaces/access'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { todayVn } from '@/lib/date-vn'
import { chieuDong, doiChieuSo, dungNxt, giaVnd, kyThang, laCotNhap, type Cot, type DongNxt, type DongSo } from '@/lib/kho-nxt' // prettier-ignore
import { banChot, kiemKy, luuYPhaiTich, thangDaQua, thangSau, tuBanChot, type DotKiemKeMo, type KiemKy, type KiemThang } from '@/lib/kho-kiem-ky' // prettier-ignore
import { nxtRepo, type KyDaChot } from './nxt.repo'
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
  /**
   * Kỳ đang xem là MỘT tháng ĐÃ CHỐT (B2) → hàng đọc từ bản chốt, không tính lại.
   * `closed_by` là tên người chốt.
   */
  kyChot: { thang: string; closed_at: string; closed_by: string | null } | null
  /** Ngày khoá (cuối tháng chốt mới nhất); null = chưa chốt tháng nào. */
  chotDen: string | null
  /** Các tháng `YYYY-MM` đã chốt — ô chọn kỳ ghi "· đã chốt". */
  thangDaChot: string[]
  /** Người xem có quyền `warehouse.period.close` (Kế toán trưởng) — thấy ô tích + nút Chốt. */
  coTheChot: boolean
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
    const [dong, daChot, coTheChot] = await Promise.all([
      nxtRepo.dongSoDen(ky.den),
      nxtRepo.kyDaChot(),
      canAction(user, 'warehouse.period.close'),
    ])
    const chotCuoi = daChot.at(-1) ?? null
    // Kỳ đang xem đúng một tháng đã chốt → đọc bản chốt (khung 3), không tính lại.
    const kyNay = laMotThang(ky) ? daChot.find((k) => k.thang === ky.tu.slice(0, 7)) : undefined
    const tinh = kyNay
      ? (await nxtRepo.banChot(kyNay.id)).map(tuBanChot)
      : dungNxt(dong, ky.tu, ky.den)
    const qua = kyNay ? null : thangDaQua(ky, homNay)
    // Tháng nằm trong phần đã khoá (≤ tháng chốt mới nhất) thì không còn gì để kiểm.
    const thangKiem = qua && (!chotCuoi || qua > chotCuoi.thang) ? qua : null
    const [vt, lenhDon, dotKiemKe] = await Promise.all([
      nxtRepo.vatTu(tinh.map((r) => r.material_id)),
      thangKiem ? nxtRepo.lenhCuaDongDon(dongDonNhan(dong)) : null,
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
        thangDau: thangMo(chotCuoi, thangDau, thangKiem),
        thang: thangKiem,
        lenhCuaDong: lenhDon.lenh,
        dotKiemKe: dotKiemKe.map(dotMo),
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
      // Kỳ đã chốt: so BẢN CHỐT với sổ hôm nay — lệch nghĩa là có phiếu ghi lùi sau khi chốt.
      doiChieu: doiChieuSo(tinh, dong, ky.tu, ky.den),
      soDong,
      kyGanNhat: kyGanNhat ? kyGanNhat.slice(0, 7) : null,
      thangDau: thangDau ? thangDau.slice(0, 7) : null,
      kiemKy: kiem,
      kyChot: kyNay
        ? { thang: kyNay.thang, closed_at: kyNay.closed_at, closed_by: kyNay.closed_by }
        : null,
      chotDen: chotCuoi?.den ?? null,
      thangDaChot: daChot.map((k) => k.thang),
      coTheChot,
    }
  },

  /**
   * CHỐT SỔ KHO ĐẾN HẾT THÁNG `thang` (B2). Q2: Kế toán trưởng. Q6: chốt luôn mọi
   * tháng trước còn mở, mỗi tháng một bản chốt, trong MỘT giao dịch. Máy chủ KIỂM
   * LẠI bằng chính hàm của hộp: còn điều kiện chặn → 409; còn lưu ý chưa tích → 400
   * (Q3). Không sửa dòng sổ — bản chốt là bảng riêng (0297).
   */
  async chot(
    user: User,
    input: { thang: string; luu_y: string[] },
  ): Promise<{ den: string; thangs: string[] }> {
    await assertAction(user, 'warehouse.period.close')
    const ky = kyThang(`${input.thang}-01`)
    const nhan = `${input.thang.slice(5, 7)}/${input.thang.slice(0, 4)}`
    if (!thangDaQua(ky, todayVn())) {
      throw BadRequest(`Tháng ${nhan} chưa qua hết — chỉ chốt được tháng đã qua.`)
    }
    const [dong, daChot, dot] = await Promise.all([
      nxtRepo.dongSoDen(ky.den),
      nxtRepo.kyDaChot(),
      stocktakesRepo.listOpen(),
    ])
    const chotCuoi = daChot.at(-1) ?? null
    if (chotCuoi && chotCuoi.thang >= input.thang) {
      throw Conflict(`Sổ kho đã chốt đến hết ${dmyNgan(chotCuoi.den)} — tháng ${nhan} đã nằm trong kỳ khoá.`) // prettier-ignore
    }
    const thangDauSo = dong.reduce<string | null>((m, d) => (!m || d.ngay < m ? d.ngay : m), null)
    const lenhDon = await nxtRepo.lenhCuaDongDon(dongDonNhan(dong))
    const k = kiemKy({
      dong,
      thangDau: thangMo(chotCuoi, thangDauSo, input.thang),
      thang: input.thang,
      lenhCuaDong: lenhDon.lenh,
      dotKiemKe: dot.map(dotMo),
    })
    if (k.soChan > 0) {
      throw Conflict(`Chưa chốt được: còn ${k.soChan} điều kiện chặn (mã tồn âm / đợt kiểm kê đang mở) — mở lại danh sách kiểm để gỡ.`) // prettier-ignore
    }
    const phai = luuYPhaiTich(k)
    const tich = new Set(input.luu_y)
    const thieu = phai.filter((l) => !tich.has(l.key))
    if (thieu.length > 0) {
      throw BadRequest(`Còn ${thieu.length} lưu ý chưa tích — ${thieu[0].text}. Tải lại trang nếu danh sách vừa đổi.`) // prettier-ignore
    }
    try {
      await nxtRepo.ghiChot(user.id, banChot(dong, k, phai))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('KHO_CHOT:')) throw Conflict(msg.replace(/^.*KHO_CHOT:\s*/, ''))
      if (msg.includes('duplicate key')) throw Conflict(`Tháng ${nhan} vừa được chốt ở phiên khác — tải lại trang.`) // prettier-ignore
      throw e
    }
    return { den: k.den, thangs: k.thangs.map((t) => t.thang) }
  },
}

/** Kỳ `{tu, den}` là đúng một tháng trọn (đã qua hay chưa). */
function laMotThang(ky: { tu: string; den: string }): boolean {
  const t = kyThang(ky.tu)
  return t.tu === ky.tu && t.den === ky.den
}

/** Dòng đơn mua của các dòng NHẬP (không đảo) — đầu vào `lenhCuaDongDon`. */
function dongDonNhan(dong: readonly DongSo[]): string[] {
  return dong.flatMap((d) => (d.direction === 'in' && d.po_line_id && !d.la_dao ? [d.po_line_id] : [])) // prettier-ignore
}

/** Tháng đầu còn mở: sau tháng chốt mới nhất; chưa chốt gì thì tháng đầu của sổ. */
function thangMo(chotCuoi: KyDaChot | null, ngayDauSo: string | null, thang: string): string {
  if (chotCuoi) return thangSau(chotCuoi.thang)
  return ngayDauSo ? ngayDauSo.slice(0, 7) : thang
}

function dotMo(t: { id: string; code: string; status: string; freeze_at: string | null }): DotKiemKeMo {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    freeze_ngay: t.freeze_at ? todayVn(new Date(t.freeze_at)) : null,
  }
}

const dmyNgan = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
