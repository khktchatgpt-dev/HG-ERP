'use client'

import { useState } from 'react'
import { NoticeBar } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/** Dải có đường đi tiếp — bấm là thấy việc được gọi, không phải nút gạt người. */
function CoViec() {
  const [bam, setBam] = useState(0)
  return (
    <div className="grid gap-1">
      <NoticeBar
        tone="warn"
        tag="Lệnh trống"
        action={{ label: 'Vật tư theo lệnh', onClick: () => setBam((n) => n + 1) }}
      >
        <b>3 lệnh</b> đang chạy chưa có đơn mua nào.
      </NoticeBar>
      <span className="text-k-label text-[var(--ink-3)]">
        (ví dụ: đã bấm <span className="num">{bam}</span> lần — màn thật đi sang trang Vật
        tư theo lệnh)
      </span>
    </div>
  )
}

function ChanGui() {
  const [mo, setMo] = useState(false)
  return (
    <div className="grid gap-1">
      <NoticeBar
        tone="stop"
        tag="Chặn gửi"
        action={{ label: 'Xem hạn mức duyệt', onClick: () => setMo((x) => !x) }}
      >
        Đơn trên 100 triệu mà chưa có hạn mức duyệt — chưa gửi Giám đốc được.
      </NoticeBar>
      {mo && (
        <span className="text-k-sm text-[var(--ink-2)]">
          Hạn mức hiện tại: trưởng phòng Cung ứng duyệt tới 100.000.000 đ.
        </span>
      )}
    </div>
  )
}

export default function DocNoticeBar() {
  return (
    <CompDoc
      family="notice-bar"
      summary={
        <>
          Dải một dòng sát mép, nói tin mà <b>cả màn</b> phải biết: nhãn ngắn + một câu +
          (tuỳ) đường đi tiếp. Công thức: hiện trạng → vì sao → ai phải làm gì. Thay cho
          “Cảnh báo: có lỗi”.
        </>
      }
      useWhen="tin áp cho cả màn hay cả bảng: sổ bị cắt đuôi, mấy lệnh chưa có đơn, đơn bị chặn gửi vì hạn mức."
      avoidWhen={
        <>
          lỗi của một ô (báo ngay cạnh ô), kết quả của một thao tác vừa làm (dùng{' '}
          <code>Toast</code>), cảnh báo sửa danh mục đang được dùng (dùng{' '}
          <code>MasterWarn</code>), hay vùng không có gì (dùng <code>Empty</code>).
        </>
      }
      variants={[
        {
          name: 'Có đường đi tiếp',
          when: 'tin kéo theo một việc. Nhãn nút nói ĐI ĐÂU, câu không nhắc lại.',
          demo: <CoViec />,
        },
        {
          name: 'Chỉ để biết — không action',
          when: 'không có việc gì để làm ngay. Bỏ hẳn action, đừng bịa một nút.',
          demo: (
            <NoticeBar tone="warn" tag="Cắt đuôi">
              Sổ chạm trần <b>1.000 đơn</b> — số trên màn có thể thiếu.
            </NoticeBar>
          ),
        },
        {
          name: 'Chặn — tone stop',
          when: 'có thứ đang CHẶN việc chính của màn. Nền đỏ nhạt.',
          demo: <ChanGui />,
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Dải tràn ngang, vạch đáy. stop: nền đỏ nhạt; MỌI tone khác (warn, done, neutral) đều nền vàng nhạt — chỉ màu chữ nhãn đổi.',
          behaves:
            'Tĩnh; chỉ nút action (nếu có) tương tác được. Hiện ra là được trình đọc thông báo (status, hoặc alert khi tone stop).',
        },
        {
          state: 'Rê chuột',
          looks: 'Nút action gạch chân.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động quanh nút action.',
          behaves: 'Enter / Space gọi onClick.',
        },
      ]}
      a11y={{
        role: 'status (mọi tone trừ stop) · alert (tone stop) · nút action là button',
        keys: [
          { key: 'Tab', does: 'Tới nút action (nếu có).' },
          { key: 'Enter / Space', does: 'Gọi action.onClick.' },
        ],
        reader: (
          <>
            Đọc nhãn, câu, rồi tên nút theo thứ tự trang. Dải là vùng thông báo: tone{' '}
            <code>stop</code> là <code>role=&quot;alert&quot;</code> — thứ đang chặn việc
            chính nên chen ngang câu đang đọc; mọi tone khác là{' '}
            <code>role=&quot;status&quot;</code>, chờ trình đọc nói xong. Nên dải hiện ra
            sau khi lọc hay sau khi bấm gửi được thông báo, người không nhìn màn hình cũng
            biết. Mũi tên “→” nằm ngoài tên nút (<code>aria-hidden</code>), và nút có{' '}
            <code>type=&quot;button&quot;</code> — nằm trong <code>&lt;form&gt;</code> bấm
            không nộp form. (Cả ba sửa 24/09/2026, B7½.) <b>Ghi thật:</b> action là{' '}
            <code>onClick</code>, không phải liên kết, nên không mở tab mới được.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Không có việc để làm thì bỏ action — dải chỉ để biết.',
          dont: 'Bịa một nhãn rồi để trống onClick: trông bấm được, bấm thì không có gì xảy ra.',
          source:
            'JSDoc của action (kit/Primitives.tsx) — prop thôi bắt buộc từ 17/09/2026',
        },
        {
          do: 'Một câu. Nút bên phải đã nói đi đâu.',
          dont: 'Giải thích thêm hai vế trên một thanh màu vàng nằm giữa bộ lọc và bảng — chữ đọc một lần rồi thừa mãi mãi.',
          source: 'chú thích dải "Lệnh trống" trong mua-hang/don/DonScreen.tsx',
        },
      ]}
      tested={{ file: 'src/components/kit/primitives.a11y.test.tsx' }}
    />
  )
}
