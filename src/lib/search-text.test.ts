import { describe, expect, it } from 'vitest'
import { normalizeSearch, searchTokens, worthFuzzy } from './search-text'

/**
 * Ba kiểu gõ mà cách tìm cũ (`ilike '%q%'` trên từng cột rời) đều ra 0 kết quả —
 * xem đầu file `supabase/migrations/0098_product_search_tolerant.sql`.
 */
describe('normalizeSearch — bỏ dấu tiếng Việt', () => {
  it('bỏ dấu thanh và dấu mũ, hạ chữ thường', () => {
    expect(normalizeSearch('Ghế xếp Florenz')).toBe('ghe xep florenz')
    expect(normalizeSearch('BÀN CNKG')).toBe('ban cnkg')
    expect(normalizeSearch('Nệm mê')).toBe('nem me')
  })

  it('đ/Đ không phải "d + dấu" nên NFD không tách được — phải thay riêng', () => {
    expect(normalizeSearch('Đố trước')).toBe('do truoc')
    expect(normalizeSearch('đan dây')).toBe('dan day')
  })

  it('giữ nguyên chuỗi đã không dấu', () => {
    expect(normalizeSearch('ST000049HG-AL')).toBe('st000049hg-al')
  })
})

describe('searchTokens — tách từ để AND lại', () => {
  it('gõ thiếu thứ tự vẫn ra: mỗi từ là một điều kiện riêng', () => {
    expect(searchTokens('ghe florenz')).toEqual(['ghe', 'florenz'])
    expect(searchTokens('Florenz  Ghế')).toEqual(['florenz', 'ghe'])
  })

  it('giữ dấu - và . vì mã sản phẩm có chúng', () => {
    expect(searchTokens('S0049HG-AL')).toEqual(['s0049hg-al'])
    expect(searchTokens('21605-217')).toEqual(['21605-217'])
  })

  it('bỏ ký tự làm vỡ cú pháp lọc PostgREST', () => {
    // Dấu phẩy tách điều kiện trong `or()`; `%` và `*` là ký tự đại diện.
    expect(searchTokens('S0049HG-AL, ghế')).toEqual(['s0049hg-al', 'ghe'])
    expect(searchTokens('ghe%(xep)*')).toEqual(['ghe', 'xep'])
  })

  it('chuỗi rỗng / toàn khoảng trắng ra mảng rỗng, không ra [""]', () => {
    expect(searchTokens('')).toEqual([])
    expect(searchTokens('   ')).toEqual([])
    // Mảng rỗng nghĩa là KHÔNG thêm điều kiện nào — không được thành `ilike '%%'`
    // rồi tưởng là đã lọc.
  })

  it('chặn số từ để một lần dán dài không đẻ ra 40 điều kiện ilike', () => {
    expect(searchTokens('a b c d e f g h')).toHaveLength(5)
  })
})

describe('worthFuzzy — khi nào mới tìm gần đúng', () => {
  it('từ khoá quá ngắn thì không, vì gần đúng sẽ khớp gần hết bảng', () => {
    expect(worthFuzzy('gh')).toBe(false)
    expect(worthFuzzy('  a ')).toBe(false)
  })

  it('từ 3 ký tự trở lên thì có', () => {
    expect(worthFuzzy('ghe')).toBe(true)
    expect(worthFuzzy('Ghế')).toBe(true) // 3 ký tự sau khi bỏ dấu
  })
})
