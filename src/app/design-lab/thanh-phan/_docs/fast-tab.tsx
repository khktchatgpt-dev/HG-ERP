'use client'

import { Btn, FastTab, Grid, GridBody, GridHead, GridRow, Td, Th } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * SÁCH TRA `FastTab` — khối gấp được mà dòng tiêu đề vẫn mang số (B7, 24/09/2026).
 *
 * Ghi thật ở mục 4: thân khối bị GỠ khỏi DOM khi gấp (không phải ẩn), nên mọi
 * thứ đang gõ dở bên trong mất. B7 còn ghi hai lỗi truy cập — tóm tắt nằm trong
 * tên nút, `aria-controls` trỏ vào khoảng không khi gấp — cả hai đã sửa ở B7½
 * (24/09/2026); mục 5 tả hành vi sau khi sửa.
 */
export default function DocFastTab() {
  return (
    <CompDoc
      family="fast-tab"
      summary={
        <>
          Khối gấp được của màn chứng từ, chép Dynamics. Khác tab và accordion của web ở
          một điểm: <b>dòng tiêu đề vẫn mang số liệu khi đang gấp</b> — gấp năm khối mà
          vẫn đọc được con số quan trọng nhất của cả năm.
        </>
      }
      useWhen="chia thân chứng từ thành các khối nghiệp vụ (Tổng quan, Dòng hàng, Đợt giao, Điều khoản, Trao đổi) xếp dọc trên cùng một màn."
      avoidWhen={
        <>
          hai nội dung thay thế nhau trên cùng một chỗ (xem cái này HOẶC cái kia) — đó là
          tab; và đừng bọc một bảng toàn trang vào <code>FastTab</code> (Khuôn C dùng{' '}
          <code>ScreenFrame</code>).
        </>
      }
      variants={[
        {
          name: 'Cố định trong một mục menu (fixed)',
          when: 'khối đã nằm trong DocMenuPanel (27/09/2026) — luôn mở, tiêu đề là h3 chứ không phải nút gập, không mũi tên ▸. Mục menu đã tách thông tin rồi; gập thêm một tầng là cú bấm thừa.',
          demo: (
            <FastTab fixed title="Chi phí mua hàng" summary={[['Phiếu', 0]]}>
              <p className="text-k-body m-0">Chưa ghi phí nào cho đơn này.</p>
            </FastTab>
          ),
        },
        {
          name: 'Gấp mà vẫn đọc được số',
          when: 'khối phụ, mặc định gấp. summary là cặp [nhãn, giá trị] ngắn — giá trị bị cắt ở 30 ký tự.',
          demo: (
            <FastTab
              title="Đợt giao"
              summary={[
                [
                  'Số đợt',
                  <span key="a" className="num">
                    3
                  </span>,
                ],
                [
                  'Đã nhận',
                  <span key="b" className="num">
                    1 / 3
                  </span>,
                ],
                [
                  'Đợt kế',
                  <span key="c" className="num">
                    12/09/2026
                  </span>,
                ],
              ]}
            >
              <div className="text-k-sm text-[var(--ink-2)]">
                Đợt 1 đã nhận 06/09/2026 · đợt 2 hẹn 12/09/2026 · đợt 3 hẹn 20/09/2026.
              </div>
            </FastTab>
          ),
        },
        {
          name: 'Mở sẵn, lưới sát mép, nút bên phải tiêu đề',
          when: 'khối chính chứa lưới dòng: flush bỏ đệm để lưới chạy sát mép; actions đặt nút của lưới ngoài nút gấp/mở, đỡ một hàng thanh công cụ.',
          demo: (
            <FastTab
              id="vd-dong-hang"
              title="Dòng hàng"
              defaultOpen
              flush
              summary={[
                [
                  'Số dòng',
                  <span key="a" className="num">
                    2
                  </span>,
                ],
              ]}
              actions={<Btn icon="excel">Xuất Excel</Btn>}
            >
              <Grid minWidth={480}>
                <GridHead>
                  <Th>Mã vật tư</Th>
                  <Th>Tên vật tư</Th>
                  <Th num>SL đặt</Th>
                </GridHead>
                <GridBody>
                  <GridRow>
                    <Td>CN1527</Td>
                    <Td>Vít dù 4×12, 7 màu</Td>
                    <Td num>1.400</Td>
                  </GridRow>
                  <GridRow>
                    <Td>ONG-2540</Td>
                    <Td>Ống sắt 25×40×1,2 dài 6m</Td>
                    <Td num>36</Td>
                  </GridRow>
                </GridBody>
              </Grid>
            </FastTab>
          ),
        },
      ]}
      states={[
        {
          state: 'Gấp (mặc định)',
          looks:
            'Một dòng: mũi tên ▸, tiêu đề đậm, tóm tắt chữ nhạt dạt phải; ngăn khối kế bằng một vạch mảnh.',
          behaves:
            'Thân KHÔNG có trong DOM — gấp lại là gỡ hẳn, trạng thái bên trong (ô đang gõ) mất.',
        },
        {
          state: 'Mở',
          looks:
            'Mũi tên xoay 90°; thân có vạch tóc phía trên, đệm trong (flush: không đệm).',
          behaves: 'Bấm lại dòng tiêu đề để gấp.',
        },
        {
          state: 'Rê chuột trên tiêu đề',
          looks: 'Nền xám nhạt cả dòng.',
          behaves: '—',
        },
        {
          state: 'Focus',
          looks: 'Vòng 2px màu hành động quanh cả dòng tiêu đề.',
          behaves: 'Chỉ khi đi bằng bàn phím.',
        },
        {
          state: 'Tóm tắt quá dài',
          looks: 'Mỗi giá trị bị cắt ở 30 ký tự kèm dấu … (hàng rào trong erp.css).',
          behaves: 'Không hiện tooltip phần bị cắt — nơi gọi nên tự cắt ngắn trước.',
        },
        {
          state: 'Giảm chuyển động',
          looks: 'Mũi tên đổi hướng tức thì, không xoay.',
          behaves: 'Theo prefers-reduced-motion.',
        },
      ]}
      a11y={{
        role: 'button (dòng tiêu đề) có aria-expanded, aria-controls khi đang mở, aria-describedby trỏ dòng tóm tắt; khối ngoài là <section>',
        keys: [
          { key: 'Tab', does: 'Tới dòng tiêu đề, rồi các nút ở actions.' },
          { key: 'Enter / Space', does: 'Gấp / mở khối.' },
        ],
        reader: (
          <>
            Tên nút chỉ là tiêu đề (“Đợt giao”, qua <code>aria-labelledby</code>); dòng
            tóm tắt (“Số đợt 3, Đã nhận 1 / 3, Đợt kế 12/09/2026”) đọc sau đó như MÔ TẢ
            qua <code>aria-describedby</code>; trạng thái gấp / mở qua{' '}
            <code>aria-expanded</code>. <code>aria-controls</code> chỉ gắn khi thân đang
            dựng — gấp lại thì không còn id trỏ vào khoảng không. Cả hai sửa 24/09/2026
            (B7½), test ở <code>erp.a11y.test.tsx</code>; trước đó cả dòng tóm tắt nằm
            trong tên nút, đọc lại nguyên tràng mỗi lần Tab qua.{' '}
            <b>Còn chưa tốt, ghi thật:</b> tiêu đề là chữ trong nút, không phải thẻ tiêu
            đề — không nhảy tới được bằng phím tiêu đề của trình đọc.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Tóm tắt là GIÁ TRỊ QUÉT ĐƯỢC: “Số đợt 3”, “Hạn giao 07/09/2026”.',
          dont: 'Nhả nguyên câu điều khoản vào dòng tiêu đề — đẩy nó cao gấp ba.',
          source:
            'commit 3bf5afd (“tóm tắt FastTab dài làm vỡ dòng tiêu đề”) và chú thích .k-ft-sum b trong erp.css, đo 09/09/2026 trên đơn thật',
        },
        {
          do: (
            <>
              Đặt nút của lưới vào <code>actions</code>.
            </>
          ),
          dont: 'Dựng một hàng thanh công cụ riêng chỉ để chứa hai nút, hay nhét nút vào trong nút gấp/mở.',
          source:
            'JSDoc prop actions, kit/Erp.tsx — đo 10/09/2026: hàng riêng ăn 32px trên lưới',
        },
        {
          do: 'Khối PHẲNG, ngăn bằng một vạch mảnh dưới đáy.',
          dont: 'Viền bốn phía, bo góc, lề quanh khối.',
          source:
            'chú thích .k-ft trong erp.css — chủ dự án chấm màn Đơn mua “vẫn có khoảng rộng xung quanh”',
        },
        {
          do: 'Khối có ô đang sửa thì để mở trong suốt lúc sửa.',
          dont: 'Để người dùng gấp khối giữa chừng — thân bị gỡ khỏi DOM, ô chưa lưu mất.',
          source: 'mã FastTab trong kit/Erp.tsx: {open && …} — thân chỉ dựng khi mở',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
