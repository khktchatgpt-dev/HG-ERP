// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TaskFileItem } from '@/modules/core/files/files.service'
import { TepDinhKem } from './tep-dinh-kem'

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }))
vi.mock('@/lib/upload', () => ({ uploadFileTracked: upload }))
vi.mock('@/lib/api', () => ({
  api: vi.fn(async () => ({ url: 'https://x/y' })),
  apiErrorText: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi'),
}))

const F = (over: Partial<TaskFileItem>): TaskFileItem => ({
  id: 'f1',
  filename: 'Siena_ban_ve_rev3.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1_258_291,
  created_at: '2026-11-03T08:00:00Z',
  owner_id: 'u-viet',
  owner_name: 'Nguyễn Võ Nam Việt',
  thumb: null,
  can_delete: false,
  ...over,
})

beforeEach(() => {
  upload.mockReset()
})
afterEach(cleanup)

const pick = (files: File[]) =>
  fireEvent.change(document.getElementById('tep-dinh-kem-input')!, { target: { files } })

describe('TepDinhKem', () => {
  it('bày ảnh thành thumbnail và tài liệu thành dòng, kèm ai tải', () => {
    render(
      <TepDinhKem
        taskId="t1"
        canAdd
        onChanged={() => {}}
        files={[
          F({}),
          F({
            id: 'f2',
            filename: 'mau-vai.jpg',
            mime_type: 'image/jpeg',
            thumb: '/api/files/f2/img?s=x',
          }),
        ]}
      />,
    )
    expect(screen.getByText('2 / 10')).toBeTruthy()
    expect(screen.getByAltText('mau-vai.jpg')).toBeTruthy()
    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getAllByText(/Nguyễn Võ Nam Việt/).length).toBe(2)
  })

  it('chỉ tệp của mình có nút xoá; xoá hai bước', () => {
    render(
      <TepDinhKem
        taskId="t1"
        canAdd
        onChanged={() => {}}
        files={[F({ can_delete: true }), F({ id: 'f2', filename: 'cua-nguoi-khac.pdf' })]}
      />,
    )
    expect(screen.getAllByLabelText(/^Xoá /)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Xoá Siena_ban_ve_rev3.pdf'))
    expect(screen.getByText('Xoá hẳn')).toBeTruthy()
  })

  it('tải tệp hợp lệ lên đúng việc rồi báo màn cha tải lại', async () => {
    upload.mockResolvedValue('fid')
    const onChanged = vi.fn()
    render(<TepDinhKem taskId="t1" canAdd files={[]} onChanged={onChanged} />)
    pick([
      new File(['x'], 'dinh-muc.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    ])
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(upload.mock.calls[0][1]).toEqual({ kind: 'task', id: 't1' })
    expect(upload.mock.calls[0][3]).toBeNull()
  })

  it('tệp lỗi báo ngay trên tệp, tệp tốt vẫn lên', async () => {
    upload.mockResolvedValue('fid')
    const onChanged = vi.fn()
    render(<TepDinhKem taskId="t1" canAdd files={[]} onChanged={onChanged} />)
    pick([
      new File(['x'], 'setup.exe', { type: 'application/x-msdownload' }),
      new File(['x'], 'ok.pdf', { type: 'application/pdf' }),
    ])
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(upload).toHaveBeenCalledTimes(1)
    expect(screen.getByText('setup.exe')).toBeTruthy()
  })

  it('máy chủ từ chối thì hiện câu lỗi trên tệp đó, không gọi tải lại', async () => {
    upload.mockRejectedValue(new Error('Việc đã đóng — mở lại rồi mới thêm tệp'))
    const onChanged = vi.fn()
    render(<TepDinhKem taskId="t1" canAdd files={[]} onChanged={onChanged} />)
    pick([new File(['x'], 'ok.pdf', { type: 'application/pdf' })])
    await waitFor(() =>
      expect(screen.getByText('Việc đã đóng — mở lại rồi mới thêm tệp')).toBeTruthy(),
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('đủ 10 tệp thì khoá ô tải và nói cách gỡ', () => {
    const ten = Array.from({ length: 10 }, (_, i) =>
      F({ id: `f${i}`, filename: `f${i}.pdf` }),
    )
    render(<TepDinhKem taskId="t1" canAdd files={ten} onChanged={() => {}} />)
    expect(screen.getByText('Đã đủ 10 tệp — xoá bớt để thêm')).toBeTruthy()
    expect(
      (document.getElementById('tep-dinh-kem-input') as HTMLInputElement).disabled,
    ).toBe(true)
  })

  it('không đính được thì không có ô tải, nói vì sao', () => {
    render(
      <TepDinhKem
        taskId="t1"
        canAdd={false}
        blockReason="Việc đã đóng — mở lại rồi mới thêm tệp"
        files={[F({})]}
        onChanged={() => {}}
      />,
    )
    expect(document.getElementById('tep-dinh-kem-input')).toBeNull()
    expect(screen.getByText('Việc đã đóng — mở lại rồi mới thêm tệp')).toBeTruthy()
  })
})
