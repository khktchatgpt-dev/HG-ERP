'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { khongDau } from '@/lib/cham-cong/ghep-ten'
import type { NhanVienData, NvDong } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { KyCongCtx } from './useKyCong'

/**
 * Ô đếm đầu bước ② — mỗi ô là một bộ lọc. Đếm bằng ĐÚNG hàm `khopLoc` mà lưới dùng
 * (nguyên tắc 3: con số là một lời hứa).
 */
export const LOC = [
  { id: 'dang-lam', ten: 'Đang làm' },
  { id: 'ten-may', ten: 'Tên còn lấy từ máy' },
  { id: 'ca-mac-dinh', ten: 'Ca mặc định, chưa xem' },
  { id: 'chua-ghep', ten: 'Mã có quẹt, chưa ghép người' },
  { id: 'khong-cham', ten: 'Không chấm công' },
  { id: 'nghi', ten: 'Không còn làm' },
] as const
export type LocId = (typeof LOC)[number]['id']

export function khopLoc(n: NvDong, loc: LocId): boolean {
  if (loc === 'dang-lam') return n.active
  if (loc === 'ten-may') return n.active && n.tenTuMay
  if (loc === 'ca-mac-dinh') return n.active && n.caMacDinh
  if (loc === 'nghi') return !n.active
  if (loc === 'khong-cham') return n.active && n.khongChamCong
  return false
}

/** State + xử lý của bước ② Nhân viên & ca. */
export function useNhanVien(d: KyCongCtx, nv: NhanVienData) {
  const router = useRouter()
  const toast = useToast()
  const [loc, setLoc] = useState<LocId>(
    nv.ds.some((n) => khopLoc(n, 'ten-may')) ? 'ten-may' : 'dang-lam',
  )
  const [tim, setTim] = useState('')
  const [boPhan, setBoPhan] = useState('')
  const [ca, setCa] = useState('')
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  /**
   * Bộ phận CÓ NGƯỜI trong ô đang chọn, kèm số người — lọc theo bộ phận chỉ đưa ra
   * lựa chọn ra kết quả (15/10/2026: danh sách lấy từ cả 186 người làm chọn "Kế
   * hoạch" ở ô Đang làm ra rỗng — cả 8 người đều đã nghỉ). Giữ cả lựa chọn hiện tại
   * dù 0 người, để ô không tự nhảy về dòng đầu.
   */
  const boPhanTrongO = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nv.ds)
      if (khopLoc(n, loc)) m.set(n.boPhan ?? '', (m.get(n.boPhan ?? '') ?? 0) + 1)
    const chon = boPhan === TRONG ? '' : boPhan
    if (boPhan && !m.has(chon)) m.set(chon, 0)
    return [...m].sort((a, b) =>
      !a[0] ? -1 : !b[0] ? 1 : a[0].localeCompare(b[0], 'vi'),
    )
  }, [nv.ds, loc, boPhan])

  const dem = (id: LocId) =>
    id === 'chua-ghep' ? nv.maChuaGhep.length : nv.ds.filter((n) => khopLoc(n, id)).length

  const ds = useMemo(() => {
    const q = khongDau(tim)
    return nv.ds
      .filter(
        (n) =>
          khopLoc(n, loc) &&
          (!boPhan || (n.boPhan ?? '') === (boPhan === TRONG ? '' : boPhan)) &&
          (!ca || n.shiftId === ca) &&
          (!q ||
            khongDau(`${n.code} ${n.hoTen} ${n.ma.map((m) => m.ten).join(' ')}`).includes(
              q,
            )),
      )
      .sort((a, b) => a.hoTen.localeCompare(b.hoTen, 'vi'))
  }, [nv.ds, loc, tim, boPhan, ca])

  const maChuaGhep = useMemo(() => {
    const q = khongDau(tim)
    return nv.maChuaGhep.filter((m) => !q || khongDau(`${m.ma} ${m.ten}`).includes(q))
  }, [nv.maChuaGhep, tim])

  function doiLoc(id: LocId) {
    setLoc(id)
    setChon(new Set())
  }

  function batChon(id: string) {
    setChon((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function chonHet(on: boolean) {
    setChon(on ? new Set(ds.map((n) => n.id)) : new Set())
  }

  /** Chạy một lệnh ghi; thành công thì làm mới trang + báo. Trả true khi xong. */
  async function chay(viec: () => Promise<unknown>, xong: string): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      await viec()
      toast.success(xong)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const luu = (
    id: string,
    v: {
      full_name: string
      team: string | null
      shift_id: string
      active: boolean
      attendance_exempt: boolean
    },
  ) =>
    chay(
      () => api(`/api/dept/hr/cham-cong/nhan-vien/${id}`, { method: 'PATCH', body: v }),
      `Đã lưu ${v.full_name}`,
    )

  const them = (v: {
    code: string
    full_name: string
    team: string | null
    shift_id: string
    device_user_id?: string
  }) =>
    chay(
      () => api('/api/dept/hr/cham-cong/nhan-vien', { method: 'POST', body: v }),
      `Đã thêm ${v.full_name}`,
    )

  /** Đổi ca nhanh ngay trên dòng lưới. */
  const doiCa = (n: NvDong, shiftId: string) =>
    luu(n.id, {
      full_name: n.hoTen,
      team: n.boPhan,
      shift_id: shiftId,
      active: n.active,
      attendance_exempt: n.khongChamCong,
    })

  async function hangLoat(v: { shift_id?: string; team?: string }) {
    const ok = await chay(
      () =>
        api('/api/dept/hr/cham-cong/nhan-vien/hang-loat', {
          method: 'POST',
          body: { ids: [...chon], ...v },
        }),
      `Đã đổi cho ${chon.size} người`,
    )
    if (ok) setChon(new Set())
  }

  const ghep = (deviceUserId: string, employeeId: string | null, ten: string) =>
    chay(
      () =>
        api('/api/dept/hr/cham-cong/ma-may/ghep', {
          method: 'POST',
          body: { device_user_id: deviceUserId, employee_id: employeeId },
        }),
      employeeId ? `Đã ghép mã vào ${ten}` : `Đã gỡ mã khỏi ${ten}`,
    )

  return {
    nv,
    loc,
    doiLoc,
    dem,
    tim,
    setTim,
    boPhan,
    setBoPhan,
    boPhanTrongO,
    ca,
    setCa,
    ds,
    maChuaGhep,
    chon,
    batChon,
    chonHet,
    busy,
    luu,
    them,
    doiCa,
    hangLoat,
    ghep,
    hoSo: d.hoSo,
    setHoSo: d.setHoSo,
    moChamCong: d.setMotNguoi,
  } as const
}

/** Giá trị lọc cho "chưa có bộ phận". */
export const TRONG = '__trong__'

export type NhanVienCtx = ReturnType<typeof useNhanVien>
