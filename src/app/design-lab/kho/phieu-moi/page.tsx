'use client'

import { useState } from 'react'
import {
  Btn,
  Chip,
  CommitBar,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  HeadChip,
  HeadChips,
  NumInput,
  Pick,
  ScreenFrame,
  SearchInput,
  StatusBar,
  Tag,
  Td,
  Th,
  TextInput,
} from '@/components/kit'
import { LabNote } from '../../_lab/Doc'
import { BINS_ALL, REASONS, m, n, reason } from '../_kho/data'

/**
 * KHO · MÀN 10 — SOẠN PHIẾU TAY (Khuôn F).
 *
 * Dành cho việc KHÔNG xuất phát từ hàng đợi: nhập mua lẻ, xuất dùng chung,
 * xuất huỷ, chuyển kệ hàng loạt. Việc có hàng đợi thì đi từ hàng đợi, vì ở đó
 * hệ thống điền sẵn được đơn, đợt, lệnh.
 *
 * QUYẾT ĐỊNH TRUNG TÂM: CHỌN MÃ LÝ DO TRƯỚC, MỌI THỨ KHÁC CHẢY THEO.
 *
 * Mã lý do quyết định ba thứ cùng lúc — đây là cái đáng chép của movement
 * type SAP, không phải con số 200 mã của họ:
 *   · đầu phiếu bắt buộc điền gì (`needs`)
 *   · lưới hiện cột nào (chọn C1 thì có hai cột kệ, ẩn cột tình trạng)
 *   · có phải qua duyệt không (`approve`)
 *
 * Không có mã lý do thì ba thứ đó phải hỏi người dùng bằng ba ô rời, và không
 * ràng buộc nổi "xuất huỷ thì bắt buộc có lý do" — đúng tình trạng của một ô
 * `reason` văn bản tự do.
 *
 * ĐẦU ĐƠN CO THÀNH DẢI CHIP vì mỗi hàng đầu trang là một hàng lưới bị lấy
 * mất, mà lưới mới là nhân vật chính của khuôn F.
 */

type Line = {
  id: string
  code: string
  qty: number | null
  binFrom: string
  binTo: string
  status: 'ok' | 'qc' | 'blocked'
  note: string
}

const BIN_OPTS = [
  { value: '', label: '— chọn —' },
  ...BINS_ALL.map((b) => ({ value: b.code, label: `${b.code} · ${b.name}` })),
]

const STATUS_OPTS = [
  { value: 'ok', label: 'Đạt — dùng được' },
  { value: 'qc', label: 'Chờ kiểm' },
  { value: 'blocked', label: 'Khoá' },
]

const SEED: Record<string, Line[]> = {
  N2: [
    { id: 'a', code: 'HAN0032', qty: 12, binFrom: '', binTo: 'HAN-F1', status: 'ok', note: '' }, // prettier-ignore
    { id: 'b', code: 'CHI0005', qty: 6, binFrom: '', binTo: 'MAY-B3', status: 'ok', note: '' }, // prettier-ignore
  ],
  X4: [
    { id: 'a', code: 'GON0022', qty: 60, binFrom: 'KHOA-01', binTo: '', status: 'ok', note: '' }, // prettier-ignore
  ],
  C1: [
    { id: 'a', code: 'BUL0071', qty: 2400, binFrom: 'TIEP-NHAN', binTo: 'PK-C2', status: 'ok', note: '' }, // prettier-ignore
    { id: 'b', code: 'LON0014', qty: 5100, binFrom: 'PK-C2', binTo: '', status: 'ok', note: '' }, // prettier-ignore
  ],
  X2: [
    { id: 'a', code: 'HAN0032', qty: 4, binFrom: 'HAN-F1', binTo: '', status: 'ok', note: '' }, // prettier-ignore
  ],
}

/** Mã lý do hay dùng nhất khi soạn tay — bốn cái, không bày cả mười hai. */
const QUICK = ['N2', 'X2', 'X4', 'C1']

