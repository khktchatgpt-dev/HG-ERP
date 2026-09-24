'use client'

import { useId, useState } from 'react'
import { Btn, PermHint } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/** Nút đang chạy — bấm là vào trạng thái `busy`, bấm lần nữa không gửi đôi. */
function BusyDemo() {
  const [busy, setBusy] = useState(false)
  const [lan, setLan] = useState(0)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn
        primary
        icon="luuNhap"
        busy={busy}
        onClick={() => {
          setLan((n) => n + 1)
          setBusy(true)
        }}
      >
        {busy ? 'Đang lưu…' : 'Lưu nháp'}
      </Btn>
      <Btn onClick={() => setBusy(false)}>Giả lập server trả lời</Btn>
      <span className="text-k-sm text-[var(--ink-2)]">
        Số lần gửi thật: <b className="num">{lan}</b>
      </span>
    </div>
  )
}

/** Khoá mềm do chỗ gọi đặt — `aria-disabled` + lý do in ra, nối vào nút. */
function SoftLockDemo() {
  const whyId = useId()
  const [lan, setLan] = useState(0)
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          primary
          icon="gui"
          aria-disabled
          aria-describedby={whyId}
          onClick={() => setLan((n) => n + 1)}
        >
          Gửi Giám đốc duyệt
        </Btn>
        <span className="text-k-sm text-[var(--ink-2)]">
          Số lần gửi thật: <b className="num">{lan}</b>
        </span>
      </div>
      <p id={whyId} className="text-k-sm text-[var(--ink-2)]">
        Dòng NK-0056 chưa có đơn giá — điền giá rồi mới gửi được.
      </p>
    </div>
  )
}

