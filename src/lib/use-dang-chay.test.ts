// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDangChay } from './use-dang-chay'

/** Promise tự giải tay — giữ việc "đang chạy" tới khi test cho xong. */
function cho<T = void>() {
  let xong!: (v: T) => void
  let hong!: (e: unknown) => void
  const p = new Promise<T>((a, b) => {
    xong = a
    hong = b
  })
  return { p, xong, hong }
}

describe('useDangChay — chặn bấm đôi', () => {
  it('hai lần gọi cùng khoá sát nhau: chỉ chạy MỘT lần, cờ bật tới khi xong', async () => {
    const { result } = renderHook(() => useDangChay())
    const v = cho<string>()
    let soLan = 0
    const fn = () => {
      soLan++
      return v.p
    }
    let a: Promise<string | undefined>, b: Promise<string | undefined>
    act(() => {
      a = result.current.chay('gui', fn)
      b = result.current.chay('gui', fn) // cùng nhịp — trước khi React vẽ lại
    })
    expect(soLan).toBe(1)
    expect(result.current.dangChay('gui')).toBe(true)
    expect(result.current.coViec).toBe(true)
    await act(async () => v.xong('ok'))
    expect(await a!).toBe('ok')
    expect(await b!).toBeUndefined()
    expect(result.current.dangChay('gui')).toBe(false)
    expect(result.current.coViec).toBe(false)
  })

  it('khoá khác nhau chạy song song, cờ riêng từng khoá', async () => {
    const { result } = renderHook(() => useDangChay())
    const a = cho()
    const b = cho()
    act(() => {
      void result.current.chay('go:1', () => a.p)
      void result.current.chay('go:2', () => b.p)
    })
    expect(result.current.dangChay('go:1')).toBe(true)
    expect(result.current.dangChay('go:2')).toBe(true)
    await act(async () => a.xong())
    expect(result.current.dangChay('go:1')).toBe(false)
    expect(result.current.dangChay('go:2')).toBe(true)
    await act(async () => b.xong())
  })

  it('việc ném lỗi: lỗi vẫn tới chỗ gọi, cờ tắt, bấm lại được', async () => {
    const { result } = renderHook(() => useDangChay())
    const v = cho()
    let p: Promise<unknown>
    act(() => {
      p = result.current.chay('xoa', () => v.p)
    })
    await act(async () => {
      v.hong(new Error('mạng'))
      await expect(p!).rejects.toThrow('mạng')
    })
    expect(result.current.dangChay('xoa')).toBe(false)
    let lan2 = 0
    await act(async () => {
      await result.current.chay('xoa', async () => {
        lan2++
      })
    })
    expect(lan2).toBe(1)
  })
})
