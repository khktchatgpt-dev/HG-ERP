'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { DOCS, type DocRow, reason } from '../_kho/data'

/**
 * KHO · MÀN 11 — SỔ PHIẾU (Khuôn C).
 *
 * Câu hỏi: "tra lại một tờ đã lập; tháng này ai điều chỉnh gì".
 *
 * BỘ LỌC CHÍNH LÀ MÃ LÝ DO, không phải ngày. Đây là điểm khác mọi sổ chứng từ
 * thường gặp, và nó đến thẳng từ câu hỏi thật của kế toán và quản lý kho: họ
 * không tra "phiếu ngày 12/09", họ tra **"tháng này có bao nhiêu phiếu huỷ"**
 * và **"ai đã điều chỉnh tồn"**. Lọc theo ngày là lọc của người đã biết mình
 * tìm gì; lọc theo mã lý do là lọc của người đang đi soát.
 *
 * PHIẾU ĐẢO VÀ PHIẾU GỐC LUÔN NẰM CẠNH NHAU, phiếu gốc gạch ngang. Sổ phải
 * cộng lại đúng bằng những gì đã xảy ra, KỂ CẢ CÁI SAI — xoá tờ sai là làm sổ
 * nói dối một cách trơn tru. Giấu tờ bị đảo đi cũng là một kiểu nói dối, chỉ
 * êm hơn.
 */

type Bucket = 'all' | 'in' | 'out' | 'move' | 'adjust' | 'reversed' | 'pending'

const ADJUST = ['N4', 'X5', 'X4', 'C3']

const BUCKETS: { id: Bucket; label: string; test: (d: DocRow) => boolean }[] = [
  { id: 'all', label: 'Tất cả', test: () => true },
  { id: 'in', label: 'Nhập', test: (d) => reason(d.rc).dir === 'in' },
  { id: 'out', label: 'Xuất', test: (d) => reason(d.rc).dir === 'out' },
  { id: 'move', label: 'Chuyển', test: (d) => reason(d.rc).dir === 'move' },
  // Rổ mà kế toán mở đầu tiên: mọi phiếu ĐỘNG VÀO TỒN ngoài luồng mua–bán.
  { id: 'adjust', label: 'Điều chỉnh tồn', test: (d) => ADJUST.includes(d.rc) },
  { id: 'reversed', label: 'Có đảo', test: (d) => !!d.reversedBy || !!d.reverses },
  { id: 'pending', label: 'Chờ duyệt', test: (d) => !!d.pending },
]

