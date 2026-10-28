import type { User } from '@/modules/core/users/users.repo'
import { Forbidden } from '@/server/http'
import { canEnterWorkspace } from '@/workspaces/access'
import { todayVn } from '@/lib/date-vn'
import { lapChiMuc, traMon, type TgKetQua } from '@/lib/tra-gia'
import { dangChon, phuongAn, thanhTien } from '@/lib/tra-gia-chon'
import { poMaterialsRepo } from './po-materials.repo'
import { traGiaRepo } from './tra-gia.repo'
import { buildTraGiaExcel, traGiaExcelFilename } from './tra-gia-excel'
import type { TraGiaExcelInput, TraGiaInput } from './tra-gia.schema'

/** Một món đã tra — kết quả của bộ máy + số lượng người mua khai + mã danh mục đoán theo chữ. */
export type TraGiaMon = TgKetQua & {
  sl: number | null
  dvt: string | null
  /** Món chưa khớp dòng đơn nào: mã danh mục gần nhất với chữ gõ (để nói nhóm nào). */
  danh_muc: {
    code: string
    name: string
    group_name: string | null
    sub_group: string | null
  } | null
}

export type TraGiaKetQua = {
  /** yyyy-mm-dd; null = mọi lúc. */
  tu_ngay: string | null
  den_ngay: string
  /** Số dòng đơn trong kỳ đã đem tra — để người xem biết nền số liệu lớn cỡ nào. */
  so_dong: number
  mon: TraGiaMon[]
}

/** Lùi `thang` tháng theo lịch (giữ ngày, kẹp về cuối tháng) — yyyy-mm-dd. */
export function luiThang(iso: string, thang: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = y * 12 + (m - 1) - thang
  const ny = Math.floor(t / 12)
  const nm = (t % 12) + 1
  const cuoi = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, cuoi)).padStart(2, '0')}`
}

const DEM = new Set(['dày', 'dài', 'loại', 'li', 'ly', 'mm', 'cm', 'cây', 'tấm', 'kg'])

/**
 * Từ khoá hỏi danh mục cho món không khớp dòng đơn nào — NỚI DẦN, dừng ở lần
 * đầu có kết quả. Danh mục tìm AND từng từ, nên chữ người gõ thêm cho rõ ("dày",
 * "35mm") mà tên mã không có là trắng tay: đo 28/10 "inox hộp 20x20 dày 1.0" và
 * "bản lề âm 35mm" đều không ra mã nào dù nhóm Inox có 104 mã.
 */
export function tuKhoaDanhMuc(text: string): string[] {
  const tu = text.toLowerCase().split(/\s+/).filter(Boolean)
  const gon = tu.filter((w) => !DEM.has(w) && !/^\d+([.,]\d+)?(mm|cm|li|ly|m)?$/.test(w))
  return [...new Set([tu.join(' '), gon.join(' '), gon.slice(0, 2).join(' ')])].filter(
    (q) => q.length >= 2,
  )
}

export const traGiaService = {
  /**
   * TRA GIÁ NHIỀU MÓN MỘT LƯỢT — chỉ đọc.
   *
   * Quyền: ai vào được khu Mua hàng (cùng luật `canEnterWorkspace('planning')`
   * với layout của khu) — giá mua là thông tin của phòng Cung ứng, route không
   * được rộng hơn trang.
   */
  async tra(user: User, input: TraGiaInput): Promise<TraGiaKetQua> {
    if (!(await canEnterWorkspace(user, 'planning')))
      throw Forbidden('Chỉ người trong khu Mua hàng tra được giá mua.')
    const den = todayVn()
    const tu = input.thang ? luiThang(den, input.thang) : null
    const rows = (await traGiaRepo.lines()).filter((d) => !tu || d.at >= tu)
    const cm = lapChiMuc(rows)

    const mon = await Promise.all(
      input.items.map(async (it): Promise<TraGiaMon> => {
        let r = traMon(it.text, cm, { key: it.key })
        let danh_muc: TraGiaMon['danh_muc'] = null
        // Không khớp dòng đơn nào → hỏi danh mục xem chữ gõ thuộc nhóm nào, để gợi ý NCC cùng nhóm.
        if (r.trang_thai === 'trong' && !r.quy_cach && !it.key) {
          let m: Awaited<ReturnType<typeof poMaterialsRepo.search>>[number] | undefined
          for (const q of tuKhoaDanhMuc(it.text)) {
            ;[m] = await poMaterialsRepo.search({ q, limit: 1 })
            if (m) break
          }
          if (m) {
            danh_muc = { code: m.code, name: m.name, group_name: m.group_name, sub_group: m.sub_group } // prettier-ignore
            if (m.group_name && m.sub_group)
              r = traMon(it.text, cm, {
                nhomCon: { group: m.group_name, sub: m.sub_group },
              })
          }
        }
        return { ...r, sl: it.sl ?? null, dvt: it.dvt ?? null, danh_muc }
      }),
    )
    return { tu_ngay: tu, den_ngay: den, so_dong: rows.length, mon }
  },

  /**
   * FILE EXCEL bảng so sánh giá. Tra LẠI giá ở server (cùng `tra()`), rồi áp
   * lựa chọn của người mua bằng chính hàm màn hình dùng (`lib/tra-gia-chon`) —
   * file và màn là một con số, không nhận số client gửi lên.
   */
  async excel(
    user: User,
    input: TraGiaExcelInput,
  ): Promise<{ buf: Buffer; filename: string }> {
    const kq = await this.tra(user, input)
    const mons = kq.mon.map((m, i) => {
      const it = input.items[i]
      const { ds, re, dv } = phuongAn(m, it.hoi ?? [])
      const chon = dangChon(ds, it.chon)
      return {
        text: it.text,
        nhan: m.quy_cach?.label ?? it.text,
        sl: it.sl ?? null,
        dvt: it.dvt ?? null,
        kq: m,
        ds,
        re,
        dv,
        chon,
        tien: thanhTien(chon, it.sl ?? null),
      }
    })
    const buf = await buildTraGiaExcel({
      mons,
      nguoiLap: user.name ?? user.email,
      ngayLap: kq.den_ngay,
      tuNgay: kq.tu_ngay,
      denNgay: kq.den_ngay,
      soDong: kq.so_dong,
    })
    return { buf, filename: traGiaExcelFilename(kq.den_ngay) }
  },
}
