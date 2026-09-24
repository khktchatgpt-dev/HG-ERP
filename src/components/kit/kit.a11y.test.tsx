// @vitest-environment happy-dom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Btn,
  Combobox,
  DateInput,
  Empty,
  Ico,
  Menu,
  Popover,
  Sheet,
  SheetActions,
  Tip,
  ToastProvider,
  useToast,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * TEST DỰNG + TRUY CẬP cho kit — kế hoạch hệ thiết kế
 * (docs/he-thiet-ke-erp-ke-hoach.md §7, §9).
 *
 * B0 (24/09/2026): dựng bộ khung, và ghi hai lỗi đã biết của `Sheet` bằng
 * `it.fails` — test SAI có chủ đích, làm bánh cóc.
 * B1 (24/09/2026): bốn lớp phủ đứng trên Radix. Hai `it.fails` ĐÃ CHUYỂN ĐỎ
 * đúng như dự tính khi `Sheet` sang Radix Dialog, và được đổi thành `it` — đó
 * chính là bằng chứng lỗi đã được vá, không phải lời khẳng định.
 *
 * CHẠY `axe` TRÊN CHÍNH LỚP PHỦ, KHÔNG TRÊN CẢ TRANG. Hộp modal (Sheet, Menu)
 * đánh dấu `aria-hidden` cho phần còn lại của trang — đúng ý đồ: trình đọc màn
 * hình chỉ được thấy hộp. Chạy `axe` trên cả trang thì luật `aria-hidden-focus`
 * báo oan các nút phía sau, trong khi bẫy focus đã khiến không ai Tab tới được.
 */

afterEach(cleanup)

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

