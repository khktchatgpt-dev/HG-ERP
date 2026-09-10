import Link from 'next/link'
import { Doc, Hero, Rule, Sec } from './_lab/Doc'

/**
 * SỔ THIẾT KẾ — trang gốc.
 *
 * Viết lại 10/09/2026. Bản trước là một cuộn mười thành phần rời; nó trả lời
 * được "kit có gì" nhưng không trả lời được câu người làm màn mới thật sự
 * hỏi: "màn này thuộc loại nào, và loại đó bắt buộc có gì".
 *
 * Cách các hệ ERP lớn tổ chức tài liệu của họ đều xoay quanh KHUÔN MÀN
 * (floorplan) chứ không quanh thư viện thành phần: SAP Fiori có List Report /
 * Object Page / Overview Page / Worklist; Dynamics 365 F&O có List page /
 * Details master / Workspace. Lý do là số loại màn trong một ERP thì ĐÓNG,
 * còn số cách ghép thành phần thì vô hạn — chốt khuôn là chốt luôn phần lớn
 * quyết định thiết kế, và người làm chỉ còn phải nghĩ về nghiệp vụ.
 *
 * Nên trang này bày: nguyên tắc → khuôn → luật kiểm. Thư viện thành phần lùi
 * xuống `/design-lab/thanh-phan`, đúng vai trò tra cứu của nó.
 */

const PLANS: {
  key: string
  name: string
  q: string
  href: string
  must: string
  src: string
  done: boolean
}[] = [
  {
    key: 'Khuôn A',
    name: 'Trang vào việc',
    q: 'Hôm nay tôi phải làm gì?',
    href: '/design-lab/mau-vao-viec',
    must: 'Ô việc có số + cảnh báo tồn đọng',
    src: 'SAP Fiori launchpad · Dynamics workspace',
    done: true,
  },
  {
    key: 'Khuôn B',
    name: 'Hộp thư việc',
    q: 'Việc nào đang chờ chính tôi, ở mọi loại chứng từ?',
    href: '/design-lab/mau-hop-thu',
    must: 'Làn Trễ/Hôm nay/Sắp tới + khay kiểm tra',
    src: 'SAP My Inbox · Odoo activity · Dynamics work list',
    done: true,
  },
  {
    key: 'Khuôn C',
    name: 'Trang danh sách',
    q: 'Trong tập này, cái nào cần tôi động vào?',
    href: '/design-lab/mau-danh-sach',
    must: 'Chip lọc có số + bảng dính đầu/chân',
    src: 'SAP List Report · Dynamics List page',
    done: true,
  },
  {
    key: 'Khuôn D',
    name: 'Trang chứng từ',
    q: 'Tờ này đang ở đâu, ai giữ, vướng gì?',
    href: '/design-lab/mau-erp',
    must: 'Action Pane + ba trục trạng thái + FastTab + FactBox',
    src: 'SAP Object Page · Dynamics Details master',
    done: true,
  },
  {
    key: 'Khuôn E',
    name: 'Hồ sơ danh mục',
    q: 'Đối tượng này là ai, làm ăn ra sao, đang được dùng ở đâu?',
    href: '/design-lab/mau-ho-so-ncc',
    must: 'Chỉ số hiệu suất + “dùng ở đâu” + lịch sử giá',
    src: 'SAP Business Partner · Dynamics Vendor master · Odoo partner form',
    done: true,
  },
  {
    key: 'Khuôn F',
    name: 'Bảng nhập liệu',
    q: 'Làm sao khai 40 dòng nhanh như Excel mà không sai?',
    href: '/design-lab/mau-soan-don',
    must: 'Lưới là nhân vật chính + kiểm từng dòng khi gõ + nạp hàng loạt',
    src: 'Dynamics journal entry · SAP mass entry · Odoo list sửa tại chỗ',
    done: true,
  },
]

