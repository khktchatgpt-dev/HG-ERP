'use client'

import Link from 'next/link'
import {
  Action,
  ActionGroup,
  ActionPane,
  AuditTable,
  Checks,
  Crumb,
  DocHead,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  GridBtn,
  GridSep,
  GridToolbar,
  HolderBar,
  LineStatus,
  StatusBar,
  StatusTrack,
} from '@/components/kit'

/**
 * SỔ THAM CHIẾU SỐNG của bộ kit — ngôn ngữ ERP.
 *
 * Thay hẳn bản cũ (`DesignLab.tsx`, theme v3) và bản kit-lab v4: cả hai đã bị
 * xoá 09/09/2026 khi chủ dự án chốt "thiết kế lại bộ kit theo thiết kế mới,
 * xoá đi các mẫu thiết kế cũ".
 *
 * Trang này bày TỪNG thành phần rời. Muốn xem chúng ráp lại thành một màn
 * chứng từ hoàn chỉnh thì sang `/design-lab/mau-erp`.
 *
 * Khu `design-lab` CÔNG KHAI (`PUBLIC_PATHS` ở proxy.ts) — đưa người ngoài
 * xem không cần cấp tài khoản.
 */

const SOURCES: [string, string][] = [
  ['Action Pane có nhóm gắn nhãn', 'Dynamics 365 F&O'],
  ['Ba trục trạng thái tách biệt', 'Dynamics 365 F&O'],
  ['FastTab mang số liệu trên dòng tiêu đề', 'Dynamics 365 F&O'],
  ['FactBox — dữ kiện liên quan', 'Dynamics 365 F&O'],
  ['Statusbar bấm được', 'Odoo'],
  ['Bảng kiểm chặn gửi duyệt', 'Dynamics validation'],
  ['Nhật ký thay đổi trường', 'SAP change documents'],
  ['Dải “ai đang giữ”', 'SAP My Inbox'],
  ['Khung nhìn lưu được', 'SAP variant / Dynamics saved view'],
  ['Thanh trạng thái đáy màn', 'SAP GUI'],
]

function Demo({
  n,
  title,
  why,
  children,
}: {
  n: number
  title: string
  why: string
  children: React.ReactNode
}) {
  return (
    <section className="lab-sec">
      <div className="lab-h">
        <span className="lab-n num">{String(n).padStart(2, '0')}</span>
        <div>
          <h2 className="lab-t">{title}</h2>
          <p className="lab-w">{why}</p>
        </div>
      </div>
      <div className="lab-demo">{children}</div>
    </section>
  )
}

