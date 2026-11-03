import { describe, expect, it } from 'vitest'
import { MAX_TASK_FILES, taskAttachBlock } from './task-flow'
import { extLabel, isImageMime, pickTaskFiles } from './task-files'

const file = (name: string, size = 1000, type = '') =>
  ({ name, size, type }) as unknown as File

describe('taskAttachBlock — ai đính tệp vào việc', () => {
  const T = { assigner_id: 'viet', assignee_id: 'quang', status: 'in_progress' as const }
  it('người giao, người nhận, sếp đính được', () => {
    expect(taskAttachBlock(T, { id: 'viet', role: 'employee' })).toBeNull()
    expect(taskAttachBlock(T, { id: 'quang', role: 'employee' })).toBeNull()
    expect(taskAttachBlock(T, { id: 'dien', role: 'admin' })).toBeNull()
  })
  it('quản lý phòng khác / người ngoài không đính', () => {
    expect(taskAttachBlock(T, { id: 'thao', role: 'manager' })).toMatch(/Chỉ người giao/)
  })
  it('việc đã xong hoặc huỷ thì khoá, nói cách gỡ', () => {
    for (const status of ['done', 'cancelled'] as const)
      expect(taskAttachBlock({ ...T, status }, { id: 'viet', role: 'employee' })).toBe(
        'Việc đã đóng — mở lại rồi mới thêm tệp',
      )
  })
  it('việc chờ duyệt / bị trả lại vẫn đính được (đính kết quả)', () => {
    for (const status of ['submitted', 'rejected'] as const)
      expect(
        taskAttachBlock({ ...T, status }, { id: 'quang', role: 'employee' }),
      ).toBeNull()
  })
})

describe('pickTaskFiles', () => {
  it('nhận ảnh và tài liệu hợp lệ', () => {
    const r = pickTaskFiles(
      [file('mau.jpg', 2e6, 'image/jpeg'), file('ban-ve.pdf', 1e6, 'application/pdf')],
      0,
    )
    expect(r.accepted).toHaveLength(2)
    expect(r.rejected).toHaveLength(0)
  })
  it('từ chối tệp xấu nhưng không chặn tệp tốt', () => {
    const r = pickTaskFiles(
      [
        file('setup.exe', 100, 'application/x-msdownload'),
        file('ok.pdf', 100, 'application/pdf'),
      ],
      0,
    )
    expect(r.accepted.map((f) => f.name)).toEqual(['ok.pdf'])
    expect(r.rejected).toHaveLength(1)
    expect(r.rejected[0].name).toBe('setup.exe')
  })
  it('tài liệu quá 50 MB bị từ chối kèm số; ảnh 13 MB vẫn nhận (tự thu nhỏ khi tải)', () => {
    const r = pickTaskFiles(
      [
        file('to.pdf', 60 * 1024 * 1024, 'application/pdf'),
        file('anh.jpg', 13 * 1024 * 1024, 'image/jpeg'),
      ],
      0,
    )
    expect(r.accepted.map((f) => f.name)).toEqual(['anh.jpg'])
    expect(r.rejected[0].reason).toMatch(/tối đa 50/)
  })
  it(`tối đa ${MAX_TASK_FILES} tệp mỗi việc, tính cả tệp đã có`, () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      file(`f${i}.pdf`, 10, 'application/pdf'),
    )
    const r = pickTaskFiles(many, 8)
    expect(r.accepted).toHaveLength(2)
    expect(r.rejected).toHaveLength(3)
    expect(r.rejected[0].reason).toBe(`Đã đủ ${MAX_TASK_FILES} tệp — xoá bớt rồi thêm`)
  })
  it('đã đủ thì từ chối hết', () => {
    expect(
      pickTaskFiles([file('a.pdf', 10, 'application/pdf')], 10).accepted,
    ).toHaveLength(0)
  })
})

describe('isImageMime / extLabel', () => {
  it('chỉ ảnh raster có thumbnail', () => {
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('application/pdf')).toBe(false)
  })
  it('nhãn đuôi', () => {
    expect(extLabel('Siena_ban_ve_rev3.pdf')).toBe('PDF')
    expect(extLabel('Dinh_muc.xlsx')).toBe('XLS')
    expect(extLabel('khongduoi')).toBe('TỆP')
  })
})
