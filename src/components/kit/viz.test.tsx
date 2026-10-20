// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DayStrip,
  DeltaNum,
  DualPct,
  MatrixTable,
  MiniBars,
  NGOAI_LO_TRINH,
  pctTienDo,
  type MatrixCol,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * BÀY SỐ (B6, 24/09/2026) — năm thành phần cho màn Thống kê.
 * Canh các QUY ƯỚC của file Excel xưởng mà thành phần phải giữ: `(300)` là
 * thiếu, `–` sọc là ngoài lộ trình, % tiến độ không bao giờ làm tròn LÊN 100.
 */

afterEach(cleanup)

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

describe('pctTienDo / DualPct', () => {
  it('chưa đủ thì không bao giờ in 100% — 99,6% vẫn là 99%', () => {
    expect(pctTienDo(0.996)).toBe('99%')
    expect(pctTienDo(1)).toBe('100%')
    expect(pctTienDo(0)).toBe('0%')
    expect(pctTienDo(0.625)).toBe('62%')
  })

  it('bày HAI mẫu số cạnh nhau; không có mẫu số thì "—", không phải 0%', () => {
    render(<DualPct pieces={0.98} sets={null} />)
    const el = screen.getByTitle(/Mảnh: tổng số cái/)
    expect(chuHien(el)).toBe('98% mảnh·— bộ')
  })

  // B7½: câu giải nghĩa từng chỉ nằm trong `title` của một thẻ không nhận focus.
  it('câu giải nghĩa hai mẫu số có cả trong chữ ẩn cho trình đọc', () => {
    const { container } = render(<DualPct pieces={0.98} sets={0.62} />)
    const an = [...container.querySelectorAll('.sr-only')].map((x) => x.textContent).join(' ') // prettier-ignore
    expect(an).toMatch(/Mảnh: tổng số cái đã làm/)
    expect(an).toMatch(/Bộ: số bộ đã đủ/)
  })

  it('null: gạch "—" ẩn khỏi trình đọc, thay bằng chữ "chưa có số"', () => {
    const { container } = render(<DualPct pieces={0.5} sets={null} />)
    const gach = [...container.querySelectorAll('[aria-hidden]')].find((x) => x.textContent === '—') // prettier-ignore
    expect(gach).toBeTruthy()
    expect(container.textContent).toContain('chưa có số')
  })
})

/** Chữ MẮT thấy — bỏ phần `.sr-only` chỉ dành cho trình đọc màn hình. */
function chuHien(el: Element): string {
  const c = el.cloneNode(true) as Element
  c.querySelectorAll('.sr-only').forEach((x) => x.remove())
  return c.textContent ?? ''
}

describe('DeltaNum — quy ước số lệch của file Excel', () => {
  it('thiếu: (300) màu dừng, trình đọc nghe "thiếu 300"', () => {
    const { container } = render(<DeltaNum value={-300} unit="bộ" />)
    expect(container.querySelector('[aria-hidden]')!.textContent).toBe('(300)')
    expect(container.textContent).toContain('thiếu 300 bộ')
    expect(container.firstElementChild!.className).toContain('--stop')
  })

  it('dư: +120 màu CHỜ — dư cũng là vấn đề; bằng: gạch mờ, đọc là "đủ"', () => {
    const { container, rerender } = render(<DeltaNum value={120} />)
    expect(container.querySelector('[aria-hidden]')!.textContent).toBe('+120')
    expect(container.firstElementChild!.className).toContain('--warn')
    rerender(<DeltaNum value={0} />)
    expect(container.textContent).toContain('đủ')
  })

  /*
    B7½: `if (!value)` coi NaN như 0 — một phép trừ với dữ liệu thiếu hiện "—"
    và trình đọc nghe "đủ". Thiếu số phải trông và nghe KHÁC hẳn "đủ".
  */
  it('NaN / null: hiện "?" mờ, đọc "chưa có số" — không bao giờ là "đủ"', () => {
    for (const v of [Number.NaN, null]) {
      const { container, unmount } = render(<DeltaNum value={v} unit="bộ" />)
      expect(container.querySelector('[aria-hidden]')!.textContent).toBe('?')
      expect(container.textContent).toContain('chưa có số')
      expect(container.textContent).not.toContain('đủ')
      const cls = container.firstElementChild!.className
      expect(cls).toContain('--ink-3')
      expect(cls).not.toContain('--done')
      unmount()
    }
  })
})

