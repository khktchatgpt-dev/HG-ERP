/**
 * CHUYỂN BẢN ĐANG GÕ SANG TAB IN (10/10/2026). Nút "Xem trước" mở tab mới y như
 * nút "Phiếu đặt hàng" ở chi tiết đơn; bản đang gõ (chưa lưu) đi qua localStorage
 * vì tab mới không nhận được state của tab soạn. Khoá theo id lượt bấm; bản cũ
 * hơn một ngày tự dọn khi ghi bản mới.
 */
const PREFIX = 'hg.po-print-nhap.'
const TTL_MS = 24 * 60 * 60 * 1000

export function ghiBanXemTruoc(input: unknown): string {
  const k = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  try {
    const now = Date.now()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PREFIX)) continue
      const at = Number(JSON.parse(localStorage.getItem(key) ?? '{}').at) || 0
      if (now - at > TTL_MS) localStorage.removeItem(key)
    }
    localStorage.setItem(PREFIX + k, JSON.stringify({ at: now, input }))
  } catch {
    // Bộ nhớ trình duyệt bị chặn → tab in báo không đọc được bản gõ.
  }
  return k
}

export function docBanXemTruoc(k: string): unknown | null {
  try {
    const raw = localStorage.getItem(PREFIX + k)
    return raw ? (JSON.parse(raw).input ?? null) : null
  } catch {
    return null
  }
}
