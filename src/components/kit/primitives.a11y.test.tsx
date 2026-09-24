// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Nhập THẲNG từ file, không qua `@/components/kit`: các file kit khác đang được
// sửa song song, lỗi dựng ở đó không được làm đỏ test của nguyên liệu.
import {
  Btn,
  Code,
  Loading,
  NoticeBar,
  Num,
  NumInput,
  TextArea,
  TextInput,
  Tick,
} from './Primitives'
import { Combobox } from './Combobox'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * TEST BÁNH CÓC cho B7½ — docs/he-thiet-ke-erp-ke-hoach.md §9.9.
 *
 * B7 viết trang tài liệu cho từng họ và ghi THẬT các lỗi truy cập / hành vi của
 * nguyên liệu (`Primitives.tsx`) và `Combobox`. Mỗi `describe` dưới đây ứng với
 * một lỗi trong danh sách đó; mọi test ĐỎ trên mã trước B7½ và XANH sau khi vá
 * — đỏ đã ghi lại lúc viết (báo cáo B7½). Sửa thành phần mà một test ở đây đỏ
 * lại là lỗi cũ quay về, đừng sửa test cho xanh.
 *
 * Ba chỗ là CSS thuần (NumInput căn trái, vùng bấm của Tick, giảm chuyển động)
 * — happy-dom không dựng bố cục nên không đo được kết quả nhìn thấy. Ở đó test
 * canh THỨ tạo ra kết quả (lớp, thuộc tính style) và chú thích nói vì sao thứ
 * đó đủ.
 */

afterEach(cleanup)

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

/* ── 1 · Btn có href ────────────────────────────────────────────────────── */

describe('Btn href — chuyển đủ thuộc tính xuống liên kết', () => {
  it('aria-label, id, target, rel, data-*, onClick tới được thẻ <a>', async () => {
    const onClick = vi.fn((e: React.MouseEvent) => e.preventDefault())
    const { container } = render(
      <Btn
        href="/mua-hang/don/1"
        icon="mo"
        aria-label="Mở đơn PO-2609-014"
        id="mo-don"
        target="_blank"
        rel="noopener"
        data-cell="0:1"
        onClick={onClick}
      >
        Mở
      </Btn>,
    )
    const a = screen.getByRole('link', { name: 'Mở đơn PO-2609-014' })
    expect(a.id).toBe('mo-don')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener')
    expect(a.getAttribute('data-cell')).toBe('0:1')
    await userEvent.click(a)
    expect(onClick).toHaveBeenCalledTimes(1)
    await expectNoViolations(container)
  })

  it('thuộc tính CHỈ của nút (type, form…, name, value) không rơi xuống <a>', () => {
    render(
      <Btn href="/x" type="submit" form="f1" name="n" value="v" formMethod="post">
        Đi
      </Btn>,
    )
    const a = screen.getByRole('link', { name: 'Đi' })
    for (const attr of ['type', 'form', 'name', 'value', 'formmethod', 'disabled'])
      expect(a.hasAttribute(attr), attr).toBe(false)
  })
})

/* ── 2 · type="button" ─────────────────────────────────────────────────── */

