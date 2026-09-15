'use client'

import { useState } from 'react'
import {
  Action,
  ActionGroup,
  ActionPane,
  type Check,
  Checks,
  CoverageBar,
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
  StatusBar,
  StatusTrack,
  Td,
  Th,
  TextInput,
  Tick,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { COUNT_LINES, type CountLine, m, n } from '../_kho/data'

/**
 * KHO · MÀN 8 — ĐỢT KIỂM KÊ (Khuôn D cho đầu đợt + F cho lưới đếm).
 *
 * Câu hỏi: "đợt này đếm tới đâu, lệch chỗ nào, ai chịu trách nhiệm số đó?".
 *
 * Kiểm kê là CHỨNG TỪ NẶNG NHẤT TRONG KHO, và thiết kế của nó quyết định cả
 * hệ thống có được tin hay không: đây là lần duy nhất người ta đối chiếu sổ
 * với sự thật ngoài kệ.
 *
 * BỐN QUYẾT ĐỊNH THIẾT KẾ, mỗi cái vá một lối mòn đo được:
 *
 * 1. ĐỢT CÓ PHẠM VI. Mở đợt là chọn KHU / NHÓM / danh sách mã — không bao giờ
 *    có đường nào đếm cả danh mục. Lối mòn cũ: một form 13.229 dòng và một
 *    nút, và phiếu duy nhất từng lập bằng nó là phiếu xoá sạch kho về 0.
 *
 * 2. SỔ ĐÓNG BĂNG LÚC MỞ ĐỢT (`book`). Không đóng băng thì người đếm xong hai
 *    tiếng, trong khoảng đó có phiếu nhập, và chênh lệch tính ra sai mà không
 *    ai biết. Cột ghi rõ "Sổ (chốt 08:00)" chứ không ghi "Tồn".
 *
 * 3. ĐẾM MÙ, CÓ CÔNG TẮC. SAP và Dynamics mặc định GIẤU cột sổ lúc đếm: thấy
 *    số sổ thì người đếm bị dẫn dắt, đếm ra "khớp" mà không thật sự đếm. Bật
 *    công tắc "Hiện số sổ" ở đầu lưới để thấy khác biệt ngay.
 *
 * 4. DÒNG LỆCH BẮT GHI LÝ DO. Lệch không có lý do là số nói dối một cách trơn
 *    tru — ba tháng sau không ai trả lời được vì sao mã đó hụt 8 cây.
 */

type Row = CountLine & { id: string }

const START: Row[] = COUNT_LINES.map((l, i) => ({ ...l, id: `r${i}` }))

export default function Page() {
  const [rows, setRows] = useState<Row[]>(START)
  /** Mặc định MÙ — chép SAP/Dynamics. Công tắc để thấy được khác biệt. */
  const [showBook, setShowBook] = useState(false)

  const set = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const counted = rows.filter((r) => r.counted != null)
  const diffs = counted.filter((r) => r.counted !== r.book)
  const noReason = diffs.filter((r) => !r.note.trim())
  const notYet = rows.filter((r) => r.counted == null)

  const checks: Check[] = []
  if (notYet.length > 0) {
    checks.push({
      level: 'stop',
      what: `Còn ${notYet.length} mã chưa đếm: ${notYet.map((r) => r.code).join(', ')}`,
      fix: 'Đếm nốt, hoặc thu hẹp phạm vi đợt nếu những mã đó không nằm trong khu đang kiểm. Bỏ trống rồi duyệt là mặc nhiên coi tồn sổ của chúng là đúng — mà chưa ai nhìn.',
    })
  }
  noReason.forEach((r) => {
    checks.push({
      level: 'stop',
      what: `${r.code} lệch ${n((r.counted ?? 0) - r.book)} ${m(r.code).unit} nhưng chưa ghi lý do`,
      fix: 'Ghi vào ô Ghi chú của dòng. Lý do là thứ duy nhất còn lại sau ba tháng — số thì sổ nào cũng có.',
    })
  })
  if (diffs.length > 0 && noReason.length === 0) {
    checks.push({
      level: 'warn',
      what: `${diffs.length} dòng lệch sổ, đã có lý do cho cả ${diffs.length}`,
      fix: 'Duyệt đợt sẽ sinh phiếu N4 (thừa) và X5 (thiếu) để kéo tồn về đúng số đếm. Hai phiếu đó vào sổ như mọi phiếu khác, đảo được.',
    })
  }

  const stop = checks.filter((c) => c.level === 'stop')
  const blocked = stop.length > 0
  const surplus = diffs.filter((r) => (r.counted ?? 0) > r.book)
  const deficit = diffs.filter((r) => (r.counted ?? 0) < r.book)

  return (
    <DocScreen>
      <LabNote>
        <div>
          <b>Khuôn D + F — Đợt kiểm kê. Bấm thử được.</b> Mặc định là <b>đếm mù</b>: cột
          “Sổ” bị giấu để người đếm không bị số sổ dẫn dắt — bật công tắc ở đầu lưới để
          thấy khác biệt. Cột sổ là số <b>đã đóng băng lúc mở đợt</b>, không phải tồn hiện
          tại. Xoá ghi chú của dòng lệch để thấy nút Gửi đối chiếu khoá lại.
        </div>
      </LabNote>

      <Crumb
        path={['Kho', 'Kiểm kê', 'DKK-2609-03']}
        view="Đợt đang đếm"
        position={[3, 3]}
      />

      <ActionPane
        tabs={[
          { label: 'Đợt', active: true },
          { label: 'Phân công' },
          { label: 'In phiếu đếm' },
        ]}
      >
        <ActionGroup label="Đợt">
          <Action strong>Sửa phạm vi</Action>
          <Action>Thêm mã vào đợt</Action>
          <Action>Huỷ đợt</Action>
        </ActionGroup>
        <ActionGroup label="Chốt">
          <Action
            primary
            disabled={blocked}
            title={blocked ? `Còn ${stop.length} lỗi chặn — xem bảng kiểm phía trên` : undefined} // prettier-ignore
          >
            Gửi đối chiếu
          </Action>
          <Action>Lưu tạm</Action>
          <Action disabled title="Chỉ quản lý kho duyệt được, và chỉ sau bước đối chiếu">
            Duyệt đợt
          </Action>
        </ActionGroup>
        <ActionGroup label="Khi không thuận">
          <Action>Đếm lại một mã</Action>
          <Action>Chuyển người đếm</Action>
          <Action>Tách mã sang đợt sau</Action>
        </ActionGroup>
        <ActionGroup label="In &amp; xuất">
          <Action>Phiếu đếm giấy</Action>
          <Action>Biên bản kiểm kê</Action>
          <Action>Xuất Excel</Action>
        </ActionGroup>
      </ActionPane>

      <DocHead
        kind="Đợt kiểm kê"
        code="DKK-2609-03"
        sub={
          <>
            Khu A · kệ NHOM-A1…A3, MAY-B1, MAY-B3, PK-C2, HAN-F1 ·{' '}
            <span className="num">{rows.length}</span> mã · mở 15/09/2026 bởi Lê Văn D
          </>
        }
      >
        <StatusTrack
          label="Đợt"
          steps={['Mở', 'Đang đếm', 'Đối chiếu', 'Đã duyệt']}
          at={1}
        />
      </DocHead>

      <HolderBar
        mine
        who="Kho — Trần Thị C"
        what={
          blocked
            ? `Đếm nốt ${notYet.length} mã và ghi lý do cho dòng lệch`
            : 'Gửi đối chiếu để quản lý kho duyệt'
        }
        age="2 giờ"
      />

      <Checks
        title={blocked ? 'Chưa gửi đối chiếu được' : 'Gửi được — đọc kỹ phần này trước'}
        items={checks}
      />

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Phạm vi đợt">
              <FactKv
                rows={[
                  ['Kiểu phạm vi', 'Theo khu kệ'],
                  ['Số kệ', <span key="b" className="num">7</span>], // prettier-ignore
                  ['Số mã', <span key="c" className="num">{rows.length}</span>], // prettier-ignore
                  ['Chốt sổ', <span key="d" className="num">15/09 08:00</span>], // prettier-ignore
                  ['Người đếm', 'Trần Thị C'],
                  ['Người duyệt', 'Lê Văn D'],
                ]}
              />
            </FactSection>
            {/*
              "CHỐT SỔ 08:00" là ô quan trọng nhất trong khay này — nó nói cho
              người duyệt biết chênh lệch đang so với thời điểm nào. Thiếu nó
              thì mọi con số lệch đều có thể cãi được.
            */}
            <FactSection title="Đợt gần đây">
              <FactKv
                rows={[
                  [<span key="1" className="num">DKK-2609-02</span>, 'Khu bao bì · 02/08'], // prettier-ignore
                  [<span key="2" className="num">DKK-2609-01</span>, 'Khu phụ kiện · 02/08'], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Kệ chưa kiểm bao giờ">
              <FactKv
                rows={[
                  ['MAY-B3', 'Chỉ may, phụ liệu'],
                  ['BB-E1', 'Bao bì, tem nhãn'],
                  ['HAN-F1', 'Vật tư hàn, cắt'],
                ]}
              />
            </FactSection>
          </FactBox>
        }
      >
        <FastTab
          title="Đầu đợt"
          summary={[
            ['Phạm vi', 'Khu A · 7 kệ'],
            ['Chốt sổ', <span key="b" className="num">15/09 08:00</span>], // prettier-ignore
            ['Cách đếm', showBook ? 'Mở' : 'Mù'],
          ]}
        >
          <FieldGrid
            note={
              <>
                Phạm vi và mốc chốt sổ <b>khoá lại khi đợt chuyển sang Đang đếm</b> — đổi
                giữa chừng thì số lệch không còn nghĩa gì.
              </>
            }
          >
            <Field label="Mã đợt">
              <span className="num">DKK-2609-03</span>
            </Field>
            <Field label="Kiểu phạm vi">Theo khu kệ</Field>
            <Field label="Khu">Khu A — 7 kệ</Field>
            <Field label="Số mã trong phạm vi">
              <span className="num">{rows.length}</span>
            </Field>
            <Field label="Chốt sổ lúc">
              <span className="num">15/09/2026 08:00</span>
            </Field>
            <Field label="Người đếm">Trần Thị C</Field>
            <Field label="Người duyệt">Lê Văn D · Quản lý kho</Field>
            <Field label="Cách đếm" tone={showBook ? 'warn' : undefined}>
              {showBook ? 'Đếm mở — người đếm thấy số sổ' : 'Đếm mù — giấu số sổ'}
            </Field>
          </FieldGrid>
        </FastTab>

        <FastTab
          title="Lưới đếm"
          defaultOpen
          flush
          summary={[
            ['Đã đếm', <span key="a" className="num">{counted.length} / {rows.length}</span>], // prettier-ignore
            ['Dòng lệch', <span key="b" className="num k-t-warn">{diffs.length}</span>], // prettier-ignore
            ['Thiếu lý do', <span key="c" className="num k-t-stop">{noReason.length}</span>], // prettier-ignore
          ]}
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[8px]">
            <div className="min-w-[200px] flex-1">
              <CoverageBar
                ratio={counted.length / rows.length}
                label={`đếm ${counted.length}/${rows.length} mã`}
              />
            </div>
            {/*
              CÔNG TẮC ĐẾM MÙ. Để nó Ở ĐÂY chứ không giấu trong Cấu hình: người
              đếm phải biết mình đang đếm theo cách nào, vì đó là điều kiện để
              con số của họ có giá trị. Đổi giữa chừng cũng được — nhưng đợt ghi
              lại cách đếm lúc CHỐT, không phải lúc mở.
            */}
            <Tick
              checked={showBook}
              onChange={setShowBook}
              label="Hiện số sổ khi đếm (bỏ đếm mù)"
            />
          </div>

          <Grid minWidth={showBook ? 980 : 800}>
            <GridHead>
              <Th width={34}>#</Th>
              <Th width={230}>Mã / Tên</Th>
              <Th width={110}>Kệ</Th>
              <Th width={52}>ĐVT</Th>
              {showBook && (
                <Th num width={120}>
                  Sổ (chốt 08:00)
                </Th>
              )}
              <Th num width={100}>
                Đếm thực tế
              </Th>
              {showBook && (
                <Th num width={92}>
                  Lệch
                </Th>
              )}
              <Th>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {rows.map((r, i) => {
                const mat = m(r.code)
                const has = r.counted != null
                const d = has ? (r.counted as number) - r.book : 0
                const needNote = has && d !== 0 && !r.note.trim()
                return (
                  <GridRow key={r.id}>
                    <Td num tone={needNote ? 'stop' : !has ? 'warn' : undefined}>
                      {needNote ? '▌' : !has ? '·' : ''}
                      {i + 1}
                    </Td>
                    <Td>
                      <b className="num">{r.code}</b> · {mat.name}
                    </Td>
                    <Td>
                      <span className="num text-[var(--ink-2)]">{r.bin}</span>
                    </Td>
                    <Td>{mat.unit}</Td>
                    {showBook && (
                      <Td num>
                        <span className="text-[var(--ink-3)]">{n(r.book)}</span>
                      </Td>
                    )}
                    <Td num tone={!has ? 'warn' : undefined}>
                      <NumInput
                        value={r.counted == null ? '' : String(r.counted)}
                        onCommit={(v) =>
                          set(r.id, { counted: v.trim() === '' ? null : Number(v) || 0 })
                        }
                        placeholder="chưa đếm"
                      />
                    </Td>
                    {showBook && (
                      <Td num tone={d === 0 ? undefined : d > 0 ? 'warn' : 'stop'}>
                        {!has ? '' : d === 0 ? '—' : d > 0 ? `+${n(d)}` : n(d)}
                      </Td>
                    )}
                    <Td tone={needNote ? 'stop' : undefined}>
                      <TextInput
                        value={r.note}
                        onCommit={(v) => set(r.id, { note: v })}
                        placeholder={needNote ? 'bắt buộc — vì sao lệch?' : 'ghi chú'}
                      />
                    </Td>
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={showBook ? 4 : 3}>
                {counted.length}/{rows.length} đã đếm · {diffs.length} dòng lệch ·{' '}
                {notYet.length} chưa đếm
              </Td>
              {showBook && <Td num>{n(rows.reduce((s, r) => s + r.book, 0))}</Td>}
              <Td num>{n(counted.reduce((s, r) => s + (r.counted ?? 0), 0))}</Td>
              {showBook && (
                <Td num>
                  {n(diffs.reduce((s, r) => s + ((r.counted ?? 0) - r.book), 0))}
                </Td>
              )}
              <Td />
            </GridFoot>
          </Grid>

          <p className="px-[var(--gutter)] py-[9px] leading-relaxed text-[var(--fs-sm)] text-[var(--ink-3)]">
            Chân bảng KHÔNG cộng thành một con số duy nhất: các mã khác đơn vị tính, cộng
            “cây” với “con” ra một số vô nghĩa. Nó cộng để{' '}
            <b>soát xem có bỏ sót dòng nào</b>, và nói rõ như vậy.
          </p>
        </FastTab>

        <FastTab
          title="Đối chiếu — sẽ sinh phiếu gì"
          summary={[
            ['Phiếu thừa N4', <span key="a" className="num">{surplus.length ? 1 : 0}</span>], // prettier-ignore
            ['Phiếu thiếu X5', <span key="b" className="num">{deficit.length ? 1 : 0}</span>], // prettier-ignore
            ['Dòng ảnh hưởng', <span key="c" className="num">{diffs.length}</span>], // prettier-ignore
          ]}
        >
          {/*
            BÀY TRƯỚC CÁI SẼ XẢY RA. Người duyệt phải biết bấm "Duyệt" là ghi
            sổ những gì — không phải bấm rồi mới đi tìm xem tồn vừa đổi ra sao.
            Kiểm kê là chỗ duy nhất một cú bấm sửa được tồn, nên nó phải là chỗ
            minh bạch nhất.
          */}
          {diffs.length === 0 ? (
            <div style={{ color: 'var(--ink-3)' }}>
              Chưa có dòng nào lệch sổ — duyệt đợt sẽ không sinh phiếu nào, chỉ đóng đợt
              và ghi lại mốc “đã kiểm” cho 7 kệ trong phạm vi.
            </div>
          ) : (
            <Grid minWidth={680}>
              <GridHead>
                <Th width={110}>Sẽ sinh</Th>
                <Th width={200}>Mã / Tên</Th>
                <Th num width={100}>
                  Sổ
                </Th>
                <Th num width={100}>
                  Đếm
                </Th>
                <Th num width={92}>
                  Điều chỉnh
                </Th>
                <Th>Lý do ghi lại</Th>
              </GridHead>
              <GridBody>
                {diffs.map((r) => {
                  const d = (r.counted as number) - r.book
                  return (
                    <GridRow key={r.id}>
                      <Td tone={d > 0 ? 'warn' : 'stop'}>
                        <b className="num">{d > 0 ? 'N4' : 'X5'}</b>{' '}
                        {d > 0 ? 'nhập thừa' : 'xuất thiếu'}
                      </Td>
                      <Td>
                        <b className="num">{r.code}</b> · {m(r.code).name}
                      </Td>
                      <Td num>{n(r.book)}</Td>
                      <Td num>{n(r.counted as number)}</Td>
                      <Td num tone={d > 0 ? 'warn' : 'stop'}>
                        {d > 0 ? `+${n(d)}` : n(d)}
                      </Td>
                      <Td tone={r.note.trim() ? undefined : 'stop'}>
                        {r.note.trim() || 'chưa ghi — chặn duyệt'}
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
            </Grid>
          )}
        </FastTab>
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính · Khu A',
          <span key="d" className="num">
            15/09/2026 10:12
          </span>,
        ]}
        right={
          blocked
            ? `${stop.length} lỗi chặn · đếm ${counted.length}/${rows.length}`
            : `sẵn sàng gửi đối chiếu · ${diffs.length} dòng lệch`
        }
      />
    </DocScreen>
  )
}