describe('DayStrip — nhịp 14 ngày', () => {
  const days = [
    { date: '2026-09-22', value: 0 },
    { date: '2026-09-23', value: 120, note: '2 phiếu' },
    { date: '2026-09-24', value: 40 },
  ]

  it('một điểm dừng Tab, tên nói đủ tổng · cao nhất · hôm nay; số nằm cả trong bảng ẩn', async () => {
    const { container } = render(
      <DayStrip days={days} today="2026-09-24" label="Chân trước · 14 ngày" />,
    )
    const g = screen.getByRole('group', {
      name: 'Chân trước · 14 ngày: tổng 160 trong 3 ngày, cao nhất 23/09 120, hôm nay 40',
    })
    expect(container.textContent).toContain('23/09: 120')
    await expectNoViolations(container)
    await userEvent.tab()
    expect(document.activeElement).toBe(g)
  })

  it('mũi tên đi từng ngày, ô rê hiện SỐ trước rồi ngày + phiếu; Enter mở ngày đó', async () => {
    const onPick = vi.fn()
    render(<DayStrip days={days} today="2026-09-24" label="Chân" onPick={onPick} />)
    await userEvent.tab()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    const tip = screen.getByRole('tooltip')
    expect(tip.textContent).toBe('120 · 23/09 · 2 phiếu')
    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith(days[1])
  })
})

