import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSignedUrl = vi.fn()
const createSignedUrls = vi.fn()
const from = vi.fn(() => ({ createSignedUrl, createSignedUrls }))
vi.mock('@/server/db', () => ({ db: () => ({ storage: { from } }) }))

import { storage } from './storage'

let token = 0
beforeEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  token = 0
  createSignedUrl.mockReset()
  createSignedUrls.mockReset()
  from.mockClear()
  // Supabase phát token MỚI mỗi lần ký — đây chính là thứ khiến cache trình duyệt
  // trượt nếu ta ký lại ở mỗi lần render.
  createSignedUrl.mockImplementation(async (path: string) => ({
    data: { signedUrl: `https://sb/${path}?token=${++token}` },
    error: null,
  }))
  createSignedUrls.mockImplementation(async (paths: string[]) => ({
    data: paths.map((p) => ({
      path: p,
      signedUrl: `https://sb/${p}?token=${++token}`,
      error: null,
    })),
    error: null,
  }))
})

// LƯU Ý: cache nằm ở cấp module nên sống xuyên suốt cả file test. Vì vậy mỗi test
// phải dùng path RIÊNG, nếu không lần gọi đầu của test sau sẽ trúng cache của test
// trước và làm assertion "gọi mấy lần" trở nên vô nghĩa.

describe('storage.createSignedDownloadUrl', () => {
  it('ký lại chỉ MỘT lần cho cùng object — lần sau lấy từ cache', async () => {
    const a = await storage.createSignedDownloadUrl('attachments', 'cache-hit.png')
    const b = await storage.createSignedDownloadUrl('attachments', 'cache-hit.png')

    // Cùng URL = cùng cache key ở trình duyệt = không tải lại ảnh. Đây là toàn bộ
    // lý do tồn tại của cache; URL đổi là egress quay lại như cũ.
    expect(b.url).toBe(a.url)
    expect(createSignedUrl).toHaveBeenCalledTimes(1)
  })

  it('object khác nhau thì URL khác nhau', async () => {
    const a = await storage.createSignedDownloadUrl('attachments', 'diff-a.png')
    const b = await storage.createSignedDownloadUrl('attachments', 'diff-b.png')
    expect(b.url).not.toBe(a.url)
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
  })

  it('cùng path khác bucket là 2 object khác nhau', async () => {
    const a = await storage.createSignedDownloadUrl('attachments', 'same-path.png')
    const b = await storage.createSignedDownloadUrl('private', 'same-path.png')
    expect(b.url).not.toBe(a.url)
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
  })

  it('TTL mặc định 1 giờ — đủ sống qua thao tác in, khác hẳn 60s cũ', async () => {
    const before = Date.now()
    const { expiresAt } = await storage.createSignedDownloadUrl('attachments', 'ttl.png')
    expect(createSignedUrl).toHaveBeenCalledWith('ttl.png', 3600)
    expect(expiresAt - before).toBeGreaterThanOrEqual(3600 * 1000 - 1000)
  })

  it('hết hạn thì ký lại URL mới', async () => {
    vi.useFakeTimers()
    const a = await storage.createSignedDownloadUrl('attachments', 'exp.png')
    vi.advanceTimersByTime(3600 * 1000) // quá hạn
    const b = await storage.createSignedDownloadUrl('attachments', 'exp.png')
    expect(b.url).not.toBe(a.url)
    expect(createSignedUrl).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('invalidate buộc ký lại — object đã xoá không được trả URL cũ', async () => {
    const a = await storage.createSignedDownloadUrl('attachments', 'del.png')
    storage.invalidateSignedUrl('attachments', 'del.png')
    const b = await storage.createSignedDownloadUrl('attachments', 'del.png')
    expect(b.url).not.toBe(a.url)
  })

  it('lỗi ký thì ném, không cache lại cái hỏng', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(
      storage.createSignedDownloadUrl('attachments', 'err.png'),
    ).rejects.toThrow('boom')

    // Lần sau vẫn phải thử ký lại chứ không kẹt ở trạng thái hỏng.
    const ok = await storage.createSignedDownloadUrl('attachments', 'err.png')
    expect(ok.url).toContain('token=')
  })
})

describe('storage.createSignedDownloadUrls (batch)', () => {
  it('ký NHIỀU path trong 1 lần gọi', async () => {
    const m = await storage.createSignedDownloadUrls('attachments', [
      'b1.png',
      'b2.png',
      'b3.png',
    ])
    expect(m.size).toBe(3)
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls).toHaveBeenCalledWith(['b1.png', 'b2.png', 'b3.png'], 3600)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('path đã cache không ký lại — chỉ ký path mới', async () => {
    await storage.createSignedDownloadUrl('attachments', 'mix-cached.png')
    const m = await storage.createSignedDownloadUrls('attachments', [
      'mix-cached.png',
      'mix-new.png',
    ])
    expect(m.get('mix-cached.png')).toBeDefined()
    expect(m.get('mix-new.png')).toBeDefined()
    // Chỉ path chưa cache mới được gửi lên batch.
    expect(createSignedUrls).toHaveBeenCalledWith(['mix-new.png'], 3600)
  })

  it('trùng path trong input chỉ ký 1 lần', async () => {
    const m = await storage.createSignedDownloadUrls('attachments', [
      'dup.png',
      'dup.png',
    ])
    expect(m.size).toBe(1)
    expect(createSignedUrls).toHaveBeenCalledWith(['dup.png'], 3600)
  })

  it('không có miss (đã cache hết) thì KHÔNG gọi API', async () => {
    await storage.createSignedDownloadUrls('attachments', ['nomiss.png'])
    createSignedUrls.mockClear()
    const m = await storage.createSignedDownloadUrls('attachments', ['nomiss.png'])
    expect(m.get('nomiss.png')).toBeDefined()
    expect(createSignedUrls).not.toHaveBeenCalled()
  })
})
