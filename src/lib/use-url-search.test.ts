import { describe, expect, it } from 'vitest'
import { nhanUrl } from './use-url-search'

describe('nhanUrl — URL về thì ô có giữ chữ đang gõ không', () => {
  it('URL về đúng giá trị mình vừa đẩy → giữ ô (chữ gõ thêm trong lúc tải không mất)', () => {
    expect(nhanUrl(['ong'], 'ong')).toEqual({ giuO: true, daDay: [] })
  })
  it('đã đẩy hai lần, trang của lần đầu về sau cùng → vẫn giữ ô, còn nhớ lần sau', () => {
    expect(nhanUrl(['ong', 'ong thep'], 'ong')).toEqual({
      giuO: true,
      daDay: ['ong thep'],
    })
  })
  it('Next gộp hai lần đẩy, về thẳng giá trị cuối → giữ ô, quên cả hai', () => {
    expect(nhanUrl(['ong', 'ong thep'], 'ong thep')).toEqual({ giuO: true, daDay: [] })
  })
  it('URL đổi từ ngoài (Back, link, xoá lọc) → ô theo URL', () => {
    expect(nhanUrl(['ong'], '')).toEqual({ giuO: false, daDay: [] })
    expect(nhanUrl([], 'vit')).toEqual({ giuO: false, daDay: [] })
  })
})
