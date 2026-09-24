'use client'

import { useState, type ReactNode } from 'react'
import {
  Count,
  Ico,
  Menu,
  NavRail,
  TopBar,
  UserCard,
  type IcoName,
  type NavGroup,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA vỏ ứng dụng — `NavRail`, `TopBar`, `UserCard`, `Count` (B7, 24/09/2026).
 *
 * Sổ cũ (`/design-lab/thanh-phan`, mục 10) CỐ Ý không dựng thanh điều hướng giả,
 * để người đọc không tưởng màn nghiệp vụ được tự vẽ vỏ của mình. Trang tra thì
 * phải có ví dụ sống, nên mỗi ví dụ nằm trong một KHUNG CÓ VIỀN, cao cố định —
 * nhìn là biết đây là mẫu thu nhỏ, không phải vỏ thật của trang.
 *
 * Link trỏ `#` — không rời trang khi bấm thử.
 */

const MUC: [IcoName, string, number?, 'stop'?][] = [
  ['cho', 'Hộp thư', 7],
  ['don', 'Đơn mua', 3, 'stop'],
  ['nhanHang', 'Nhận hàng'],
  ['ncc', 'Nhà cung cấp'],
  ['vattu', 'Vật tư'],
]

/**
 * Icon để TRANG TRÍ (không `label`): thu gọn thì chính `NavRail` đặt
 * `aria-label` = nhãn mục cho link. Trước 24/09/2026 (B7½) nơi gọi phải tự đưa
 * icon có `label`, quên là link câm — nay kit lo.
 */
function nhom(): NavGroup[] {
  const it = ([icon, label, count, countTone]: (typeof MUC)[number], i: number) => ({
    href: `#muc-${i}`,
    label,
    icon: <Ico name={icon} />,
    count,
    countTone,
  })
  return [
    { heading: 'Việc', items: MUC.slice(0, 3).map((m, i) => it(m, i)) },
    { heading: 'Danh mục', items: MUC.slice(3).map((m, i) => it(m, i + 3)) },
  ]
}

function Khung({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[340px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface)]">
      {children}
    </div>
  )
}

function RailMau() {
  const [mo, setMo] = useState(false)
  return (
    <Khung>
      <NavRail
        groups={nhom()}
        activeHref="#muc-1"
        expanded={mo}
        onToggle={() => setMo((x) => !x)}
        brand={
          <span className="text-k-sm font-bold text-[var(--act)]">
            {mo ? 'Cung ứng' : 'CƯ'}
          </span>
        }
        footer={<UserCard initials="TM" name="Trần Minh" sub="Cung ứng" expanded={mo} />}
      />
      <div className="text-k-sm grid flex-1 place-items-center p-4 text-[var(--ink-3)]">
        Vùng màn nghiệp vụ (mẫu thu nhỏ)
      </div>
    </Khung>
  )
}

/*
  TopBar DỰNG SẴN cạnh NavRail. Bản B7 phải giấu nó sau một nút "Hiện TopBar
  mẫu": rail và đường dẫn đều là `<nav>` KHÔNG TÊN, cùng trang thì axe báo
  `landmark-unique` (đo được đúng ở trang này ngày 24/09/2026). B7½ đặt tên cho
  hai mốc — "Điều hướng chính" và "Đường dẫn" — nên giờ đứng chung được.
*/
function TopBarMau() {
  const [tim, setTim] = useState(0)
  return (
    <div className="grid gap-2">
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
        <TopBar
          crumbs={[{ label: 'Đơn mua', href: '#' }, { label: 'PO-2608-097' }]}
          onSearch={() => setTim((n) => n + 1)}
          right={
            <Menu
              label="Tài khoản ▾"
              items={[
                { label: 'Hồ sơ của tôi' },
                { label: 'Đổi mật khẩu' },
                { label: 'Đăng xuất' },
              ]}
            />
          }
        />
      </div>
      <p className="text-k-sm text-[var(--ink-3)]" aria-live="polite">
        {tim > 0
          ? `onSearch đã gọi ${tim} lần — màn thật mở bảng lệnh ở đây.`
          : 'Bấm ô tìm để thấy onSearch chạy.'}
      </p>
    </div>
  )
}

