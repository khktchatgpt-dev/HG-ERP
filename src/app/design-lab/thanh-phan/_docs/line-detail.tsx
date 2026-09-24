'use client'

import { useState } from 'react'
import { Field, FieldGroup, LineDetail } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — khay chi tiết dòng dưới lưới (B7, 24/09/2026).
 *
 * Ruột khay là `FieldGroup` như màn thật. Tới B7 ví dụ phải dùng `FieldGrid`
 * thay thế vì tên nhóm là `<h4>` cố định cấp, đặt ngay dưới `<h2>` của trang
 * tài liệu thì axe bắt lỗi nhảy cấp; B7½ (24/09/2026) thêm `level`, nên ở đây
 * truyền `level={3}`. Cũng B7½: mũi tên của nút gấp/mở nay `aria-hidden`, và
 * nút có `aria-controls` khi khay đang mở — mục 5 tả hành vi sau khi sửa.
 */
function Ruot() {
  return (
    <FieldGroup title="Quy cách & quy đổi" level={3}>
      <Field label="Quy cách">Ống 25×25×1,2 mm</Field>
      <Field label="Quy đổi kho">
        <span className="num">84 cây</span>
      </Field>
      <Field label="Nhu cầu lệnh">
        <span className="num">480 kg</span>
      </Field>
      <Field label="Ghi chú dòng">Giao cùng đợt với khung ghế</Field>
    </FieldGroup>
  )
}

function GapDuoc() {
  const [open, setOpen] = useState(false)
  return (
    <LineDetail
      index={3}
      code="VT-ONG-2525"
      open={open}
      onToggle={() => setOpen(!open)}
      summary={open ? null : 'Ống 25×25×1,2 · 84 cây · có ghi chú'}
    >
      <Ruot />
    </LineDetail>
  )
}

export default function DocLineDetail() {
  return (
    <CompDoc
      family="line-detail"
      summary={
        <>
          Khay &quot;Chi tiết dòng&quot; nằm ngay dưới lưới, đổi theo dòng đang chọn —
          chép Dynamics Line details. Cột hiếm dùng của lưới sống ở đây, nên lưới gọn.
        </>
      }
      useWhen="một dòng có nhiều thông số ít khi cần (quy cách theo mẫu, quy đổi, chia số lượng cho lệnh, ghi chú) mà nhét hết thành cột thì lưới phải cuộn ngang."
      avoidWhen={
        <>
          thông số người dùng cần thấy ở MỌI dòng cùng lúc — để thành cột lưới; và khối
          của cả chứng từ — dùng <code>FastTab</code>.
        </>
      }
      variants={[
        {
          name: 'Gấp được — kèm câu tóm tắt',
          when: 'màn chứng từ thật. Lúc gấp, summary nói trong khay có gì để biết có nên mở không. Bấm vạch tiêu đề để mở.',
          demo: <GapDuoc />,
        },
        {
          name: 'Luôn mở — không có onToggle',
          when: 'khay ngắn, không đáng gấp. Tiêu đề là chữ tĩnh, không có mũi tên.',
          demo: (
            <LineDetail index={1} code="VT-SON-TD01">
              <Ruot />
            </LineDetail>
          ),
        },
      ]}
      states={[
        {
          state: 'Mở',
          looks:
            'Vạch trên 2px, nền --surface-raised; tiêu đề chữ hoa nhỏ "Chi tiết dòng n" + mã dòng chữ mono màu hành động.',
          behaves: 'Dựng ruột (children).',
        },
        {
          state: 'Gấp (open = false)',
          looks:
            'Chỉ còn vạch tiêu đề (~24px) với mũi tên ▸ và câu summary đẩy sát phải.',
          behaves:
            'KHÔNG dựng ruột — trạng thái bên trong (ô đang gõ) mất khi gấp. Không có onToggle thì không ai mở lại được.',
        },
        {
          state: 'Có onToggle',
          looks: 'Tiêu đề thành nút rộng cả hàng; rê chuột thì chữ đậm màu hơn.',
          behaves: 'Bấm gọi onToggle; kit không tự giữ trạng thái mở/gấp.',
        },
      ]}
      a11y={{
        role: 'button (aria-expanded, aria-controls khi mở) khi có onToggle · div khi không',
        keys: [
          {
            key: 'Tab',
            does: 'Tới nút tiêu đề (chỉ khi có onToggle), rồi vào ruột khay.',
          },
          { key: 'Enter / Space', does: 'Gấp hoặc mở khay (hành vi gốc của button).' },
        ],
        reader: (
          <>
            Đọc &quot;Chi tiết dòng 3 VT-ONG-2525 …, nút, đã thu gọn/đã mở rộng&quot;. Mũi
            tên ▾/▸ mang <code>aria-hidden</code> nên không lọt vào tên nút; khi khay mở,
            nút có <code>aria-controls</code> trỏ đúng ruột khay (gấp thì bỏ, vì ruột đã
            gỡ khỏi DOM) — cả hai sửa 24/09/2026 (B7½), test ở{' '}
            <code>erp.a11y.test.tsx</code>. <b>Hai chỗ chưa tốt, ghi thật:</b> khi không
            có onToggle thì tiêu đề là <code>&lt;div&gt;</code>, không phải thẻ tiêu đề;
            và câu summary nằm TRONG nút nên thành một phần tên nút (khác{' '}
            <code>FastTab</code>, nơi tóm tắt đã chuyển sang <code>aria-describedby</code>
            ).
          </>
        ),
      }}
      doDont={[
        {
          do: 'Cho gấp (open + onToggle), và giữ trạng thái gấp theo NGƯỜI DÙNG — đổi dòng vẫn giữ.',
          dont: 'Để khay luôn mở trên màn nhiều dòng.',
          source:
            'JSDoc prop open — đo đơn 17 dòng, khung 694px: khay chiếm 459px = 66% màn; commit c44a020 (14/09/2026)',
        },
        {
          do: 'Có summary khi gấp: một câu nói trong khay có gì.',
          dont: 'Gấp thành hộp kín — người dùng mở ra ở MỌI dòng để kiểm, tệ hơn lúc chưa gấp.',
          source: 'DonChungTuScreen.tsx, chú thích prop summary của LineDetail',
        },
        {
          do: 'Chuyển cột hiếm dùng của lưới xuống khay.',
          dont: 'Nhét mọi thông số theo mẫu thành cột, bắt lưới cuộn ngang.',
          source: 'kit/erp.css, chú thích k-linedet — theo Dynamics Line details',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
