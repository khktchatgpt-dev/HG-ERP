'use client'

import { useState } from 'react'
import { Action, ActionGroup, ActionPane } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `ActionPane` — thanh hành động của chứng từ, chép Dynamics 365 F&O
 * (B7, 24/09/2026).
 *
 * Câu chuyện chính của họ này là KHOÁ MỀM (16/09/2026): nút bị khoá vẫn bấm
 * được để hỏi lý do. Khi viết trang này (B7) đo ra nút `primary` bị khoá mềm
 * vẫn nền đặc màu hành động; B7½ (24/09/2026) đã sửa ở erp.css — mục 4 kể lại.
 */

function HaiTab() {
  const [tab, setTab] = useState<'don' | 'nhan'>('don')
  return (
    <ActionPane
      tabs={[
        { label: 'Đơn hàng', active: tab === 'don', onClick: () => setTab('don') },
        { label: 'Nhận hàng', active: tab === 'nhan', onClick: () => setTab('nhan') },
        { label: 'Tài chính', disabled: true, title: 'Phân hệ Kế toán chưa mở' },
      ]}
    >
      {tab === 'don' ? (
        <>
          <ActionGroup label="Duy trì">
            <Action icon="sua" strong>
              Sửa
            </Action>
            <Action icon="saoChep">Sao chép</Action>
          </ActionGroup>
          <ActionGroup label="Luồng phê duyệt">
            <Action icon="gui" primary>
              Gửi duyệt
            </Action>
            <Action icon="traLai">Rút về nháp</Action>
          </ActionGroup>
          <ActionGroup label="In">
            <Action icon="in">In phiếu</Action>
          </ActionGroup>
        </>
      ) : (
        <ActionGroup label="Nhận hàng">
          <Action icon="nhanHang" primary>
            Nhận hàng
          </Action>
          <Action icon="huy">Đóng thiếu</Action>
        </ActionGroup>
      )}
    </ActionPane>
  )
}