export default function Page() {
  const [bucket, setBucket] = useState<Bucket>('all')
  const [rc, setRc] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const spec = BUCKETS.find((b) => b.id === bucket)!
    const ql = q.trim().toLowerCase()
    return DOCS.filter(spec.test)
      .filter((d) => !rc || d.rc === rc)
      .filter((d) => !ql || `${d.code} ${d.party} ${d.rc}`.toLowerCase().includes(ql))
  }, [bucket, rc, q])

  /** Mã lý do CÓ MẶT trong sổ — không bày cả 12 mã, chỉ bày cái đã dùng. */
  const usedRc = [...new Set(DOCS.map((d) => d.rc))].sort()

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn C — Sổ phiếu.</b> Bộ lọc chính là <b>mã lý do</b>, không phải ngày:
          người đi soát hỏi “tháng này có bao nhiêu phiếu huỷ”, không hỏi “phiếu ngày
          12/09”. Phiếu <b>PXK-2609-045</b> bị đảo — nó vẫn nằm trong sổ, gạch ngang, và
          tờ đảo nằm ngay cạnh. Sổ phải cộng lại đúng bằng những gì đã xảy ra, kể cả cái
          sai.
        </div>
      </LabNote>

      <ScreenHeader
        eyebrow="Kho · Sổ sách"
        title="Sổ phiếu"
        facts={[
          { label: 'Phiếu 7 ngày', value: String(DOCS.length) },
          { label: 'Điều chỉnh tồn', value: String(DOCS.filter((d) => ADJUST.includes(d.rc)).length), tone: 'warn' }, // prettier-ignore
          { label: 'Đã bị đảo', value: String(DOCS.filter((d) => d.reversedBy).length), tone: 'stop' }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn href="/design-lab/kho/phieu-moi">+ Soạn phiếu</Btn>
            <Btn>Xuất Excel cho kế toán</Btn>
          </>
        }
      >
        <FilterBar>
          {BUCKETS.map((b) => (
            <Chip
              key={b.id}
              on={bucket === b.id}
              count={DOCS.filter(b.test).length}
              onClick={() => setBucket(b.id)}
            >
              {b.label}
            </Chip>
          ))}
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="số phiếu / đối ứng…"
            width={210}
          />{' '}
          {/* prettier-ignore */}
        </FilterBar>
        <div className="flex flex-wrap items-center gap-1.5 px-[var(--gutter)] pb-[7px]">
          <span className="font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
            Mã lý do
          </span>
          <Chip on={rc === null} onClick={() => setRc(null)}>
            Mọi mã
          </Chip>
          {usedRc.map((c) => (
            <Chip
              key={c}
              on={rc === c}
              count={DOCS.filter((d) => d.rc === c).length}
              onClick={() => setRc(rc === c ? null : c)}
            >
              {c} · {reason(c).name}
            </Chip>
          ))}
        </div>
      </ScreenHeader>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {rows.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Không phiếu nào khớp bộ lọc"
              reason={
                rc
                  ? `Chưa có phiếu nào mã ${rc} · ${reason(rc).name} trong rổ đang chọn. Mã lý do này có trong hệ thống, chỉ là chưa ai lập phiếu bằng nó.`
                  : 'Rổ đang chọn không có phiếu nào trong 7 ngày gần đây.'
              }
              next={
                <Btn
                  primary
                  onClick={() => {
                    setBucket('all')
                    setRc(null)
                    setQ('')
                  }}
                >
                  Xoá hết bộ lọc
                </Btn>
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <th>Số phiếu</th>
              <th>Ngày</th>
              <th>Mã lý do</th>
              <th>Đối ứng</th>
              <th style={{ textAlign: 'right' }}>Dòng</th>
              <th>Người lập</th>
              <th>Tình trạng</th>
            </THead>
            <tbody>
              {rows.map((d) => {
                const r = reason(d.rc)
                const dead = !!d.reversedBy
                return (
                  <Row key={d.code}>
                    <Cell>
                      <span className={dead ? 'line-through opacity-60' : undefined}>
                        <Code as="a" href="/design-lab/kho/phieu-nhap">
                          {d.code}
                        </Code>
                      </span>
                    </Cell>
                    <Cell num muted>
                      {d.date}
                    </Cell>
                    <Cell>
                      <b className="num">{d.rc}</b>{' '}
                      <span className="text-[var(--ink-3)]">{r.name}</span>
                    </Cell>
                    <Cell grow muted={dead}>
                      {d.party}
                    </Cell>
                    <Cell num muted>
                      {d.lines}
                    </Cell>
                    <Cell muted>{d.by}</Cell>
                    <Cell>
                      {/*
                        BỐN TÌNH TRẠNG, không gộp: đã đảo · là tờ đảo · chờ
                        duyệt · đã ghi sổ. Gộp "đã đảo" với "đã ghi sổ" thì
                        người soát cộng cả hai tờ vào một lần và ra số gấp đôi.
                      */}
                      {d.reversedBy ? (
                        <Tag tone="stop">đã đảo bởi {d.reversedBy}</Tag>
                      ) : d.reverses ? (
                        <Tag tone="warn">tờ đảo của {d.reverses}</Tag>
                      ) : d.pending ? (
                        <Tag tone="warn">chờ quản lý kho duyệt</Tag>
                      ) : (
                        <Tag tone="done">đã ghi sổ</Tag>
                      )}
                    </Cell>
                  </Row>
                )
              })}
            </tbody>
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
        right={`${rows.length} phiếu · ${DOCS.length} trong 7 ngày`}
      />
    </ScreenFrame>
  )
}