describe('Empty — trạng thái rỗng', () => {
  it('nói đủ ba thứ: chuyện gì, vì sao, làm gì tiếp', async () => {
    const { container } = render(
      <Empty
        headline="Chưa có phiếu nào"
        reason="Lệnh chưa được định hình chi tiết."
        next={<Btn>Định hình chi tiết</Btn>}
      />,
    )
    expect(screen.getByText('Chưa có phiếu nào')).toBeTruthy()
    expect(screen.getByText('Lệnh chưa được định hình chi tiết.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Định hình chi tiết' })).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('Ico — icon khái niệm', () => {
  it('không nhãn = trang trí: ẩn khỏi trình đọc, KHÔNG chen vào tên nút', () => {
    const { container } = render(<Btn icon="in">In phiếu</Btn>)
    // Tên nút phải đúng bằng chữ — icon lọt vào thì trình đọc đọc "hình, In phiếu".
    expect(screen.getByRole('button', { name: 'In phiếu' })).toBeTruthy()
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('có nhãn = nội dung: role="img" và tên đọc được', async () => {
    const { container } = render(<Ico name="quaHen" label="Quá hẹn" />)
    expect(screen.getByRole('img', { name: 'Quá hẹn' })).toBeTruthy()
    await expectNoViolations(container)
  })

  it('nút chỉ có icon + aria-label: có tên, qua axe', async () => {
    const { container } = render(
      <Btn aria-label="Phiếu trước">
        <Ico name="truoc" />
      </Btn>,
    )
    expect(screen.getByRole('button', { name: 'Phiếu trước' })).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('Btn — nút', () => {
  it('là <button> thật, có tên gọi đọc được', async () => {
    const { container } = render(
      <Btn primary icon="ghiSo">
        Ghi sổ
      </Btn>,
    )
    const b = screen.getByRole('button', { name: 'Ghi sổ' })
    expect(b.tagName).toBe('BUTTON')
    await expectNoViolations(container)
  })

  /*
    B4 đổi hành vi: khoá theo quyền là KHOÁ MỀM. Bản trước dùng `disabled`
    thật — nút rơi khỏi thứ tự Tab, nên người dùng trình đọc màn hình không
    bao giờ tới được nó để nghe "việc này do Kế toán quản lý".
  */
  it('bị khoá theo quyền: bấm không ăn, Tab TỚI được, đọc được ai giữ quyền', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <Btn blockedBy="Kế toán" icon="duyet" onClick={onClick}>
        Duyệt chi
      </Btn>,
    )
    // Tên KHÔNG lẫn câu lý do — lý do là MÔ TẢ, không phải tên.
    const b = screen.getByRole('button', { name: 'Duyệt chi' })
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b).toHaveProperty('disabled', false)
    expect(
      screen.getByRole('button', { description: 'Việc này do Kế toán quản lý' }),
    ).toBe(b)
    await userEvent.tab()
    expect(document.activeElement).toBe(b)
    await userEvent.click(b)
    await userEvent.keyboard('{Enter}')
    expect(onClick).not.toHaveBeenCalled()
    await expectNoViolations(container)
  })

  it('đang chạy: aria-busy, bấm lần hai không gửi đôi, tiêu điểm KHÔNG rơi', async () => {
    const onClick = vi.fn()
    function Luu() {
      const [busy, setBusy] = useState(false)
      return (
        <Btn
          primary
          icon="luuNhap"
          busy={busy}
          onClick={() => {
            onClick()
            setBusy(true)
          }}
        >
          Lưu nháp
        </Btn>
      )
    }
    render(<Luu />)
    const b = screen.getByRole('button', { name: 'Lưu nháp' })
    await userEvent.click(b)
    expect(b.getAttribute('aria-busy')).toBe('true')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(b)
  })

  it('mặc định type="button" — không nộp form ngoài ý muốn', () => {
    render(<Btn icon="them">Thêm dòng</Btn>)
    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })
})

describe('Combobox — ô tìm-rồi-chọn (B4)', () => {
  const NCC = [
    { value: 'n1', label: 'CÔNG TY TNHH SX TM MINH ĐẠT', hint: 'NCC-0012' },
    { value: 'n2', label: 'CÔNG TY NHỰA SƠN TÍN PHÁT', hint: 'NCC-0043' },
    { value: 'n3', label: 'CƠ KHÍ THÀNH ĐẠT', hint: 'NCC-0101' },
  ]

  function Chon({ onChange = () => {} }: { onChange?: (v: string) => void }) {
    const [v, setV] = useState('n1')
    return (
      <Combobox
        label="Nhà cung cấp"
        options={NCC}
        value={v}
        onChange={(x) => {
          setV(x)
          onChange(x)
        }}
      />
    )
  }

  it('aria-expanded nói THẬT: đóng là false, mở là true (vá lỗi cmdk)', async () => {
    render(<Chon />)
    const input = screen.getByRole('combobox', { name: 'Nhà cung cấp' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    await userEvent.click(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
  })

  it('gõ KHÔNG DẤU, lệch thứ tự vẫn ra; Enter chọn dòng KHỚP — không xoá lựa chọn', async () => {
    const onChange = vi.fn()
    render(<Chon onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Nhà cung cấp' })
    await userEvent.click(input)
    await userEvent.keyboard('tin phat son')
    const opts = screen.getAllByRole('option')
    // "— chưa chọn —" + đúng một dòng khớp.
    expect(opts.map((o) => o.textContent)).toEqual([
      '— chưa chọn —',
      'CÔNG TY NHỰA SƠN TÍN PHÁT' + 'NCC-0043',
    ])
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('n2')
    expect((input as HTMLInputElement).value).toBe('CÔNG TY NHỰA SƠN TÍN PHÁT')
  })

  it('danh sách ra PORTAL — không nằm trong khung cha (hết bị bảng cuộn cắt)', async () => {
    const { container } = render(
      <div style={{ overflow: 'auto', height: 40 }}>
        <Chon />
      </div>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    const list = screen.getByRole('listbox')
    expect(container.contains(list)).toBe(false)
    // Ô nhập TRỎ tới đúng danh sách (lỗi đo trên app thật: aria-controls trống).
    await waitFor(() =>
      expect(screen.getByRole('combobox').getAttribute('aria-controls')).toBe(list.id),
    )
    await expectNoViolations(list)
  })

  it('↓ đi dòng, Esc đóng mà GIỮ lựa chọn cũ', async () => {
    const onChange = vi.fn()
    render(<Chon onChange={onChange} />)
    const input = screen.getByRole('combobox') as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('{ArrowDown}')
    const active = input.getAttribute('aria-activedescendant')
    expect(active && document.getElementById(active)?.textContent).toContain(
      'SƠN TÍN PHÁT',
    )
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(input.value).toBe('CÔNG TY TNHH SX TM MINH ĐẠT')
  })

  it('kiểu TRA: hỏi server sau khi ngừng gõ, lấy một dòng, ô trống lại, con trỏ ở lại', async () => {
    const search = vi.fn(async (q: string) =>
      NCC.filter((n) => n.label.includes(q.toUpperCase())),
    )
    const onPick = vi.fn()
    render(
      <Combobox
        label="Thêm vật tư"
        search={search}
        onPick={onPick}
        keyOf={(n) => n.value}
        render={(n) => n.label}
      />,
    )
    const input = screen.getByRole('combobox', {
      name: 'Thêm vật tư',
    }) as HTMLInputElement
    await userEvent.click(input)
    await userEvent.keyboard('ĐẠT')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    // Gõ 3 phím mà chỉ hỏi server MỘT lần — đợi ngừng gõ.
    expect(search).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(onPick).toHaveBeenCalledWith(NCC[2])
    expect(input.value).toBe('')
    expect(document.activeElement).toBe(input)
  })
})

describe('DateInput — ô ngày kiểu Việt (B4)', () => {
  function Ngay({
    onChange = () => {},
    max,
  }: {
    onChange?: (v: string) => void
    max?: string
  }) {
    const [v, setV] = useState('2026-09-10')
    return (
      <DateInput
        label="Ngày chứng từ"
        value={v}
        max={max}
        onChange={(x) => {
          setV(x)
          onChange(x)
        }}
      />
    )
  }

  it('hiện dd/mm/yyyy; gõ số liền tự chèn gạch, ra ISO', async () => {
    const onChange = vi.fn()
    render(<Ngay onChange={onChange} />)
    const input = screen.getByRole('textbox', {
      name: 'Ngày chứng từ',
    }) as HTMLInputElement
    expect(input.value).toBe('10/09/2026')
    await userEvent.clear(input)
    await userEvent.type(input, '03082026')
    expect(input.value).toBe('03/08/2026')
    // 03/08 là ngày 3 THÁNG 8 — không phải 8 tháng 3 như lịch trình duyệt tiếng Anh.
    expect(onChange).toHaveBeenLastCalledWith('2026-08-03')
  })

  it('Alt+↓ mở lịch TIẾNG VIỆT, tuần bắt đầu thứ Hai; chọn ngày thì đóng, con trỏ về ô', async () => {
    const onChange = vi.fn()
    render(<Ngay onChange={onChange} />)
    const input = screen.getByRole('textbox', {
      name: 'Ngày chứng từ',
    }) as HTMLInputElement
    input.focus()
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')
    const lich = await screen.findByRole('dialog', { name: 'Lịch — Ngày chứng từ' })
    const thu = [...lich.querySelectorAll('th')].map((t) => t.textContent)
    expect(thu).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
    expect(lich.textContent).toContain('Tháng 9/2026')
    await userEvent.click(screen.getByRole('button', { name: 'Thứ 6, 25/09/2026' }))
    expect(onChange).toHaveBeenLastCalledWith('2026-09-25')
    expect(input.value).toBe('25/09/2026')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(input)
  })

  it('max chặn các ngày sau đó TRÊN LỊCH', async () => {
    render(<Ngay max="2026-09-24" />)
    await userEvent.click(screen.getByRole('button', { name: 'Mở lịch — Ngày chứng từ' }))
    // Ô ngày đọc ra đúng dạng ô chữ đang hiện — người nghe khớp với thứ họ gõ.
    expect(
      screen.getByRole('button', { name: 'Thứ 5, 10/09/2026, đang chọn' }),
    ).toBeTruthy()
    const sau = screen.getByRole('button', {
      name: 'Thứ 6, 25/09/2026',
    }) as HTMLButtonElement
    expect(sau.disabled).toBe(true)
    await expectNoViolations(screen.getByRole('dialog'))
  })
})

describe('Sheet — bảng bên phải (hộp thoại)', () => {
  function Mo({
    onClose = () => {},
    stakes,
  }: {
    onClose?: () => void
    stakes?: 'nhe' | 'vua' | 'nang'
  }) {
    return (
      <>
        <button type="button">Nút TRƯỚC hộp</button>
        <Sheet open onClose={onClose} title="Huỷ đơn PO-2608-097" stakes={stakes}>
          <button type="button">Trong hộp 1</button>
          <button type="button">Trong hộp 2</button>
        </Sheet>
        <button type="button">Nút SAU hộp</button>
      </>
    )
  }

  it('là dialog, mang tên theo tiêu đề, không vi phạm luật truy cập', async () => {
    render(<Mo />)
    const dlg = screen.getByRole('dialog', { name: 'Huỷ đơn PO-2608-097' })
    await expectNoViolations(dlg)
  })

  it('Esc đóng hộp', async () => {
    const onClose = vi.fn()
    render(<Mo onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('mở ra thì tiêu điểm vào CHÍNH HỘP — không vào nút đầu tiên', () => {
    render(<Mo />)
    // Nút đầu ở hộp huỷ đơn có thể là nút không lùi lại được; một cú Enter lỡ
    // tay là mất. Tiêu điểm vào hộp, Tab một lần mới tới nút.
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
  })

  /*
    HAI TEST DƯỚI ĐÂY LÀ `it.fails` Ở B0 — chúng ghi lỗi của bản tự viết. Khi
    `Sheet` sang Radix Dialog (B1), chúng chuyển ĐỎ đúng như dự tính và được
    đổi thành `it`. Tiêu chí T1 của kế hoạch (WAI-ARIA APG, mẫu Dialog Modal).
  */
  it('[B1] Tab không lọt ra ngoài hộp — vòng trong hộp', async () => {
    render(<Mo />)
    const dlg = screen.getByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await userEvent.tab()
      expect(dlg.contains(document.activeElement)).toBe(true)
    }
  })

  it('[B1] đóng hộp thì trả tiêu điểm về nút đã mở nó', async () => {
    // Đi ĐÚNG trình tự người dùng: bấm nút → hộp mở → Esc. Dựng hộp mở sẵn
    // thì nút chưa từng có tiêu điểm, và test không thể chuyển trạng thái.
    function Hop() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Mở hộp
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Xác nhận">
            <button type="button">Đồng ý</button>
          </Sheet>
        </>
      )
    }
    render(<Hop />)
    const opener = screen.getByRole('button', { name: 'Mở hộp' })
    await userEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  /*
    B7½: `SheetActions busy` từng khoá nút làm bằng `disabled` thật — tiêu điểm
    đang ở nút "Gửi duyệt" rơi về `<body>` đúng lúc người dùng vừa bấm, tức RA
    NGOÀI hộp đang giữ focus. Nay đi đúng đường `Btn busy`: khoá mềm.
  */
  it('SheetActions busy: aria-busy, tiêu điểm Ở LẠI nút, bấm lần hai không gửi đôi', async () => {
    const gui = vi.fn()
    function Hop() {
      const [busy, setBusy] = useState(false)
      return (
        <Sheet
          open
          onClose={() => {}}
          title="Gửi duyệt PO-2608-097"
          footer={
            <SheetActions
              onCancel={() => {}}
              onConfirm={() => {
                gui()
                setBusy(true)
              }}
              confirmLabel="Gửi duyệt"
              busy={busy}
            />
          }
        />
      )
    }
    render(<Hop />)
    const nut = screen.getByRole('button', { name: 'Gửi duyệt' })
    await userEvent.click(nut)
    const dang = screen.getByRole('button', { name: 'Đang chạy…' })
    expect(dang).toBe(nut)
    expect(nut.getAttribute('aria-busy')).toBe('true')
    expect(nut).toHaveProperty('disabled', false)
    expect(document.activeElement).toBe(nut)
    await userEvent.click(nut)
    expect(gui).toHaveBeenCalledOnce()
  })

  it('SheetActions disabled (chưa đủ điều kiện) vẫn khoá như cũ, KHÔNG đổi nhãn', () => {
    render(
      <Sheet
        open
        onClose={() => {}}
        title="Hạ về nháp"
        footer={<SheetActions onCancel={() => {}} onConfirm={() => {}} confirmLabel="Hạ về nháp" disabled />} // prettier-ignore
      />,
    )
    const nut = screen.getByRole('button', { name: 'Hạ về nháp' })
    expect(nut).toHaveProperty('disabled', true)
  })

  it('việc NẶNG là alertdialog — ngắt luồng để hỏi một câu quan trọng', async () => {
    render(<Mo stakes="nang" />)
    const dlg = screen.getByRole('alertdialog', { name: 'Huỷ đơn PO-2608-097' })
    await expectNoViolations(dlg)
  })

  it('việc NẶNG không đóng khi bấm ra nền — việc thường thì đóng', async () => {
    // Bấm vào LỚP PHỦ — đúng chỗ người dùng bấm. Không bấm `<body>`: Radix đặt
    // `pointer-events: none` lên body khi modal mở, nên cú bấm đó không có thật.
    // Lớp phủ đứng ngay trước hộp trong cùng lớp bọc `.kit` (xem Sheet.tsx).
    const nen = (role: 'dialog' | 'alertdialog') =>
      screen.getByRole(role).previousElementSibling as Element

    const dong = vi.fn()
    const { unmount } = render(<Mo stakes="nang" onClose={dong} />)
    await userEvent.click(nen('alertdialog'))
    expect(dong).not.toHaveBeenCalled()
    unmount()

    const dongThuong = vi.fn()
    render(<Mo stakes="vua" onClose={dongThuong} />)
    await userEvent.click(nen('dialog'))
    expect(dongThuong).toHaveBeenCalledOnce()
  })
})

describe('Tip — tooltip', () => {
  it('Tab tới thì hiện, nút TRỎ tới nó, Esc tắt được (WCAG 1.4.13)', async () => {
    render(
      <Tip label="Cài đặt tài khoản" side="top">
        <button type="button" aria-label="Tài khoản">
          ⚙
        </button>
      </Tip>,
    )
    const nut = screen.getByRole('button', { name: 'Tài khoản' })
    await userEvent.tab()
    expect(document.activeElement).toBe(nut)

    // Lỗi của bản tự viết: có role="tooltip" nhưng nút KHÔNG trỏ tới nó.
    const id = nut.getAttribute('aria-describedby')
    expect(id, 'nút phải có aria-describedby trỏ tới tooltip').toBeTruthy()
    expect(document.getElementById(id!)?.textContent).toBe('Cài đặt tài khoản')

    await userEvent.keyboard('{Escape}')
    expect(nut.getAttribute('aria-describedby')).toBeNull()
  })
})

describe('Menu — menu thả ⋯', () => {
  function Dung({ saoChep = () => {}, huy = () => {} }) {
    return (
      <Menu
        items={[
          { label: 'Sao chép đơn', onClick: saoChep },
          { label: 'Duyệt chi', blockedBy: 'Kế toán' },
          { label: 'Huỷ đơn', danger: true, onClick: huy },
        ]}
      />
    )
  }

  it('nút "⋯" có tên đọc được — không để trình đọc nói "dấu ba chấm"', () => {
    render(<Dung />)
    expect(screen.getByRole('button', { name: 'Thêm thao tác' })).toBeTruthy()
  })

  /*
    B7½ ĐỔI HÀNH VI: mục khoá KHÔNG còn bị mũi tên nhảy qua. Bản B1 đưa `disabled`
    cho Radix — Radix bỏ qua mục đó khi đi bằng phím, nên người dùng trình đọc
    màn hình không bao giờ đứng trên nó để nghe "Việc này do Kế toán quản lý".
    Cùng lý do `Btn blockedBy` chuyển sang khoá mềm ở B4 (và mẫu Menu của
    WAI-ARIA APG: mục khoá mặc định vẫn nhận tiêu điểm).
  */
  it('đi bằng mũi tên, DỪNG ở mục khoá và đọc lý do, Enter trên đó không chạy; tiêu điểm về nút', async () => {
    const huy = vi.fn()
    render(<Dung huy={huy} />)
    const nut = screen.getByRole('button', { name: 'Thêm thao tác' })
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    const menu = screen.getByRole('menu')
    await expectNoViolations(menu)
    expect(document.activeElement?.textContent).toBe('Sao chép đơn')

    await userEvent.keyboard('{ArrowDown}')
    // Tên là NHÃN, lý do là MÔ TẢ — không trộn hai thứ vào một câu tên.
    const khoa = screen.getByRole('menuitem', {
      name: 'Duyệt chi',
      description: 'Việc này do Kế toán quản lý',
    })
    expect(document.activeElement).toBe(khoa)
    expect(khoa.getAttribute('aria-disabled')).toBe('true')
    // Enter trên mục khoá: không chạy gì, menu vẫn mở.
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeTruthy()

    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement?.textContent).toBe('Huỷ đơn')

    await userEvent.keyboard('{Enter}')
    expect(huy).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(nut)
  })

  it('bấm chuột vào mục khoá: không chạy onClick, menu không đóng', async () => {
    const chay = vi.fn()
    render(<Menu items={[{ label: 'Ghi nhận thanh toán', blockedBy: 'Kế toán', onClick: chay }]} />) // prettier-ignore
    await userEvent.click(screen.getByRole('button', { name: 'Thêm thao tác' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ghi nhận thanh toán' }))
    expect(chay).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()
  })
})

describe('Popover — khung nổi', () => {
  it('mở ra thì tiêu điểm vào khung, Esc đóng, tiêu điểm về nút', async () => {
    render(
      <Popover label="Lọc nâng cao" trigger={<Btn>Lọc</Btn>}>
        <input aria-label="Mã lệnh" />
      </Popover>,
    )
    const nut = screen.getByRole('button', { name: 'Lọc' })
    await userEvent.click(nut)

    const khung = screen.getByRole('dialog', { name: 'Lọc nâng cao' })
    await expectNoViolations(khung)
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Mã lệnh' }))

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(nut)
  })
})

describe('Toast — thông báo bay (B2)', () => {
  function Nut({ loai }: { loai: 'success' | 'error' }) {
    const toast = useToast()
    return (
      <button
        type="button"
        onClick={() =>
          loai === 'success'
            ? toast.success('Đã ghi phiếu PBS-0042', '12 dòng · Tổ Phôi')
            : toast.error('Không lưu được phiếu', 'Sổ ngày 22/09 đã chốt')
        }
      >
        Bấm
      </button>
    )
  }

  /*
    Lỗi của bản cũ: MỌI toast đều `role="alert"` — tức ngắt lời người dùng
    trình đọc màn hình kể cả khi chỉ báo "đã lưu" (WCAG 4.1.3). Radix phát tin
    qua một vùng `aria-live` riêng: `polite` cho tin thường, `assertive` cho lỗi.
  */
  it('tin THÀNH CÔNG đọc nhẹ nhàng — không ngắt lời người đang thao tác', async () => {
    render(
      <ToastProvider>
        <Nut loai="success" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bấm' }))
    expect(screen.getByText('Đã ghi phiếu PBS-0042')).toBeTruthy()
    expect(document.querySelector('[role="alert"]')).toBeNull()
    await waitFor(() =>
      expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain(
        'Đã ghi phiếu PBS-0042',
      ),
    )
  })

  it('tin LỖI thì được ngắt lời — người dùng phải biết ngay việc vừa làm không thành', async () => {
    render(
      <ToastProvider>
        <Nut loai="error" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bấm' }))
    await waitFor(() =>
      expect(document.querySelector('[aria-live="assertive"]')?.textContent).toContain(
        'Không lưu được phiếu',
      ),
    )
  })

  it('nút đóng có tên, bấm là tắt; khay không vi phạm luật truy cập', async () => {
    render(
      <ToastProvider>
        <Nut loai="success" />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Bấm' }))
    const khay = screen.getByRole('region', { name: /Thông báo/ })
    await expectNoViolations(khay)

    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    await waitFor(() => expect(screen.queryByText('Đã ghi phiếu PBS-0042')).toBeNull())
  })

  it('dùng ngoài Provider thì báo lỗi rõ ràng, không im lặng', () => {
    function Le() {
      useToast()
      return null
    }
    // React in lỗi ra console khi component ném — nuốt đi cho gọn đầu ra test.
    const tat = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Le />)).toThrow(/ToastProvider/)
    tat.mockRestore()
  })
})
