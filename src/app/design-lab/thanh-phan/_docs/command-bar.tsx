'use client'

import { useState } from 'react'
import { CommandBar } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — CommandBar (B7, 24/09/2026).
 *
 * Thành phần của VỎ, không phải của màn: grep 24/09/2026 cho 0 màn thật dùng
 * nó (vỏ workspace dựng thanh trên riêng). Chỉ một ví dụ sống: từ B7½ `<nav>`
 * mang tên "Đường dẫn", nhưng hai thanh cùng trang vẫn là hai mốc CÙNG tên —
 * axe vẫn đúng khi kêu “mốc trang trùng nhau”.
 */
function Demo() {
  const [bam, setBam] = useState(0)
  return (
    <div className="grid gap-2">
      <div className="border border-[var(--line)]">
        <CommandBar
          brand="HG-ERP"
          crumbs={[
            { label: 'Mua hàng', href: '#' },
            { label: 'Đơn mua', href: '#' },
            { label: 'PO-2609-014' },
          ]}
          onSearch={() => setBam((n) => n + 1)}
          user={{ initials: 'NA', name: 'Nguyễn Văn A', role: 'Cung ứng' }}
        />
      </div>
      <p className="text-k-sm text-[var(--ink-2)]">
        Bấm ô “Đi tới…”: thanh chỉ gọi <code>onSearch</code> — đã gọi{' '}
        <b className="num">{bam}</b> lần. Mở hộp tìm là việc của màn gọi.
      </p>
    </div>
  )
}

export default function DocCommandBar() {
  return (
    <CompDoc
      family="command-bar"
      summary={
        <>
          Thanh lệnh một hàng cao 44px: thương hiệu, đường dẫn, ô “Đi tới…” kèm gợi ý phím{' '}
          <kbd>Ctrl</kbd> <kbd>K</kbd> (máy Apple: <kbd>⌘</kbd> <kbd>K</kbd>), và người
          đang đăng nhập. Bản gộp dành cho màn đứng <b>ngoài</b> vỏ workspace — trong vỏ
          thì thanh trên đã do layout dựng sẵn.
        </>
      }
      useWhen="một trang đứng riêng, không nằm trong WorkspaceShell (trang mẫu, trang in thử), cần đường dẫn và lối tìm nhanh ở đầu."
      avoidWhen={
        <>
          màn nghiệp vụ trong workspace — vỏ đã có <code>TopBar</code>/
          <code>NavRail</code>; vẽ thêm một thanh là hai đường dẫn chồng nhau. Đường dẫn
          của một chứng từ thì dùng <code>Crumb</code>.
        </>
      }
      variants={[
        {
          name: 'Đường dẫn ba mắt + ô tìm',
          when: 'mắt cuối không có href = trang đang đứng, in đậm và mang aria-current. Bấm ô tìm để thấy thanh chỉ báo lên, không tự làm gì. Không truyền onSearch thì không có ô tìm.',
          demo: <Demo />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Nền thẻ, vạch đáy; mắt đường dẫn có href là chữ phụ, mắt cuối đậm màu mực; ô tìm viền mảnh, chữ nhạt.',
          behaves:
            'Mắt có href là thẻ <a> thật (tải lại cả trang — khác TopBar dùng next/link). Ô tìm là <button type="button">, đặt trong form cũng không nộp form.',
        },
        {
          state: 'Không có onSearch',
          looks: 'Không có ô tìm; thẻ người dùng dạt về mép phải.',
          behaves: 'Không vẽ nút nào — một nút bấm không làm gì là lời hứa suông.',
        },
        {
          state: 'Rê chuột',
          looks:
            'Mắt đường dẫn đổi màu hành động + gạch chân; ô tìm đổi viền sang màu hành động.',
          behaves: 'Không đổi gì khác.',
        },
        {
          state: 'Tiêu điểm (Tab)',
          looks: 'Vòng 2px màu hành động — luật chung :focus-visible của .kit.',
          behaves: 'Enter/Space trên ô tìm gọi onSearch, như bấm chuột.',
        },
      ]}
      a11y={{
        role: 'navigation “Đường dẫn” + button (khi có onSearch)',
        keys: [
          { key: 'Tab', does: 'Đi qua các mắt có href, rồi tới ô tìm.' },
          { key: 'Enter / Space', does: 'Trên ô tìm: gọi onSearch.' },
          {
            key: 'Ctrl+K / ⌘K',
            does: 'KHÔNG làm gì — thanh chỉ vẽ phím, không bắt phím. Màn gọi phải tự gắn.',
          },
        ],
        reader: (
          <>
            Đọc “Đường dẫn, điều hướng”, các mắt đường dẫn (dấu “/” ngăn cách bị ẩn khỏi
            trình đọc), mắt cuối kèm “trang hiện tại”, rồi nút “Đi tới lệnh, đơn, vật tư…
            Ctrl K”. Gợi ý phím theo máy người xem: Windows “Ctrl”, Apple “⌘”; HTML dựng ở
            server luôn là “Ctrl” rồi đổi sau khi hydrate — không lệch hydrate. (Mốc có
            tên, <code>aria-current</code>, <code>type=&quot;button&quot;</code> và phím
            theo máy đều vá 24/09/2026, B7½ — trước đó phím luôn in ⌘ kể cả trên Windows.){' '}
            <b>Chỗ chưa tốt, ghi thật:</b> <code>aria-current</code> chỉ gắn khi mắt cuối
            KHÔNG có <code>href</code>; mắt có href vẫn là <code>&lt;a&gt;</code> trần;
            hai thanh trên một trang vẫn là hai mốc cùng tên “Đường dẫn”.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Để vỏ workspace dựng thanh trên một lần cho mọi màn.',
          dont: 'Tự vẽ lại thanh điều hướng bên trong một màn nghiệp vụ.',
          source:
            'design-lab/thanh-phan/page.tsx — chú thích mục 10 “Vỏ ứng dụng”: thứ của SHELL không thuộc màn',
        },
        {
          do: 'Gắn Ctrl+K/⌘K thật và một hộp tìm tốt TRƯỚC khi bỏ thanh bên.',
          dont: 'Bỏ sidebar khi lối tìm còn là ô trang trí — khoá người dùng ra ngoài.',
          source:
            'kit/Shell.tsx — chú thích CommandBar: chuyển đổi ba bước, thêm ⌘K → theo dõi 2 tuần → mới bỏ sidebar',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
