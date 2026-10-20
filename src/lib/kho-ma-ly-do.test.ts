import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MA_LY_DO_KHO,
  canDuyet,
  doiUngConThieu,
  laMaLyDo,
  maTheoHuong,
  nhanLyDo,
  suyMaTuLichSu,
  vaoGiaThanhLenh,
} from './kho-ma-ly-do'

describe('mã lý do kho', () => {
  it('mã không trùng, và mọi mã đúng khuôn một chữ + một số', () => {
    const ma = MA_LY_DO_KHO.map((x) => x.ma)
    expect(new Set(ma).size).toBe(ma.length)
    for (const m of ma) expect(m).toMatch(/^[NXC]\d$/)
  })

  it('chữ đầu của mã khớp hướng — N vào, X ra, C chuyển', () => {
    const chu: Record<string, string> = { in: 'N', out: 'X', move: 'C' }
    for (const x of MA_LY_DO_KHO) expect(x.ma[0]).toBe(chu[x.huong])
  })

  it('chỉ mã VÀO mới được vào giá thành theo hướng nhập, và kiểm kê thì không', () => {
    // Kiểm kê lệch là điều chỉnh sổ, không phải chi phí của lệnh nào.
    for (const x of MA_LY_DO_KHO) {
      // `as const` làm doiUng thành union các tuple; C2 là tuple RỖNG nên phần
      // tử của nó là `never` và `.includes` không nhận tham số nào. Nới về
      // readonly string[] để hỏi được câu này.
      const doiUng: readonly string[] = x.doiUng
      if (doiUng.includes('stocktake')) expect(x.vaoGiaThanhLenh).toBe(false)
    }
  })

  it('mọi mã CẦN DUYỆT đều là mã sửa được tồn mà không có chứng từ ngoài đối chiếu', () => {
    // N4/X5 kiểm kê · X4 huỷ · C3 khoá hàng — đúng ba nhóm của thiết kế §2b.
    expect(MA_LY_DO_KHO.filter((x) => x.canDuyet).map((x) => x.ma)).toEqual([
      'N4',
      'X4',
      'X5',
      'C3',
    ])
  })

  it('maTheoHuong giữ thứ tự khai và không lẫn hướng', () => {
    expect(maTheoHuong('in').map((x) => x.ma)).toEqual(['N1', 'N2', 'N3', 'N4'])
    expect(maTheoHuong('move').map((x) => x.ma)).toEqual(['C1', 'C2', 'C3'])
    expect(maTheoHuong('out')).toHaveLength(7)
  })

  it('laMaLyDo chặn mã lạ', () => {
    expect(laMaLyDo('X1')).toBe(true)
    expect(laMaLyDo('x1')).toBe(false)
    expect(laMaLyDo('sx')).toBe(false)
  })

  it('nhãn của mã lạ là CHÍNH NÓ, không phải ô trống', () => {
    expect(nhanLyDo('X4')).toBe('Xuất huỷ · phế liệu')
    expect(nhanLyDo('Z9')).toBe('Z9')
    expect(nhanLyDo(null)).toBeNull()
  })

  it('vaoGiaThanhLenh tách chi phí lệnh khỏi chi phí chung', () => {
    expect(vaoGiaThanhLenh('X1')).toBe(true)
    expect(vaoGiaThanhLenh('X2')).toBe(true)
    expect(vaoGiaThanhLenh('X6')).toBe(false)
    expect(vaoGiaThanhLenh('X4')).toBe(false)
    expect(vaoGiaThanhLenh(null)).toBe(false)
  })

  it('canDuyet đúng cho mã sửa tồn', () => {
    expect(canDuyet('X4')).toBe(true)
    expect(canDuyet('X1')).toBe(false)
  })
})

describe('đối ứng còn thiếu', () => {
  it('nói THIẾU CÁI GÌ, không chỉ nói chưa hợp lệ', () => {
    expect(doiUngConThieu('X3', {})).toEqual(['po_line', 'reason'])
    expect(doiUngConThieu('X3', { po_line: 'abc' })).toEqual(['reason'])
    expect(doiUngConThieu('X3', { po_line: 'abc', reason: 'hàng cong' })).toEqual([])
  })

  it('chuỗi toàn khoảng trắng là CHƯA có', () => {
    expect(doiUngConThieu('X4', { reason: '   ' })).toEqual(['reason'])
    expect(doiUngConThieu('X4', { reason: 'ẩm mốc' })).toEqual([])
  })

  it('mã không đòi gì thì không bao giờ thiếu', () => {
    expect(doiUngConThieu('C2', {})).toEqual([])
  })

  it('mã lạ không đòi gì — không chặn được dữ liệu cũ', () => {
    expect(doiUngConThieu('Z9', {})).toEqual([])
    expect(doiUngConThieu(null, {})).toEqual([])
  })
})