export default function DocActionPane() {
  return (
    <CompDoc
      family="action-pane"
      summary={
        <>
          Thanh hành động của chứng từ: nút <b>bày sẵn</b>, chia nhóm, mỗi nhóm có nhãn
          bên dưới. Nút bị khoá <b>nói lý do tại chỗ</b> — bấm vào là hiện một dòng ngay
          dưới thanh, không giấu trong tooltip.
        </>
      }
      useWhen="đầu màn chứng từ, ngay dưới Crumb — mọi việc làm được trên tờ này (sửa, gửi duyệt, nhận hàng, in) đứng yên một chỗ để người dùng bấm bằng trí nhớ vị trí."
      avoidWhen={
        <>
          màn danh sách hay bàn làm việc — ở đó dùng <code>CommandBar</code> hoặc{' '}
          <code>Btn</code>. Thao tác trên DÒNG của lưới cũng không nhét vào thanh này:
          dùng <code>GridToolbar</code>.
        </>
      }
      variants={[
        {
          name: 'Tab phân hệ + nhóm nút',
          when: 'chứng từ có nhiều mảng việc. Bấm “Nhận hàng” để đổi nhóm nút; tab “Tài chính” mờ vì phân hệ chưa mở — hiện ra để người dùng biết nó SẼ có.',
          demo: <HaiTab />,
        },
        {
          name: 'Nút khoá mềm — bấm để hỏi lý do',
          when: 'việc chưa làm được. Truyền disabled + title; bấm “Nhận hàng” để thấy lý do hiện dưới thanh.',
          demo: (
            <ActionPane>
              <ActionGroup label="Duy trì">
                <Action icon="sua" strong>
                  Sửa
                </Action>
              </ActionGroup>
              <ActionGroup label="Nhận hàng">
                <Action
                  icon="nhanHang"
                  disabled
                  title="Đơn chưa gửi NCC — gửi đơn ở nhóm Luồng phê duyệt trước, rồi mới nhận hàng được."
                >
                  Nhận hàng
                </Action>
                <Action icon="in">In phiếu nhập</Action>
              </ActionGroup>
            </ActionPane>
          ),
        },
        {
          name: 'Nút CHÍNH bị khoá mềm',
          when: 'hành động chính của màn chưa làm được. Nút mất nền đặc — nền đặc chỉ dành cho thứ bấm được — nhưng giữ chữ đậm để vẫn nhận ra đâu là việc chính. Bấm “Gửi duyệt” để thấy lý do.',
          demo: (
            <ActionPane>
              <ActionGroup label="Luồng phê duyệt">
                <Action
                  icon="gui"
                  primary
                  disabled
                  title="Dòng 3 chưa có đơn giá — nhập giá ở lưới Dòng hàng rồi gửi lại."
                >
                  Gửi duyệt
                </Action>
                <Action icon="traLai">Rút về nháp</Action>
              </ActionGroup>
            </ActionPane>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Nút viền mảnh nền trắng; nhãn nhóm in hoa nhỏ căn trái dưới hàng nút; nhóm ngăn bằng vạch tóc.',
          behaves:
            'Rộng thì các nhóm xuống hàng; khung hẹp hơn 1100px thì thành dải ngang cuộn được, mép có bóng khi còn nút khuất.',
        },
        {
          state: 'Chính (primary)',
          looks: 'Nền đặc màu hành động, chữ đậm. Nền đặc = bấm được.',
          behaves: 'Mỗi màn chỉ nên có một.',
        },
        {
          state: 'Đậm (strong)',
          looks: 'Chữ đậm, nền không đổi.',
          behaves: 'Hành động hay dùng nhất trong nhóm.',
        },
        {
          state: 'Rê chuột',
          looks: 'Nút thường nền xám nhạt; nút chính sáng hơn 8%.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động (:focus-visible chung của .kit).',
          behaves: 'Chỉ khi đi bằng bàn phím.',
        },
        {
          state: 'Khoá mềm (disabled + title, trong ActionPane)',
          looks: 'Nền xám đặc, chữ xám, không đậm; con trỏ dấu hỏi.',
          behaves:
            'aria-disabled, vẫn bấm được: bấm thì dòng “CHƯA BẤM ĐƯỢC · lý do” hiện dưới thanh (role=status), có nút × đóng. onClick KHÔNG được gọi.',
        },
        {
          state: 'Khoá cứng (thiếu title, hoặc ngoài ActionPane)',
          looks: 'Như khoá mềm, con trỏ cấm.',
          behaves:
            'disabled thật — bấm không có gì xảy ra. “Thà một nút chết còn hơn một nút bấm vào im lặng.”',
        },
        {
          state: 'Chính + khoá (mềm hoặc cứng)',
          looks:
            'Nền xám đặc, chữ xám như mọi nút khoá — KHÔNG còn nền --act; riêng chữ vẫn đậm để nhận ra việc chính.',
          behaves:
            'Như khoá mềm / khoá cứng ở trên. Đã sửa 24/09/2026 (B7½): luật .k-act-p.k-act-off nay đứng SAU .k-act-p trong erp.css. Trước đó .k-act-p khai sau, cùng độ ưu tiên nên thắng, và nút khoá trông y như nút chính bấm được.',
        },
        {
          state: 'Tab tắt',
          looks: 'Mờ 45%, con trỏ cấm.',
          behaves:
            'disabled thật — tab không có khoá mềm; lý do chỉ ở title khi rê chuột.',
        },
      ]}
      a11y={{
        role: 'tablist / tab (hàng tab) · button (nút) · status (dòng lý do)',
        keys: [
          { key: 'Tab', does: 'Đi qua từng tab rồi từng nút, theo thứ tự nhóm.' },
          { key: 'Enter / Space', does: 'Bấm nút; trên nút khoá mềm thì hiện lý do.' },
        ],
        reader: (
          <>
            Nút khoá đọc là “mờ / không khả dụng” nhờ <code>aria-disabled</code> mà vẫn
            nhận focus, nên người dùng bàn phím cũng hỏi được lý do; dòng lý do nằm trong{' '}
            <code>role=&quot;status&quot;</code>. Icon là trang trí, không chen vào tên
            nút. <b>Chưa tốt, ghi thật:</b> hàng tab khai{' '}
            <code>role=&quot;tablist&quot;</code> nhưng không đi bằng phím mũi tên và
            không trỏ tới <code>tabpanel</code> nào — thực chất là một hàng nút. Vùng
            status được CHÈN cùng lúc với chữ, nên có trình đọc không đọc lên; chưa thử
            bằng trình đọc thật.
          </>
        ),
      }}
      doDont={[
        {
          do: (
            <>
              Nút khoá truyền <code>title</code> nói vướng gì VÀ cách gỡ.
            </>
          ),
          dont: 'Nút xám câm, hoặc lý do chỉ nằm trong tooltip phải rê chuột mới thấy.',
          source:
            'commit 619e3e4 (16/09/2026) — đo trên màn đơn mua: 7/16 nút khoá, cả 7 giấu lý do trong tooltip',
        },
        {
          do: 'Nút khoá tô NỀN xám đặc — kể cả nút chính (primary).',
          dont: (
            <>
              Làm mờ bằng <code>opacity: .5</code> — chữ tụt xuống ~2,2:1, trượt AA, nút
              gần như biến mất.
            </>
          ),
          source:
            'chú thích .k-act-off và .k-act-p.k-act-off trong erp.css (B7½, 24/09/2026); CLAUDE.md nguyên tắc 5',
        },
        {
          do: 'Bày sẵn nút, chia nhóm có nhãn; tab chưa có phân hệ thì HIỆN MỜ.',
          dont: 'Giấu vào menu “⋯”, hay ẩn tab chưa dùng — thanh đổi hình là phá trí nhớ vị trí.',
          source: 'chú thích mục 2 và ActionTab.disabled trong kit/Erp.tsx',
        },
        {
          do: (
            <>
              Động từ quen thuộc (Sửa, In, Duyệt…) có <code>icon</code>.
            </>
          ),
          dont: 'Nút chữ trơn cho động từ đã có trong bản đồ icon.',
          source: 'luật lint hg/kit-icon (canh Btn và Action)',
        },
      ]}
      tested={{
        missing:
          'chưa test nào dựng ActionPane/Action — khoá mềm (bấm hiện lý do, onClick không chạy) là hành vi đáng có test nhất của họ này mà chưa ai viết. Bản vá nền nút chính khoá (B7½) nằm ở CSS nên cũng không test được bằng happy-dom (không tính cascade) — soi bằng mắt ở ví dụ “Nút CHÍNH bị khoá mềm”.',
      }}
    />
  )
}