const TODO: { key: string; name: string; q: string; why: string }[] = [
  {
    key: 'Khuôn G',
    name: 'Nhập nhiều bước',
    q: 'Làm sao đi hết một việc dài mà không bỏ sót?',
    why: 'Chưa dựng. Chỉ đáng làm khi có việc thật cần >3 bước bắt buộc theo thứ tự — hiện chưa có màn nào như vậy.',
  },
  {
    key: 'Khuôn H',
    name: 'Trang phân tích',
    q: 'Kỳ vừa rồi thế nào?',
    why: 'Chưa dựng, và CỐ Ý hoãn: bảng biểu đồ trả lời câu hỏi của tháng, người dùng hằng ngày hỏi câu của hôm nay. Làm sớm là lấy chỗ của Khuôn A.',
  },
]

/**
 * Bản đồ TRANG THẬT → khuôn. Mười mục nav của phòng Cung ứng, đúng theo
 * `workspaces.config.ts`.
 *
 * Bảng này là PHÉP THỬ của bản đồ khuôn: nếu một trang thật không xếp được vào
 * khuôn nào thì bản đồ thiếu, chứ không phải trang đó đặc biệt. Chính bảng này
 * lộ ra Khuôn E và F — bốn khuôn đầu dựng từ mỗi luồng đơn mua nên không có chỗ
 * cho hồ sơ danh mục lẫn màn khai 40 dòng.
 */
const SUPPLY_MAP: { page: string; href: string; plan: string; note: string }[] = [
  { page: 'Tổng quan', href: '/planning', plan: 'A', note: 'Sáu ô việc theo vai người mua' }, // prettier-ignore
  { page: 'Chờ tôi xử lý', href: '/planning/viec-cua-toi', plan: 'B', note: 'Nay chỉ đếm đơn mua — khuôn đòi xuyên mọi loại chứng từ' }, // prettier-ignore
  { page: 'Vấn đề cần xử lý', href: '/planning/van-de', plan: 'B', note: 'Cùng khuôn, lọc sẵn theo rủi ro của lệnh' }, // prettier-ignore
  { page: 'Việc cần quyết định', href: '/planning/hop', plan: 'B', note: 'Cùng khuôn, dùng trong buổi họp' }, // prettier-ignore
  { page: 'Phiếu mua', href: '/planning/pos', plan: 'C', note: 'Chính là màn mẫu Khuôn C' }, // prettier-ignore
  { page: 'Kho & tồn', href: '/planning/stock', plan: 'C', note: 'Thêm cột ngưỡng tồn tối thiểu' }, // prettier-ignore
  { page: 'Vật tư theo lệnh', href: '/planning/lsx', plan: 'C', note: 'Ba tầng: lệnh → đơn của lệnh → dòng, bằng dòng tiêu đề khối' }, // prettier-ignore
  { page: 'Hàng sắp về', href: '/planning/hang-sap-ve', plan: 'C', note: 'Khối theo NGÀY giao thay vì theo người giữ' }, // prettier-ignore
  { page: 'Chi tiết phiếu mua', href: '/planning/pos/[id]', plan: 'D', note: 'Chính là màn mẫu Khuôn D' }, // prettier-ignore
  { page: 'Nhà cung cấp', href: '/planning/suppliers', plan: 'C + E', note: 'Danh sách theo C, hồ sơ từng NCC theo E' }, // prettier-ignore
  { page: 'Vật tư & giá mua', href: '/planning/materials', plan: 'C + E', note: 'Cùng cặp khuôn với nhà cung cấp' }, // prettier-ignore
  { page: 'Soạn phiếu mua', href: '/planning/pos/new', plan: 'F', note: 'Không phải Khuôn D: ở đây lưới là nhân vật chính' }, // prettier-ignore
]