export default function DocAppShell() {
  return (
    <CompDoc
      family="app-shell"
      summary={
        <>
          Vỏ ứng dụng kiểu v4: rail điều hướng 52px (mở rộng 212px) thay sidebar 240px,
          thanh trên có đường dẫn + ô tìm, thẻ người dùng ở đáy rail, huy hiệu số việc.{' '}
          <b>Ghi thật:</b> tới 24/09/2026 app CHƯA dùng bốn thành phần này — vỏ workspace
          thật là <code>WorkspaceShell</code> (<code>WorkspaceSidebar</code> +{' '}
          <code>WorkspaceTopbar</code> + <code>NavRailLink</code>, chỉ mượn{' '}
          <code>Tip</code> của kit).
        </>
      }
      useWhen={
        <>
          dựng VỎ một lần ở layout của workspace — không bao giờ ở trong một màn nghiệp
          vụ.
        </>
      }
      avoidWhen={
        <>
          màn nghiệp vụ muốn có thanh riêng: dùng <code>ScreenHeader</code> +{' '}
          <code>Crumb</code> cho đầu màn, <code>ActionPane</code> cho dải lệnh; màn đứng
          ngoài vỏ workspace thì dùng <code>CommandBar</code>.
        </>
      }
      variants={[
        {
          name: 'NavRail + UserCard — thu gọn / mở rộng',
          when: 'bấm » ở đáy rail để mở rộng. Thu gọn: số việc co thành chấm theo màu của số, tên hiện trong tooltip và là tên đọc được của link.',
          demo: <RailMau />,
        },
        {
          name: 'TopBar',
          when: 'đường dẫn bắt đầu từ mục đang xem, không lặp tên phòng. Ô tìm CHỈ có khi truyền onSearch — không có thì không vẽ, không để một nút chết. Đứng chung trang với NavRail được: hai mốc mang hai tên khác nhau.',
          demo: <TopBarMau />,
        },
        {
          name: 'Count — ba luật của số đếm',
          when: '0 thì không hiện; trên 99 thì “99+”; đỏ chỉ cho việc quá hạn.',
          demo: (
            <div className="text-k-sm flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                Chờ tôi <Count n={4} />
              </span>
              <span className="flex items-center gap-1.5">
                Quá hẹn <Count n={3} tone="stop" />
              </span>
              <span className="flex items-center gap-1.5">
                Sắp trễ <Count n={2} tone="warn" />
              </span>
              <span className="flex items-center gap-1.5">
                Nháp <Count n={140} />
              </span>
              <span className="flex items-center gap-1.5">
                Đã xong <Count n={0} />
              </span>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Rail thu gọn',
          looks:
            '52px, chỉ icon; nhóm ngăn bằng vạch; số việc là chấm 7px theo màu của số: đỏ = quá hạn, vàng = sắp trễ, còn lại xám (không bao giờ xanh hành động).',
          behaves:
            'Link mang aria-label = nhãn mục. Rê / Tab tới mục thì tooltip hiện tên + số việc. Ô tròn UserCard cũng nhận Tab và mở tooltip tên người dùng.',
        },
        {
          state: 'Rail mở rộng',
          looks: '212px, tiêu đề nhóm, nhãn, Count ở mép phải; thanh cuộn hiện lại.',
          behaves: 'Không tooltip — nhãn đã in ra.',
        },
        {
          state: 'Mục đang xem',
          looks: 'Nền nhạt màu hành động, chữ đậm, vạch 2px mép trái.',
          behaves:
            'aria-current="page". Khớp khi activeHref trùng hẳn hoặc là trang con.',
        },
        {
          state: 'Đang chuyển trang',
          looks: 'Vòng quay thay chỗ icon của đúng mục vừa bấm.',
          behaves:
            'Cờ pending của next/link (useLinkStatus). Link ở ví dụ trỏ # nên ở đây không thấy.',
        },
        {
          state: 'TopBar không có onSearch',
          looks: 'Không có ô tìm; vùng right vẫn nằm mép phải.',
          behaves: 'Không vẽ nút nào — ô tìm chỉ tồn tại khi bấm vào có việc xảy ra.',
        },
        {
          state: 'Count = 0',
          looks: 'Không vẽ gì.',
          behaves: 'Trả null — không chiếm chỗ.',
        },
      ]}
      a11y={{
        role: 'navigation “Điều hướng chính” (NavRail) · navigation “Đường dẫn” (TopBar) · link · button · img (ô tròn UserCard thu gọn)',
        keys: [
          {
            key: 'Tab',
            does: 'Đi qua từng mục rail, nút thu/mở, ô tròn UserCard (khi thu gọn), rồi đường dẫn, ô tìm (nếu có onSearch) và vùng right của TopBar.',
          },
          { key: 'Enter', does: 'Mở mục (link) / bấm nút.' },
          { key: 'Esc', does: 'Tắt tooltip của mục rail / ô tròn đang focus.' },
        ],
        reader: (
          <>
            Hai mốc điều hướng mang tên riêng — “Điều hướng chính” và “Đường dẫn” — nên
            nhảy theo mốc phân biệt được bằng tai. Rail thu gọn: link có tên là nhãn mục
            (kit tự đặt <code>aria-label</code>, icon chỉ trang trí). Nút thu/mở là{' '}
            <code>type=&quot;button&quot;</code> và nói trạng thái bằng{' '}
            <code>aria-expanded</code>. Mục đang xem và mảnh cuối đường dẫn đều mang{' '}
            <code>aria-current=&quot;page&quot;</code>. Ô tròn <code>UserCard</code> thu
            gọn nhận tiêu điểm, đọc ra họ tên, dòng phụ đi theo tooltip thành mô tả. (Các
            điểm trên vá 24/09/2026, B7½ — sách tra bản B7 ghi chúng là chỗ yếu.){' '}
            <b>Còn yếu, ghi thật:</b> (1) số việc ở rail thu gọn chỉ nằm trong tooltip —
            trình đọc chỉ nghe khi tooltip đang mở (tức là khi Tab tới, không phải khi đọc
            lướt danh sách link); (2) <code>Count</code> chỉ đọc ra con số trần, không nói
            “việc” hay “quá hạn”.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Rail dùng <code>next/link</code> — prefetch, chạy <code>loading.tsx</code>,
              giữ trạng thái vỏ.
            </>
          ),
          dont: (
            <>
              <code>&lt;a href&gt;</code> trần: tải lại cả trang, màn trắng một nhịp.
              Đường dẫn của TopBar cũng đã chuyển sang <code>next/link</code> (B7½,
              24/09/2026).
            </>
          ),
          source:
            'chủ dự án báo 14/09/2026 “chuyển trang không có loading” — chú thích đầu kit/Nav.tsx',
        },
        {
          do: 'Đường dẫn bắt đầu từ mục đang xem.',
          dont: 'Lặp tên phòng ở mảnh đầu đường dẫn khi rail đã in nó.',
          source: 'đo vỏ v3 ngày 08/09/2026 — chú thích THANH TRÊN, kit/Nav.tsx',
        },
        {
          do: (
            <>
              <code>Count</code> đỏ chỉ cho việc quá hạn; 0 thì không hiện.
            </>
          ),
          dont: 'Tô đỏ mọi huy hiệu, kể cả “12 đơn nháp” — đỏ khắp nơi thì hết là tín hiệu.',
          source:
            'v3 tô đỏ mọi badge — chú thích NavRailLink.tsx và SỐ ĐẾM trong kit/Nav.tsx',
        },
        {
          do: 'Vỏ dựng một lần ở layout (Shell nằm ở layout, không ở page).',
          dont: 'Màn nghiệp vụ tự vẽ lại thanh điều hướng của mình.',
          source:
            'CLAUDE.md “Shell nằm ở layout”; chú thích đầu design-lab/thanh-phan/page.tsx',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
