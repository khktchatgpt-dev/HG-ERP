'use client'

import { WhyBox } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — WhyBox (B7, 24/09/2026).
 *
 * Mục 6 có một dòng rút từ chính lúc viết trang này: khối từng không giữ khoảng
 * trắng, trong khi vài màn Tài chính đang dóng cột bằng dấu cách. Trang ghi thật
 * chỗ yếu đó, rồi người giữ kit vá ở B7½ (24/09/2026): mỗi dòng của `lines` nay
 * `whitespace-pre-wrap`.
 */
export default function DocWhyBox() {
  return (
    <CompDoc
      family="why-box"
      summary={
        <>
          Bày <b>nguyên văn phép tính</b> ra sau một con số, dòng cuối là kết quả. Nguyên
          tắc 6 của sổ: số nào không kiểm được thì không ai tin — không tin thì người ta
          mở Excel tính lại, và ERP tụt xuống thành nơi nhập liệu.
        </>
      }
      useWhen="một con số là kết quả SUY RA (hạn quá bao ngày, dư cuối kỳ, số cây phải mua) và người đọc cần tự kiểm trước khi ra quyết định."
      avoidWhen={
        <>
          con số là dữ liệu gốc ai đó gõ vào (không có phép tính để bày), hoặc chỉ cần một
          câu lưu ý — dùng <code>hint</code> của <code>NextAction</code> hay{' '}
          <code>caveat</code> của <code>TFoot</code>.
        </>
      }
      variants={[
        {
          name: 'Vì sao đơn này ở đây',
          when: 'trong khay kiểm tra của hộp thư: bày đủ các vế để người đọc tự trừ ngày.',
          demo: (
            <div className="max-w-[320px]">
              <WhyBox
                lines={[
                  'hẹn giao 02/09/2026',
                  'hôm nay 10/09/2026',
                  'trạng thái: đã gửi NCC',
                ]}
                result="quá hẹn 8 ngày, chưa nhận đủ"
              />
            </div>
          ),
        },
        {
          name: 'Nói cả phần KHÔNG gồm',
          when: 'số tổng che điều kiện là số nguy hiểm — ghi rõ vế bị loại ra, ngay trong phép tính.',
          demo: (
            <div className="max-w-[520px]">
              <WhyBox
                lines={[
                  'Dư đầu kỳ 01/09: 412.500.000',
                  '+ Phát sinh tăng (hoá đơn NCC đã vào sổ, gồm VAT): 131.400.000',
                  '− Phát sinh giảm (phiếu chi trong kỳ): 200.000.000',
                  'Chưa gồm 2 hoá đơn còn nháp — nháp không phải nợ',
                ]}
                result="343.900.000 ₫ dư cuối kỳ 30/09"
              />
            </div>
          ),
        },
        {
          name: 'Quy đổi sang đơn vị mua',
          when: 'định mức tính bằng chi tiết, người mua đặt bằng cây — bày phép quy đổi để khỏi mua thừa.',
          demo: (
            <div className="max-w-[420px]">
              <WhyBox
                lines={[
                  'chi tiết dài 1.390 mm × 24 cái',
                  'cây tiêu chuẩn 6 m → cắt được 4 đoạn/cây',
                  '24 ÷ 4 = 6',
                ]}
                result="6 cây thép hộp 25×50"
              />
            </div>
          ),
        },
        {
          name: 'Dóng cột bằng dấu cách',
          when: 'các vế cùng dạng “nhãn … số”: dấu cách được giữ nguyên, chữ đơn cách nên số thẳng cột.',
          demo: (
            <div className="max-w-[320px]">
              <WhyBox
                lines={['Đặt            120', 'Đã giao      −  96', 'Trả lại lỗi  +   4']}
                result="còn phải giao 28"
              />
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Mặc định',
          looks:
            'Khối nền nhạt, viền tóc, chữ đơn cách cỡ nhỏ; mỗi phần tử của lines một dòng, GIỮ nguyên dãy dấu cách (dòng quá dài thì xuống hàng); dòng kết quả in đậm màu hành động, kit tự thêm "= ".',
          behaves:
            'Tĩnh. Không gập, không bấm, không nhận tiêu điểm. Riêng dòng kết quả không giữ dãy dấu cách — chỉ lines có.',
        },
      ]}
      a11y={{
        role: '(không có — khối văn bản thường)',
        keys: [],
        reader: (
          <>
            Đọc từng dòng theo thứ tự, rồi “= kết quả”. <b>Chỗ chưa tốt, ghi thật:</b>{' '}
            không có gì nối khối này với con số nó giải thích (không{' '}
            <code>aria-describedby</code>, không tiêu đề) — người nghe phải tự hiểu phép
            tính đang nói về số nào qua vị trí trong trang. Đặt khối ngay dưới con số,
            trong một khối có tiêu đề (như <code>InspectSection</code> “Vì sao đơn này ở
            đây”).
          </>
        ),
      }}
      doDont={[
        {
          do: 'Bày phép tính nguyên văn, cùng cách làm tròn với số trên bảng.',
          dont: 'Chỉ in con số rồi để người đọc tin — hoặc diễn giải lại bằng lời, khác số trên bảng một đồng.',
          source: 'CLAUDE.md — nguyên tắc 6 “Số nào không kiểm được thì không ai tin”',
        },
        {
          do: 'Ghi luôn điều kiện bị loại ra: “CHƯA gồm VAT”, “nháp không phải nợ”.',
          dont: 'Cộng một tổng rồi để người ký tưởng đó là toàn bộ tiền phải chi.',
          source:
            'finance/bao-cao/BaoCaoScreen.tsx và so-cong-no/SoCongNoScreen.tsx — dòng “NCC đã xuất HĐ … CHƯA gồm VAT”',
        },
        {
          do: 'Mỗi vế một dòng; dóng cột bằng dấu cách được — khối giữ nguyên khoảng trắng và dùng chữ đơn cách.',
          dont: 'Dóng cột bằng dấu cách trong result — dòng kết quả không giữ khoảng trắng, chỉ các dòng của lines giữ.',
          source:
            'đọc mã 24/09/2026: WhyBox từng thiếu whitespace-pre nên cột của theo-lenh/TheoLenhScreen.tsx và hoa-don-ncc/DoiChieuTable.tsx bị gộp lệch — vá ở B7½',
        },
      ]}
      tested={{ file: 'src/components/kit/shell-flow.a11y.test.tsx' }}
    />
  )
}