export default function Page() {
  const [rc, setRc] = useState('C1')
  const [lines, setLines] = useState<Line[]>(SEED.C1)
  const [why, setWhy] = useState('')
  const [party, setParty] = useState('')

  const r = reason(rc)
  const isMove = r.dir === 'move'
  const isIn = r.dir === 'in'
  const needsWhy = r.needs.includes('Lý do')
  const needsParty = r.needs.some((x) => x !== 'Lý do' && x !== 'Kệ đi' && x !== 'Kệ đến')
  const partyLabel = r.needs.find((x) => x !== 'Lý do' && x !== 'Kệ đi' && x !== 'Kệ đến')

  function pickReason(code: string) {
    setRc(code)
    setLines(SEED[code] ?? [])
    setWhy('')
    setParty('')
  }

  const set = (id: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)))

  const noQty = lines.filter((l) => l.qty == null || l.qty <= 0)
  const noBin = lines.filter((l) =>
    isMove ? !l.binFrom || !l.binTo : isIn ? !l.binTo : !l.binFrom,
  )

  const blocked =
    lines.length === 0
      ? 'chưa có dòng nào — thêm vật tư ở ô tìm dưới lưới'
      : needsParty && !party.trim()
        ? `chưa khai ${partyLabel?.toLowerCase()}`
        : needsWhy && !why.trim()
          ? `mã ${r.code} bắt buộc ghi lý do`
          : noQty.length > 0
            ? `dòng ${lines.indexOf(noQty[0]) + 1} chưa có số lượng`
            : noBin.length > 0
              ? `dòng ${lines.indexOf(noBin[0]) + 1} chưa đủ kệ`
              : undefined

  const totalQty = lines.reduce((s, l) => s + (l.qty ?? 0), 0)

  return (
    <ScreenFrame>
      <LabNote>
        <div>
          <b>Khuôn F — Soạn phiếu tay. Bấm thử được.</b> Đổi <b>mã lý do</b> ở dải chip
          trên cùng và xem lưới đổi cột theo: chọn <b>C1 Chuyển vị trí</b> thì có hai cột
          kệ và không có cột tình trạng; chọn <b>X4 Xuất huỷ</b> thì ô lý do thành bắt
          buộc và phiếu phải qua duyệt. Mã lý do quyết định luôn ba thứ — đầu phiếu, cột
          lưới, và có duyệt hay không.
        </div>
      </LabNote>

      <HeadChips>
        <HeadChip label="Mã lý do" value={`${r.code} · ${r.name}`} />
        {needsParty && (
          <HeadChip
            label={partyLabel ?? 'Đối ứng'}
            value={party || null}
            need
            onClick={() =>
              setParty((v) =>
                v
                  ? ''
                  : partyLabel === 'Nhà cung cấp'
                    ? 'Cơ khí Thành Đạt'
                    : 'Tổ Bảo trì',
              )
            }
          />
        )}
        <HeadChip label="Ngày" value="15/09/2026" />
        <HeadChip label="Kho" value="Kho vật tư chính" muted />
        <HeadChip
          label="Duyệt"
          value={r.approve ? 'Cần quản lý kho duyệt' : 'Ghi sổ thẳng'}
          muted={!r.approve}
        />
        <span style={{ marginLeft: 'auto' }}>
          {blocked ? (
            <Tag tone="warn">chưa lưu được</Tag>
          ) : (
            <Tag tone="done">{lines.length} dòng đủ</Tag>
          )}
        </span>
      </HeadChips>

      {/*
        CHỌN MÃ LÝ DO — đứng NGAY DƯỚI dải chip, trước lưới. Đây là thao tác
        đầu tiên của màn và là thao tác quyết định mọi thứ phía sau, nên nó
        không được nằm trong một hộp chọn lẫn giữa các ô khác.
      */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[8px]">
        <span className="font-bold tracking-[.1em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
          Soạn phiếu gì
        </span>
        {QUICK.map((c) => {
          const x = reason(c)
          return (
            <Chip key={c} on={rc === c} onClick={() => pickReason(c)}>
              {x.code} · {x.name}
            </Chip>
          )
        })}
        <Pick
          label="Mã lý do khác"
          value={rc}
          options={REASONS.map((x) => ({
            value: x.code,
            label: `${x.code} · ${x.name}`,
          }))}
          onChange={pickReason}
          width={250}
        />
        {r.needs.length > 0 && (
          <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
            Bắt buộc: {r.needs.join(' · ')}
          </span>
        )}
      </div>

      {needsWhy && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[8px]">
          <span
            className="font-bold tracking-[.06em] text-[var(--fs-label)] uppercase"
            style={{ color: why.trim() ? 'var(--ink-3)' : 'var(--stop)' }}
          >
            Lý do (bắt buộc với {r.code})
          </span>
          <div className="min-w-[320px] flex-1">
            <TextInput
              value={why}
              onCommit={setWhy}
              placeholder="VD: gòn ẩm mốc mép tấm, không dùng được cho hàng xuất"
            />
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface-card)]">
        <div className="min-h-0 flex-1 overflow-auto">
          <Grid minWidth={isMove ? 960 : 900}>
            <GridHead>
              <Th width={34}>#</Th>
              <Th width={250}>Mã / Tên</Th>
              <Th width={52}>ĐVT</Th>
              <Th num width={110}>
                Số lượng
              </Th>
              {/* CỘT ĐỔI THEO MÃ LÝ DO — đây là cả điểm của màn */}
              {(isMove || !isIn) && <Th width={170}>{isMove ? 'Kệ đi' : 'Lấy ở kệ'}</Th>}
              {(isMove || isIn) && (
                <Th width={170}>{isMove ? 'Kệ đến' : 'Cất vào kệ'}</Th>
              )}
              {isIn && <Th width={160}>Tình trạng</Th>}
              <Th>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const mat = m(l.code)
                const badQty = l.qty == null || l.qty <= 0
                return (
                  <GridRow key={l.id}>
                    <Td num tone={badQty ? 'warn' : undefined}>
                      {badQty ? '▌' : ''}
                      {i + 1}
                    </Td>
                    <Td>
                      <b className="num">{l.code}</b> · {mat.name}
                    </Td>
                    <Td>{mat.unit}</Td>
                    <Td num tone={badQty ? 'warn' : undefined}>
                      <NumInput
                        value={l.qty == null ? '' : String(l.qty)}
                        onCommit={(v) =>
                          set(l.id, { qty: v.trim() === '' ? null : Number(v) || 0 })
                        }
                        placeholder="thiếu"
                      />
                    </Td>
                    {(isMove || !isIn) && (
                      <Td tone={!l.binFrom ? 'warn' : undefined}>
                        <Pick
                          label="Kệ đi"
                          value={l.binFrom}
                          options={BIN_OPTS}
                          onChange={(v) => set(l.id, { binFrom: v })}
                          width={162}
                        />
                      </Td>
                    )}
                    {(isMove || isIn) && (
                      <Td tone={!l.binTo ? 'warn' : undefined}>
                        <Pick
                          label="Kệ đến"
                          value={l.binTo}
                          options={BIN_OPTS}
                          onChange={(v) => set(l.id, { binTo: v })}
                          width={162}
                        />
                      </Td>
                    )}
                    {isIn && (
                      <Td>
                        <Pick
                          label="Tình trạng"
                          value={l.status}
                          options={STATUS_OPTS}
                          onChange={(v) => set(l.id, { status: v as Line['status'] })}
                          width={152}
                        />
                      </Td>
                    )}
                    <Td>
                      <TextInput
                        value={l.note}
                        onCommit={(v) => set(l.id, { note: v })}
                        placeholder="ghi chú"
                      />
                    </Td>
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={3}>Cộng {lines.length} dòng</Td>
              <Td num>{n(totalQty)}</Td>
              <Td colSpan={isMove ? 3 : isIn ? 3 : 2} />
            </GridFoot>
          </Grid>
        </div>

        {/*
          VÙNG THÊM DÒNG đứng NGOÀI khung cuộn của lưới, dính ngay trên thanh
          chốt: để nó cuộn cùng lưới thì gõ tới dòng 40 phải cuộn xuống đáy mới
          thêm được dòng tiếp — đúng thao tác lặp nhiều nhất của cả màn.
        */}
        <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[9px]">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value=""
              onChange={() => {}}
              placeholder="Gõ mã hoặc tên vật tư rồi Enter…"
              width={300}
            />
            <Btn
              onClick={() =>
                setLines((ls) => [
                  ...ls,
                  { id: `n${ls.length}`, code: 'NH-0480', qty: null, binFrom: '', binTo: '', status: 'ok', note: '' }, // prettier-ignore
                ])
              }
            >
              + Thêm dòng
            </Btn>
            <Btn>Quét mã vạch</Btn>
            <Btn>Dán từ Excel</Btn>
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
              {isMove
                ? 'Chuyển kệ không đổi tổng tồn — chỉ đổi chỗ.'
                : isIn
                  ? 'Tồn tăng khi phiếu được ghi sổ, không phải lúc gõ.'
                  : 'Chỉ lấy được từ lượng DÙNG ĐƯỢC ở kệ đã chọn.'}
            </span>
          </div>
        </div>
      </div>

      <CommitBar
        totals={[
          { label: 'Số dòng', value: String(lines.length) },
          { label: 'Tổng lượng', value: n(totalQty) },
        ]}
        grand={{
          label: r.approve ? 'Gửi duyệt' : 'Ghi sổ',
          value: `${r.code} · ${r.dir === 'in' ? 'nhập' : r.dir === 'out' ? 'xuất' : 'chuyển'}`,
        }}
        blocked={blocked}
        actions={
          <>
            <Btn>Lưu nháp</Btn>
            <Btn primary disabled={!!blocked} title={blocked}>
              {r.approve ? 'Gửi quản lý kho duyệt' : 'Ghi sổ'}
            </Btn>
          </>
        }
      />

      <StatusBar
        left={[
          <>
            <b>Trần Thị C</b> · Thủ kho
          </>,
          'Kho vật tư chính',
        ]}
        right={blocked ? 'chưa lưu được' : `${lines.length} dòng sẵn sàng`}
      />
    </ScreenFrame>
  )
}
