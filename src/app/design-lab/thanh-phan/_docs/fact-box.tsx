'use client'

import { FactBox, FactKv, FactSection } from '@/components/kit'
import { CompDoc } from '../../_lab/CompDoc'

/**
 * TRANG TÀI LIỆU — cột dữ kiện bên phải chứng từ (B7, 24/09/2026).
 *
 * Tới B7 chỉ MỘT ví dụ dựng vỏ `FactBox`: vỏ là `<aside>` không nhãn, hai cái
 * trên một trang là hai landmark complementary không phân biệt được (axe trong
 * happy-dom KHÔNG bắt chuyện này — thử 24/09/2026). B7½ (24/09/2026) thêm prop
 * `label` (mặc định "Dữ kiện liên quan") thành `aria-label`, nên ví dụ hai nay
 * dựng cả vỏ với một tên khác.
 */
export default function DocFactBox() {
  return (
    <CompDoc
      family="fact-box"
      summary={
        <>
          Cột phải của chứng từ, chép Dynamics FactBox: <b>dữ kiện liên quan</b> người
          duyệt cần mà không phải rời tờ đang xem — NCC này giao đúng hẹn mấy lần, mua gần
          nhất khi nào, tổng tiền gồm gì. Không phải chỗ điều hướng.
        </>
      }
      useWhen={
        <>
          chứng từ (Khuôn D) hoặc hồ sơ (Khuôn E) cần một cột dữ kiện đứng cạnh thân —
          truyền vào prop <code>aside</code> của <code>DocBody</code>.
        </>
      }
      avoidWhen={
        <>
          trường của chính chứng từ — dùng <code>FieldGrid</code> trong thân; và lối đi
          sang chứng từ khác — dùng <code>SmartLinks</code>.
        </>
      }
      variants={[
        {
          name: 'FactBox trên chứng từ đơn mua',
          when: 'hai khối: dữ kiện NCC (mỗi tỉ lệ kèm mẫu số) và tiền (nói rõ tổng CHƯA gồm gì).',
          demo: (
            <div className="max-w-[320px]">
              <FactBox>
                <FactSection title="Nhà cung cấp">
                  <div className="k-strong mb-1">Cơ khí Thành Đạt</div>
                  <FactKv
                    rows={[
                      ['Giao đúng hẹn', <span key="a" className="num k-t-done">8 / 9 đơn</span>], // prettier-ignore
                      ['Mua gần nhất', <span key="b" className="num">02/09/2026</span>], // prettier-ignore
                      ['Mã số thuế', <span key="c" className="num">0301234567</span>], // prettier-ignore
                    ]}
                  />
                </FactSection>
                <FactSection title="Tiền">
                  <FactKv
                    rows={[
                      ['Tiền hàng', <span key="a" className="num">45.000.000 ₫</span>], // prettier-ignore
                      ['VAT', <span key="b" className="num">8% · 3.600.000 ₫</span>], // prettier-ignore
                      ['Tổng thanh toán', <b key="c" className="num">48.600.000 ₫</b>], // prettier-ignore
                      ['Chưa gồm', <span key="d" className="k-t-warn">2 dòng thiếu số</span>], // prettier-ignore
                    ]}
                  />
                </FactSection>
              </FactBox>
            </div>
          ),
        },
        {
          name: 'FactKv prose — giá trị là câu chữ dài',
          when: 'giá trị là điều khoản / nơi giao / câu mô tả: nhãn thành cột trái cố định, giá trị canh trái xuống dòng. Dùng ở dải thông tin màn ký đơn mua của Giám đốc (01/10/2026) — kiểu đẩy phải biến câu dài thành khối chữ lởm chởm.',
          demo: (
            <div className="max-w-[260px]">
              <FactKv
                prose
                rows={[
                  ['Thanh toán', 'Thanh toán công nợ cuối tháng'],
                  ['Thời hạn giao', 'Từ 7 đến 10 ngày kể từ ngày xác nhận đơn'],
                  ['Nơi giao', 'Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Gia Lai'],
                ]}
              />
            </div>
          ),
        },
        {
          name: 'FactKv nhãn mono — Chứng từ liên quan, vỏ có tên riêng',
          when: 'nhãn là MÃ chứng từ, nên truyền ReactNode bọc num thay cho chuỗi. Trang đã có một FactBox tên mặc định, nên cái thứ hai truyền label khác.',
          demo: (
            <div className="max-w-[320px]">
              <FactBox label="Chứng từ liên quan của đơn">
                <FactSection title="Chứng từ liên quan">
                  <FactKv
                    rows={[
                      [<span key="a" className="num">06/26-27 - MX</span>, 'Lệnh sản xuất'], // prettier-ignore
                      [<span key="b" className="num">PN-2609-031</span>, 'Phiếu nhập · 60 / 100 kg'], // prettier-ignore
                    ]}
                  />
                </FactSection>
              </FactBox>
            </div>
          ),
        },
      ]}
      states={[
        {
          state: 'Dưới 1100px',
          looks: 'Xuống dưới thân chứng từ, ngăn bằng một vạch NGANG ở trên.',
          behaves: 'Tĩnh.',
        },
        {
          state: 'Từ 1100px',
          looks: 'Dán cạnh phải, ngăn với thân bằng một vạch DỌC, cao hết thân.',
          behaves:
            'Tĩnh. Là container nên FieldGrid đặt bên trong chia cột theo bề rộng cột.',
        },
        {
          state: 'FactKv',
          looks: 'Mỗi hàng: nhãn trái chữ phụ, giá trị phải chữ đậm, cỡ chữ nhỏ.',
          behaves: 'Khoá theo chỉ số hàng.',
        },
      ]}
      a11y={{
        role: 'complementary (aside, aria-label = label, mặc định “Dữ kiện liên quan”) · FactKv là dl / dt / dd',
        keys: [
          { key: '—', does: 'Không nhận phím; nút hay liên kết đặt bên trong mới nhận.' },
        ],
        reader: (
          <>
            Trình đọc liệt kê được cột này như một landmark &quot;bổ sung&quot; CÓ TÊN —
            “Dữ kiện liên quan, bổ sung” — và đọc từng cặp nhãn–giá trị như danh sách mô
            tả. Tên lấy từ prop <code>label</code> (sửa 24/09/2026, B7½; test ở{' '}
            <code>erp.a11y.test.tsx</code>); trước đó <code>&lt;aside&gt;</code> không
            tên, phím mốc chỉ đọc “bổ sung” trơn. <b>Hai chỗ chưa tốt, ghi thật:</b> kit
            không tự chặn hai FactBox trùng tên trên một trang — chỗ gọi phải tự đặt{' '}
            <code>label</code> khác nhau, và axe trong happy-dom không bắt lỗi này; tên
            khối của <code>FactSection</code> là <code>&lt;div&gt;</code>, không phải thẻ
            tiêu đề, nên không nhảy tới được bằng phím tiêu đề.
          </>
        ),
      }}
      doDont={[
        {
          do: 'Mỗi tỉ lệ kèm mẫu số: "8 / 9 đơn".',
          dont: 'Chỉ ghi "89%" — không ai kiểm được.',
          source: 'CLAUDE.md, nguyên tắc 6; DonChungTuScreen.tsx khối "Giao đúng hẹn"',
        },
        {
          do: 'Tổng thiếu phần nào thì thêm hàng "Chưa gồm: 2 dòng thiếu số".',
          dont: 'Bày tổng như thể đủ khi còn dòng chưa có giá.',
          source:
            'CLAUDE.md, nguyên tắc 6 — "chân bảng nói tổng KHÔNG gồm gì"; DonChungTuScreen.tsx khối "Tiền"',
        },
        {
          do: (
            <>
              Mã chứng từ ở vế nhãn thì bọc{' '}
              <code>&lt;span className=&quot;num&quot;&gt;</code> cho ra chữ mono.
            </>
          ),
          dont: 'Để mã chứng từ chữ thường lẫn vào nhãn.',
          source: 'Erp.tsx, chú thích FactKv — vì sao nhãn nhận ReactNode',
        },
        {
          do: (
            <>
              Một FactBox mỗi trang, chia khối bằng FactSection; buộc phải có hai thì mỗi
              cái một <code>label</code> riêng.
            </>
          ),
          dont: 'Hai FactBox cùng tên mặc định trên một trang — hai landmark "bổ sung" trùng tên, trình đọc không phân biệt được.',
          source:
            'JSDoc prop label của FactBox, kit/Erp.tsx (B7½, 24/09/2026); mọi màn dùng hiện nay (DonChungTuScreen, mau-ho-so-ncc) đều một FactBox',
        },
      ]}
      tested={{ file: 'src/components/kit/erp.a11y.test.tsx' }}
    />
  )
}
