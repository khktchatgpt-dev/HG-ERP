'use client'

import { useState } from 'react'
import { PrimaryStep } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — PrimaryStep (B7, 24/09/2026).
 *
 * Chưa màn thật nào dùng (grep 24/09/2026) — màn đơn mua đặt hành động trong
 * `ActionPane`. Ví dụ dưới đây là toàn bộ bằng chứng sống.
 */
function SanSang() {
  const [gui, setGui] = useState(false)
  return (
    <div className="flex items-center justify-end gap-3">
      {gui && (
        <span className="text-k-sm text-[var(--ink-2)]">
          Đã gọi onClick — màn thật sẽ gửi đơn rồi làm mới.
        </span>
      )}
      <PrimaryStep label="Gửi Giám đốc duyệt" onClick={() => setGui(true)} />
    </div>
  )
}

export default function DocPrimaryStep() {
  return (
    <CompDoc
      family="primary-step"
      summary={
        <>
          Nút <b>bước kế tiếp duy nhất</b> của một trạng thái, to và đặc; các việc còn lại
          xuống hàng phụ. Bị chặn thì nói vì sao ngay dưới nút, căn phải, màu cảnh báo.
        </>
      }
      useWhen="một chứng từ đang ở trạng thái có đúng một bước đi tiếp tự nhiên (nháp → gửi duyệt, đã duyệt → gửi NCC)."
      avoidWhen={
        <>
          trạng thái có hai lối ngang nhau (duyệt / trả lại) — dựng hai <code>Btn</code>{' '}
          trong <code>ActionPane</code>; hoặc việc phụ, ngoại lệ — đưa vào menu ⋯.
        </>
      }
      variants={[
        {
          name: 'Sẵn sàng',
          when: 'đủ điều kiện, đúng quyền: nút chính nền đặc. Bấm thử.',
          demo: <SanSang />,
        },
        {
          name: 'Thiếu dữ liệu — why',
          when: 'câu lý do hiện NGAY dưới nút, nói cả vướng gì lẫn cách gỡ. Khoá mềm: Tab tới được, bấm thử không có gì xảy ra.',
          demo: (
            <div className="flex justify-end">
              <PrimaryStep
                label="Gửi Giám đốc duyệt"
                why="Dòng NK-0056 chưa có đơn giá — nhập giá ở lưới dòng rồi gửi lại."
              />
            </div>
          ),
        },
        {
          name: 'Không có quyền — blockedBy',
          when: 'khoá mềm: vẫn Tab tới được, rê chuột thấy “Việc này do … quản lý”.',
          demo: (
            <div className="flex justify-end">
              <PrimaryStep label="Duyệt đơn" blockedBy="Giám đốc" />
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Sẵn sàng',
          looks: 'Nút chính: nền đặc màu hành động, chữ đậm.',
          behaves: 'Bấm gọi onClick; có href thì là liên kết thật.',
        },
        {
          state: 'Thiếu dữ liệu (why)',
          looks:
            'Nút nền xám đặc, chữ nhạt, con trỏ cấm; dưới nút một câu màu cảnh báo, căn phải, rộng tối đa 220px.',
          behaves:
            'Khoá MỀM (aria-disabled): vẫn nhận tiêu điểm, cú bấm bị nuốt, câu lý do gắn vào nút qua aria-describedby. Có href cũng vẫn là nút, không điều hướng.',
        },
        {
          state: 'Không có quyền (blockedBy)',
          looks: 'Nút nền xám đặc như trên; không có dòng chữ dưới nút trừ khi kèm why.',
          behaves:
            'Khoá MỀM (aria-disabled): vẫn nhận tiêu điểm, cú bấm bị nuốt, title và aria-describedby nói “Việc này do … quản lý”.',
        },
        {
          state: 'Cả blockedBy lẫn why',
          looks: 'Nút xám + câu why dưới nút.',
          behaves:
            'Khoá mềm như hai ca trên; mô tả đọc được là câu “Việc này do … quản lý” — câu why chỉ in ra, không gắn vào nút.',
        },
      ]}
      a11y={{
        role: 'button (hoặc link khi có href và không khoá)',
        keys: [
          { key: 'Tab', does: 'Tới nút — kể cả khi đang khoá (why hoặc blockedBy).' },
          { key: 'Enter / Space', does: 'Gọi onClick khi không khoá; khoá thì bị nuốt.' },
        ],
        reader: (
          <>
            Đọc tên bước; khi khoá đọc thêm “mờ” và câu mô tả: “Việc này do Giám đốc quản
            lý” với <code>blockedBy</code>, chính câu <code>why</code> với{' '}
            <code>why</code>. Đã sửa 24/09/2026 (B7½): trước đó <code>why</code> khoá CỨNG
            bằng <code>disabled</code> — người đi bằng phím không bao giờ tới được nút, và
            câu lý do không gắn vào nút, chỉ là một đoạn chữ rời.{' '}
            <b>Chỗ chưa tốt, ghi thật:</b> truyền cả <code>blockedBy</code> lẫn{' '}
            <code>why</code> thì mô tả của <code>Btn</code> (ai giữ quyền) đè lên — câu{' '}
            <code>why</code> chỉ tới được người nhìn.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Một bước chính to lên, còn lại xuống hàng phụ hoặc menu ⋯.',
          dont: 'Bày tám nút ngang hàng rồi để người dùng tự đoán cái nào là bước kế.',
          source: 'kit/Flow.tsx — chú thích PrimaryStep',
        },
        {
          do: 'Nói vướng gì VÀ cách gỡ, ngay dưới nút, trước khi ai bấm.',
          dont: 'Cho bấm rồi mới hiện lỗi, hoặc giấu lý do trong tooltip.',
          source:
            'CLAUDE.md — luật kiểm “Hành động bị chặn phải nói vướng gì và cách gỡ, ngay tại chỗ”; nguyên tắc 5 (siết 16/09/2026)',
        },
        {
          do: (
            <>
              Chặn theo quyền bằng <code>blockedBy</code> (khoá mềm, nói ai giữ quyền).
            </>
          ),
          dont: 'Để nút bấm được rồi mới báo “không có quyền” về một ô người dùng không thấy.',
          source: 'kit/Primitives.tsx — chú thích Btn, ca min_stock 08/09/2026',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
