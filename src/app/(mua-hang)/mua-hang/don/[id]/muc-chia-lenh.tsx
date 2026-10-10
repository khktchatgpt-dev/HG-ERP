'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CellHint,
  FastTab,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  Menu,
  NumInput,
  Td,
  Th,
  useToast,
} from '@/components/kit'
import {
  lineAmount,
  type Line,
  type Num,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { splitOf } from '@/app/(mua-hang)/mua-hang/don/_lib/po-lsx-chia'
import { api, apiErrorText } from '@/lib/api'
import { fmtMoney, roundMoney } from '@/lib/po-line'
import { tienTheoLenh } from '@/lib/po-lsx-split'
import { fmtNum } from './don-chung-tu.shared'
import type { DonCtx } from './useDonChungTu'

/**
 * MỤC "CHIA LỆNH" — ma trận dòng hàng × lệnh của đơn gộp (10/10/2026, bản vẽ được
 * duyệt https://claude.ai/artifact/8j6UkStoLFzdyErr13DVMj, Q1–Q8 theo đề xuất).
 *
 * Câu nghiệp vụ: "đơn gộp này, mỗi lệnh lấy bao nhiêu — còn dòng nào chưa rõ thuộc
 * lệnh nào?". Khuôn chép của "Chia đợt giao" (`ChiaDotSoanGrid`): mỗi lệnh một
 * cột, cột "Còn lại" cuối dòng. Đây là chỗ SỬA DUY NHẤT; cột "Lệnh" trên lưới
 * Dòng đơn hàng chỉ để nhìn.
 *
 * Chân bảng là TIỀN theo lệnh (`tienTheoLenh`) chứ không cộng SL — đơn trộn Cây
 * với Kg. Cùng hàm với màn ký Giám đốc và phiếu in.
 *
 * Ba chế độ: soạn / sửa đơn (ghi cùng lượt Lưu đơn); đơn đã duyệt bấm "Sửa chia
 * lệnh" (lưu riêng qua `pos/:id/lsx-split`, không phải ký lại); còn lại chỉ đọc.
 */
export function MucChiaLenh({ d }: { d: DonCtx }) {
  const { lines, lsxsOfPo, nhieuLenh, editing, drafting, po, viewMode, patch } = d
  const { template, header, perms, setPick, curIdx, setLines, needsOf } = d
  const { chiaMo, setChiaMo, chiaTheoNhuCau } = d
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  // Phần chia lúc bấm "Sửa chia lệnh" — "Thôi" trả lại đúng bản này.
  const truoc = useRef<Record<string, Num>[]>([])
  if (!nhieuLenh) return null

  const sua = editing || chiaMo
  const coThe =
    !!po &&
    !editing &&
    perms.canEdit &&
    po.status !== 'draft' &&
    po.status !== 'cancelled'
  const conLai = (l: Line) => {
    const q = Number(l.qty) || 0
    const tong = splitOf(l).reduce((s, x) => s + x.qty, 0)
    return { q, tong, lech: Math.round((q - tong) * 1e4) / 1e4 }
  }
  const rows = lines.map((l, i) => ({ l, i })).filter(({ l }) => Number(l.qty) > 0)
  const chuaChia = rows.filter(({ l }) => splitOf(l).length === 0).length
  const lech = rows.filter(({ l }) => {
    const c = conLai(l)
    return c.tong > 0 && c.lech !== 0
  }).length
  const tien = tienTheoLenh(
    rows.map(({ l }) => ({
      qty_ordered: Number(l.qty) || 0,
      amount: l.price === '' ? null : lineAmount(template, l),
      lsx_split: splitOf(l),
    })),
    lsxsOfPo,
  )
  const money = (n: number) => fmtMoney(roundMoney(n, header.currency), header.currency)

  const batSua = () => {
    truoc.current = lines.map((l) => ({ ...l.lsx_split }))
    setChiaMo(true)
  }
  const thoi = () => {
    setLines((ls) => ls.map((l, k) => ({ ...l, lsx_split: truoc.current[k] ?? {} })))
    setChiaMo(false)
  }
  async function luu() {
    if (!po) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${po.id}/lsx-split`, {
        method: 'PATCH',
        body: {
          lines: lines
            .filter((l) => l.po_line_id)
            .map((l) => ({ line_id: l.po_line_id, lsx_split: splitOf(l) })),
        },
      })
      setChiaMo(false)
      router.refresh()
      toast.success('Đã lưu chia lệnh', 'Vết sửa ghi ở mục Trao đổi (nội bộ).')
    } catch (e) {
      toast.error('Không lưu được chia lệnh', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const menuChia = (
    <Menu
      label="Chia theo nhu cầu ▾"
      ariaLabel="Chia số lượng cho từng lệnh"
      items={[
        { label: 'Điền các dòng chưa chia', onClick: () => chiaTheoNhuCau(true) },
        { label: 'Chia lại cả đơn (bỏ số đã gõ tay)', onClick: () => chiaTheoNhuCau(false) }, // prettier-ignore
      ]}
    />
  )

  return (
    <FastTab
      fixed={viewMode}
      id="chia-lenh"
      title="Chia lệnh"
      flush
      // Q6: mở sẵn khi còn dòng chưa chia hoặc chia lệch; đủ rồi thì gập.
      defaultOpen={chuaChia > 0 || lech > 0 || sua}
      summary={[
        [
          'Lệnh',
          <span key="a" className="num">
            {lsxsOfPo.length}
          </span>,
        ],
        ['Đã chia', <span key="b" className="num">{rows.length - chuaChia}/{rows.length} dòng</span>], // prettier-ignore
        ...(chuaChia > 0 ? [['Chưa chia', <span key="c" className="num k-t-warn">{chuaChia}</span>] as [string, React.ReactNode]] : []), // prettier-ignore
        ...(lech > 0 ? [['Lệch', <span key="d" className="num k-t-stop">{lech}</span>] as [string, React.ReactNode]] : []), // prettier-ignore
      ]}
      actions={
        editing ? (
          menuChia
        ) : chiaMo ? (
          <>
            {menuChia}
            <GridSep />
            <GridBtn disabled={busy} onClick={thoi}>
              Thôi
            </GridBtn>
            <GridBtn
              disabled={busy || lech > 0}
              title={lech > 0 ? `${lech} dòng chia lệch SL đặt — sửa cho khớp rồi lưu` : undefined} // prettier-ignore
              onClick={() => void luu()}
            >
              {busy ? 'Đang lưu…' : 'Lưu chia lệnh'}
            </GridBtn>
          </>
        ) : coThe ? (
          <GridBtn
            onClick={batSua}
            title="Sửa riêng phần chia — không đổi SL, giá, tiền nên không phải ký lại"
          >
            Sửa chia lệnh
          </GridBtn>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <div className="text-k-sm px-[var(--gutter)] py-3 leading-relaxed text-[var(--ink-2)]">
          <b className="text-[var(--ink)]">Chưa có dòng hàng để chia.</b>
          <div className="mt-1 text-[var(--ink-3)]">
            Thêm dòng ở <b>Dòng đơn hàng</b> phía trên — gõ SL đặt là máy chia theo nhu
            cầu từng lệnh.
          </div>
        </div>
      ) : (
        <>
          {sua && (
            <div className="text-k-sm border-b border-[var(--hair)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
              Mỗi lệnh một cột. Ô trống = lệnh đó không lấy. Số nhạt dưới ô = còn phải đặt
              của lệnh theo định mức.
              {drafting ? ' Gõ SL đặt ở lưới trên → máy tự chia; sửa tay ở đây.' : ''}
            </div>
          )}
          <Grid minWidth={480 + lsxsOfPo.length * 140}>
            <GridHead>
              <Th num width={36}>
                #
              </Th>
              <Th>Vật tư</Th>
              <Th width={56}>ĐVT</Th>
              <Th num width={90}>
                SL đặt
              </Th>
              {lsxsOfPo.map((x, k) => (
                <Th key={x.id} num width={140}>
                  <span className="flex flex-col items-end leading-tight normal-case">
                    <span className="num">{x.code}</span>
                    <span
                      className="text-k-label font-medium"
                      style={{ color: k === 0 ? 'var(--act-text)' : 'var(--ink-3)' }}
                    >
                      {k === 0 ? 'lệnh chính' : 'gộp'}
                    </span>
                  </span>
                </Th>
              ))}
              <Th num width={120}>
                Còn lại
              </Th>
            </GridHead>
            <GridBody>
              {rows.map(({ l, i }) => {
                const c = conLai(l)
                const nc = sua ? needsOf(l.material_id) : []
                const coNhuCau = nc.some((n) => n.need > 0)
                return (
                  <GridRow key={i} selected={i === curIdx} onClick={() => setPick(i)}>
                    <Td num>{i + 1}</Td>
                    <Td>
                      <span className="num k-strong">{l.code}</span>
                      {l.code ? ' · ' : ''}
                      {l.name}
                    </Td>
                    <Td>{l.unit}</Td>
                    <Td num>{fmtNum(c.q)}</Td>
                    {lsxsOfPo.map((x, k) => {
                      const v = l.lsx_split?.[x.id]
                      const need =
                        nc.find((n) => n.production_order_id === x.id)?.need ?? 0
                      return (
                        <Td key={x.id} num>
                          {sua ? (
                            <>
                              <NumInput
                                aria-label={`SL cho ${x.code} · dòng ${i + 1}`}
                                value={v === undefined || v === '' ? '' : String(v)}
                                onCommit={(raw) => {
                                  const n = Number(raw.replace(',', '.'))
                                  patch(i, { lsx_split: { ...l.lsx_split, [x.id]: (raw.trim() === '' || !(n > 0) ? '' : n) as Num } }) // prettier-ignore
                                }}
                              />
                              {need > 0 ? (
                                <CellHint title="Còn phải đặt của lệnh này theo định mức (đã trừ đơn khác)">
                                  cần {fmtNum(need)}
                                </CellHint>
                              ) : coNhuCau && Number(v) > 0 ? (
                                <CellHint
                                  tone="warn"
                                  title="Lệnh này không có mã này trong định mức — kiểm lại nếu không chủ đích"
                                >
                                  không có trong định mức
                                </CellHint>
                              ) : !coNhuCau && k === 0 && c.tong === 0 ? (
                                <CellHint
                                  tone="warn"
                                  title="Không lệnh nào có định mức cho mã này — máy không tự chia được"
                                >
                                  chưa có định mức — gõ tay
                                </CellHint>
                              ) : null}
                            </>
                          ) : v === undefined || v === '' || !(Number(v) > 0) ? (
                            <span className="text-[var(--ink-3)]">—</span>
                          ) : (
                            fmtNum(Number(v))
                          )}
                        </Td>
                      )
                    })}
                    <Td
                      num
                      tone={
                        c.tong === 0
                          ? 'warn'
                          : c.lech < 0
                            ? 'stop'
                            : c.lech > 0
                              ? 'warn'
                              : undefined
                      }
                    >
                      {c.tong === 0 ? (
                        `${fmtNum(c.q)} chưa chia`
                      ) : c.lech === 0 ? (
                        <span style={{ color: 'var(--done)', fontWeight: 600 }}>✓</span>
                      ) : c.lech > 0 ? (
                        `thiếu ${fmtNum(c.lech)}`
                      ) : (
                        `thừa ${fmtNum(-c.lech)}`
                      )}
                    </Td>
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={4}>Tiền hàng theo lệnh · chia theo SL · chưa VAT</Td>
              {tien.lenh.map((x) => (
                <Td key={x.id} num>
                  {money(x.tien)}
                </Td>
              ))}
              <Td num tone={tien.chuaChia.dong > 0 ? 'warn' : undefined}>
                {tien.chuaChia.dong > 0 ? (
                  <span title="Dòng chưa chia — đang tính cho lệnh chính">
                    {money(tien.chuaChia.tien)}
                  </span>
                ) : (
                  ''
                )}
              </Td>
            </GridFoot>
          </Grid>
          <div className="text-k-sm border-t border-[var(--hair)] px-[var(--gutter)] py-1.5 text-[var(--ink-3)]">
            Dòng của lệnh: {tien.lenh.map((x) => `${x.code} ${x.dong}`).join(' · ')}
            {tien.chuaChia.dong > 0
              ? ` · ${tien.chuaChia.dong} dòng chưa chia (đang tính cho ${lsxsOfPo[0]?.code}, cả trên phiếu in)`
              : ''}
            . Dòng ghi nhiều lệnh đếm ở mọi lệnh có phần.
          </div>
        </>
      )}
    </FastTab>
  )
}
