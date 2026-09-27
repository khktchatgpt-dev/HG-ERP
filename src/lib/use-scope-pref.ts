'use client'

import { useState } from 'react'
import { useLocalPref } from './use-local-pref'
import type { SupplyScope } from './supply-scope'

/**
 * PHẠM VI "Của tôi | Cả phòng" NHỚ THEO TÀI KHOẢN, TỪNG MÀN (27/09/2026).
 *
 * Thứ tự quyết định:
 *   1. `?pham_vi=` trên địa chỉ trang — link gửi nhau, badge sidebar dẫn vào,
 *      "Xem cả phòng" từ màn khác: mở ra đúng phạm vi người gửi muốn;
 *   2. lựa chọn đã nhớ của CHÍNH tài khoản này trên máy này;
 *   3. mặc định theo vai (`defaultScope`: người duyệt → cả phòng).
 *
 * Khoá gồm id người dùng: hai người dùng chung một máy ở xưởng không kế thừa
 * lựa chọn của nhau. Đổi phạm vi thì nhớ lại VÀ ghi lên địa chỉ trang (thay
 * tại chỗ, không thêm lịch sử) — tải lại trang vẫn đúng chỗ.
 *
 * Nhớ trên MÁY (chốt Q2): đổi máy thì về mặc định theo vai — chấp nhận được vì
 * mặc định đã là lựa chọn đúng cho phần đông; nhớ trên máy chủ cần một bảng.
 */
export function useScopePref(
  screen: string,
  userId: string,
  fallback: SupplyScope,
  fromUrl: SupplyScope | null,
): [SupplyScope, (s: SupplyScope) => void] {
  const [stored, setStored] = useLocalPref(`hg.pham-vi.${screen}.${userId}`, fallback)
  // Địa chỉ trang thắng lựa chọn đã nhớ — nhưng chỉ cho LẦN MỞ này: người dùng
  // bấm đổi thì bỏ ghi đè, từ đó theo lựa chọn mới.
  const [override, setOverride] = useState<SupplyScope | null>(fromUrl)
  const value: SupplyScope =
    override ?? (stored === 'phong' || stored === 'toi' ? stored : fallback)
  const set = (s: SupplyScope) => {
    setStored(s)
    setOverride(null)
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('pham_vi', s)
      window.history.replaceState(window.history.state, '', url)
    } catch {
      // Không ghi được địa chỉ (môi trường thử) — lựa chọn vẫn nhớ, không sao.
    }
  }
  return [value, set]
}