export default function DesignLabPage() {
  return (
    <div className="kit lab">
      <style>{CSS}</style>

      <header className="lab-top">
        <div className="lab-eyebrow">Sổ tham chiếu · Bộ kit</div>
        <h1 className="lab-title">Khung chứng từ ERP</h1>
        <p className="lab-deck">
          Mười thành phần dựng nên một màn chứng từ. Mỗi cái chép từ một hệ ERP thật và
          ghi rõ chép của ai — để sau này ai sửa còn biết đang phá vỡ quy ước của ai.
        </p>
        <p className="lab-deck">
          Chữ nền vẫn <b>13px</b>: ERP mặc định dày. Dễ đọc đến từ kỷ luật căn chỉnh và
          tương phản, không từ việc phóng to chữ.
        </p>
        <Link className="lab-cta" href="/design-lab/mau-erp">
          Xem cả mười ráp thành một màn hoàn chỉnh →
        </Link>
      </header>

      <Demo
        n={1}
        title="Thanh định vị + khung nhìn"
        why="Điều hướng bản ghi (‹ 14/68 ›) là thứ web hầu như không có, nhưng người ERP dùng liên tục để duyệt cả tập chứng từ mà không quay ra danh sách."
      >
        <Crumb
          path={['Cung ứng', 'Đơn đặt vật tư', 'PO-2609-014']}
          view="Đơn của tôi · quá hạn"
          position={[14, 68]}
        />
      </Demo>

      <Demo
        n={2}
        title="Action Pane"
        why="Nút bày sẵn, chia nhóm có nhãn. Không giấu vào menu “⋯”: người dùng mở màn này vài chục lần mỗi ngày và bấm bằng trí nhớ vị trí."
      >
        <ActionPane
          tabs={[
            { label: 'Đơn hàng', active: true },
            { label: 'Nhận hàng' },
            { label: 'Tài chính' },
          ]}
        >
          <ActionGroup label="Duy trì">
            <Action strong>Sửa</Action>
            <Action>Mới</Action>
            <Action>Sao chép</Action>
          </ActionGroup>
          <ActionGroup label="Luồng phê duyệt">
            <Action primary disabled title="Còn 2 lỗi chặn">
              Gửi duyệt
            </Action>
            <Action>Trả lại người soạn</Action>
          </ActionGroup>
          <ActionGroup label="In &amp; xuất">
            <Action>Phiếu đặt hàng</Action>
            <Action>Xuất Excel</Action>
          </ActionGroup>
        </ActionPane>
      </Demo>

      <Demo
        n={3}
        title="Đầu chứng từ + ba trục trạng thái"
        why="Dynamics tách trạng thái đơn / nhận hàng / thanh toán vì một thanh tuyến tính không diễn tả nổi “hàng về một phần mà vẫn đang chờ sửa giá”."
      >
        <DocHead
          kind="Đơn đặt vật tư"
          code="PO-2609-014"
          sub="Cơ khí Thành Đạt · soạn 01/09/2026 bởi Nguyễn Văn A"
        >
          <StatusTrack
            label="Trạng thái đơn"
            steps={['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đã gửi NCC']}
            at={0}
          />
          <StatusTrack label="Nhận hàng" steps={['Chưa nhận', 'Một phần', 'Đủ']} at={0} />
        </DocHead>
      </Demo>

      <Demo
        n={4}
        title="Dải “ai đang giữ”"
        why="Không có dòng này thì không ai biết chứng từ đang chờ mình hay chờ người khác — nguyên nhân đo được của 65 đơn nằm nháp trung bình 6,5 ngày."
      >
        <HolderBar
          mine
          who="Cung ứng — Nguyễn Văn A"
          what="Soạn xong thì gửi Giám đốc duyệt"
          age="8 ngày"
        />
        <HolderBar who="Giám đốc" what="Chờ duyệt hoặc từ chối" age="7 ngày" />
      </Demo>

      <Demo
        n={5}
        title="Bảng kiểm trước khi gửi duyệt"
        why="Chặn hành động VÀ nói rõ vướng gì, kèm cách gỡ. Web hay làm ngược: cho bấm rồi mới báo lỗi."
      >
        <Checks
          title="Chưa gửi duyệt được"
          items={[
            { level: 'stop', what: 'Dòng 2 — NK-0056 chưa có đơn giá', fix: 'Nhập giá hoặc đánh dấu “chờ báo giá”' }, // prettier-ignore
            { level: 'warn', what: 'Hạn giao 07/09/2026 đã qua 2 ngày', fix: 'Cập nhật hạn hoặc ghi lý do trễ' }, // prettier-ignore
          ]}
        />
      </Demo>

      <Demo
        n={6}
        title="FastTab"
        why="Khối gấp được mà dòng tiêu đề VẪN mang số liệu. Web gấp là mất sạch, nên không ai dám gấp và màn cứ dài mãi."
      >
        <FastTab
          title="Tổng quan"
          defaultOpen
          summary={[
            ['Kho nhận', 'Kho vật tư chính'],
            ['Hạn giao', <span key="h" className="k-t-stop">07/09/2026 · trễ 2 ngày</span>], // prettier-ignore
          ]}
        >
          <FieldGrid>
            <Field label="Nhà cung cấp">Cơ khí Thành Đạt</Field>
            <Field label="Kho nhận">Kho vật tư chính</Field>
            <Field label="Tỷ giá" inherited>
              <span className="num">1,000000</span>
            </Field>
          </FieldGrid>
        </FastTab>
        <FastTab
          title="Đợt giao (đang gấp — vẫn đọc được số)"
          summary={[
            ['Số đợt', <span key="a" className="num">1</span>], // prettier-ignore
            ['Đã nhận', <span key="b" className="num">0 / 1</span>], // prettier-ignore
          ]}
        >
          <div style={{ color: 'var(--ink-3)' }}>Nội dung khối.</div>
        </FastTab>
      </Demo>

      <Demo
        n={7}
        title="Lưới nhãn–giá trị"
        why="Xương sống của mọi màn chứng từ: nhãn rộng cố định, giá trị luôn bắt đầu ở cùng một cột, nên mắt quét dọc được thay vì đọc từng dòng."
      >
        <div className="lab-card">
          <FieldGrid note="Ô nền nhạt là giá trị kế thừa từ hồ sơ gốc.">
            <Field label="Mã NCC">
              <span className="num">NCC-0043</span>
            </Field>
            <Field label="Ngày đặt">
              <span className="num">01/09/2026</span>
            </Field>
            <Field label="Hạn giao" tone="stop">
              <span className="num">07/09/2026</span>
            </Field>
            <Field label="Hạn mức NCC" inherited>
              <span className="num">500.000.000 ₫</span>
            </Field>
          </FieldGrid>
        </div>
      </Demo>

      <Demo
        n={8}
        title="Thanh công cụ lưới + trạng thái dòng"
        why="Mọi lưới ERP có thanh riêng và số dòng đang chọn. Web thường bỏ hẳn rồi bắt thao tác từng dòng bằng menu chuột phải."
      >
        <div className="lab-card">
          <GridToolbar count="2 dòng đã chọn">
            <GridBtn>+ Thêm dòng</GridBtn>
            <GridBtn>Xoá dòng</GridBtn>
            <GridBtn disabled title="Chọn ít nhất một dòng">
              Sao chép
            </GridBtn>
            <GridSep />
            <GridBtn>Lọc</GridBtn>
            <GridBtn>Chọn cột</GridBtn>
          </GridToolbar>
          <div className="lab-chips">
            <LineStatus kind="idle">Chưa nhận</LineStatus>
            <LineStatus kind="part">Một phần</LineStatus>
            <LineStatus kind="done">Đủ</LineStatus>
            <LineStatus kind="short">Đóng thiếu</LineStatus>
          </div>
        </div>
      </Demo>

      <Demo
        n={9}
        title="FactBox"
        why="Cột phải chứa dữ kiện liên quan, không phải chỗ điều hướng. Người duyệt cần biết NCC giao đúng hẹn mấy lần mà không phải rời chứng từ."
      >
        <div style={{ maxWidth: 268 }}>
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <div className="k-strong" style={{ marginBottom: 4 }}>
                Cơ khí Thành Đạt
              </div>
              <FactKv
                rows={[
                  ['Giao đúng hẹn', <span key="a" className="num k-t-done">8 / 9 đơn</span>], // prettier-ignore
                  ['Giá lần trước', <span key="b" className="num">352.000 ₫</span>], // prettier-ignore
                  ['Đang nợ', <span key="c" className="num">0 ₫</span>], // prettier-ignore
                ]}
              />
            </FactSection>
          </FactBox>
        </div>
      </Demo>

      <Demo
        n={10}
        title="Nhật ký thay đổi + thanh trạng thái đáy"
        why="Nhật ký là thứ MÁY ghi, tách hẳn khỏi Trao đổi là thứ NGƯỜI viết. Gộp vào một dòng thời gian là mất cả hai."
      >
        <div className="lab-card">
          <AuditTable
            rows={[
              { at: '02/09 14:20', who: 'Nguyễn Văn A', field: 'Đơn giá · CN1527', from: '352.000', to: '369.600' }, // prettier-ignore
              { at: '05/09 16:10', who: 'Lê Văn D', field: 'Hạn giao', from: '05/09/2026', to: '07/09/2026' }, // prettier-ignore
            ]}
          />
        </div>
        <StatusBar
          left={[
            <>
              <b>Nguyễn Văn A</b> · Cung ứng
            </>,
            'Công ty Hoàng Gia · Xưởng Bình Dương',
          ]}
          right="PO-2609-014 · bản ghi 14/68"
        />
      </Demo>

      <section className="lab-sec">
        <div className="lab-h">
          <span className="lab-n num">↺</span>
          <div>
            <h2 className="lab-t">Chép của ai</h2>
            <p className="lab-w">
              Không có đặc trưng nào ở đây do tôi nghĩ ra. Ghi nguồn để lần sau ai sửa còn
              biết đang phá quy ước của hệ nào.
            </p>
          </div>
        </div>
        <div className="lab-card">
          <dl className="k-fact-kv lab-src">
            {SOURCES.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.lab{min-height:100vh;padding:0 0 60px}
.lab-top{padding:44px var(--gutter) 30px;border-bottom:2px solid var(--ink);background:var(--surface-card)}
.lab-eyebrow{font-size:var(--fs-label);font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-3)}
.lab-title{margin:10px 0 0;font-size:38px;font-weight:800;letter-spacing:-.03em;line-height:1.06}
.lab-deck{margin:12px 0 0;font-size:15px;line-height:1.6;color:var(--ink-2);max-width:66ch}
.lab-cta{display:inline-block;margin-top:16px;font-size:14px;font-weight:600;color:var(--act)}
.lab-sec{padding:30px var(--gutter) 0;max-width:1180px}
.lab-h{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;margin-bottom:12px}
.lab-n{font-size:var(--fs-sm);font-weight:700;color:var(--act);border:1.5px solid var(--act);
  border-radius:var(--radius);padding:2px 7px;margin-top:2px;text-align:center}
.lab-t{margin:0;font-size:var(--fs-title);font-weight:700;letter-spacing:-.015em}
.lab-w{margin:3px 0 0;font-size:var(--fs-body);color:var(--ink-2);max-width:74ch;line-height:1.55}
.lab-demo{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface)}
.lab-card{background:var(--surface-card);border-bottom:1px solid var(--line)}
.lab-card:last-child{border-bottom:0}
.lab-chips{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px}
.lab-src > div{padding:4px 12px;border-bottom:1px solid var(--hair)}
.lab-src > div:last-child{border-bottom:0}
`
