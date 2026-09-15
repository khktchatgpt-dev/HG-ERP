'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { STOCK, type StockRow, free, m, n } from '../_kho/data'

/**
 * KHO · MÀN 6 — TỒN KHO (Khuôn C).
 *
 * Câu hỏi: "trong tập này, mã nào cần tôi động vào?".
 *
 * RUỘT CỦA MÀN LÀ BỐN CỘT LƯỢNG + MỘT CỘT SUY RA:
 *
 *   Dùng được · Chờ kiểm · Khoá · Giữ cho lệnh  →  CÒN DÙNG = Dùng được − Giữ
 *
 * Một cột "Tồn" duy nhất là con số đúng mà vô dụng: 2.400 con bulon nằm trong
 * kho nhưng chưa kiểm thì cấp đi không được, và một hệ thống nói "tồn 2.400"
 * là một hệ thống hứa hộ nhà kho một thứ nó không giao nổi.
 *
 * CÒN DÙNG ÂM = ĐÃ HỨA NHIỀU HƠN SỐ CÓ. Đây không phải lỗi dữ liệu mà là
 * tình huống nghiệp vụ thường ngày (duyệt lệnh trước, mua sau) — và là con số
 * người lập kế hoạch cần nhất.
 *
 * MẶC ĐỊNH KHÔNG PHẢI CẢ DANH MỤC. Rổ đầu là "Đang dùng" (có tồn hoặc có
 * phát sinh 90 ngày). Rổ "Cả danh mục" đứng CUỐI và **ghi rõ con số 13.229**
 * — giấu đi thì người dùng tưởng mất hàng, mà mở mặc định thì mỗi lần vào
 * màn là kéo cả danh mục xuống trình duyệt để lọc bằng tay.
 */

type Bucket = 'live' | 'low' | 'qc' | 'blocked' | 'short' | 'all'

const BUCKETS: { id: Bucket; label: string; test: (s: StockRow) => boolean }[] = [
  { id: 'live', label: 'Đang dùng', test: () => true },
  { id: 'low', label: 'Dưới mức tối thiểu', test: (s) => s.min > 0 && s.usable < s.min },
  { id: 'qc', label: 'Có lô chờ kiểm', test: (s) => s.qc > 0 },
  { id: 'blocked', label: 'Có lô khoá', test: (s) => s.blocked > 0 },
  { id: 'short', label: 'Đã hứa quá số có', test: (s) => free(s) < 0 },
  { id: 'all', label: 'Cả danh mục', test: () => true },
]

/** Số mã trong danh mục thật, đọc 15/09/2026 — dùng cho rổ "Cả danh mục". */
const CATALOG = 13229