describe('suy mã cho dòng sổ cũ', () => {
  it('po: vào là nhập mua, ra là trả NCC', () => {
    expect(suyMaTuLichSu('po', 'in')).toBe('N1')
    expect(suyMaTuLichSu('po', 'out')).toBe('X3')
  })

  it('lsx: ra là cấp cho lệnh, vào là hoàn kho', () => {
    expect(suyMaTuLichSu('lsx', 'out')).toBe('X1')
    expect(suyMaTuLichSu('lsx', 'in')).toBe('N3')
  })

  it('external vào là mua ngoài đơn; external RA thì không suy được', () => {
    expect(suyMaTuLichSu('external', 'in')).toBe('N2')
    expect(suyMaTuLichSu('external', 'out')).toBeNull()
  })

  it('transfer là chuyển vị trí', () => {
    expect(suyMaTuLichSu('transfer', 'in')).toBe('C1')
    expect(suyMaTuLichSu('transfer', 'out')).toBe('C1')
  })

  it('adjust và daily TRẢ NULL — đoán bừa là bịa số cho kế toán', () => {
    expect(suyMaTuLichSu('adjust', 'in')).toBeNull()
    expect(suyMaTuLichSu('adjust', 'out')).toBeNull()
    expect(suyMaTuLichSu('daily', 'out')).toBeNull()
    expect(suyMaTuLichSu(null, 'out')).toBeNull()
  })
})

/**
 * Bảng DB giữ toàn vẹn FK, file TS giữ luật. Không canh thì đây đúng là hai
 * nguồn một sự thật — thứ mà chính bộ mã này sinh ra để dẹp.
 */
describe('seed SQL 0197 khớp danh sách TS', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/0197_warehouse_reason_codes.sql'),
    'utf8',
  )
  // Cắt từ CÂU LỆNH insert, không cắt từ lần xuất hiện đầu tiên của chuỗi:
  // header của migration có nhắc `on conflict (code) do nothing` trong lời giải
  // thích, nên tìm mốc cuối phải bắt đầu từ SAU câu insert.
  const dau = sql.indexOf('insert into public.warehouse_reason_codes\n')
  const than = sql.slice(dau, sql.indexOf('on conflict (code) do nothing', dau))

  const dong = [
    ...than.matchAll(
      /\('([NXC]\d)',\s*'([^']*)',\s*'(in|out|move)',\s*'\{([^}]*)\}',\s*(true|false),\s*(true|false),\s*(\d+)\)/g,
    ),
  ]

  it('đọc được đúng 14 dòng seed (regex không hỏng im lặng)', () => {
    expect(dong).toHaveLength(MA_LY_DO_KHO.length)
  })

  it('từng mã: nhãn, hướng, đối ứng, duyệt, giá thành đều khớp', () => {
    for (const [, ma, nhan, huong, doiUng, duyet, giaThanh] of dong) {
      const ts = MA_LY_DO_KHO.find((x) => x.ma === ma)
      expect(ts, `SQL có mã ${ma} mà TS không có`).toBeDefined()
      expect(nhan, `nhãn ${ma}`).toBe(ts!.nhan)
      expect(huong, `hướng ${ma}`).toBe(ts!.huong)
      expect(doiUng ? doiUng.split(',') : [], `đối ứng ${ma}`).toEqual([...ts!.doiUng])
      expect(duyet === 'true', `duyệt ${ma}`).toBe(ts!.canDuyet)
      expect(giaThanh === 'true', `giá thành ${ma}`).toBe(ts!.vaoGiaThanhLenh)
    }
  })

  it('sort_order tăng dần theo đúng thứ tự khai ở TS', () => {
    expect(dong.map((d) => d[1])).toEqual(MA_LY_DO_KHO.map((x) => x.ma))
    const thuTu = dong.map((d) => Number(d[7]))
    expect([...thuTu].sort((a, b) => a - b)).toEqual(thuTu)
  })

  it('migration bật RLS và không đặt check constraint trên mã', () => {
    expect(sql).toMatch(
      /alter table public\.warehouse_reason_codes enable row level security/,
    )
    expect(sql).not.toMatch(/check \(code in/)
  })
})
