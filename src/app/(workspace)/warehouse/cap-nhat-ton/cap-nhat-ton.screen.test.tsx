// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiError } from '@/lib/api'
import { taoDong } from '@/lib/kho-cap-nhat-ton'
import { CapNhatTonScreen } from './CapNhatTonScreen'

/**
 * CẬP NHẬT SỐ THỰC TẾ (B1 "Kho cho người mới", bản vẽ C1). Dữ liệu từ DB thật
 * 27/10/2026: NH-0513 753 cây là hàng của 09-MX và 03-ROSCO; NH-0606 290 cây
 * tồn chung.
 */

const api = vi.fn()
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
afterEach(() => {
  cleanup()
  api.mockReset()
})

const vt = (id: string, code: string) => ({ id, code, name: `tên ${code}`, unit: 'Cây' })
const NHOM = taoDong(vt('m513', 'NH-0513'), 753, [
  { lsx_id: 'l-r3', code: '03/26-27 - ROSCO', chia: 200 },
  { lsx_id: 'l-mx9', code: '09/26-27 - MX', chia: 553 },
])
const CHUNG = taoDong(vt('m606', 'NH-0606'), 290, [])

function dung(laTruong = true) {
  render(
    <CapNhatTonScreen
      nguoiGhi="Lê Khắc Hào"
      laTruong={laTruong}
      canEdit
      lenhTheoMa={{}}
      banDau={[NHOM, CHUNG]}
      maKhongThay={[]}
      choDuyet={[]}
    />,
  )
}

const go = (id: string, v: string) => {
  const o = document.getElementById(id) as HTMLInputElement
  fireEvent.change(o, { target: { value: v } })
  fireEvent.blur(o)
}

describe('CapNhatTonScreen', () => {
  it('giảm hàng của lệnh → hỏi tại dòng, mặc định xuất bù cho lệnh phần lớn nhất', () => {
    dung()
    go('cn-tt-0', '745')
    expect(screen.getByText('−8')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Thiếu NH-0513 vì sao' })).toBeTruthy()
    const lenh = document.getElementById('cn-lenh-0') as HTMLSelectElement
    expect(lenh.value).toBe('l-mx9')
  })

  it('chưa gõ thì chặn tại chỗ, nhảy tới ô, không gửi; lỗi cũ của server không đè câu chặn', async () => {
    dung()
    go('cn-tt-0', '745')
    // Lần 1: đủ số dòng 1, dòng 2 trống → chặn.
    fireEvent.click(screen.getByRole('button', { name: 'Ghi cập nhật' }))
    expect(api).not.toHaveBeenCalled()
    expect(screen.getByText(/Dòng 2 chưa gõ số thực tế/)).toBeTruthy()
    expect(document.activeElement?.id).toBe('cn-tt-1')
    // Lần 2: đủ số nhưng server từ chối.
    go('cn-tt-1', '1.300')
    api.mockRejectedValueOnce(new ApiError(400, 'Không đủ tồn'))
    fireEvent.click(screen.getByRole('button', { name: 'Ghi cập nhật' }))
    await screen.findByText(/Không đủ tồn/)
    // Lần 3: sửa thành số âm → câu chặn MỚI, không phải lỗi cũ.
    go('cn-tt-1', '-2')
    fireEvent.click(screen.getByRole('button', { name: 'Ghi cập nhật' }))
    expect(screen.getByRole('button', { name: /Dòng 2 số âm/ })).toBeTruthy()
  })

  it('gửi đúng thân: số kiểu VN, chỉ dòng xuất bù mang lệnh', async () => {
    api.mockResolvedValueOnce({
      trang_thai: 'cho_duyet',
      id: 'dot9',
      code: 'KK-2026-0009',
    })
    dung(false)
    go('cn-tt-0', '745')
    go('cn-tt-1', '1.300')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi trưởng kho duyệt' }))
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    const [url, opt] = api.mock.calls[0] as [string, { body: { lines: unknown[] } }]
    expect(url).toBe('/api/dept/warehouse/cap-nhat-ton')
    expect(opt.body.lines).toEqual([
      { material_id: 'm513', counted_qty: 745, ly_do: null, ghi_chu: null, xuat_bu_lsx_id: 'l-mx9' }, // prettier-ignore
      { material_id: 'm606', counted_qty: 1300, ly_do: null, ghi_chu: null, xuat_bu_lsx_id: null }, // prettier-ignore
    ])
    expect(await screen.findByText(/chờ trưởng kho duyệt — tồn CHƯA đổi/)).toBeTruthy()
  })
})
