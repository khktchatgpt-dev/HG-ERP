import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { tongTheoKhoi, type DongTong, type KhoiTong } from '@/lib/luong/tong-duyet'
import type { TrangThaiLuong } from './bang-luong.repo'
import { bangLuongRepo } from './bang-luong.repo'
import { dieuKienGui, nap, type DieuKienGui } from './bang-luong.service'
import { hoSoLuongRepo } from './ho-so-luong.repo'

/**
 * DUYỆT BẢNG LƯƠNG CỦA SẾP (bản vẽ duyệt 21/10/2026, https://claude.ai/artifact/8BH9Nam6…).
 * Câu hỏi của màn: "kỳ này trả bao nhiêu, ở đâu tăng bất thường, chị Phụng đã kiểm đủ chưa —
 * duyệt hay trả lại?".
 *
 * Kế toán trưởng KHÔNG thấy lương từng người (Q9 của 20/10): dữ liệu trả về chỉ có TỔNG theo khối → tổ;
 * phiếu từng người đọc ở server rồi bỏ, không gửi xuống trình duyệt. Quyền `hr.payroll.approve`
 * (Kế toán trưởng — vai giữ hr.payroll.approve). Duyệt / trả lại đi qua `bangLuongService.quyet` (chặn tự duyệt bảng mình gửi).
 */

const DUYET = 'hr.payroll.approve'

const thangTruoc = (thang: string) => {
  const [y, m] = thang.split('-').map(Number)
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7)
}

export type DuyetLuongTrang = {
  thang: string
  ky: { tu: string; den: string } | null
  bang: {
    trangThai: TrangThaiLuong
    lanTinh: number
    guiLuc: string | null
    guiBoi: string | null
    duyetLuc: string | null
    duyetBoi: string | null
    chiLuc: string | null
    lyDoTraLai: string | null
  } | null
  khoi: KhoiTong[]
  cong: DongTong
  so: {
    nguoi: number
    tong: number
    thucLinh: number
    bhNld: number
    coBh: number
    /** Kỳ trước trong ERP — null khi kỳ trước tính ngoài ERP (kỳ 10/2026 là kỳ đầu). */
    truocNguoi: number | null
    truocThucLinh: number | null
  }
  dieuKien: DieuKienGui[]
  /** Lời người gửi kèm theo (lần gửi gần nhất). */
  ghiChuGui: string | null
  suKien: { viec: string; boi: string | null; luc: string; ghiChu: string | null }[]
  /** duyet = bấm được Duyệt / Trả lại; lyDo = vì sao không (đã duyệt, chưa gửi, tự mình gửi). */
  quyen: { duyet: boolean; lyDo: string | null }
}

export type BangChoDuyet = {
  thang: string
  nguoi: number
  thucLinh: number
  guiLuc: string | null
  guiBoi: string | null
  guiBoiId: string | null
}

export const duyetLuongService = {
  async trang(user: User, thang: string): Promise<DuyetLuongTrang> {
    await assertAction(user, DUYET)
    const tt = thangTruoc(thang)
    const [d, khoiCuaTo, bTruoc] = await Promise.all([
      nap(thang),
      bangLuongRepo.khoiCuaTo(),
      bangLuongRepo.bang(tt),
    ])
    const [phieuTruoc, suKien] = await Promise.all([
      bTruoc && bTruoc.lanTinh ? bangLuongRepo.phieu(bTruoc.id, bTruoc.lanTinh) : null,
      d.bang ? bangLuongRepo.suKien(d.bang.id) : [],
    ])
    // Kế toán trưởng mở = một lần xem lương (dù chỉ tổng) — vào nhật ký như mọi lần xem khác.
    await hoSoLuongRepo.ghiXemLuong('payroll_sheet', user.id, {
      ghiChu: `duyệt kỳ ${thang} (chỉ tổng theo bộ phận)`,
    })
    const { khoi, cong } = tongTheoKhoi(d.phieu, khoiCuaTo, phieuTruoc)
    const b = d.bang
    const lyDo = !b
      ? 'Kỳ này chưa có bảng lương.'
      : b.trangThai === 'draft'
        ? 'Bảng đang ở bước Nháp — chị Phụng còn kiểm tra, chưa gửi duyệt.'
        : b.trangThai === 'approved'
          ? `Đã duyệt${b.duyetBoi ? ` bởi ${b.duyetBoi}` : ''}. Muốn sửa số: người quản lý lương bấm "Mở lại" kèm lý do.`
          : b.trangThai === 'paid'
            ? 'Lương kỳ này đã chi.'
            : b.guiBoiId === user.id
              ? 'Bạn là người gửi bảng lương này — người khác có quyền duyệt phải xử lý.'
              : null
    const guiCuoi = [...suKien].reverse().find((e) => e.viec === 'submit')
    return {
      thang,
      ky: d.ky ? { tu: d.ky.tu, den: d.ky.den } : null,
      bang: b
        ? {
            trangThai: b.trangThai,
            lanTinh: b.lanTinh,
            guiLuc: b.guiLuc,
            guiBoi: b.guiBoi,
            duyetLuc: b.duyetLuc,
            duyetBoi: b.duyetBoi,
            chiLuc: b.chiLuc,
            lyDoTraLai: b.lyDoTraLai,
          }
        : null,
      khoi,
      cong,
      so: {
        nguoi: d.phieu.length,
        tong: cong.tong,
        thucLinh: cong.thucLinh,
        bhNld: d.phieu.reduce((s, p) => s + p.bhNld, 0),
        coBh: d.phieu.filter((p) => p.bhNld > 0).length,
        truocNguoi: phieuTruoc ? phieuTruoc.length : null,
        truocThucLinh: phieuTruoc ? phieuTruoc.reduce((s, p) => s + p.thucLinh, 0) : null,
      },
      dieuKien: dieuKienGui(d.phieu, d.canTinhLai, d.thieuPhieu),
      ghiChuGui: b?.trangThai === 'submitted' ? (guiCuoi?.ghiChu ?? null) : null,
      suKien: suKien.map((e) => ({
        viec: e.viec,
        boi: e.boi ?? (e.viec === 'calculate' ? 'Hệ thống' : null),
        luc: e.luc,
        ghiChu: e.ghiChu,
      })),
      quyen: { duyet: !lyDo, lyDo },
    }
  },

  /** Bảng chờ duyệt mà người này duyệt được (Hộp ký). Không tự duyệt bảng mình gửi. */
  async choToiDuyet(user: User): Promise<BangChoDuyet[]> {
    if (!(await canAction(user, DUYET))) return []
    const ds = (await bangLuongRepo.choDuyet()).filter((b) => b.guiBoiId !== user.id)
    return Promise.all(
      ds.map(async (b) => {
        const p = b.lanTinh ? await bangLuongRepo.phieu(b.id, b.lanTinh) : []
        return {
          thang: b.thang,
          nguoi: p.length,
          thucLinh: p.reduce((s, x) => s + x.thucLinh, 0),
          guiLuc: b.guiLuc,
          guiBoi: b.guiBoi,
          guiBoiId: b.guiBoiId,
        }
      }),
    )
  },

  /** Số đếm menu "Chờ tôi phê duyệt" — không đọc phiếu. */
  async demChoToiDuyet(user: User): Promise<number> {
    if (!(await canAction(user, DUYET))) return 0
    return (await bangLuongRepo.choDuyet()).filter((b) => b.guiBoiId !== user.id).length
  },
}