export default function Page() {
  const [bucket, setBucket] = useState<Bucket>('live')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const spec = BUCKETS.find((b) => b.id === bucket)!
    const ql = q.trim().toLowerCase()
    return STOCK.filter(spec.test).filter(
      (s) => !ql || `${s.code} ${m(s.code).name}`.toLowerCase().includes(ql),
    )
  }, [bucket, q])

  const sum = (f: (s: StockRow) => number) => rows.reduce((a, s) => a + f(s), 0)

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn C — Tồn kho.</b> Bốn cột lượng thay cho một cột “Tồn”: 2.400 con bulon
          nằm trong kho mà chưa kiểm thì <b>cấp đi không được</b>. Cột{' '}
          <b>Còn dùng = Dùng được − Giữ</b>; số âm nghĩa là đã hứa nhiều hơn số có. Rổ{' '}
          <b>“Cả danh mục 13.229”</b> đứng cuối và ghi rõ con số — mặc định chỉ bày tập
          đang dùng.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Sổ sách"
        title="Tồn kho"
        facts={[
          { label: 'Mã đang dùng', value: String(STOCK.length) },
          { label: 'Có lô chờ kiểm', value: String(STOCK.filter((s) => s.qc > 0).length), tone: 'warn' }, // prettier-ignore
          { label: 'Đã hứa quá số có', value: String(STOCK.filter((s) => free(s) < 0).length), tone: 'stop' }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn href="/design-lab/kho/vat-tu">Mở một hồ sơ vật tư</Btn>
            <Btn>Xuất Excel</Btn>
          </>
        }
      >
        <FilterBar>
          {BUCKETS.map((b) => (
            <Chip
              key={b.id}
              on={bucket === b.id}
              count={b.id === 'all' ? CATALOG : STOCK.filter(b.test).length}
              onClick={() => setBucket(b.id)}
            >
              {b.label}
            </Chip>
          ))}
          <SearchInput value={q} onChange={setQ} placeholder="mã hoặc tên…" width={230} />
        </FilterBar>
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {bucket === 'all' ? (
          /*
            RỔ "CẢ DANH MỤC" KHÔNG ĐỔ 13.229 DÒNG RA MÀN.
            Nó nói thẳng vì sao và đẩy người dùng sang đúng công cụ — ô tìm.
            Đây là chỗ khác nhau giữa "giấu dữ liệu" và "không đổ dữ liệu":
            con số 13.229 vẫn hiện trên chip, nên không ai tưởng bị mất hàng.
          */
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline={`Danh mục có ${n(CATALOG)} mã — màn tồn không đổ hết ra`}
              reason={`Chỉ ${STOCK.length} mã đang có tồn hoặc có phát sinh trong 90 ngày. ${n(CATALOG - STOCK.length)} mã còn lại là danh mục: chúng có thật, chỉ là chưa động tới. Đổ hết ra thì mỗi lần vào màn là kéo cả danh mục xuống trình duyệt để lọc bằng tay.`}
              next={
                <>
                  <Btn primary onClick={() => setBucket('live')}>
                    Về tập đang dùng
                  </Btn>
                  <Btn>Tìm trong cả danh mục</Btn>
                </>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline={q ? 'Không mã nào khớp ô tìm' : 'Rổ này đang trống'}
              reason={
                q
                  ? `Không có mã nào chứa “${q}” trong rổ đang chọn. Mã có thể nằm ở rổ khác, hoặc nằm trong phần danh mục chưa phát sinh.`
                  : 'Không mã nào rơi vào điều kiện của rổ đang chọn — với rổ này thì trống là tin tốt.'
              }
              next={
                q ? (
                  <Btn primary onClick={() => setQ('')}>
                    Xoá ô tìm
                  </Btn>
                ) : (
                  <Btn onClick={() => setBucket('live')}>Về tập đang dùng</Btn>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <th>Mã / Tên</th>
              <th style={{ textAlign: 'right' }}>Dùng được</th>
              <th style={{ textAlign: 'right' }}>Chờ kiểm</th>
              <th style={{ textAlign: 'right' }}>Khoá</th>
              <th style={{ textAlign: 'right' }}>Giữ cho lệnh</th>
              <th style={{ textAlign: 'right' }}>Còn dùng</th>
              <th style={{ textAlign: 'right' }}>Tối thiểu</th>
              <th>Kệ</th>
              <th>Tình trạng</th>
            </THead>
            <tbody>
              {rows.map((s) => {
                const mat = m(s.code)
                const f = free(s)
                const low = s.min > 0 && s.usable < s.min
                return (
                  <Row key={s.code}>
                    <Cell grow>
                      <Code as="a" href="/design-lab/kho/vat-tu">
                        {s.code}
                      </Code>{' '}
                      <span className="text-[var(--ink-3)]">{mat.name}</span>
                    </Cell>
                    <Cell num>
                      <Num value={n(s.usable)} strong zero="zero" />{' '}
                      <span className="text-[var(--ink-3)]">{mat.unit}</span>
                    </Cell>
                    {/*
                      CHỜ KIỂM và KHOÁ hiện ô TRỐNG khi bằng 0, không hiện "0".
                      Bảng đầy số 0 thì mắt phải lọc thủ công để tìm dòng có
                      chuyện — mà dòng có chuyện mới là thứ màn này tồn tại vì nó.
                    */}
                    <Cell num className={s.qc > 0 ? 'text-[var(--warn)]' : undefined}>
                      {s.qc > 0 ? n(s.qc) : ''}
                    </Cell>
                    <Cell
                      num
                      className={s.blocked > 0 ? 'text-[var(--stop)]' : undefined}
                    >
                      {s.blocked > 0 ? n(s.blocked) : ''}
                    </Cell>
                    <Cell num muted>
                      {s.held > 0 ? n(s.held) : ''}
                    </Cell>
                    <Cell num className={f < 0 ? 'text-[var(--stop)]' : undefined}>
                      {f < 0 ? <Num value={`thiếu ${n(-f)}`} strong /> : n(f)}
                    </Cell>
                    <Cell num muted>
                      {s.min > 0 ? n(s.min) : ''}
                    </Cell>
                    <Cell>
                      <span
                        className={
                          s.bin === 'TIEP-NHAN'
                            ? 'num text-[var(--warn)]'
                            : 'num text-[var(--ink-2)]'
                        }
                        title={
                          s.bin === 'TIEP-NHAN'
                            ? 'Còn ở khu tiếp nhận — chưa cất vào kệ thật'
                            : undefined
                        }
                      >
                        {s.bin}
                      </span>
                    </Cell>
                    <Cell>
                      {s.blocked > 0 ? (
                        <Tag tone="stop">có lô khoá</Tag>
                      ) : s.qc > 0 ? (
                        <Tag tone="warn">chờ kiểm</Tag>
                      ) : low ? (
                        <Tag tone="warn">dưới mức</Tag>
                      ) : f < 0 ? (
                        <Tag tone="stop">hứa quá</Tag>
                      ) : (
                        <Tag tone="done">đủ</Tag>
                      )}
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
            {/*
              CHÂN BẢNG NÓI TỔNG **KHÔNG GỒM GÌ**. Luật kiểm "số nào không kiểm
              được thì không ai tin": một tổng không nói phạm vi là một tổng
              người đọc phải tự đoán, và họ sẽ mở Excel cộng lại.
            */}
            <TFoot
              label={`Cộng ${rows.length} mã trong rổ`}
              cells={
                <>
                  <td className="num">{n(sum((s) => s.usable))}</td>
                  <td className="num">{n(sum((s) => s.qc))}</td>
                  <td className="num">{n(sum((s) => s.blocked))}</td>
                  <td className="num">{n(sum((s) => s.held))}</td>
                  <td className="num">{n(sum(free))}</td>
                  <td colSpan={3} />
                </>
              }
              caveat={`Tổng cộng các mã KHÁC ĐƠN VỊ TÍNH nên chỉ dùng để soát, không dùng để báo cáo. KHÔNG gồm ${n(CATALOG - STOCK.length)} mã danh mục chưa phát sinh.`}
            />
          </Table>
        )}
      </div>

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính',
        ]}
        right={`${rows.length} mã trong rổ · ${STOCK.length} mã đang dùng · ${n(CATALOG)} mã danh mục`}
      />
    </ScreenFrame>
  )
}
