import { describe, expect, it } from 'vitest'
import { ghepNgayLam, gioCua } from './gio-khung'

/**
 * Lượt máy THẬT kỳ T9/2026 (21/10/2026) của 6 người làm ca liền đêm, so với cách sổ Nhân sự
 * ghép (BẢNG CÔNG T9 / file CT). Mã người giữ ở tên ca kiểm để tra ngược sổ.
 */
const tho = (ngay: Record<string, string>) =>
  Object.entries(ngay).flatMap(([d, s]) => s.split(' ').map((g) => `2026-09-${d} ${g}`))

const theoNgay = (luot: string[]) =>
  Object.fromEntries(ghepNgayLam(luot).map((x) => [x.ngay.slice(8), x.luot.map(gioCua).join(' ')]))

describe('ca ĐÊM vào ~20:45, ra 05:00–05:30 hôm sau', () => {
  it('105 tuần 08–13/09: mỗi lượt sáng sớm là lượt RA của tối hôm trước, không dây chuyền', () => {
    const r = theoNgay(
      tho({
        '08': '06:49 11:29 20:56',
        '09': '04:58 20:57',
        '10': '04:59 20:53',
        '11': '05:08 20:48',
        '12': '05:00 20:43',
        '13': '04:08 04:08 15:40',
        '14': '06:34 21:02',
      }),
    )
    expect(r).toEqual({
      '08': '06:49 11:29 20:56 04:58(+1)',
      '09': '20:57 04:59(+1)',
      '10': '20:53 05:08(+1)',
      '11': '20:48 05:00(+1)',
      '12': '20:43 04:08(+1)',
      '13': '15:40',
      '14': '06:34 21:02',
    })
  })

  it('105 ngày 17→18/09 và 24→25/09; 6038 ngày 10→11/09', () => {
    expect(theoNgay(tho({ '17': '20:45', '18': '05:04 12:31 19:42' }))).toEqual({
      '17': '20:45 05:04(+1)',
      '18': '12:31 19:42',
    })
    expect(theoNgay(tho({ '24': '20:45', '25': '05:26' }))).toEqual({ '24': '20:45 05:26(+1)' })
    expect(theoNgay(tho({ '09': '20:52 20:52', '10': '04:59 20:44', '11': '05:08' }))).toEqual({
      '09': '20:52 04:59(+1)',
      '10': '20:44 05:08(+1)',
    })
  })
})

describe('ca DÀI vào sáng, ra sáng hôm sau (≥ 20 giờ)', () => {
  it('529 ngày 14→15/09: 07:05 → 06:20 hôm sau; 15/09 còn 11:56 → 21:00', () => {
    expect(theoNgay(tho({ '14': '07:05', '15': '06:20 06:20 11:56 21:00' }))).toEqual({
      '14': '07:05 06:20(+1)',
      '15': '11:56 21:00',
    })
  })

  it('529 ngày 17→18/09: 06:56 → 06:29 hôm sau; 18/09 vào lại 06:52', () => {
    expect(theoNgay(tho({ '17': '06:56 06:56', '18': '06:29 06:52 21:04' }))).toEqual({
      '17': '06:56 06:29(+1)',
      '18': '06:52 21:04',
    })
  })
})

describe('KHÔNG ghép — quên quẹt ra, lượt sáng nay là lượt vào', () => {
  it('625 ngày 19→20/09: 06:39 (quên ra) rồi 06:36 → 16:01 — hôm sau còn lẻ lượt', () => {
    expect(theoNgay(tho({ '19': '06:39 06:39', '20': '06:36 16:01' }))).toEqual({
      '19': '06:39',
      '20': '06:36 16:01',
    })
  })

  it('529 ngày 10→11/09: lượt hôm sau 07:03 không trước giờ vào ca', () => {
    expect(theoNgay(tho({ '10': '06:57', '11': '07:03 07:03 21:18' }))).toEqual({
      '10': '06:57',
      '11': '07:03 21:18',
    })
  })

  it('quên quẹt VÀO một tối (chỉ có 21:01) rồi hôm sau vào 06:45 — không kéo dây chuyền', () => {
    expect(
      theoNgay(tho({ '01': '21:01', '02': '06:45 21:01', '03': '06:44 21:01' })),
    ).toEqual({ '01': '21:01', '02': '06:45 21:01', '03': '06:44 21:01' })
  })

  it('ca dài phải đủ 20 giờ: vào 11:30 hôm trước, 06:40 hôm sau là lượt vào', () => {
    expect(theoNgay(tho({ '01': '06:50 11:30 13:00', '02': '06:40 16:05' }))).toEqual({
      '01': '06:50 11:30 13:00',
      '02': '06:40 16:05',
    })
  })
})

describe('ca dài cần hôm sau còn ca của nó', () => {
  it('hai ngày liền chỉ một lượt 06:55 — không ghép thành ca 24 giờ', () => {
    expect(theoNgay(tho({ '15': '06:55', '16': '06:55' }))).toEqual({ '15': '06:55', '16': '06:55' })
  })
})

describe('lượt ra ca đêm đứng lẻ không thành lượt vào ca dài', () => {
  it('6037 ngày 16→17/09: 05:03 (ra ca đêm, thiếu lượt vào tối 15) — 06:46 hôm sau là lượt vào', () => {
    expect(
      theoNgay(tho({ '15': '05:14 20:43', '16': '05:03 05:03', '17': '06:46 11:03 20:42' })),
    ).toEqual({ '15': '05:14 20:43', '16': '05:03', '17': '06:46 11:03 20:42' })
  })
})