export default function DocBtn() {
  return (
    <CompDoc
      family="btn"
      summary={
        <>
          Nút hành động. Hai trục: <b>nghĩa</b> (thường · chính · nguy hiểm) và{' '}
          <b>khoá</b> — khoá theo quyền (<code>blockedBy</code>) nói ai giữ quyền và vẫn
          Tab tới được; <code>busy</code> chặn gửi đôi mà không đánh rơi tiêu điểm;{' '}
          <code>href</code> biến nút thành liên kết thật. <code>PermHint</code> là câu
          giải thích quyền đặt cạnh một khối nút.
        </>
      }
      useWhen="người dùng bấm để LÀM một việc (gửi duyệt, lưu nháp, xoá dòng) hoặc để đi sang một màn khác từ đầu trang."
      avoidWhen={
        <>
          nút nằm trong dải lệnh của chứng từ (dùng <code>Action</code> trong{' '}
          <code>ActionPane</code>), chip lọc trên bảng (dùng <code>Chip</code>), hoặc mã
          chứng từ bấm để mở (dùng <code>Code as=&quot;a&quot;</code>).
        </>
      }
      variants={[
        {
          name: 'Thường · chính · nguy hiểm',
          when: 'một nút chính cho việc nên làm tiếp; đỏ chỉ cho việc không lùi lại được.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <Btn primary icon="gui">
                Gửi duyệt
              </Btn>
              <Btn icon="luuNhap">Lưu nháp</Btn>
              <Btn icon="in">In phiếu</Btn>
              <Btn danger icon="xoa">
                Xoá dòng
              </Btn>
              <Btn primary danger icon="huy">
                Huỷ đơn đã gửi NCC
              </Btn>
            </div>
          ),
        },
        {
          name: 'Khoá theo quyền + PermHint',
          when: 'người xem không giữ quyền làm việc này. Nút nói ai giữ; câu dưới nói phải làm gì.',
          demo: (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <Btn primary icon="duyet" blockedBy="Giám đốc">
                  Duyệt chi
                </Btn>
                <Btn icon="tien" blockedBy="Kế toán">
                  Ghi nhận thanh toán
                </Btn>
              </div>
              <PermHint owner="Kế toán" />
            </div>
          ),
        },
        {
          name: 'Đang chạy',
          when: 'việc đã gửi đi, chờ server. Bấm thử hai lần — số lần gửi thật chỉ tăng một.',
          demo: <BusyDemo />,
        },
        {
          name: 'Liên kết — href',
          when: 'nút ĐI TỚI một màn. Mở được bằng chuột giữa / Ctrl+bấm, hiện URL ở thanh trạng thái. target / rel chỉ có nghĩa ở nhánh này.',
          demo: (
            <div className="flex flex-wrap gap-2">
              <Btn href="/design-lab/mau-erp" icon="mo">
                Mở màn chứng từ mẫu
              </Btn>
              <Btn href="/design-lab/mau-erp" icon="mo" target="_blank" rel="noopener">
                Mở ở tab mới
              </Btn>
              <Btn href="/design-lab/mau-erp" icon="mo" blockedBy="Cung ứng">
                Mở — nhưng bị khoá (vẫn là nút, không đi)
              </Btn>
            </div>
          ),
        },
        {
          name: 'Khoá mềm không theo quyền — aria-disabled',
          when: 'chưa đủ điều kiện (thiếu đơn giá, chưa chọn dòng) chứ không phải thiếu quyền. Chỗ gọi tự in lý do cạnh nút và nối bằng aria-describedby.',
          demo: <SoftLockDemo />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Thường: nền thẻ trắng, viền mảnh. Chính: nền đặc màu hành động. Nguy hiểm: viền + chữ đỏ. Chính nguy hiểm: nền đỏ đặc.',
          behaves: 'Mặc định type="button" — không nộp form ngoài ý muốn.',
        },
        {
          state: 'Rê chuột',
          looks:
            'Thường: viền đậm lên, nền xám nhạt. Chính: nền đậm hơn. Nguy hiểm: nền đỏ nhạt. Chính nguy hiểm: sáng lên.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks:
            'Vòng 2px màu hành động, cách mép 1px (luật chung của .kit, chỉ khi đi bằng phím).',
          behaves: 'Enter / Space kích hoạt.',
        },
        {
          state: 'Đang chạy',
          looks:
            'Vòng quay thay chỗ icon; nền xám đặc, chữ nhạt, con trỏ cấm. Bật "giảm chuyển động" thì vòng đứng yên, hở một góc (quay chỉ dưới motion-safe). Chữ nút KHÔNG tự đổi — chỗ gọi tự đổi ("Đang lưu…").',
          behaves:
            'aria-busy. Cú bấm bị nuốt nhưng nút không disabled, nên tiêu điểm ở lại nút.',
        },
        {
          state: 'Bị chặn (theo quyền)',
          looks:
            'Nền xám đặc + chữ tương phản 5,3:1 — không làm mờ. Rê chuột hiện tooltip "Việc này do … quản lý".',
          behaves:
            'Khoá MỀM: aria-disabled, vẫn Tab tới, cú bấm và Enter bị nuốt. Có href thì vẫn là nút, không đi.',
        },
        {
          state: 'Bị chặn (aria-disabled của chỗ gọi)',
          looks: 'Cùng dáng xám như trên, không tooltip — lý do do chỗ gọi tự in ra.',
          behaves:
            'Cũng là khoá MỀM: vẫn Tab tới, cú bấm bị nuốt, có href thì không thành liên kết. aria-describedby của chỗ gọi được giữ. (Trước 24/09/2026 — B7½ — nút tự đặt aria-disabled đè lên giá trị của chỗ gọi, nên chỗ nào cần khoá có lý do đều phải dùng disabled thật.)',
        },
        {
          state: 'Bị chặn (disabled)',
          looks: 'Cùng dáng xám như trên, không tooltip.',
          behaves:
            'Khoá CỨNG: rơi khỏi thứ tự Tab, không nói vì sao. Chỉ dùng khi lý do đã hiện ngay cạnh.',
        },
      ]}
      a11y={{
        role: 'button · link (khi có href và không khoá)',
        keys: [
          {
            key: 'Tab',
            does: 'Tới nút — kể cả nút khoá mềm (theo quyền hay aria-disabled) và nút đang chạy.',
          },
          { key: 'Enter / Space', does: 'Kích hoạt. Bị nuốt khi khoá hoặc đang chạy.' },
          { key: 'Ctrl + bấm', does: 'Nút có href: mở tab mới như mọi liên kết.' },
        ],
        reader: (
          <>
            Đọc tên theo chữ nút; icon là trang trí nên không chen vào tên. Nút khoá theo
            quyền đọc thành “mờ / không dùng được” kèm mô tả “Việc này do Kế toán quản lý”
            (qua <code>aria-describedby</code>) — lý do là MÔ TẢ, không lẫn vào tên. Có
            test canh cả hai. Nhánh <code>href</code> chuyển mọi thuộc tính xuống liên kết
            — <code>aria-*</code>, <code>id</code>, <code>onClick</code>,{' '}
            <code>target</code>, <code>rel</code>, <code>data-*</code> — trừ thứ chỉ nút
            mới hiểu (<code>type</code>, <code>disabled</code>, <code>form*</code>,{' '}
            <code>name</code>, <code>value</code>); nên liên kết chỉ có icon vẫn mang tên
            từ <code>aria-label</code> (đã sửa 24/09/2026, B7½ — trước đó chỉ{' '}
            <code>title</code> đi xuống, liên kết icon thành liên kết câm).{' '}
            <b>Hai chỗ chưa tốt, ghi thật:</b> (1) <code>busy</code> chỉ đặt{' '}
            <code>aria-busy</code> — nhiều trình đọc không báo gì, nên chỗ gọi phải tự đổi
            chữ nút; (2) <code>PermHint</code> là đoạn văn thường, không nối vào nút nào
            bằng <code>aria-describedby</code> — trình đọc chỉ gặp nó theo thứ tự trang.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              <code>blockedBy=&quot;Kế toán&quot;</code> — nút nói TRƯỚC là nó khoá, và
              khoá vì ai.
            </>
          ),
          dont: 'Cho bấm rồi mới báo "không có quyền" về một ô mà hộp thoại không hề có.',
          source: 'JSDoc của Btn (kit/Primitives.tsx) — ca min_stock ngày 08/09/2026',
        },
        {
          do: 'Khoá theo quyền là khoá mềm: Tab tới được, nghe được lý do.',
          dont: (
            <>
              <code>disabled</code> thật cho nút khoá quyền — nút rơi khỏi thứ tự Tab,
              người dùng trình đọc không bao giờ nghe được “việc này do ai”.
            </>
          ),
          source: 'B4 đổi hành vi — chú thích ở kit.a11y.test.tsx, mục "Btn — nút"',
        },
        {
          do: (
            <>
              <code>href</code> cho điều hướng.
            </>
          ),
          dont: (
            <>
              <code>onClick=&#123;() =&gt; router.push(…)&#125;</code> — không mở được tab
              mới, không hiện URL; hay <code>&lt;a&gt;</code> trần — tải lại cả tài liệu,
              trắng màn.
            </>
          ),
          source: 'commit f668713 “perf(kit): điều hướng bằng next/link”',
        },
        {
          do: 'Khoá = nền xám đặc, chữ vẫn đọc được.',
          dont: 'Làm mờ bằng opacity — chữ tụt còn ~2,2:1, không đọc nổi việc gì đang bị chặn.',
          source:
            'chú thích btnVariants (kit/Primitives.tsx); CLAUDE.md nguyên tắc 5, siết 16/09/2026',
        },
        {
          do: (
            <>
              Động từ quen thuộc (In, Xoá, Duyệt, Ghi sổ…) luôn kèm prop <code>icon</code>
              .
            </>
          ),
          dont: 'Nút "Xoá dòng" trơn giữa một thanh 6–8 nút có icon.',
          source: 'luật lint hg/kit-icon (eslint-rules/hg-ui.mjs), lỗi missing',
        },
      ]}
      tested={{ file: 'src/components/kit/kit.a11y.test.tsx' }}
    />
  )
}
