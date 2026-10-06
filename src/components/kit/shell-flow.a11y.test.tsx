// @vitest-environment happy-dom
import { act, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CommandBar,
  Empty,
  InspectPanel,
  InspectSection,
  NavRail,
  NoteComposer,
  PrimaryStep,
  TopBar,
  UserCard,
  WhyBox,
  WorkLanes,
  type NavGroup,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/*
  `next/link` bọc thêm một dấu `data-next-link` — để test phân biệt được link
  của Next với thẻ `<a>` trần. Nhìn DOM thì hai thứ giống hệt nhau (Link cũng
  ra `<a href>`), khác nhau ở chỗ bấm vào: `<a>` trần tải lại CẢ TRANG. Hành vi
  đó happy-dom không mô phỏng được, nên canh ở chỗ dựng.
*/
vi.mock('next/link', async (orig) => {
  const m = await orig<typeof import('next/link')>()
  const L = m.default
  function DauLink(props: React.ComponentProps<typeof L>) {
    return <L {...props} data-next-link="" />
  }
  return { ...m, default: DauLink }
})

/**
 * TEST TRUY CẬP cho tầng VỎ + LUỒNG của kit — đợt B7½
 * (docs/he-thiet-ke-erp-ke-hoach.md §9.9).
 *
 * Mỗi ca dưới đây ghi một lỗi mà B7 tìm ra lúc viết mục "truy cập" của sách tra
 * (`/design-lab/thanh-phan/*`). Viết TRƯỚC khi sửa, chạy thấy đỏ trên mã cũ,
 * rồi mới sửa — đỏ-trước là bằng chứng test canh đúng chỗ, không phải lời
 * khẳng định viết sau khi đã xong.
 */

afterEach(cleanup)

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

const GROUPS: NavGroup[] = [
  {
    heading: 'Việc',
    items: [
      { href: '/hop-thu', label: 'Hộp thư', icon: <span aria-hidden>▣</span>, count: 7 },
      {
        href: '/don',
        label: 'Đơn mua',
        icon: <span aria-hidden>▤</span>,
        count: 3,
        countTone: 'warn',
      },
    ],
  },
]

function Rail({ expanded = false }: { expanded?: boolean }) {
  const [mo, setMo] = useState(expanded)
  return (
    <NavRail
      groups={GROUPS}
      activeHref="/don"
      expanded={mo}
      onToggle={() => setMo((x) => !x)}
      brand={<span>CƯ</span>}
    />
  )
}

describe('NavRail — rail điều hướng', () => {
  it('là mốc "Điều hướng chính" — hai <nav> trên một trang phải phân biệt được', () => {
    render(<Rail />)
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeTruthy()
  })

  it('thu gọn: link chỉ có icon vẫn có TÊN — chính nhãn của mục', () => {
    render(<Rail />)
    expect(screen.getByRole('link', { name: 'Hộp thư' })).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Đơn mua' }).getAttribute('aria-current'),
    ).toBe('page')
  })

  it('thu gọn: chấm số việc theo tone của số — warn là vàng, không phải xanh hành động', () => {
    const { container } = render(<Rail />)
    const cham = [...container.querySelectorAll('a [data-count-dot]')]
    expect(cham).toHaveLength(2)
    // Mục "Đơn mua" đếm tone warn.
    expect(cham[1].className).toContain('var(--warn)')
    expect(cham[1].className).not.toContain('var(--act)')
  })

  it('nút thu/mở: type="button" và aria-expanded nói thật', async () => {
    render(<Rail />)
    const nut = screen.getByRole('button', { name: 'Mở rộng menu' })
    expect(nut.getAttribute('type')).toBe('button')
    expect(nut.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(nut)
    expect(
      screen.getByRole('button', { name: 'Thu gọn menu' }).getAttribute('aria-expanded'),
    ).toBe('true')
  })

  it('không vi phạm luật truy cập (thu gọn lẫn mở rộng)', async () => {
    const { container, unmount } = render(<Rail />)
    await expectNoViolations(container)
    unmount()
    const r = render(<Rail expanded />)
    await expectNoViolations(r.container)
  })
})

describe('UserCard — thẻ người dùng', () => {
  it('thu gọn: ô tròn NHẬN TIÊU ĐIỂM và có tên — tooltip không còn chỉ dành cho chuột', async () => {
    render(<UserCard initials="TM" name="Trần Minh" sub="Cung ứng" />)
    const o = screen.getByRole('img', { name: 'Trần Minh' })
    expect(o.getAttribute('tabindex')).toBe('0')
    await userEvent.tab()
    expect(document.activeElement).toBe(o)
    // Radix gắn mô tả vào CHÍNH ô tròn khi tooltip mở.
    const id = o.getAttribute('aria-describedby')
    expect(id && document.getElementById(id)?.textContent).toBe('Trần Minh · Cung ứng')
  })
})

describe('TopBar — thanh trên', () => {
  const CRUMBS = [{ label: 'Đơn mua', href: '/mua-hang/don' }, { label: 'PO-2608-097' }]

  it('đường dẫn là mốc "Đường dẫn"; mảnh cuối aria-current="page"', () => {
    render(<TopBar crumbs={CRUMBS} onSearch={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Đường dẫn' })
    const cuoi = [...nav.querySelectorAll('[aria-current]')]
    expect(cuoi.map((x) => x.textContent)).toEqual(['PO-2608-097'])
    expect(cuoi[0].getAttribute('aria-current')).toBe('page')
  })

  it('mảnh có href đi bằng next/link — không tải lại cả trang', () => {
    render(<TopBar crumbs={CRUMBS} onSearch={() => {}} />)
    const a = screen.getByRole('link', { name: 'Đơn mua' })
    expect(a.hasAttribute('data-next-link')).toBe(true)
  })

  it('không có onSearch thì KHÔNG vẽ ô tìm — không để một nút chết', () => {
    render(<TopBar crumbs={CRUMBS} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ô tìm là type="button" — nằm trong <form> cũng không nộp form', () => {
    render(<TopBar crumbs={CRUMBS} onSearch={() => {}} />)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('không vi phạm luật truy cập, kể cả đứng CẠNH NavRail', async () => {
    const { container } = render(
      <>
        <Rail />
        <TopBar crumbs={CRUMBS} onSearch={() => {}} />
      </>,
    )
    await expectNoViolations(container)
  })
})

describe('CommandBar — thanh lệnh', () => {
  const USER = { initials: 'NA', name: 'Nguyễn Văn A', role: 'Cung ứng' }
  const CRUMBS = [{ label: 'Kho', href: '/kho' }, { label: 'Phiếu nhập' }]

  function datNenTang(p: string) {
    Object.defineProperty(navigator, 'platform', { value: p, configurable: true })
  }
  afterEach(() => datNenTang('Win32'))

  it('đường dẫn là mốc "Đường dẫn"; mảnh cuối aria-current="page"', () => {
    render(<CommandBar brand="HG" crumbs={CRUMBS} user={USER} onSearch={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Đường dẫn' })
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Phiếu nhập')
  })

  it('không onSearch thì không có ô tìm; có thì là type="button"', () => {
    const { unmount } = render(<CommandBar brand="HG" crumbs={CRUMBS} user={USER} />)
    expect(screen.queryByRole('button')).toBeNull()
    unmount()
    render(<CommandBar brand="HG" crumbs={CRUMBS} user={USER} onSearch={() => {}} />)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  it('máy KHÔNG phải Mac thì gợi ý "Ctrl K", không phải ⌘', () => {
    datNenTang('Win32')
    render(<CommandBar brand="HG" crumbs={CRUMBS} user={USER} onSearch={() => {}} />)
    const kbd = [...screen.getByRole('button').querySelectorAll('kbd')]
    expect(kbd.map((k) => k.textContent)).toEqual(['Ctrl', 'K'])
  })

  it('HTML dựng ở server luôn là "Ctrl"; hydrate trên Mac mới đổi ⌘ — không lệch hydrate', async () => {
    datNenTang('MacIntel')
    const el = <CommandBar brand="HG" crumbs={CRUMBS} user={USER} onSearch={() => {}} />
    const html = renderToString(el)
    // Server không biết máy người xem → luôn "Ctrl".
    expect(html).toContain('Ctrl')
    expect(html).not.toContain('⌘')

    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    // `act` gọi TRỰC TIẾP (ngoài `render` của Testing Library) cần cờ này, không
    // thì React tự báo "not configured to support act" qua console.error — và
    // test đọc nhầm đó thành lệch hydrate.
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    const coCu = g.IS_REACT_ACT_ENVIRONMENT
    g.IS_REACT_ACT_ENVIRONMENT = true
    const loi = vi.spyOn(console, 'error').mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    try {
      await act(async () => {
        root = hydrateRoot(host, el, { onRecoverableError: (e) => console.error(e) })
      })
      // Lệch hydrate thì React báo qua console.error / onRecoverableError.
      expect(loi).not.toHaveBeenCalled()
      expect(host.querySelector('kbd')?.textContent).toBe('⌘')
    } finally {
      // Dọn trong `finally`: host gắn thẳng vào <body>, test hỏng mà không dọn
      // thì nút/link của nó lọt sang các test SAU (đếm thừa nút, Tab lạc chỗ).
      loi.mockRestore()
      act(() => root?.unmount())
      host.remove()
      g.IS_REACT_ACT_ENVIRONMENT = coCu
    }
  })

  it('TopBar dùng chung luật phím: Windows ra "Ctrl"', () => {
    datNenTang('Win32')
    render(<TopBar crumbs={[{ label: 'Đơn mua' }]} onSearch={() => {}} />)
    expect(screen.getByRole('button').querySelector('kbd')?.textContent).toBe('Ctrl')
  })

  it('không vi phạm luật truy cập', async () => {
    const { container } = render(
      <CommandBar brand="HG" crumbs={CRUMBS} user={USER} onSearch={() => {}} />,
    )
    await expectNoViolations(container)
  })
})

describe('InspectPanel — khay kiểm tra', () => {
  it('<aside> có tên theo mã + việc — hai khay/hai mốc bổ sung phân biệt được', () => {
    render(
      <InspectPanel code="PO-2608-097" title="Nhập đơn giá rồi gửi duyệt">
        <p>thân</p>
      </InspectPanel>,
    )
    expect(
      screen.getByRole('complementary', {
        name: 'PO-2608-097 — Nhập đơn giá rồi gửi duyệt',
      }),
    ).toBeTruthy()
  })

  it('InspectSection nhận `level` — màn chỉ có h1 thì không nhảy cóc xuống h4', async () => {
    const { container } = render(
      <>
        <h1>Hộp thư</h1>
        <InspectPanel code="PO-1" title="Việc">
          <InspectSection title="Đến lượt ai" level={2}>
            <p>x</p>
          </InspectSection>
        </InspectPanel>
      </>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Đến lượt ai' })).toBeTruthy()
    await expectNoViolations(container)
  })

  it('mặc định vẫn là h4 — không đổi dàn tiêu đề của màn đang dùng', () => {
    render(
      <InspectSection title="Chuỗi chứng từ">
        <p>x</p>
      </InspectSection>,
    )
    expect(screen.getByRole('heading', { level: 4, name: 'Chuỗi chứng từ' })).toBeTruthy()
  })
})

describe('Empty — trạng thái rỗng (B7½)', () => {
  it('là vùng status — lọc hết dòng thì trình đọc được báo', () => {
    render(<Empty headline="Không còn đơn nào" reason="Bộ lọc quá hẹp." next={null} />)
    expect(screen.getByRole('status').textContent).toContain('Không còn đơn nào')
  })

  it('`level` biến dòng đầu thành thẻ tiêu đề; mặc định vẫn là div', () => {
    const { unmount } = render(
      <Empty
        headline="Không còn đơn nào"
        reason="Bộ lọc quá hẹp."
        next={null}
        level={2}
      />,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'Không còn đơn nào' }),
    ).toBeTruthy()
    unmount()
    render(<Empty headline="Không còn đơn nào" reason="Bộ lọc quá hẹp." next={null} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})

describe('WorkLanes — hàng đợi việc', () => {
  const LANES = [
    { id: 'late', label: 'Trễ', rows: [1, 2], tone: 'stop' as const },
    { id: 'today', label: 'Hôm nay', rows: [3] },
    { id: 'soon', label: 'Sắp tới', rows: [] as number[] },
  ]

  function Lanes({ panelId }: { panelId?: string }) {
    const [id, setId] = useState('late')
    return (
      <>
        <WorkLanes lanes={LANES} activeId={id} onPick={setId} panelId={panelId} />
        {panelId && (
          <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${id}`}>
            làn {id}
          </div>
        )}
      </>
    )
  }

  it('tab là type="button"', () => {
    render(<Lanes />)
    for (const t of screen.getAllByRole('tab'))
      expect(t.getAttribute('type')).toBe('button')
  })

  it('Tab chỉ dừng ở tab ĐANG CHỌN; ← → Home End đi giữa các tab và chọn luôn', async () => {
    render(<Lanes />)
    const [tre, homNay, sapToi] = screen.getAllByRole('tab')
    expect(tre.getAttribute('tabindex')).toBe('0')
    expect(homNay.getAttribute('tabindex')).toBe('-1')

    await userEvent.tab()
    expect(document.activeElement).toBe(tre)
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(homNay)
    expect(homNay.getAttribute('aria-selected')).toBe('true')
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(sapToi)
    // Ở tab cuối, → vòng về tab đầu.
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(tre)
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(sapToi)
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(tre)
    expect(tre.getAttribute('aria-selected')).toBe('true')
  })

  it('có panelId thì tab TRỎ tới vùng nội dung; vùng mang tên theo tab', async () => {
    const { container } = render(<Lanes panelId="hop-thu-lan" />)
    for (const t of screen.getAllByRole('tab'))
      expect(t.getAttribute('aria-controls')).toBe('hop-thu-lan')
    expect(screen.getByRole('tabpanel', { name: /Trễ/ })).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('WhyBox — phép tính bày ra', () => {
  it('GIỮ khoảng trắng — cột dóng bằng dấu cách không bị gộp lệch', () => {
    const { container } = render(
      <WhyBox lines={['Đã giao     12', 'Còn lại      3']} result="15" />,
    )
    const dong = [...container.firstElementChild!.children].slice(0, 2)
    expect(dong.map((d) => d.textContent)).toEqual(['Đã giao     12', 'Còn lại      3'])
    for (const d of dong) expect(d.className).toContain('whitespace-pre-wrap')
  })
})

describe('PrimaryStep — nút việc tiếp theo', () => {
  const WHY = 'Dòng NK-0056 chưa có đơn giá.'

  it('`why`: khoá MỀM — Tab tới được, bấm không ăn, lý do gắn vào nút', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <PrimaryStep label="Gửi Giám đốc duyệt" onClick={onClick} why={WHY} />,
    )
    const b = screen.getByRole('button', { name: 'Gửi Giám đốc duyệt' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { description: WHY })).toBe(b)
    await userEvent.tab()
    expect(document.activeElement).toBe(b)
    await userEvent.click(b)
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
    // Câu lý do vẫn IN RA cho người nhìn — không giấu trong tooltip.
    expect(screen.getByText(WHY)).toBeTruthy()
    await expectNoViolations(container)
  })

  it('`why` + `href`: vẫn là nút khoá, không điều hướng', () => {
    render(<PrimaryStep label="Mở chứng từ" href="/x" why={WHY} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('button', { name: 'Mở chứng từ' })).toBeTruthy()
  })

  it('không khoá thì bấm được như thường', async () => {
    const onClick = vi.fn()
    render(<PrimaryStep label="Gửi duyệt" onClick={onClick} />)
    await userEvent.click(screen.getByRole('button', { name: 'Gửi duyệt' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('NoteComposer — ô viết ghi chú', () => {
  it('hai nút người đọc: type="button" + aria-pressed nói đang chọn gì', async () => {
    render(<NoteComposer onSubmit={() => {}} partnerLabel="Gửi Thép Asia" />)
    const noiBo = screen.getByRole('button', { name: 'Ghi chú nội bộ' })
    const ngoai = screen.getByRole('button', { name: 'Gửi Thép Asia' })
    expect(noiBo.getAttribute('type')).toBe('button')
    expect(noiBo.getAttribute('aria-pressed')).toBe('true')
    expect(ngoai.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(ngoai)
    expect(ngoai.getAttribute('aria-pressed')).toBe('true')
    expect(noiBo.getAttribute('aria-pressed')).toBe('false')
  })

  it('lưu HỎNG thì chữ còn nguyên trong ô — không bắt người dùng gõ lại', async () => {
    const onSubmit = vi.fn(() => Promise.reject(new Error('500')))
    render(<NoteComposer onSubmit={onSubmit} />)
    const o = screen.getByRole('textbox') as HTMLTextAreaElement
    await userEvent.type(o, 'NCC báo trễ')
    await userEvent.click(screen.getByRole('button', { name: 'Ghi' }))
    expect(onSubmit).toHaveBeenCalledWith('NCC báo trễ', 'internal')
    // Cho Promise bị từ chối kịp chạy hết.
    await act(async () => {})
    expect(o.value).toBe('NCC báo trễ')
  })

  it('CHỜ lưu xong mới xoá ô; lưu được thì ô trống', async () => {
    let xong: () => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((r) => {
          xong = r
        }),
    )
    render(<NoteComposer onSubmit={onSubmit} />)
    const o = screen.getByRole('textbox') as HTMLTextAreaElement
    await userEvent.type(o, 'Đã gọi chị Hoa')
    await userEvent.click(screen.getByRole('button', { name: 'Ghi' }))
    // Đang lưu: chữ vẫn còn.
    expect(o.value).toBe('Đã gọi chị Hoa')
    await act(async () => xong())
    expect(o.value).toBe('')
  })

  it('onSubmit đồng bộ (không trả Promise) vẫn xoá ô như cũ', async () => {
    render(<NoteComposer onSubmit={() => {}} />)
    const o = screen.getByRole('textbox') as HTMLTextAreaElement
    await userEvent.type(o, 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Ghi' }))
    await waitFor(() => expect(o.value).toBe(''))
  })
})
