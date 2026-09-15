import { describe, expect, it } from 'vitest'
import { SHARED_SECTION } from '@/workspaces/workspaces.config'
import { INBOX_HREF, SUPPLY_HREFS, SUPPLY_NAV, activeSupplyHref } from './nav'

/**
 * HÀNG RÀO CỦA CUỘC CHUYỂN NHÀ.
 *
 * Từ 15/09/2026 cửa vào phòng Cung ứng đã dời sang khu này, nên menu ở đây là
 * thứ DUY NHẤT người mua nhìn thấy. Mất một mục là mất một tính năng họ đang
 * dùng hằng ngày — và mất im lặng, vì không có lỗi nào nổ ra.
 *
 * Bảng dưới liệt kê mọi mục của sidebar Cung ứng CŨ tại thời điểm dời cửa, kèm
 * chỗ đi tới trong khu mới. Gỡ một trang mới mà quên đường thay thế thì test
 * này đỏ, chứ không phải người dùng phát hiện.
 */
const CUA_CU: { cu: string; nhan: string; moi: string; vi_sao: string }[] = [
  {
    cu: '/planning',
    nhan: 'Tổng quan',
    moi: '/mua-hang',
    vi_sao: 'Bàn làm việc gộp 4 trang cũ (Tổng quan, Chờ tôi xử lý, Vấn đề, Họp)',
  },
  { cu: '/planning/pos', nhan: 'Phiếu mua', moi: '/mua-hang/don', vi_sao: 'Đơn mua' },
  {
    cu: '/planning/materials',
    nhan: 'Vật tư & giá mua',
    moi: '/mua-hang/vat-tu',
    vi_sao: 'Danh mục Vật tư; phần giá tách sang Bảng giá',
  },
  {
    cu: '/planning/suppliers',
    nhan: 'Nhà cung cấp',
    moi: '/mua-hang/ncc',
    vi_sao: 'Danh sách NCC kèm lịch sử mua',
  },
  {
    cu: '/planning/stock',
    nhan: 'Kho & tồn',
    moi: '/mua-hang/ton',
    vi_sao: 'Tồn & cân đối — trục là vị thế, không phải tồn kho',
  },
  {
    cu: '/planning/lsx',
    nhan: 'Vật tư theo lệnh',
    moi: '/mua-hang/yeu-cau',
    vi_sao: 'Yêu cầu mua — lệnh nào còn thiếu đồ',
  },
  {
    cu: '/planning/viec-cua-toi',
    nhan: 'Chờ tôi xử lý',
    moi: INBOX_HREF,
    vi_sao: 'Hộp thư việc — ở VỎ, không nằm trong cây menu',
  },
  {
    cu: '/planning/hang-sap-ve',
    nhan: 'Hàng sắp về',
    moi: '/mua-hang/nhan-hang',
    vi_sao: 'Nhận hàng — trục là thời gian',
  },
  {
    cu: '/planning/van-de',
    nhan: 'Vấn đề cần xử lý',
    moi: '/mua-hang',
    vi_sao: 'một tab của Bàn làm việc',
  },
  {
    cu: '/planning/hop',
    nhan: 'Việc cần quyết định',
    moi: '/mua-hang',
    vi_sao: 'một tab của Bàn làm việc',
  },
  {
    cu: '/products',
    nhan: 'Thư viện sản phẩm',
    moi: '/products',
    vi_sao: 'trang dùng chung',
  },
  { cu: '/khuon', nhan: 'Khuôn nhôm', moi: '/khuon', vi_sao: 'trang dùng chung' },
]

describe('menu khu Mua hàng giữ đủ tính năng của sidebar Cung ứng cũ', () => {
  const reachable = new Set<string>([...SUPPLY_HREFS, INBOX_HREF])

  for (const m of CUA_CU) {
    it(`"${m.nhan}" còn đường vào — ${m.moi} (${m.vi_sao})`, () => {
      expect(reachable.has(m.moi)).toBe(true)
    })
  }

  it('mọi trang DÙNG CHUNG của vỏ cũ đều có trong menu mới', () => {
    // Vỏ cũ nối SHARED_SECTION vào sidebar mọi phòng; vỏ mới phải tự nối.
    for (const i of SHARED_SECTION.items) expect(SUPPLY_HREFS).toContain(i.href)
  })

  it('còn lối về khu cũ khi hai bản chạy song song', () => {
    expect(SUPPLY_HREFS).toContain('/planning')
  })

  it('mục ngoài khu không cướp phần sáng của mục trong khu', () => {
    // /products, /khuon, /planning render ở vỏ CŨ nên vỏ này không bao giờ
    // thấy pathname của chúng — nhưng nếu có, không được sáng nhầm.
    expect(activeSupplyHref('/mua-hang/don/abc')).toBe('/mua-hang/don')
    expect(activeSupplyHref('/mua-hang')).toBe('/mua-hang')
    expect(activeSupplyHref('/mua-hang/khong-co-that')).toBe('/mua-hang')
  })

  it('không mục nào trùng href', () => {
    expect(new Set(SUPPLY_HREFS).size).toBe(SUPPLY_HREFS.length)
  })

  it('mọi mục đều khai khuôn màn và câu hỏi', () => {
    for (const g of SUPPLY_NAV) {
      for (const i of g.items) {
        expect(i.label.trim().length, i.href).toBeGreaterThan(0)
        expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(i.plan)
      }
    }
  })
})
