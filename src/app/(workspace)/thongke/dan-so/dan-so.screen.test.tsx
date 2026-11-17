// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  DongXem,
  TuyChonDanSo,
  XemDanSo,
} from '@/modules/dept/production/dan-so.service'
import { DanSoScreen } from './DanSoScreen'

/**
 * DÁN SỔ EXCEL (bản vẽ 17/11/2026). Máy chủ giả: tên "Hộp trươtt" → gần khớp
 * "Hộp trượt"; nhận gợi ý rồi tính lại thì hết chặn và mở được nút Ghi.
 */
const goi = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: goi,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/thongke/dan-so',
}))
afterEach(() => {
  cleanup()
  goi.mockReset()
})

const opt: TuyChonDanSo = {
  today: '2026-11-17',
  nam: 2026,
  can_khai: true,
  stages: [{ code: 'han', label: 'Hàn' }],
  teams: [{ id: 't1', name: 'Tổ Hàn', stage: 'han' }],
  lenh: [
    {
      id: 'l1',
      code: '1/26-27',
      dong: [{ id: 'd1', ma: 'FDA50089N', ten: 'Ghế', dot: '', qty: 10 }],
    },
  ],
  mac_dinh: { team: 't1', stage: 'han' },
}

const TSV = [
  ['Cụm', 'Tên chi tiết', 'CT/SP', '27/07', '28/07'].join('\t'),
  ['CỤM CHÂN', 'Chân trước', '1', '150', '150'].join('\t'),
  ['', 'Hộp trươtt', '1', '', '200'].join('\t'),
].join('\n')

const xemGia = (rows: { hang: number; ten: string }[]): XemDanSo => {
  const dong: DongXem[] = rows.map((r) => {
    const gan = r.ten === 'Hộp trươtt'
    return {
      hang: r.hang,
      kieu: gan ? 'gan' : 'khop',
      comp_id: gan ? null : 'c1',
      gan: gan ? 'Hộp trượt' : null,
      van_de: gan
        ? ['Không có trên lệnh, gần giống "Hộp trượt" — nhận gợi ý hoặc sửa tên']
        : [],
      o: { '2026-07-28': { tt: 'ghi' } },
      tong_ghi: 150,
      can: 400,
      da_lam: 0,
    }
  })
  const chan = dong.filter((d) => d.van_de.length).length
  return {
    dong,
    cot_loi: [],
    tom_tat: {
      o_ghi: 3,
      ngay_ghi: 2,
      moi: 0,
      ngoai: 0,
      trung: 0,
      khac: 0,
      chot: 0,
      chan,
    },
    canh_bao: [],
  }
}

describe('DanSoScreen', () => {
  it('chưa dán gì thì Xem trước nói lý do', () => {
    render(<DanSoScreen opt={opt} />)
    expect(screen.getByText('Dán dữ liệu vào ô vàng')).toBeTruthy()
  })

  it('dán → xem trước chặn dòng gần khớp → nhận gợi ý → mở được Ghi', async () => {
    goi.mockImplementation(
      async (
        _u: string,
        init: { body: { data: { rows: { hang: number; ten: string }[] } } },
      ) => xemGia(init.body.data.rows),
    )
    render(<DanSoScreen opt={opt} />)
    fireEvent.change(screen.getByLabelText('Vùng dán từ Excel'), {
      target: { value: TSV },
    })
    expect(screen.getByText(/Đọc được 2 dòng · 2 cột ngày/)).toBeTruthy()
    fireEvent.click(screen.getByText('Xem trước'))

    expect((await screen.findAllByText(/Chưa ghi được:/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Còn 1 chỗ cần sửa')).toBeTruthy()

    fireEvent.click(screen.getByText('nhận'))
    await waitFor(() => expect(screen.getByText(/Sẵn sàng ghi/)).toBeTruthy())
    expect(screen.getByText('Ghi 3 ô')).toBeTruthy()
    // payload gửi đi mang tên đã đổi
    const last = goi.mock.calls
      .at(-1)![1]
      .body.data.rows.map((r: { ten: string }) => r.ten)
    expect(last).toEqual(['Chân trước', 'Hộp trượt'])
  })

  it('ô chữ sai hiện ở lưới kèm "bỏ"', async () => {
    goi.mockImplementation(
      async (
        _u: string,
        init: { body: { data: { rows: { hang: number; ten: string }[] } } },
      ) => xemGia(init.body.data.rows),
    )
    render(<DanSoScreen opt={opt} />)
    const t = ['Tên chi tiết\t27/07', 'Chốt tay\tabc'].join('\n')
    fireEvent.change(screen.getByLabelText('Vùng dán từ Excel'), { target: { value: t } })
    fireEvent.click(screen.getByText('Xem trước'))
    await screen.findByText('abc')
    expect(screen.getByLabelText(/Bỏ ô 27\/07 của Chốt tay/)).toBeTruthy()
  })
})