describe('MiniBars', () => {
  it('một chuỗi: không chú giải; số ở đầu thanh bằng mực chữ', () => {
    render(
      <MiniBars
        label="Theo công đoạn"
        rows={[
          { id: 'phoi', label: 'Phôi', value: 0.62 },
          { id: 'han', label: 'Hàn', value: 1 },
        ]}
      />,
    )
    expect(screen.queryByText('Nội bộ')).toBeNull()
    expect(screen.getByText('62%')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('hai chuỗi: chú giải LUÔN hiện (màu phụ chỉ qua ngưỡng mù màu khi có mã phụ)', () => {
    render(
      <MiniBars
        label="Nội bộ và gia công ngoài"
        series={['Nội bộ', 'GC ngoài']}
        rows={[{ id: 'son', label: 'Sơn', value: 0.4, value2: 0.2 }]}
      />,
    )
    expect(screen.getByText('Nội bộ')).toBeTruthy()
    expect(screen.getByText('GC ngoài')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
  })

  // B7½: phần tách hai chuỗi từng chỉ nằm trong thanh (ẩn) và `title` (chỉ chuột).
  it('hai chuỗi: mỗi dòng có chữ ẩn nêu TÊN + SỐ của từng chuỗi', () => {
    const { container } = render(
      <MiniBars
        label="Nội bộ và gia công ngoài"
        series={['Nội bộ', 'GC ngoài']}
        max={400}
        rows={[
          { id: 'son', label: 'Sơn', value: 220, value2: 60 },
          { id: 'dg', label: 'Đóng gói', value: 40 },
        ]}
      />,
    )
    const dong = container.querySelectorAll('li')
    const an = (i: number) =>
      [...dong[i].querySelectorAll('.sr-only')].map((x) => x.textContent).join(' ')
    expect(an(0)).toContain('Nội bộ 220')
    expect(an(0)).toContain('GC ngoài 60')
    // Dòng chỉ có chuỗi chính vẫn nói rõ chuỗi phụ bằng 0 — không để người nghe đoán.
    expect(an(1)).toContain('Nội bộ 40')
    expect(an(1)).toContain('GC ngoài 0')
  })

  it('hai chuỗi dạng TỈ LỆ (max = 1): chữ ẩn đọc phần trăm, không đọc "0,55"', () => {
    const { container } = render(
      <MiniBars
        label="Tỉ lệ"
        series={['Nội bộ', 'GC ngoài']}
        rows={[{ id: 'son', label: 'Sơn', value: 0.55, value2: 0.2 }]}
      />,
    )
    const an = container.querySelector('li .sr-only')!.textContent
    expect(an).toBe('Nội bộ 55%, GC ngoài 20%')
  })

  it('một chuỗi: không thêm chữ ẩn thừa', () => {
    const { container } = render(
      <MiniBars label="x" rows={[{ id: 'a', label: 'Phôi', value: 0.5 }]} />,
    )
    expect(container.querySelectorAll('li .sr-only')).toHaveLength(0)
  })

  it('tầng kiểu: dòng có value2 mà thiếu series là lỗi biên dịch', () => {
    const el = (
      // @ts-expect-error — có `value2` thì `series` bắt buộc (thành chú giải + chữ ẩn).
      <MiniBars label="x" rows={[{ id: 'a', label: 'Sơn', value: 0.4, value2: 0.2 }]} />
    )
    expect(el).toBeTruthy()
  })
})

describe('MatrixTable — bảng chéo', () => {
  type SP = {
    id: string
    ma: string
    sl: number
    phoi: number | null
    son: number | null
  }
  const rows: SP[] = [
    { id: 'a', ma: 'FDA50089N', sl: 400, phoi: 250, son: null },
    { id: 'b', ma: 'FDA50090N', sl: 200, phoi: 0, son: 0 },
  ]
  const cd = (id: 'phoi' | 'son', header: string): MatrixCol<SP> => ({
    id,
    header,
    num: true,
    cell: (r) => (r[id] == null ? NGOAI_LO_TRINH : r[id]),
  })

  function Bang({ onCell }: { onCell?: (r: SP, c: string) => void }) {
    return (
      <MatrixTable
        label="Bảng đồng bộ"
        rows={rows}
        rowKey={(r) => r.id}
        pinned={[
          { id: 'ma', header: 'Mã SP', width: 120, cell: (r) => r.ma },
          {
            id: 'sl',
            header: 'SL bộ',
            width: 70,
            num: true,
            foot: 600,
            cell: (r) => r.sl,
          },
        ]}
        groups={[
          { id: 'cd', header: 'Công đoạn', cols: [cd('phoi', 'Phôi'), cd('son', 'Sơn')] },
          {
            id: 'kl',
            header: 'Kết luận',
            cols: [{ id: 'du', header: 'Bộ hoàn chỉnh', pick: false, cell: () => 0 }],
          },
        ]}
        onCell={onCell}
        foot={{ label: 'Cộng 2 SP', note: 'Bộ hoàn chỉnh = công đoạn chậm nhất' }}
      />
    )
  }

  it('tiêu đề HAI tầng: nhóm là colgroup, ô đầu dòng là tiêu đề dòng; qua axe', async () => {
    const { container } = render(<Bang />)
    const nhom = screen.getByRole('columnheader', { name: 'Công đoạn' })
    expect(nhom.getAttribute('scope')).toBe('colgroup')
    expect((nhom as HTMLTableCellElement).colSpan).toBe(2)
    expect(screen.getByRole('rowheader', { name: 'FDA50089N' })).toBeTruthy()
    await expectNoViolations(container)
  })

  it('ô ngoài lộ trình khác ô 0: gạch + nền sọc, trình đọc nghe "ngoài lộ trình"', () => {
    render(<Bang />)
    const dongA = screen.getByRole('rowheader', { name: 'FDA50089N' }).closest('tr')!
    const off = dongA.querySelector('.k-mx-off')!
    expect(off.textContent).toBe('–ngoài lộ trình')
    const dongB = screen.getByRole('rowheader', { name: 'FDA50090N' }).closest('tr')!
    expect(dongB.querySelector('.k-mx-off')).toBeNull()
  })

  it('chuông canh lệch cột KHÔNG báo oan bảng hai tầng tiêu đề', () => {
    const loi = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Bang />)
    expect(loi.mock.calls.filter((c) => String(c[0]).includes('LỆCH CỘT'))).toEqual([])
    loi.mockRestore()
  })

  it('chân bảng tự khớp số cột với tiêu đề (tính cả tầng hai)', () => {
    render(<Bang />)
    const t = document.querySelector('table')!
    const dem = (q: string) =>
      [...t.querySelectorAll(q)].reduce((a, c) => a + ((c as HTMLTableCellElement).colSpan || 1), 0) // prettier-ignore
    // Cột lá = 2 cột ghim + 3 cột trong nhóm.
    const la = 2 + t.querySelectorAll('thead tr:nth-child(2) th').length
    expect(dem('tfoot td')).toBe(la)
    expect(t.querySelector('tfoot')!.textContent).toContain(
      'Bộ hoàn chỉnh = công đoạn chậm nhất',
    )
  })

  it('có onCell: ô công đoạn là NÚT; cột kết luận (pick: false) và ô sọc thì không', async () => {
    const onCell = vi.fn()
    render(<Bang onCell={onCell} />)
    const dongB = screen.getByRole('rowheader', { name: 'FDA50090N' }).closest('tr')!
    const nut = within(dongB).getAllByRole('button')
    expect(nut).toHaveLength(2) // Phôi + Sơn; không có "Bộ hoàn chỉnh"
    await userEvent.click(nut[1])
    expect(onCell).toHaveBeenCalledWith(rows[1], 'son')
    const dongA = screen.getByRole('rowheader', { name: 'FDA50089N' }).closest('tr')!
    expect(within(dongA).getAllByRole('button')).toHaveLength(1) // Sơn ngoài lộ trình
  })
})