describe('type="button" — bấm trong <form> không nộp form', () => {
  it('Code as="button"', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    render(
      <form onSubmit={onSubmit}>
        <Code as="button">VT-00123</Code>
      </form>,
    )
    const b = screen.getByRole('button', { name: 'VT-00123' })
    expect(b.getAttribute('type')).toBe('button')
    await userEvent.click(b)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Code as="button" vẫn cho chỗ gọi đặt type khác', () => {
    render(
      <Code as="button" type="submit">
        VT-00123
      </Code>,
    )
    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  it('nút action của NoticeBar', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())
    const onAct = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <NoticeBar
          tag="Lệnh trống"
          action={{ label: 'Vật tư theo lệnh', onClick: onAct }}
        >
          3 lệnh chưa có đơn mua.
        </NoticeBar>
      </form>,
    )
    const b = screen.getByRole('button')
    expect(b.getAttribute('type')).toBe('button')
    await userEvent.click(b)
    expect(onAct).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

/* ── 3 · Prop rải cuối đè xử lý riêng ───────────────────────────────────── */

describe('NumInput / TextInput / TextArea — prop của chỗ gọi GHÉP, không ĐÈ', () => {
  it('NumInput: truyền onBlur thì onCommit VẪN được gọi, và onBlur của chỗ gọi cũng vậy', async () => {
    const onCommit = vi.fn()
    const onBlur = vi.fn()
    render(<NumInput aria-label="SL" value="1" onCommit={onCommit} onBlur={onBlur} />)
    const input = screen.getByRole('textbox', { name: 'SL' })
    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}1.5')
    await userEvent.tab()
    expect(onCommit).toHaveBeenCalledWith('1.5')
    expect(onBlur).toHaveBeenCalledTimes(1)
  })

  it('TextInput: truyền onKeyDown thì Enter vẫn chốt, Esc vẫn bỏ nháp', async () => {
    const onCommit = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <TextInput
        label="Quy cách"
        value="20x40"
        onCommit={onCommit}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Quy cách' }) as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('x1.2{Escape}')
    expect(input.value).toBe('20x40')
    await userEvent.keyboard('x1.2{Enter}')
    expect(onCommit).toHaveBeenCalledWith('20x40x1.2')
    expect(onKeyDown).toHaveBeenCalled()
  })

  it('TextInput: chỗ gọi preventDefault một phím thì ô NHƯỜNG phím đó (lưới tự đi ô)', async () => {
    const onCommit = vi.fn()
    render(
      <TextInput
        label="Ghi chú"
        value=""
        onCommit={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
      />,
    )
    const input = screen.getByRole('textbox', { name: 'Ghi chú' })
    await userEvent.click(input)
    await userEvent.keyboard('abc{Enter}')
    // Ô không tự blur — chỗ gọi đã nhận Enter (vd. lưới chuyển tiêu điểm).
    expect(document.activeElement).toBe(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('className của chỗ gọi CỘNG vào kiểu của ô, không xoá kiểu', () => {
    render(
      <>
        <NumInput aria-label="n" value="" onCommit={() => {}} className="mt-1" />
        <TextInput label="t" value="" onCommit={() => {}} className="mt-1" />
        <TextArea aria-label="a" value="" onChange={() => {}} className="mt-1" />
      </>,
    )
    for (const name of ['n', 't', 'a']) {
      const el = screen.getByRole('textbox', { name })
      expect(el.classList.contains('mt-1'), name).toBe(true)
      expect(el.classList.contains('border'), name).toBe(true)
      expect(el.classList.contains('w-full'), name).toBe(true)
    }
  })
})

/* ── 4 · NumInput align="left" ─────────────────────────────────────────── */

describe('NumInput align="left"', () => {
  /*
    CSS thuần: `.kit .num` (tokens.css, NGOÀI mọi @layer) thắng lớp tiện ích
    `text-left` (nằm trong @layer utilities) — lớp ngoài layer luôn thắng lớp
    trong layer, bất kể độ ưu tiên. Chỉ khai báo INLINE mới thắng nó. Nên test
    canh đúng thứ đó: có `text-align: left` inline. Trình duyệt thật thì mở
    /design-lab/thanh-phan/num-input mà nhìn.
  */
  it('căn trái bằng style inline — thứ duy nhất thắng .kit .num', () => {
    render(<NumInput aria-label="m3" value="0.035" onCommit={() => {}} align="left" />)
    const el = screen.getByRole('textbox', { name: 'm3' }) as HTMLInputElement
    expect(el.style.textAlign).toBe('left')
  })

  it('mặc định (phải) không gắn style — để .num lo', () => {
    render(<NumInput aria-label="sl" value="1" onCommit={() => {}} />)
    const el = screen.getByRole('textbox', { name: 'sl' }) as HTMLInputElement
    expect(el.style.textAlign).toBe('')
  })
})

/* ── 5 · Loading ───────────────────────────────────────────────────────── */

describe('Loading — báo "đang tải" cho trình đọc, tôn trọng giảm chuyển động', () => {
  it('role="status" có chữ ẩn "Đang tải…"; khung xương aria-hidden', async () => {
    const { container } = render(<Loading rows={2} />)
    const st = screen.getByRole('status')
    expect(st.textContent).toContain('Đang tải…')
    const skel = st.querySelector('[aria-hidden="true"]')
    expect(skel).toBeTruthy()
    expect(skel?.children).toHaveLength(2)
    await expectNoViolations(container)
  })

  /*
    Giảm chuyển động là media query — happy-dom không giả được. Canh lớp:
    nhấp nháy chỉ chạy dưới `motion-safe:` (tức `prefers-reduced-motion:
    no-preference`), KHÔNG còn lớp trần chạy vô điều kiện.
  */
  it('nhấp nháy chỉ dưới motion-safe', () => {
    const { container } = render(<Loading rows={1} />)
    const cls = [...container.querySelectorAll('*')].map((e) => e.className).join(' ')
    expect(cls).toContain('motion-safe:animate-pulse')
    expect(cls.split(/\s+/)).not.toContain('animate-pulse')
  })

  it('vòng quay của Btn busy chỉ dưới motion-safe', () => {
    const { container } = render(<Btn busy>Đang lưu…</Btn>)
    const spin = container.querySelector('button > span[aria-hidden]')
    expect(spin?.className).toContain('motion-safe:animate-spin')
    expect(spin?.className.split(/\s+/)).not.toContain('animate-spin')
  })
})

/* ── 6 · NoticeBar ─────────────────────────────────────────────────────── */

describe('NoticeBar — dải hiện ra thì được thông báo', () => {
  it('tone thường → role="status" (lịch sự)', async () => {
    const { container } = render(
      <NoticeBar tag="Cắt đuôi">Sổ chạm trần 1.000 đơn.</NoticeBar>,
    )
    expect(screen.getByRole('status').textContent).toContain('Sổ chạm trần')
    await expectNoViolations(container)
  })

  it('tone stop → role="alert" (chen ngang)', () => {
    render(
      <NoticeBar tone="stop" tag="Chặn gửi">
        Chưa có hạn mức duyệt.
      </NoticeBar>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Chưa có hạn mức duyệt')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tên nút action không kèm mũi tên "→"', () => {
    render(
      <NoticeBar
        tag="Lệnh trống"
        action={{ label: 'Vật tư theo lệnh', onClick: () => {} }}
      >
        3 lệnh.
      </NoticeBar>,
    )
    expect(screen.getByRole('button', { name: 'Vật tư theo lệnh' })).toBeTruthy()
  })
})

/* ── 7 · Num rỗng ──────────────────────────────────────────────────────── */

describe('Num — nghĩa của ô rỗng đọc được, không chỉ nằm trong title', () => {
  it('dash → "Chưa có số", done → "Không còn phải làm" (chữ ẩn); ký hiệu aria-hidden', () => {
    const { container } = render(
      <>
        <Num value="" />
        <Num value="" zero="done" />
      </>,
    )
    expect(screen.getByText('Chưa có số').className).toContain('sr-only')
    expect(screen.getByText('Không còn phải làm').className).toContain('sr-only')
    for (const g of ['—', '✓']) {
      const glyph = screen.getByText(g)
      expect(glyph.getAttribute('aria-hidden'), g).toBe('true')
    }
    // Giữ title cho người dùng chuột.
    expect(container.querySelector('[title="Chưa có số"]')).toBeTruthy()
    expect(container.querySelector('[title="Không còn phải làm"]')).toBeTruthy()
  })
})

/* ── 8 · Tick vùng bấm ─────────────────────────────────────────────────── */

describe('Tick — vùng bấm ≥ 24×24 mà ô vẫn 13px', () => {
  /*
    Kích thước là CSS — happy-dom không đo được. Canh hai thứ: (1) lớp đệm
    `p-1.5` + lề âm `-m-1.5` quanh ô 13px → 13 + 2×6 = 25px vùng bấm, lề âm
    trả lại đúng chỗ cũ trong bố cục; (2) bấm vào phần ĐỆM (không trúng ô) cũng
    tick, và không nổi bọt lên dòng.
  */
  it('bấm vào phần đệm quanh ô cũng tick, không mở dòng', async () => {
    const onChange = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <Tick label="Chọn PO-2609-014" checked={false} onChange={onChange} />
      </div>,
    )
    const box = screen.getByRole('checkbox', { name: 'Chọn PO-2609-014' })
    const pad = box.parentElement as HTMLElement
    expect(pad.className).toContain('p-1.5')
    expect(pad.className).toContain('-m-1.5')
    await userEvent.click(pad)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('bấm thẳng vào ô: đúng MỘT lần onChange, không nổi bọt', async () => {
    const onChange = vi.fn()
    const onRow = vi.fn()
    render(
      <div onClick={onRow}>
        <Tick label="Chọn" checked={false} onChange={onChange} />
      </div>,
    )
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(true)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('khoá thì phần đệm cũng không tick', async () => {
    const onChange = vi.fn()
    render(<Tick label="Khoá" checked={false} onChange={onChange} disabled />)
    await userEvent.click(screen.getByRole('checkbox').parentElement as HTMLElement)
    expect(onChange).not.toHaveBeenCalled()
  })
})

/* ── 9 · Combobox kiểu TRA: lỗi + vùng thông báo ───────────────────────── */

describe('Combobox kiểu TRA — search lỗi thì NÓI, kết quả được thông báo', () => {
  const ROWS = [
    { value: 'v1', label: 'THÉP HỘP 20x40' },
    { value: 'v2', label: 'THÉP HỘP 30x60' },
  ]

  function Tra({ search }: { search: (q: string) => Promise<typeof ROWS> }) {
    return (
      <Combobox
        label="Thêm vật tư"
        search={search}
        onPick={() => {}}
        keyOf={(r) => r.value}
        render={(r) => r.label}
      />
    )
  }

  it('search bị từ chối → dòng lỗi trong danh sách, gõ tiếp là tra lại', async () => {
    let fail = true
    const search = vi.fn(async (q: string) => {
      if (fail) throw new Error('mạng rớt')
      return ROWS.filter((r) => r.label.includes(q.toUpperCase()))
    })
    render(<Tra search={search} />)
    const input = screen.getByRole('combobox', { name: 'Thêm vật tư' })
    await userEvent.click(input)
    await userEvent.keyboard('thép')
    const err = await screen.findByText('Không tra được: mạng rớt')
    expect(screen.getByRole('listbox').contains(err)).toBe(true)
    fail = false
    await userEvent.keyboard(' hộp')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    expect(screen.queryByText(/Không tra được/)).toBeNull()
  })

  it('MỘT vùng status lịch sự, nói số kết quả SAU khi kết quả về', async () => {
    const search = vi.fn(async () => ROWS)
    render(<Tra search={search} />)
    const live = screen.getByRole('status')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('')
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('thép')
    await waitFor(() => expect(live.textContent).toBe('2 kết quả'))
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('không có dòng nào → vùng status nói rỗng', async () => {
    render(<Tra search={async () => []} />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.keyboard('zzz')
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Không thấy mã nào khớp.'),
    )
  })
})

/* ── 10 · TextArea maxRows ─────────────────────────────────────────────── */

describe('TextArea maxRows — tự nở theo nội dung tới trần', () => {
  /*
    `field-sizing: content` là CSS — happy-dom không dựng bố cục nên không đo
    được chiều cao thật. Canh khai báo: trần cao = maxRows dòng (đơn vị `lh`),
    sàn = rows dòng, và cờ field-sizing có mặt.
  */
  it('có maxRows → style gắn sàn/trần theo dòng + field-sizing', () => {
    render(<TextArea aria-label="Lý do" value="" onChange={() => {}} maxRows={6} />)
    const el = screen.getByRole('textbox', { name: 'Lý do' }) as HTMLTextAreaElement
    expect(el.style.maxHeight).toContain('6lh')
    expect(el.style.minHeight).toContain('3lh')
    expect(el.getAttribute('style')).toContain('field-sizing')
  })

  it('không maxRows → như cũ, không style', () => {
    render(<TextArea aria-label="Ghi chú" value="" onChange={() => {}} />)
    const el = screen.getByRole('textbox', { name: 'Ghi chú' })
    expect(el.getAttribute('style')).toBeNull()
  })
})

/* ── Btn — `aria-disabled` của chỗ gọi là KHOÁ MỀM ─────────────────────── */

describe('Btn aria-disabled từ chỗ gọi', () => {
  /*
    B7½: trước đây Btn đặt `aria-disabled` SAU prop của chỗ gọi nên giá trị
    chỗ gọi truyền bị đè thành undefined — nút trông bấm được và bấm CHẠY.
  */
  it('giữ aria-disabled, nuốt cú bấm, vẫn Tab tới, không thành link dù có href', async () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <Btn icon="gui" aria-disabled onClick={onClick}>
        Gửi duyệt
      </Btn>,
    )
    const b = screen.getByRole('button', { name: 'Gửi duyệt' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b).toHaveProperty('disabled', false)
    await userEvent.tab()
    expect(document.activeElement).toBe(b)
    await userEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
    rerender(
      <Btn aria-disabled href="/x">
        Mở đơn
      </Btn>,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('button', { name: 'Mở đơn' })).toBeTruthy()
  })
})
