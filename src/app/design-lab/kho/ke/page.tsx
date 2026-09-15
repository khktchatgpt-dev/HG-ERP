'use client'

import {
  Btn,
  Cell,
  Code,
  NoticeBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { BINS_ALL, type Bin } from '../_kho/data'

/**
 * KHO · MÀN 12 — SƠ ĐỒ KỆ (Khuôn C). Thuộc họ NỀN, nằm sau vạch ngăn.
 *
 * Câu hỏi: "kho có những khu nào, khu nào lâu rồi chưa ai đếm?".
 *
 * MƯỜI HAI KHU THÔ, KHÔNG ĐÁNH TỚI TỪNG Ô — và đây là quyết định đáng cãi
 * nhất của cả phân hệ, nên nói rõ lý do:
 *
 * Xưởng chưa đánh mã kệ ngoài thực địa. Đánh mã tới từng ô nghe "làm cho
 * chuẩn ngay từ đầu", nhưng nó có nghĩa là phải dán tem cả nhà kho TRƯỚC KHI
 * dùng được một ngày nào — và trong lúc đó `bin_id` chỉ là một ô rỗng nữa
 * trên phiếu. Khu thì sơn một tấm biển là xong trong buổi sáng, và nó đã đủ
 * trả lời câu "hàng để đâu". Chia nhỏ về sau chỉ là thêm dòng vào bảng này.
 *
 * BA KHU ẢO. `TIEP-NHAN` (chưa cất) · `KHOA-01` (chưa được dùng) · `PHE-Z`
 * (chờ thanh lý) không phải chỗ thật nào cả — chúng là cách chép "địa điểm
 * ảo" của Odoo mà không phải dựng cây địa điểm. Nhờ chúng mà:
 *   · "chờ cất" là một CÂU TRUY VẤN (còn gì ở TIEP-NHAN), không phải một cờ
 *     trạng thái phải nuôi;
 *   · mọi lượng luôn ở một chỗ có tên, không lượng nào "biến mất".
 *
 * CỘT "ĐẾM GẦN NHẤT" là lý do màn này không chỉ là một bảng cấu hình: nó là
 * chỗ lên lịch kiểm kê XOAY VÒNG theo khu, thay cho việc kiểm cả kho một lần
 * — mà kiểm cả kho một lần thì thực tế là không bao giờ kiểm.
 */

const KIND_LABEL: Record<Bin['kind'], string> = {
  store: 'Kệ thật',
  receiving: 'Khu tiếp nhận',
  blocked: 'Kệ hàng khoá',
  scrap: 'Khu phế liệu',
}

const KIND_TONE: Record<Bin['kind'], 'neutral' | 'warn' | 'stop' | 'done'> = {
  store: 'done',
  receiving: 'warn',
  blocked: 'stop',
  scrap: 'neutral',
}

const virtual = BINS_ALL.filter((b) => b.kind !== 'store')
const never = BINS_ALL.filter((b) => b.kind === 'store' && !b.lastCount)
const stale = BINS_ALL.filter((b) => b.kind === 'store' && b.lastCount === '02/08')

export default function Page() {
  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn C — Sơ đồ kệ.</b> <b>Mười hai khu thô</b>, không đánh tới từng ô: sơn
          một tấm biển mỗi khu là xong trong buổi sáng, còn dán tem cả nhà kho thì phải
          làm xong trước khi dùng được ngày nào. Ba khu <b>ẢO</b> (tiếp nhận · khoá · phế)
          là cách chép “địa điểm ảo” của Odoo — nhờ chúng mà “chờ cất” chỉ là một câu truy
          vấn, không phải một cờ trạng thái phải nuôi.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Nền"
        title="Sơ đồ kệ"
        facts={[
          { label: 'Khu', value: String(BINS_ALL.length) },
          { label: 'Khu ảo', value: String(virtual.length) },
          { label: 'Chưa kiểm bao giờ', value: String(never.length), tone: 'warn' },
        ]}
        actions={
          <>
            <Btn href="/design-lab/kho/kiem-ke">Mở đợt kiểm kê</Btn>
            <Btn primary>+ Thêm khu</Btn>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface)] px-[var(--gutter)] py-[13px]">
        <NoticeBar tone="warn" tag="Đến hạn" action={{ label: 'Mở đợt cho 3 khu này' }}>
          <b>
            {never.length} khu chưa kiểm bao giờ, {stale.length} khu kiểm lần cuối 02/08.
          </b>{' '}
          Kiểm kê xoay vòng theo khu thì mỗi đợt chỉ mất một buổi và cả kho được phủ trong
          tháng. Kiểm cả kho một lần nghe chặt chẽ hơn, nhưng thực tế là không bao giờ
          kiểm — bằng chứng nằm ngay ở cột bên phải.
        </NoticeBar>

        <div className="mt-[13px] overflow-hidden rounded-[var(--radius)] border border-[var(--line)]">
          <Table>
            <THead>
              <th>Mã khu</th>
              <th>Tên</th>
              <th>Loại</th>
              <th style={{ textAlign: 'right' }}>Mã đang nằm</th>
              <th>Đếm gần nhất</th>
              <th>Ghi chú</th>
            </THead>
            <tbody>
              {BINS_ALL.map((b) => (
                <Row key={b.code}>
                  <Cell>
                    <Code>{b.code}</Code>
                  </Cell>
                  <Cell grow>{b.name}</Cell>
                  <Cell>
                    <Tag tone={KIND_TONE[b.kind]}>{KIND_LABEL[b.kind]}</Tag>
                  </Cell>
                  <Cell num>
                    <Num value={String(b.mats)} zero="dash" />
                  </Cell>
                  <Cell
                    num
                    className={!b.lastCount && b.kind === 'store' ? 'text-[var(--warn)]' : undefined} // prettier-ignore
                  >
                    {b.kind !== 'store' ? (
                      <span className="text-[var(--ink-3)]">không kiểm kê</span>
                    ) : b.lastCount ? (
                      b.lastCount
                    ) : (
                      'chưa bao giờ'
                    )}
                  </Cell>
                  <Cell muted>
                    {b.kind === 'receiving'
                      ? 'Hàng ở đây = việc "chờ cất"'
                      : b.kind === 'blocked'
                        ? 'Không tính vào tồn dùng được'
                        : b.kind === 'scrap'
                          ? 'Ra khỏi tồn khi lập phiếu X4'
                          : ''}
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>

        <p className="mt-[13px] max-w-[76ch] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
          Ba khu ảo <b>không kiểm kê</b> — và đó không phải là bỏ sót. Hàng ở{' '}
          <span className="num">TIEP-NHAN</span> vừa được đếm lúc nhận; hàng ở{' '}
          <span className="num">KHOA-01</span> đã có biên bản khoá ghi rõ số; hàng ở{' '}
          <span className="num">PHE-Z</span> đã ra khỏi tồn bằng phiếu X4. Đếm lại chúng
          là đếm hai lần cùng một lượng, và đó là cách nhanh nhất để sổ tự mâu thuẫn với
          chính nó.
        </p>
      </div>

      <StatusBar
        left={[
          <>
            <b>Lê Văn D</b> · Quản lý kho
          </>,
          'Kho vật tư chính',
        ]}
        right={`${BINS_ALL.length} khu · ${virtual.length} khu ảo`}
      />
    </ScreenFrame>
  )
}
