'use client'

import { useState } from 'react'
import {
  Action,
  ActionGroup,
  ActionPane,
  type Check,
  Checks,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  HolderBar,
  NumInput,
  Pick,
  StatusBar,
  StatusTrack,
  Td,
  Th,
  TextInput,
  Timeline,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { m, n } from '../_kho/data'

/**
 * KHO · MÀN 3 — PHIẾU NHẬP (Khuôn D). MÀN NẶNG NHẤT CỦA CẢ PHÂN HỆ.
 *
 * Câu hỏi: "xe này chở gì, nhận bao nhiêu, hàng có đạt không, cất đâu?".
 *
 * BA Ý CHÉP CỦA ERP LỚN, và đây là chỗ để soi xem chúng có đáng chép không:
 *
 * 1. BA CỘT SỐ **Đặt / Đã về / Lần này** — mẫu Goods Receipt của SAP. Một đơn
 *    giao làm nhiều đợt là chuyện thường; bắt người nhận tự nhớ "đợt trước về
 *    bao nhiêu rồi" là nguồn sai lớn nhất của cả nghiệp vụ nhận hàng.
 *
 * 2. Ô **Tình trạng** ngay trên dòng — mẫu stock type của SAP (Unrestricted /
 *    Quality Inspection / Blocked). Hàng sai quy cách **VẪN VÀO SỔ**, ở trạng
 *    thái KHOÁ. Không có nút "từ chối nhận" làm hàng biến mất khỏi hệ thống
 *    trong khi nó nằm thật ngoài sân — đó là lối mòn đắt nhất của kho tự làm.
 *
 * 3. BẢNG KIỂM `Checks` nói **vướng gì VÀ gỡ thế nào**, hiện NGAY KHI GÕ chứ
 *    không đợi bấm Ghi sổ. Nút xám câm là lỗi UX; nút xám kèm câu chỉ đường
 *    mới là thiết kế.
 *
 * MÀN NÀY BẤM THỬ ĐƯỢC: đổi "Lần này" của NH-0480 lên trên 399 để thấy cảnh
 * báo vượt dung sai, hoặc đổi Tình trạng của một dòng sang "Sai quy cách" để
 * thấy ô lý do trở thành bắt buộc và nút Ghi sổ khoá lại.
 */

const TOL = 0.05 // dung sai nhận vượt 5% — lấy theo `over_tolerance_pct` của vật tư

type Status = 'ok' | 'qc' | 'blocked'

type Line = {
  code: string
  ordered: number
  arrived: number
  now: number
  bin: string
  status: Status
  note: string
}

const START: Line[] = [
  { code: 'NH-0480', ordered: 500, arrived: 120, now: 380, bin: 'NHOM-A1', status: 'ok', note: '' }, // prettier-ignore
  { code: 'NH-0482', ordered: 200, arrived: 0, now: 200, bin: 'KHOA-01', status: 'blocked', note: 'Giao sai mã hợp kim — hồ sơ ghi 6063 T5, hàng về dập 6061' }, // prettier-ignore
  { code: 'BUL0071', ordered: 5000, arrived: 2600, now: 2400, bin: 'TIEP-NHAN', status: 'qc', note: '' }, // prettier-ignore
]

const STATUS_OPTS = [
  { value: 'ok', label: 'Đạt — dùng được ngay' },
  { value: 'qc', label: 'Chờ kiểm — chưa cho dùng' },
  { value: 'blocked', label: 'Sai quy cách — khoá' },
]

const BINS = [
  { value: 'TIEP-NHAN', label: 'TIEP-NHAN · khu tiếp nhận' },
  { value: 'NHOM-A1', label: 'NHOM-A1' },
  { value: 'NHOM-A2', label: 'NHOM-A2' },
  { value: 'PK-C2', label: 'PK-C2' },
  { value: 'KHOA-01', label: 'KHOA-01 · kệ hàng khoá' },
]

const STATUS_TONE: Record<Status, 'stop' | 'warn' | undefined> = {
  ok: undefined,
  qc: 'warn',
  blocked: 'stop',
}

export default function Page() {
  const [lines, setLines] = useState<Line[]>(START)
  const [supplierDoc, setSupplierDoc] = useState('')

  const set = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  /** Phần còn lại của dòng đơn — nền để tính dung sai. */
  const remain = (l: Line) => l.ordered - l.arrived
  const overPct = (l: Line) => {
    const r = remain(l)
    return r <= 0 ? 0 : (l.now - r) / r
  }
  /** Dấu thập phân tiếng Việt là DẤU PHẨY — `${x}` cho ra "13.2%", sai locale. */
  const pct = (p: number) =>
    (Math.round(p * 1000) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

  /*
    BẢNG KIỂM TÍNH LẠI MỖI LẦN GÕ.

    Mỗi mục bắt buộc có `fix` — kiểu của `Check` không cho khai thiếu, và đó là
    cách rẻ nhất để không ai viết được một thông báo kiểu "dữ liệu không hợp lệ".
  */
  const checks: Check[] = []
  lines.forEach((l, i) => {
    const p = overPct(l)
    if (p > TOL && !l.note.trim()) {
      checks.push({
        level: 'stop',
        what: `Dòng ${i + 1} ${l.code} nhận vượt ${pct(p)}% phần còn lại (${n(remain(l))} ${m(l.code).unit})`,
        fix: `Dung sai cho phép ${TOL * 100}%. Vượt thì ghi lý do vào ô Ghi chú của dòng đó, hoặc sửa số về ${n(Math.floor(remain(l) * (1 + TOL)))}.`,
      })
    } else if (p > 0 && p <= TOL) {
      checks.push({
        level: 'warn',
        what: `Dòng ${i + 1} ${l.code} nhận vượt ${pct(p)}% — trong dung sai`,
        fix: 'Không cần giải trình. Ghi nhận bình thường, phần vượt vẫn vào tồn.',
      })
    }
    if (l.status === 'blocked' && !l.note.trim()) {
      checks.push({
        level: 'stop',
        what: `Dòng ${i + 1} ${l.code} khai "Sai quy cách" nhưng chưa ghi lý do`,
        fix: 'Lý do đi theo lô suốt đời nó — Cung ứng đọc đúng câu này để quyết trả NCC hay nhận giá giảm. Ghi vào ô Ghi chú của dòng.',
      })
    }
  })
  if (!supplierDoc.trim()) {
    checks.push({
      level: 'warn',
      what: 'Chưa ghi số phiếu giao của nhà cung cấp',
      fix: 'Kế toán đối chiếu hoá đơn theo số này. Không có thì tháng sau phải lục lại chứng từ giấy.',
    })
  }

  const stop = checks.filter((c) => c.level === 'stop')
  const blocked = stop.length > 0

  const okQty = lines.filter((l) => l.status === 'ok').reduce((s, l) => s + l.now, 0)
  const qcQty = lines.filter((l) => l.status === 'qc').reduce((s, l) => s + l.now, 0)
  const lockQty = lines
    .filter((l) => l.status === 'blocked')
    .reduce((s, l) => s + l.now, 0)

  return (
    <DocScreen>
      <LabNote>
        <div>
          <b>Khuôn D — Phiếu nhập. Bấm thử được.</b> Sửa ô “Lần này” của NH-0480 lên trên
          399 để thấy cảnh báo vượt dung sai; đổi Tình trạng một dòng sang{' '}
          <b>“Sai quy cách”</b> để thấy ô lý do thành bắt buộc và nút Ghi sổ khoá lại.
          Hàng sai quy cách <b>vẫn vào sổ</b> ở trạng thái khoá — không có nút “từ chối
          nhận” làm hàng biến mất khỏi hệ thống trong khi nó nằm thật ngoài sân.
        </div>
      </LabNote>

      <Crumb
        path={['Kho', 'Phiếu kho', 'PNK-2609-051']}
        view="Nhập theo đơn"
        position={[51, 51]}
      />

      <ActionPane
        tabs={[
          { label: 'Phiếu', active: true },
          { label: 'Cất hàng' },
          { label: 'Chất lượng' },
          { label: 'In & xuất' },
        ]}
      >
        <ActionGroup label="Duy trì">
          <Action strong>Sửa</Action>
          <Action>Thêm dòng ngoài đơn</Action>
          <Action>Xoá nháp</Action>
        </ActionGroup>
        <ActionGroup label="Ghi sổ">
          <Action
            primary
            disabled={blocked}
            title={blocked ? `Còn ${stop.length} lỗi chặn — xem bảng kiểm bên dưới` : undefined} // prettier-ignore
          >
            Ghi sổ
          </Action>
          <Action>Lưu nháp</Action>
          <Action
            disabled
            title="Chỉ bật sau khi phiếu đã ghi sổ — nháp thì xoá thẳng, không cần đảo"
          >
            Đảo phiếu
          </Action>
        </ActionGroup>
        {/*
          NHÓM NGOẠI LỆ — bốn nút, tức 4/9 hành động của màn phục vụ đường
          ngoại lệ. Màn chứng từ ERP thật rơi vào khoảng 60–70%; dưới 30% nghĩa
          là mới làm xong đường thuận. Đây là chỗ đo được, không phải cảm tính.
        */}
        <ActionGroup label="Khi không thuận">
          <Action>Chốt thiếu dòng</Action>
          <Action>Khoá cả phiếu</Action>
          <Action>Lập phiếu trả NCC</Action>
          <Action>Báo Cung ứng</Action>
        </ActionGroup>
        <ActionGroup label="Chứng từ liên quan">
          <Action>Đơn mua PO-2609-044</Action>
          <Action>Lệnh SX 07/26-14</Action>
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Phiếu nhập kho"
        code="PNK-2609-051"
        sub={
          <>
            Vạn Vi Thành · <span className="num">NCC-0112</span> · theo đơn{' '}
            <span className="num">PO-2609-044</span> đợt 2 · lập 15/09/2026 bởi Trần Thị C
          </>
        }
      >
        {/*
          HAI TRỤC, KHÔNG PHẢI MỘT. Phiếu kho có vòng đời rất ngắn (nháp → ghi
          sổ), nhưng việc CẤT HÀNG là một lần đi lại riêng, có khi người khác
          làm, có khi để tới chiều. Nhét nó vào cùng một thanh tuyến tính thì
          không diễn tả nổi tình trạng "đã ghi sổ nhưng hàng còn ở bãi".
        */}
        <StatusTrack label="Phiếu" steps={['Nháp', 'Đã ghi sổ']} at={0} />
        <StatusTrack
          label="Cất hàng"
          steps={['Chưa cất', 'Cất một phần', 'Đã cất']}
          at={0}
        />{' '}
        {/* prettier-ignore */}
      </DocHead>

      <HolderBar
        mine
        who="Kho — Trần Thị C"
        what={
          blocked
            ? 'Gỡ nốt lỗi chặn rồi ghi sổ — tồn chỉ đổi khi phiếu được ghi sổ'
            : 'Ghi sổ phiếu, rồi cất hàng khỏi khu tiếp nhận'
        }
        age="18 phút"
      />

      <Checks
        title={blocked ? 'Chưa ghi sổ được' : 'Ghi sổ được — còn vài điều nên xem'}
        items={checks}
      />

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <div className="k-strong" style={{ marginBottom: 4 }}>
                Vạn Vi Thành
              </div>
              <FactKv
                rows={[
                  ['Giao đúng hẹn', <span key="a" className="num k-t-done">11 / 13 đợt</span>], // prettier-ignore
                  ['Trễ trung bình', <span key="b" className="num">0,8 ngày</span>], // prettier-ignore
                  ['Lô bị khoá 6 tháng', <span key="c" className="num k-t-warn">2 lô</span>], // prettier-ignore
                  ['Nhận gần nhất', <span key="d" className="num">09/09/2026</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            {/*
              "LÔ BỊ KHOÁ 6 THÁNG" là con số chỉ tồn tại khi hàng không đạt VẪN
              VÀO SỔ. Từ chối nhận ngoài hệ thống thì ô này vĩnh viễn bằng 0 và
              không ai chấm được chất lượng NCC.
            */}
            <FactSection title="Dòng chảy chứng từ">
              <FactKv
                rows={[
                  [<span key="1" className="num">PO-2609-044</span>, 'Đơn mua · đợt 2/3'], // prettier-ignore
                  [<span key="2" className="num">LSX 07/26-14</span>, 'Lệnh SX · đang chờ cấp'], // prettier-ignore
                  [<span key="3" className="num">chưa có</span>, 'Hoá đơn NCC'], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Người theo dõi">
              <FactKv
                rows={[
                  ['Trần Thị C', 'lập phiếu'],
                  ['Nguyễn Văn A', 'cung ứng'],
                  ['Lê Minh KCS', 'kiểm hàng'],
                ]}
              />
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Đầu phiếu"
          defaultOpen
          summary={[
            ['Kho nhận', 'Kho vật tư chính'],
            ['Ngày', <span key="h" className="num">15/09/2026</span>], // prettier-ignore
            ['Đợt', <span key="d" className="num">2 / 3</span>], // prettier-ignore
          ]}
        >
          <FieldGrid
            note={
              <>
                Ô nền nhạt là giá trị <b>kế thừa từ đơn mua</b> — sửa ở đây chỉ đổi cho
                phiếu này.
              </>
            }
          >
            <Field label="Lý do nhập">N1 · Nhập mua theo đơn</Field>
            <Field label="Đơn mua" inherited>
              <span className="num">PO-2609-044</span>
            </Field>
            <Field label="Nhà cung cấp" inherited>
              Vạn Vi Thành
            </Field>
            <Field label="Kho nhận" inherited>
              Kho vật tư chính
            </Field>
            <Field label="Ngày nhập">
              <span className="num">15/09/2026</span>
            </Field>
            <Field label="Số phiếu giao NCC" tone={supplierDoc ? undefined : 'warn'}>
              <TextInput
                value={supplierDoc}
                onCommit={setSupplierDoc}
                placeholder="VD: 0012345"
              />
            </Field>
            <Field label="Người giao">Nguyễn Văn Tài · 0908 xxx xxx</Field>
            <Field label="Biển số xe">
              <span className="num">61C-234.56</span>
            </Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Dòng hàng"
          defaultOpen
          flush
          summary={[
            ['Dòng', <span key="a" className="num">{lines.length}</span>], // prettier-ignore
            ['Vào dùng được', <span key="b" className="num k-t-done">{n(okQty)}</span>], // prettier-ignore
            ['Vào chờ kiểm / khoá', <span key="c" className="num k-t-warn">{n(qcQty + lockQty)}</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={1120}>
            <GridHead>
              <Th width={34}>#</Th>
              <Th width={250}>Mã / Tên</Th>
              <Th width={52}>ĐVT</Th>
              <Th num width={78}>
                Đặt
              </Th>
              <Th num width={78}>
                Đã về
              </Th>
              <Th num width={96}>
                Lần này
              </Th>
              <Th width={168}>Tình trạng</Th>
              <Th width={168}>Kệ</Th>
              <Th>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const p = overPct(l)
                const needNote = (p > TOL || l.status === 'blocked') && !l.note.trim()
                return (
                  <GridRow key={l.code}>
                    <Td num tone={needNote ? 'stop' : undefined}>
                      {needNote ? '▌' : ''}
                      {i + 1}
                    </Td>
                    <Td>
                      <b className="num">{l.code}</b> · {m(l.code).name}
                    </Td>
                    <Td>{m(l.code).unit}</Td>
                    <Td num>{n(l.ordered)}</Td>
                    {/*
                      "Đã về" của CÁC ĐỢT TRƯỚC. Ô trống khi bằng 0 (luật showNum
                      của kit): "0 đã về" và "chưa ai nhập số" là hai chuyện khác
                      nhau, và bảng đầy số 0 thì mắt phải lọc thủ công.
                    */}
                    <Td num>
                      <span className="text-[var(--ink-3)]">
                        {l.arrived === 0 ? '' : n(l.arrived)}
                      </span>
                    </Td>
                    <Td num tone={p > TOL ? 'stop' : p > 0 ? 'warn' : undefined}>
                      <NumInput
                        value={String(l.now)}
                        onCommit={(v) => set(i, { now: Math.max(0, Number(v) || 0) })}
                      />
                    </Td>
                    <Td tone={STATUS_TONE[l.status]}>
                      <Pick
                        label="Tình trạng"
                        value={l.status}
                        options={STATUS_OPTS}
                        onChange={(v) =>
                          set(i, {
                            status: v as Status,
                            // Sai quy cách thì hàng đi thẳng kệ khoá — không để
                            // người dùng chọn kệ thường cho lô đang khoá.
                            bin: v === 'blocked' ? 'KHOA-01' : l.bin === 'KHOA-01' ? 'TIEP-NHAN' : l.bin, // prettier-ignore
                          })
                        }
                        width={160}
                      />
                    </Td>
                    <Td>
                      <Pick
                        label="Kệ"
                        value={l.bin}
                        options={BINS}
                        onChange={(v) => set(i, { bin: v })}
                        disabled={l.status === 'blocked'}
                        width={160}
                      />
                    </Td>
                    <Td tone={needNote ? 'stop' : undefined}>
                      <TextInput
                        value={l.note}
                        onCommit={(v) => set(i, { note: v })}
                        placeholder={needNote ? 'bắt buộc — vì sao?' : 'ghi chú'}
                      />
                    </Td>
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={5}>
                Cộng {lines.length} dòng · vào dùng được {n(okQty)} · chờ kiểm {n(qcQty)}{' '}
                · khoá {n(lockQty)}
              </Td>
              <Td num>{n(okQty + qcQty + lockQty)}</Td>
              <Td colSpan={3} />
            </GridFoot>
          </Grid>
          <p className="px-[var(--gutter)] py-[9px] text-[var(--fs-sm)] text-[var(--ink-3)]">
            Chân bảng nói rõ <b>tổng chia về đâu</b>. Một tổng duy nhất “580 đơn vị” là
            con số đúng mà vô dụng: thứ người đọc cần biết là bao nhiêu trong đó{' '}
            <b>cấp đi được ngay</b>.
          </p>
        </FastTab>

        <FastTab
          title="Dòng thời gian"
          summary={[
            ['Mốc', <span key="a" className="num">4</span>], // prettier-ignore
            ['Mở đầu', <span key="b" className="num">01/09</span>], // prettier-ignore
            ['Gần nhất', <span key="c" className="num">15/09 09:20</span>], // prettier-ignore
          ]}
        >
          <Timeline
            marks={[
              { key: '1', at: '2026-09-01T09:10:00', label: 'Cung ứng gửi đơn PO-2609-044', actor: 'Nguyễn Văn A' }, // prettier-ignore
              { key: '2', at: '2026-09-09T14:30:00', label: 'Nhận đợt 1 — PNK-2609-042', actor: 'Trần Thị C', detail: '120 cây NH-0480, 2.600 con BUL0071' }, // prettier-ignore
              { key: '3', at: '2026-09-15T09:20:00', label: 'Xe đợt 2 tới bãi', actor: 'Trần Thị C', tone: 'act' }, // prettier-ignore
              { key: '4', at: null, label: 'Ghi sổ phiếu nhập', actor: null }, // prettier-ignore
              { key: '5', at: null, label: 'Cất khỏi khu tiếp nhận', actor: null }, // prettier-ignore
            ]}
          />
        </FastTab>
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Công ty Hoàng Gia · Kho vật tư chính',
          <span key="d" className="num">
            15/09/2026 09:38
          </span>,
        ]}
        right={
          blocked ? `${stop.length} lỗi chặn ghi sổ` : `${n(okQty + qcQty + lockQty)} đơn vị sẵn sàng ghi sổ` // prettier-ignore
        }
      />
    </DocScreen>
  )
}
