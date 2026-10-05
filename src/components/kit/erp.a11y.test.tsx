// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AuditTable,
  Checks,
  CommitBar,
  Crumb,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGroup,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  HeadChip,
  HeadChips,
  HeadField,
  HolderBar,
  LineDetail,
  NumInput,
  SmartLinks,
  StatusTrack,
  Td,
  Th,
} from '@/components/kit'
import { a11yViolations, formatViolations } from '@/test/a11y'

/**
 * TEST TRUY CẬP cho khối CHỨNG TỪ của kit (`Erp.tsx`) — bước B7½ của
 * docs/he-thiet-ke-erp-ke-hoach.md.
 *
 * Mỗi ca dưới đây là một lỗi mà B7 (sách tra thành phần) đã ghi thật trên
 * trang tài liệu của thành phần, §9.9. Test viết TRƯỚC bản vá và chạy trên mã
 * cũ để chứng minh nó đỏ — test không bao giờ đỏ thì không canh được gì. Hai
 * lỗi chỉ nằm ở CSS (nút chính khoá mềm vẫn tô nền đặc; `GridBtn`/`SmartLinks`
 * khoá bằng `opacity`) không đo được ở đây: `happy-dom` không tính cascade.
 *
 * Như `kit.a11y.test.tsx`: axe chạy trên chính thành phần, không trên cả trang.
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function expectNoViolations(root: Element) {
  const v = await a11yViolations(root)
  expect(v, formatViolations(v)).toEqual([])
}

/** Chữ của mô tả truy cập — ghép các phần tử mà `aria-describedby` trỏ tới. */
function description(el: Element): string {
  const ids = el.getAttribute('aria-describedby')?.split(/\s+/) ?? []
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .trim()
}

describe('SmartLinks — nút khoá là KHOÁ MỀM, lý do tới được bằng bàn phím', () => {
  it('aria-disabled thay disabled, lý do qua aria-describedby, bấm bị nuốt', async () => {
    const go = vi.fn()
    const { container } = render(
      <SmartLinks
        items={[
          {
            label: 'Phiếu kho',
            count: 0,
            onClick: go,
            disabled: true,
            title: 'Đơn chưa gửi NCC',
          },
          { label: 'Hoá đơn', count: 2, onClick: () => {} },
        ]}
      />,
    )
    const b = screen.getByRole('button', { name: /Phiếu kho/ })
    // `disabled` thật rơi khỏi thứ tự Tab — người đi bằng phím không bao giờ nghe lý do.
    expect(b.hasAttribute('disabled')).toBe(false)
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(description(b)).toBe('Đơn chưa gửi NCC')
    b.focus()
    expect(document.activeElement).toBe(b)
    await userEvent.click(b)
    expect(go).not.toHaveBeenCalled()
    await expectNoViolations(container)
  })
})

describe('GridRow — dòng bấm được thì bàn phím cũng bấm được', () => {
  function Luoi({ onPick }: { onPick: () => void }) {
    return (
      <Grid>
        <GridHead>
          <Th>Mã</Th>
          <Th num>SL</Th>
        </GridHead>
        <GridBody>
          <GridRow onClick={onPick}>
            <Td>CN1527</Td>
            <Td num>
              <NumInput value="4" onCommit={() => {}} aria-label="SL dòng CN1527" />
            </Td>
          </GridRow>
          <GridRow>
            <Td>ST-0083</Td>
            <Td num>2</Td>
          </GridRow>
        </GridBody>
      </Grid>
    )
  }

  it('nhận Tab, Enter và Space gọi onClick, Space không cuộn trang', () => {
    const pick = vi.fn()
    const { container } = render(<Luoi onPick={pick} />)
    const [dong, dongTinh] = container.querySelectorAll('tbody tr')
    expect(dong.getAttribute('tabindex')).toBe('0')
    // Dòng không có onClick thì không được thành điểm dừng Tab vô nghĩa.
    expect(dongTinh.hasAttribute('tabindex')).toBe(false)

    fireEvent.keyDown(dong, { key: 'Enter' })
    expect(pick).toHaveBeenCalledTimes(1)
    // fireEvent trả false khi handler gọi preventDefault — tức trang KHÔNG cuộn.
    const khongCuon = !fireEvent.keyDown(dong, { key: ' ' })
    expect(pick).toHaveBeenCalledTimes(2)
    expect(khongCuon).toBe(true)
  })

  it('gõ Space/Enter trong ô nhập của dòng KHÔNG bấm dòng', () => {
    const pick = vi.fn()
    render(<Luoi onPick={pick} />)
    const o = screen.getByRole('textbox', { name: 'SL dòng CN1527' })
    fireEvent.keyDown(o, { key: ' ' })
    fireEvent.keyDown(o, { key: 'Enter' })
    expect(pick).not.toHaveBeenCalled()
  })
})

