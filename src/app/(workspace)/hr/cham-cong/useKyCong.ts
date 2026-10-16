'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import type { KetQuaKeo } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { KyCong } from './ky-cong.shared'

/**
 * State + xử lý dùng chung của các trang nhóm CHẤM CÔNG (tách trang 17/10/2026 — mỗi
 * trang một việc, không còn thanh 5 bước). Trang nào cũng có ‹ tháng ›; trang Lấy dữ
 * liệu dùng thêm phần lấy về + kiểm máy.
 */
export function useKyCong(k: KyCong) {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  // Khoảng lấy về mặc định = đầu kỳ → (hôm nay nếu kỳ đang chạy, cuối kỳ nếu đã qua).
  const [tu, setTu] = useState(k.tu)
  const [den, setDen] = useState(k.homNay < k.den ? k.homNay : k.den)
  const [dangLay, setDangLay] = useState(false)
  const [ketQua, setKetQua] = useState<KetQuaKeo | null>(null)
  const [dangKiem, setDangKiem] = useState(false)

  function xemThang(t: string) {
    router.push(`${path}?thang=${t}`)
  }

  /** Trang "Chấm công một người" — link gửi được, giữ tháng đang xem. */
  function moNguoi(ma: string) {
    router.push(`/hr/cham-cong/nguoi/${encodeURIComponent(ma)}?thang=${k.thang}`)
  }

  const loiKhoang =
    !tu || !den
      ? 'Chọn đủ từ ngày và đến ngày'
      : den < tu
        ? '"Đến ngày" phải sau hoặc bằng "Từ ngày"'
        : (Date.parse(den) - Date.parse(tu)) / 86400_000 + 1 > 366
          ? 'Mỗi lần lấy tối đa 1 năm'
          : null

  async function layVe() {
    if (loiKhoang || dangLay) return
    setDangLay(true)
    setKetQua(null)
    try {
      const r = await api<KetQuaKeo>('/api/dept/hr/cham-cong/keo', {
        method: 'POST',
        body: { tu, den },
      })
      setKetQua(r)
      const hong = r.may.filter((m) => !m.ok)
      const moi = r.may.reduce((s, m) => s + (m.luotMoi ?? 0), 0)
      if (hong.length === r.may.length)
        toast.error('Không lấy được từ máy nào', hong[0]?.loi)
      else
        toast.show({
          tone: hong.length ? 'warning' : 'success',
          title: moi
            ? `Đã lấy ${moi.toLocaleString('vi-VN')} lượt mới`
            : 'Không có lượt mới — khoảng này đã lấy đủ',
          description: r.maChuaGhep
            ? `${r.maChuaGhep} mã trên máy chưa ghép được nhân viên — gán ở Hồ sơ nhân viên.`
            : undefined,
        })
      router.refresh()
    } catch (e) {
      toast.error('Lấy về thất bại', apiErrorText(e))
    } finally {
      setDangLay(false)
    }
  }

  async function kiemMay() {
    setDangKiem(true)
    try {
      const r = await api<{ may: { ten: string; ok: boolean; loi?: string }[] }>(
        '/api/dept/hr/cham-cong/may/kiem',
        { method: 'POST' },
      )
      const hong = r.may.filter((m) => !m.ok)
      if (hong.length)
        toast.error(`${hong.length}/${r.may.length} máy không kết nối được`, hong[0].loi)
      else toast.success(`Cả ${r.may.length} máy kết nối được`)
      router.refresh()
    } catch (e) {
      toast.error('Kiểm kết nối thất bại', apiErrorText(e))
    } finally {
      setDangKiem(false)
    }
  }

  return {
    k,
    xemThang,
    moNguoi,
    tu,
    setTu,
    den,
    setDen,
    loiKhoang,
    dangLay,
    ketQua,
    layVe,
    dangKiem,
    kiemMay,
  } as const
}

export type KyCongCtx = ReturnType<typeof useKyCong>