const SOURCES: [string, string][] = [
  ['Action Pane có nhóm gắn nhãn', 'Dynamics 365 F&O'],
  ['Ba trục trạng thái tách biệt', 'Dynamics 365 F&O'],
  ['FastTab mang số liệu trên dòng tiêu đề', 'Dynamics 365 F&O'],
  ['FactBox — dữ kiện liên quan', 'Dynamics 365 F&O'],
  ['Statusbar bấm được', 'Odoo'],
  ['Chatter — trao đổi ngay trên chứng từ', 'Odoo'],
  ['Bảng kiểm chặn gửi duyệt', 'Dynamics validation'],
  ['Nhật ký thay đổi trường', 'SAP change documents'],
  ['Dải “ai đang giữ”', 'SAP My Inbox'],
  ['Ô việc kèm số trên trang chủ', 'SAP Fiori launchpad tile'],
  ['Làn Trễ / Hôm nay / Sắp tới', 'Odoo activity menu'],
  ['Khung nhìn lưu được', 'SAP variant · Dynamics saved view'],
  ['Thanh trạng thái đáy màn', 'SAP GUI'],
]

export default function DesignLabHome() {
  return (
    <Doc>
      <Hero
        eyebrow="Sổ thiết kế · HG-ERP"
        title="Làm màn theo khuôn, không theo cảm hứng"
      >
        <p className="lab-deck">
          Sổ này chốt <b>sáu khuôn màn</b> và <b>sáu nguyên tắc</b>. Trước khi dựng một
          màn mới, việc đầu tiên không phải chọn thành phần — mà là xác định màn đó thuộc
          khuôn nào. Khuôn đã chốt sẵn phần lớn quyết định bố cục, nên chỉ còn phải nghĩ
          về nghiệp vụ.
        </p>
        <p className="lab-deck">
          Không có đặc trưng nào ở đây do chúng tôi nghĩ ra. Mỗi thứ đều chép từ một hệ
          ERP đang chạy thật và <b>ghi rõ chép của ai</b> — để sau này ai sửa còn biết
          mình đang phá quy ước của hệ nào.
        </p>
      </Hero>

      <Sec
        n={1}
        id="khac-biet"
        title="Khác biệt gốc: web là nơi đến, ERP là nơi làm việc"
        why="Sai lầm thường gặp không nằm ở màu sắc hay bố cục. Nó nằm ở chỗ web thiết kế cho MỘT người dùng, còn ERP thiết kế cho MỘT DÂY CHUYỀN người."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th />
                <th>Web / SaaS</th>
                <th>ERP nội bộ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Người dùng</b>
                </td>
                <td>khách lạ, phải thuyết phục</td>
                <td>nhân viên, 8 tiếng/ngày, 5 màn quen</td>
              </tr>
              <tr>
                <td>
                  <b>Tối ưu cho</b>
                </td>
                <td>lần dùng đầu tiên</td>
                <td>lần dùng thứ 500</td>
              </tr>
              <tr>
                <td>
                  <b>Điều hướng</b>
                </td>
                <td>khám phá, menu đẹp</td>
                <td>trí nhớ vị trí, phím tắt</td>
              </tr>
              <tr>
                <td>
                  <b>Một màn</b>
                </td>
                <td>một thông điệp</td>
                <td>một câu hỏi nghiệp vụ</td>
              </tr>
              <tr>
                <td>
                  <b>Dữ liệu</b>
                </td>
                <td>minh hoạ</td>
                <td>là nhân vật chính</td>
              </tr>
              <tr>
                <td>
                  <b>Chứng từ</b>
                </td>
                <td>không có</td>
                <td>đi qua tay nhiều phòng</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="lab-w" style={{ marginTop: 10 }}>
          Một đơn đặt vật tư đi Cung ứng → Giám đốc → NCC → Kho. Màn hình nào không nói
          được <b>“giờ đến lượt ai”</b> thì đẹp mấy cũng không dùng được.
        </p>
      </Sec>

      <Sec
        n={2}
        id="nguyen-tac"
        title="Sáu nguyên tắc"
        why="Mỗi nguyên tắc đi kèm một triệu chứng quan sát được. Nguyên tắc không nói được “hỏng thì thấy gì” thì review nào cũng bỏ qua, vì không ai kiểm được."
      >
        <div className="lab-rules">
          <Rule
            n={1}
            title="Một màn trả lời một câu hỏi nghiệp vụ"
            symptom={
              <>
                Trang tổng quan gom đủ mọi khối và không ai mở nó lần thứ hai; người dùng
                quay về Excel vì ở đó họ tự chọn được cột.
              </>
            }
          >
            Không phải “một màn trưng một bảng dữ liệu”. Nhiều lệnh sản xuất thì tách
            trang theo câu hỏi (đang chờ vật tư / đang chạy / sắp giao), đừng nhồi vào một
            tổng quan. Xác định câu hỏi trước, khuôn màn sẽ tự lộ ra ở mục 03.
          </Rule>

          <Rule
            n={2}
            title="Chứng từ tự kể chuyện đời nó"
            symptom={
              <>
                Đo 09/09/2026: <b>66/68 đơn nằm im 5–7 ngày</b> và hệ thống không hề báo.
                Ai cũng tưởng người kia đang giữ.
              </>
            }
          >
            Ba thứ phải nằm ngay đầu chứng từ, trước mọi bảng số: <b>đang ở bước nào</b>{' '}
            (ba trục trạng thái), <b>ai đang giữ và phải làm gì</b> (dải HolderBar),{' '}
            <b>đã có chuyện gì</b> (nhật ký máy ghi, tách khỏi trao đổi người viết).
          </Rule>

          <Rule
            n={3}
            title="Con số là một lời hứa"
            symptom={
              <>
                Badge nói 5, bấm vào thấy 7. Một lần sai là{' '}
                <b>hỏng niềm tin vào cả sidebar</b> — người dùng quay lại cách cũ, mở từng
                danh sách rồi tự lọc.
              </>
            }
          >
            Mọi con số trên ô việc, chip lọc, badge menu đều phải đếm bằng{' '}
            <b>đúng hàm mà trang đích dùng</b>, không đếm lại bằng truy vấn riêng. Số 0
            không phải lúc nào cũng xấu: “Đơn quá hạn: 0” là tin mừng, tô đỏ số 0 làm
            người ta hoảng vô cớ.
          </Rule>

          <Rule
            n={4}
            title="Dày, nhưng có kỷ luật căn chỉnh"
            symptom={
              <>
                Chữ đã to lên mà vẫn bị chê khó nhìn. Nguyên nhân thật đo được là tương
                phản: <b>màu nhãn cột cũ chỉ đạt 3,40:1</b>, trượt chuẩn WCAG AA.
              </>
            }
          >
            ERP mặc định dày và thang chữ nền giữ <b>13px</b>. Đọc được một màn 40 dòng
            không đến từ việc phóng to chữ, mà từ lưới nhãn–giá trị nghiêm ngặt, khối ngăn
            nhau bằng <b>một vạch mảnh</b>, thanh hành động luôn ở một chỗ. Chữa “khó
            nhìn” bằng cách nới thoáng là phản xạ web, và nó lấy mất số dòng trên màn.
            Cùng phản xạ đó là <b>thẻ nổi</b>: bo góc, viền bốn phía, lề 10–14px quanh
            lưới và khung dữ kiện — từng thứ nhỏ, cộng lại thành khoảng trắng bao quanh
            nội dung. Từ 10/09/2026 kit mặc định phẳng: lưới chạy sát mép, FactBox là
            panel một vạch dọc, như SAP GUI và Dynamics.
          </Rule>

          <Rule
            n={5}
            title="Một màu hành động, ba màu vòng đời"
            symptom={
              <>
                Dòng <b>đang chọn</b> trông như dòng <b>đang lỗi</b>, vì trạng thái điều
                khiển mượn màu của trạng thái dữ liệu.
              </>
            }
          >
            Chỗ nào xanh <code>--act</code> là chỗ bấm được hoặc đang chọn. Đỏ / hổ phách
            / lục chỉ mã hoá vòng đời dữ liệu và{' '}
            <b>tuyệt đối không được dùng cho nút hay dòng đang chọn</b>. Đây là luật một
            chiều: nút không bao giờ ăn màu trạng thái.
          </Rule>

          <Rule
            n={6}
            title="Số nào không kiểm được thì không ai tin"
            symptom={
              <>
                Tổng “5.482.000 ₫” trong khi 14/16 mã chưa có giá. Người ký tưởng đó là
                toàn bộ tiền phải chi —{' '}
                <b>con số che giấu điều kiện là con số nguy hiểm</b>.
              </>
            }
          >
            Chân bảng phải nói tổng <b>không bao gồm</b> cái gì. Số suy ra từ phép tính
            phải bày được phép tính nguyên văn, không diễn giải lại và không làm tròn khác
            bảng. Không kiểm được thì người dùng mở Excel tính tay, và lúc đó ERP tụt
            xuống thành nơi nhập liệu.
          </Rule>
        </div>
      </Sec>

      <Sec
        n={3}
        id="khuon"
        title="Sáu khuôn màn"
        why="Số loại màn trong một ERP là tập ĐÓNG. Chốt khuôn là chốt luôn phần lớn quyết định bố cục — mỗi khuôn dưới đây có một màn mẫu chạy được, dựng hoàn toàn bằng kit."
      >
        <div className="lab-plans">
          {PLANS.map((p) => (
            <article key={p.key} className="lab-plan">
              <div className="lab-plan-k">{p.key}</div>
              <h3>{p.name}</h3>
              <p className="lab-plan-q">
                Trả lời: <b>{p.q}</b>
              </p>
              <dl>
                <dt>Bắt buộc</dt>
                <dd>{p.must}</dd>
                <dt>Chép của</dt>
                <dd>{p.src}</dd>
              </dl>
              <Link href={p.href}>Mở màn mẫu →</Link>
            </article>
          ))}
          {TODO.map((p) => (
            <article key={p.key} className="lab-plan" data-todo="1">
              <div className="lab-plan-k">{p.key} · chưa dựng</div>
              <h3>{p.name}</h3>
              <p className="lab-plan-q">
                Trả lời: <b>{p.q}</b>
              </p>
              <p className="lab-plan-q" style={{ color: 'var(--ink-3)' }}>
                {p.why}
              </p>
            </article>
          ))}
        </div>
      </Sec>

      <Sec
        n={'3b'}
        id="ban-do-cung-ung"
        title="Bản đồ trang thật — phòng Cung ứng"
        why="Bảng này là PHÉP THỬ của bản đồ khuôn. Một trang thật không xếp được vào khuôn nào thì bản đồ thiếu, chứ không phải trang đó đặc biệt — và chính bảng này lộ ra Khuôn E với F."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Trang</th>
                <th>Đường dẫn</th>
                <th>Khuôn</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {SUPPLY_MAP.map((r) => (
                <tr key={r.href}>
                  <td>
                    <b>{r.page}</b>
                  </td>
                  <td>
                    <code>{r.href}</code>
                  </td>
                  <td>
                    <b>{r.plan}</b>
                  </td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lab-w" style={{ marginTop: 10 }}>
          Bốn khuôn đầu dựng từ mỗi luồng đơn mua, nên chúng không có chỗ cho{' '}
          <b>hồ sơ danh mục</b> (không có vòng đời duyệt, nhưng có hiệu suất và “dùng ở
          đâu”) lẫn <b>bảng nhập liệu</b> (lưới là nhân vật chính, không phải một khối
          trong chứng từ). Đó là lý do tập khuôn nở từ bốn lên sáu, chứ không phải vì thêm
          cho nhiều.
        </p>
      </Sec>

      <Sec
        n={4}
        id="chon-khuon"
        title="Chọn khuôn nào"
        why="Đọc câu người dùng đang hỏi, không đọc tên bảng dữ liệu. Cùng một bảng đơn đặt vật tư sinh ra ba khuôn khác nhau tuỳ người mở nó đang hỏi gì."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Người dùng đang hỏi</th>
                <th>Khuôn</th>
                <th>Dấu hiệu nhận ra</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>“Hôm nay tôi bắt đầu từ đâu?”</td>
                <td>
                  <b>A · Vào việc</b>
                </td>
                <td>Người mở màn chưa có chứng từ nào trong đầu</td>
              </tr>
              <tr>
                <td>“Có ai đang chờ tôi không?”</td>
                <td>
                  <b>B · Hộp thư</b>
                </td>
                <td>Câu trả lời phải xuyên nhiều loại chứng từ, nhiều phòng</td>
              </tr>
              <tr>
                <td>“Đơn nào chưa gửi NCC?”</td>
                <td>
                  <b>C · Danh sách</b>
                </td>
                <td>Một loại chứng từ, cần lọc và so sánh nhiều dòng</td>
              </tr>
              <tr>
                <td>“Đơn PO-2609-014 sao chưa duyệt?”</td>
                <td>
                  <b>D · Chứng từ</b>
                </td>
                <td>Đã biết đích danh một tờ, cần xem và tác động lên nó</td>
              </tr>
              <tr>
                <td>“Tháng này mua hết bao nhiêu?”</td>
                <td>
                  <b>F · Phân tích</b>
                </td>
                <td>
                  Chưa dựng. Nếu câu hỏi thật sự là của <b>kỳ</b> chứ không của{' '}
                  <b>hôm nay</b>, hãy nói ra trước khi làm
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec
        n={5}
        id="luat-kiem"
        title="Luật kiểm trước khi coi màn là xong"
        why="Mười bốn dòng này rà được bằng mắt trong hai phút. Chúng bắt đúng những lỗi đã thật sự xảy ra trong dự án này, không phải danh sách chung chung chép từ sách."
      >
        <div className="lab-demo">
          <ul className="lab-checks">
            <li>
              <div>
                <b>Màn đã chọn đúng một khuôn ở mục 03.</b>
                <em>
                  Không chọn được khuôn nào nghĩa là câu hỏi nghiệp vụ chưa rõ, không phải
                  cần khuôn thứ năm.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Mọi con số hiển thị đếm bằng đúng hàm trang đích dùng.</b>
                <em>Bấm thử một ô có số và đếm tay số dòng nhận được.</em>
              </div>
            </li>
            <li>
              <div>
                <b>Bảng dài có tiêu đề cột dính và chân tổng dính.</b>
                <em>
                  Bẫy đã dính: cha đặt <code>min-h-screen</code> thì bảng không bao giờ
                  cuộn trong khung, và cả hai thứ dính đều vô hiệu. Dùng{' '}
                  <code>ScreenFrame</code>.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Cột số dùng lớp `num` — mono, căn phải, tabular.</b>
                <em>
                  Thiếu tabular thì cột số vẫn nhấp nhô và mắt không so sánh dọc được.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Con số tổng có nói phần nó không bao gồm.</b>
              </div>
            </li>
            <li>
              <div>
                <b>Hành động bị chặn thì nói rõ vướng gì và cách gỡ, ngay tại chỗ.</b>
                <em>
                  Không cho bấm rồi mới báo lỗi. Nút chặn phải mang <code>title</code> nói
                  lý do.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Trạng thái rỗng nói được lý do và việc phải làm tiếp.</b>
                <em>“Không có dữ liệu” là ngõ cụt đẩy người dùng đi hỏi vòng quanh.</em>
              </div>
            </li>
            <li>
              <div>
                <b>Không có màu vòng đời nào nằm trên nút hoặc dòng đang chọn.</b>
              </div>
            </li>
            <li>
              <div>
                <b>Không có thẻ nổi quanh lưới hay khung dữ kiện.</b>
                <em>
                  Khối ngăn nhau bằng một vạch mảnh, lưới sát mép, FactBox một vạch dọc.
                  Thấy viền bốn phía + bo góc + lề quanh một lưới là đang chép web.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Không có mã màu Tailwind dựng sẵn và không có hex trong class.</b>
                <em>
                  Cổng ESLint <code>hg/no-hardcoded-color</code> chặn, nhưng 193 file nợ
                  cũ đang ở mức cảnh báo — file mới thì là lỗi.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Không có thẻ thô: table, button, input, select, textarea.</b>
                <em>
                  Cổng <code>hg/no-raw-control</code>. Lưới nằm trong khối thì dùng{' '}
                  <code>Grid</code>; màn toàn trang thì dùng <code>Table</code>.
                </em>
              </div>
            </li>
            <li>
              <div>
                <b>Ô tick chọn dòng có aria-label nói rõ chọn dòng nào.</b>
                <em>Một cột toàn ô tick không nhãn là cột câm với trình đọc màn hình.</em>
              </div>
            </li>
            <li>
              <div>
                <b>Đi hết màn bằng phím Tab, vòng focus luôn nhìn thấy.</b>
              </div>
            </li>
            <li>
              <div>
                <b>
                  <code>npm run check</code> sạch.
                </b>
                <em>Typecheck + lint + test. Đỏ thì chưa xong, không có ngoại lệ.</em>
              </div>
            </li>
          </ul>
        </div>
      </Sec>

      <Sec
        n={6}
        id="nguon"
        title="Chép của ai"
        why="Ghi nguồn không phải để lịch sự. Nó là cách duy nhất để lần sau ai định sửa còn biết mình đang phá quy ước của hệ nào, và tra lại được lý do gốc."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Đặc trưng</th>
                <th>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lab-w" style={{ marginTop: 10 }}>
          Ba thứ <b>cố ý không chép</b>: hình thức trừu tượng của SAP Fiori (dựng cho hàng
          nghìn người dùng nhiều quốc gia, một xưởng không cần tầng đó); bảng biểu đồ ở
          trang chủ; và việc thêm trạng thái mới khi chưa thật sự đau.
        </p>
      </Sec>

      <Sec
        n={7}
        id="do-phu"
        title="Tình trạng áp dụng"
        why="Đo trên mã nguồn 10/09/2026. Sổ này mô tả nơi hệ thống ĐANG ĐI TỚI, không mô tả nơi phần lớn mã đang đứng — nhầm hai thứ đó là sửa nhầm file."
      >
        <div className="lab-demo">
          <table className="lab-tbl">
            <thead>
              <tr>
                <th>Số đo</th>
                <th className="num">Giá trị</th>
                <th>Nghĩa</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>File dùng bộ kit mới</td>
                <td className="num">6</td>
                <td>Chi tiết đơn đặt vật tư là đầu cầu duy nhất</td>
              </tr>
              <tr>
                <td>File còn dùng kit cũ</td>
                <td className="num">168</td>
                <td>
                  Vẫn chạy, vẫn sửa bình thường. Không viết lại hàng loạt — chuyển khi có
                  việc chạm vào
                </td>
              </tr>
              <tr>
                <td>Thành phần kit có chỗ tra</td>
                <td className="num">77 / 82</td>
                <td>
                  Năm cái còn lại thuộc vỏ ứng dụng, chỉ ghi bằng chữ. Sổ trước dựng thật
                  22 / 82
                </td>
              </tr>
              <tr>
                <td>File nợ luật màu / thẻ thô</td>
                <td className="num">193</td>
                <td>
                  Bánh cóc <code>ui-baseline.json</code>: danh sách chỉ được ngắn đi
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="lab-w" style={{ marginTop: 10 }}>
          Nghĩa thực dụng: <b>màn MỚI dựng theo sổ này</b>. Màn cũ giữ nguyên cho tới khi
          có việc nghiệp vụ chạm vào nó — viết lại 168 file để cho đều nhau là đổi rất
          nhiều rủi ro lấy rất ít giá trị.
        </p>
      </Sec>
    </Doc>
  )
}