describe('HeadChip — không có onClick thì không phải nút', () => {
  it('chip chỉ-bày là phần tử tĩnh, chip có onClick vẫn là nút', async () => {
    const { container } = render(
      <HeadChips>
        <HeadChip label="Tiền tệ" value="VND" />
        <HeadChip label="NCC" value={null} need onClick={() => {}} />
      </HeadChips>,
    )
    expect(screen.queryByRole('button', { name: /Tiền tệ/ })).toBeNull()
    expect(screen.getByText('VND')).toBeTruthy()
    expect(screen.getByRole('button', { name: /NCC/ })).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('HeadField — ô bắt buộc nói ra là bắt buộc', () => {
  it('tên ô có chữ "bắt buộc" khi need', async () => {
    const { container } = render(
      <HeadChips>
        <HeadField label="Số hoá đơn" need empty>
          <NumInput value="" onCommit={() => {}} />
        </HeadField>
      </HeadChips>,
    )
    expect(screen.getByRole('textbox', { name: /bắt buộc/ })).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('FieldGroup — cấp tiêu đề theo chỗ đặt', () => {
  it('mặc định h4, `level` đổi cấp', () => {
    render(
      <>
        <FieldGroup title="Chung">
          <Field label="NCC">Thành Đạt</Field>
        </FieldGroup>
        <FieldGroup title="Điều khoản" level={3}>
          <Field label="Thanh toán">30 ngày</Field>
        </FieldGroup>
      </>,
    )
    expect(screen.getByRole('heading', { name: 'Chung' }).tagName).toBe('H4')
    expect(screen.getByRole('heading', { name: 'Điều khoản', level: 3 })).toBeTruthy()
  })
})

describe('FastTab — tên nút là tiêu đề, số liệu là mô tả', () => {
  it('đang gấp: aria-controls không trỏ vào khoảng không', async () => {
    const { container } = render(
      <FastTab title="Đợt giao" summary={[['Số đợt', '3']]}>
        <p>thân</p>
      </FastTab>,
    )
    const b = screen.getByRole('button', { name: 'Đợt giao' })
    const ctl = b.getAttribute('aria-controls')
    if (ctl) expect(document.getElementById(ctl)).not.toBeNull()
    expect(description(b)).toContain('Số đợt')
    await expectNoViolations(container)
  })

  it('đang mở: aria-controls trỏ đúng thân khối', async () => {
    render(
      <FastTab title="Tổng quan" defaultOpen>
        <p>thân khối</p>
      </FastTab>,
    )
    const b = screen.getByRole('button', { name: 'Tổng quan' })
    const body = document.getElementById(b.getAttribute('aria-controls') ?? '')
    expect(body?.textContent).toBe('thân khối')
  })
})

describe('Crumb — landmark đường dẫn', () => {
  it('nav có tên, dấu › ẩn, mảnh cuối là trang hiện tại', async () => {
    const { container } = render(
      <Crumb path={[{ label: 'Đơn mua', href: '/mua-hang/don' }, 'PO-2609-014']} />,
    )
    const nav = screen.getByRole('navigation', { name: 'Đường dẫn' })
    for (const s of nav.querySelectorAll('.k-crumb-sep')) {
      expect(s.getAttribute('aria-hidden')).toBe('true')
    }
    expect(within(nav).getByText('PO-2609-014').closest('[aria-current="page"]')).not.toBeNull() // prettier-ignore
    await expectNoViolations(container)
  })
})

describe('StatusTrack — bậc kết thúc khi dải bấm được', () => {
  it('onPick + terminal: không có listitem mồ côi', async () => {
    const { container } = render(
      <StatusTrack
        label="Trạng thái đơn"
        steps={['Nháp', 'Chờ duyệt', 'Đã duyệt']}
        at={-1}
        terminal="Đã huỷ"
        onPick={() => {}}
      />,
    )
    await expectNoViolations(container)
  })
})

describe('LineDetail — nút gấp/mở', () => {
  it('mũi tên không lọt vào tên nút, aria-controls trỏ đúng khay khi mở', async () => {
    const { container } = render(
      <LineDetail index={3} code="CN1527" onToggle={() => {}}>
        <p>ruột khay</p>
      </LineDetail>,
    )
    const b = screen.getByRole('button', { name: /Chi tiết dòng 3/ })
    expect(b.textContent).toContain('▾')
    const arrow = [...b.querySelectorAll('span')].find((s) => s.textContent === '▾')
    expect(arrow?.getAttribute('aria-hidden')).toBe('true')
    const body = document.getElementById(b.getAttribute('aria-controls') ?? '')
    expect(body?.textContent).toBe('ruột khay')
    await expectNoViolations(container)
  })
})

describe('CommitBar — câu chặn lưu', () => {
  const base = {
    totals: [{ label: 'Tiền hàng', value: '1.000 ₫' }],
    grand: { label: 'Tổng', value: '1.080 ₫' },
  }

  it('không có onGoBlocked: câu chặn là chữ, không phải nút chết', async () => {
    const { container } = render(<CommitBar {...base} blocked="chưa chọn NCC" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('chưa chọn NCC')
    await expectNoViolations(container)
  })

  it('có onGoBlocked: nút trong vùng status, mũi tên không vào tên nút', async () => {
    const go = vi.fn()
    const { container } = render(
      <CommitBar {...base} blocked="dòng 3 thiếu đơn giá" onGoBlocked={go} />,
    )
    const b = within(screen.getByRole('status')).getByRole('button')
    expect(b.textContent).toContain('→')
    expect(screen.getByRole('button', { name: 'Chưa lưu được: dòng 3 thiếu đơn giá' })).toBe(b) // prettier-ignore
    await userEvent.click(b)
    expect(go).toHaveBeenCalledTimes(1)
    await expectNoViolations(container)
  })

  it('vùng status có sẵn TRƯỚC khi bị chặn — không thì trình đọc không báo', () => {
    const { rerender } = render(<CommitBar {...base} />)
    const live = screen.getByRole('status')
    rerender(<CommitBar {...base} blocked="chưa chọn NCC" />)
    expect(screen.getByRole('status')).toBe(live)
    expect(live.textContent).toContain('chưa chọn NCC')
  })
})

describe('HolderBar — tuổi ở bước hiện tại theo ngưỡng', () => {
  const tone = (age: string) => {
    const { container } = render(<HolderBar who="Nga" what="gửi duyệt" age={age} />)
    const el = container.querySelector('.k-hold-age')
    const t = el?.classList.contains('k-hold-age-stop')
      ? 'stop'
      : el?.classList.contains('k-hold-age-warn')
        ? 'warn'
        : 'none'
    cleanup()
    return t
  }

  it('1 ngày không đỏ, 3–6 ngày cảnh báo, từ 7 ngày đỏ', () => {
    expect(tone('1 ngày')).toBe('none')
    expect(tone('từ hôm nay')).toBe('none')
    expect(tone('3 ngày')).toBe('warn')
    expect(tone('đã 6 ngày · nằm im')).toBe('warn')
    expect(tone('7 ngày')).toBe('stop')
    expect(tone('12 ngày')).toBe('stop')
  })

  it('là vùng status — đổi người giữ thì trình đọc báo', async () => {
    const { container } = render(<HolderBar who="Nga" what="gửi duyệt" age="2 ngày" />)
    expect(screen.getByRole('status').textContent).toContain('Nga')
    await expectNoViolations(container)
  })
})

describe('AuditTable', () => {
  it('hai lần sửa cùng trường cùng phút không đụng khoá', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AuditTable
        rows={[
          {
            at: '12/09 09:14',
            who: 'Nga',
            field: 'Đơn giá',
            from: '352.000',
            to: '360.000',
          },
          {
            at: '12/09 09:14',
            who: 'Nga',
            field: 'Đơn giá',
            from: '360.000',
            to: '369.600',
          },
        ]}
      />,
    )
    const trung = err.mock.calls.some((c) => String(c[0]).includes('same key'))
    expect(trung).toBe(false)
    expect(screen.getByText('369.600')).toBeTruthy()
  })

  it('chưa có thay đổi: nói ra, không để tiêu đề trơ', async () => {
    const { container } = render(<AuditTable rows={[]} />)
    expect(screen.getByText(/Chưa có thay đổi/)).toBeTruthy()
    await expectNoViolations(container)
  })
})

describe('FactBox — landmark có tên', () => {
  it('mặc định "Dữ kiện liên quan", đổi được qua `label`', () => {
    render(
      <>
        <FactBox>
          <FactSection title="Nhà cung cấp">
            <FactKv rows={[['Đúng hẹn', '8/9']]} />
          </FactSection>
        </FactBox>
        <FactBox label="Dữ kiện dòng">
          <FactSection title="Vật tư">
            <FactKv rows={[['Tồn', '12']]} />
          </FactSection>
        </FactBox>
      </>,
    )
    expect(screen.getByRole('complementary', { name: 'Dữ kiện liên quan' })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: 'Dữ kiện dòng' })).toBeTruthy()
  })
})

describe('Checks — dòng tóm tắt là vùng status', () => {
  it('tóm tắt nằm trong status, danh sách dài thì KHÔNG', async () => {
    const { container } = render(
      <Checks
        title="Chưa gửi duyệt được"
        items={[
          { level: 'stop', what: 'Dòng 3 thiếu đơn giá', fix: 'Gõ đơn giá' },
          { level: 'warn', what: 'Chưa có hẹn giao', fix: 'Chọn ngày' },
        ]}
      />,
    )
    const live = screen.getByRole('status')
    expect(live.textContent).toContain('1 lỗi chặn')
    expect(live.textContent).not.toContain('Gõ đơn giá')
    await expectNoViolations(container)
  })
})

describe('GridHead groups — tiêu đề hai tầng (03/10/2026)', () => {
  function BaoCao() {
    return (
      <Grid size="md">
        <GridHead
          groups={
            <>
              <Th rows={2}>Lệnh</Th>
              <Th group sep span={2}>
                Đơn bán của lệnh
              </Th>
            </>
          }
        >
          <Th num sep>
            Đơn
          </Th>
          <Th num>VND quy đổi</Th>
        </GridHead>
        <GridBody>
          <GridRow>
            <Td>02/26-27 - ROSCO</Td>
            <Td num sep>
              1
            </Td>
            <Td num>40.201.510.656</Td>
          </GridRow>
        </GridBody>
      </Grid>
    )
  }

  it('hai hàng tiêu đề, ô nhóm trải đúng số cột con, vạch mở nhóm ở cả tiêu đề lẫn thân', async () => {
    const { container } = render(<BaoCao />)
    const [top, sub] = container.querySelectorAll('thead tr')
    expect(container.querySelector('thead')!.className).toContain('k-gh2')
    expect(container.querySelector('table')!.className).toContain('k-grid-md')
    const [lenh, nhom] = top.querySelectorAll('th')
    expect(lenh.rowSpan).toBe(2)
    expect(nhom.colSpan).toBe(2)
    expect(nhom.getAttribute('scope')).toBe('colgroup')
    expect(nhom.className).toContain('k-th-grp')
    // Ô nhóm KHÔNG được mang lớp `k-grp` của thanh nhóm nút (đè padding/viền).
    expect(nhom.className.split(' ')).not.toContain('k-grp')
    expect(sub.querySelectorAll('th')).toHaveLength(2)
    expect(sub.querySelector('th')!.className).toContain('k-sep')
    expect(container.querySelector('tbody td.k-sep')!.textContent).toBe('1')
    await expectNoViolations(container)
  })

  it('không khai groups thì vẫn một hàng tiêu đề như cũ', () => {
    const { container } = render(
      <Grid>
        <GridHead>
          <Th>Mã</Th>
        </GridHead>
        <GridBody>
          <GridRow>
            <Td>CN1527</Td>
          </GridRow>
        </GridBody>
      </Grid>,
    )
    expect(container.querySelectorAll('thead tr')).toHaveLength(1)
    expect(container.querySelector('thead')!.className).toBe('')
    expect(container.querySelector('table')!.className).toBe('k-grid')
  })
})
