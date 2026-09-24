'use client'

import {
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  StatusBar,
  StatusTrack,
} from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `DocScreen` / `DocBody` / `StatusBar` — bộ xương Khuôn D (B7, 24/09/2026).
 *
 * Ba mảnh này không tự làm gì: chúng chỉ đặt chỗ. Nên trang này nói nhiều về
 * THỨ TỰ và BỐ CỤC hơn là hành vi, và nói thật rằng thanh đáy là chữ trơn —
 * trình đọc màn hình không biết nó là thanh trạng thái.
 */

function Than({ aside }: { aside?: boolean }) {
  return (
    <DocBody
      aside={
        aside ? (
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <FactKv
                rows={[
                  ['Giao đúng hẹn', <span key="a" className="num">8 / 9 đơn</span>], // prettier-ignore
                  ['Giá lần trước', <span key="b" className="num">352.000 ₫</span>], // prettier-ignore
                ]}
              />
            </FactSection>
          </FactBox>
        ) : undefined
      }
    >
      <FastTab title="Tổng quan" defaultOpen summary={[['Kho nhận', 'Kho vật tư chính']]}>
        <div className="text-k-sm text-[var(--ink-2)]">
          Nhà cung cấp Cơ khí Thành Đạt · hạn giao 07/09/2026.
        </div>
      </FastTab>
    </DocBody>
  )
}

const thanhDay = (
  <StatusBar
    left={[
      <>
        <b>Nguyễn Văn A</b> · Cung ứng
      </>,
      'Công ty Hoàng Gia · Xưởng Bình Dương',
      'Ngày làm việc 09/09/2026',
    ]}
    right="PO-2609-014 · bản ghi 14/68"
  />
)

export default function DocDocScreen() {
  return (
    <CompDoc
      family="doc-screen"
      summary={
        <>
          Bộ xương của màn chứng từ (Khuôn D). <code>DocScreen</code> gắn lớp token và xếp
          các khối theo cột dọc; <code>DocBody</code> chia thân thành cột chính + cột dữ
          kiện bên phải; <code>StatusBar</code> là thanh đáy nói người dùng là ai, đang ở
          đơn vị nào, bản ghi thứ mấy.
        </>
      }
      useWhen="dựng một màn trả lời “tờ này ở đâu, ai giữ, vướng gì” — đơn mua, lệnh sản xuất, phiếu nhập — xem ráp đủ ở /design-lab/mau-erp."
      avoidWhen={
        <>
          màn danh sách hay bàn làm việc (Khuôn A, B, C) — dùng <code>ScreenFrame</code>;
          hồ sơ danh mục (Khuôn E) không có vòng đời duyệt nên không cần{' '}
          <code>DocHead</code> + <code>StatusTrack</code> đi kèm bộ xương này.
        </>
      }
      variants={[
        {
          name: 'Thân có cột dữ kiện (aside)',
          when: 'người duyệt cần biết NCC giao đúng hẹn mấy lần, giá lần trước bao nhiêu mà không rời chứng từ. Cột phải 268px, chỉ đứng cạnh từ 1100px trở lên.',
          demo: (
            <DocScreen>
              <DocHead kind="Đơn đặt vật tư" code="PO-2609-014" compact>
                <StatusTrack
                  label="Trạng thái đơn"
                  steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi NCC']}
                  at={1}
                  tone="wait"
                />
              </DocHead>
              <Than aside />
              {thanhDay}
            </DocScreen>
          ),
        },
        {
          name: 'Thân trọn bề ngang, mật độ dày',
          when: 'chứng từ nhiều dòng (lệnh 40 chi tiết) — bỏ aside để lưới chiếm hết chỗ, bật dense để hàng 25px.',
          demo: (
            <DocScreen dense>
              <Than />
              {thanhDay}
            </DocScreen>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Phẳng: không thẻ nổi, các khối ngăn bằng một vạch mảnh; thanh đáy nền chrome, chữ mono nhỏ.',
          behaves: 'Tĩnh. Không mảnh nào nhận focus hay sự kiện.',
        },
        {
          state: 'Có aside, màn ≥ 1100px',
          looks: 'Hai cột: chính co giãn, phải 268px.',
          behaves: 'Hẹp hơn 1100px thì cột phải rơi xuống dưới cột chính.',
        },
        {
          state: 'Dày (dense)',
          looks: 'Hàng bảng 25px, đệm ô dọc 2px (thường: 30px, 5px).',
          behaves: 'Chỉ đổi token mật độ cho mọi thứ bên trong; không đổi bố cục.',
        },
      ]}
      a11y={{
        role: '(không có — div bố cục)',
        keys: [{ key: '—', does: 'Không nhận phím; các khối con mới nhận.' }],
        reader: (
          <>
            Đọc theo thứ tự DOM: thanh định vị → thanh hành động → đầu chứng từ → thân →
            cột dữ kiện → thanh đáy. <b>Chưa tốt, ghi thật:</b> không mảnh nào mang
            landmark — <code>DocBody</code> không phải <code>main</code>,{' '}
            <code>StatusBar</code> không có <code>role=&quot;status&quot;</code> hay{' '}
            <code>contentinfo</code> — nên người dùng trình đọc không nhảy thẳng tới thân
            hay thanh đáy được. Cột phải chỉ là landmark khi nó là <code>FactBox</code>{' '}
            (thẻ <code>aside</code>).
          </>
        ),
      }}
      doDont={[
        {
          do: 'Để các khối PHẲNG, ngăn nhau bằng một vạch mảnh, lưới sát mép.',
          dont: 'Bọc FastTab / FactBox trong thẻ nổi bo góc có lề 7–14px.',
          source:
            'CLAUDE.md nguyên tắc 4; chú thích .k-ft trong erp.css — chủ dự án chấm màn Đơn mua “vẫn có khoảng rộng xung quanh” (10/09/2026)',
        },
        {
          do: 'Thanh đáy nói NGỮ CẢNH: người dùng, công ty · xưởng, bản ghi thứ mấy.',
          dont: 'Bỏ thanh đáy vì “thừa với người quen web”.',
          source:
            'chú thích mục 11 trong kit/Erp.tsx — ERP chạy nhiều công ty / nhiều kho, nhập nhầm đơn vị là hỏng sổ',
        },
        {
          do: (
            <>
              Bảng dài cần tiêu đề + chân dính thì đặt trong <code>ScreenFrame</code>.
            </>
          ),
          dont: (
            <>
              Đặt <code>min-h-screen</code> ở cha — bảng không bao giờ cuộn trong khung,
              cả hai thứ dính đều vô hiệu.
            </>
          ),
          source: 'CLAUDE.md, luật kiểm trước khi coi màn là xong',
        },
      ]}
      tested={{
        missing:
          'ba mảnh chỉ là div bố cục, chưa test nào dựng chúng; trang này qua axe trong kit-docs.test.tsx nhưng đó không phải test hành vi.',
      }}
    />
  )
}
