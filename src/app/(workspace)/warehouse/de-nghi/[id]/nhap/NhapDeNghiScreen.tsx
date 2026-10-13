'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  conPhaiNhap,
  kiemNhapDeNghi,
  mucVuot,
  tienNhap,
  VUOT_TU_DO,
  type DongNhapDeNghi,
} from '@/lib/de-nghi-nhap'
import { kiemNgayChungTu } from '@/lib/ngay-chung-tu-nhap'
import { useBeRong } from '@/lib/use-be-rong'
import {
  Action,
  ActionGroup,
  ActionPane,
  CellHint,
  Code,
  CommitBar,
  Crumb,
  DateInput,
  DocHead,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  HeadChip,
  HeadChips,
  HeadField,
  NoticeBar,
  NumInput,
  ScreenFrame,
  StatusBar,
  StatusTrack,
  Tag,
  TextInput,
  Th,
  useToast,
} from '@/components/kit'
import { GanMaSheet, type MaGan } from './gan-ma'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })
/** Số kiểu VN: "1.390" = 1390 · "2,5" = 2,5. Rỗng = null. */
const docSo = (v: string): number | null => {
  const t = v.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const pct = (x: number) => `${Math.round(x * 100)}%`
/** Tiêu đề cột số được xuống dòng (khung hẹp) — Th của kit không nhận style. */
const ThSo = ({ w, children }: { w: number; children: string }) => (
  <th className="k-r" scope="col" style={{ width: w, whiteSpace: 'normal' }}>
    {children}
  </th>
)

/** Một dòng phiếu đề nghị còn phải nhập — page dựng sẵn. */
export type DongCho = {
  line_id: string
  material_id: string | null
  code: string | null
  name: string
  unit: string
  can: number
  da_nhap: number
  /** Giá dự kiến trên phiếu đề nghị — mồi ô đơn giá thật (Q11). */
  gia_du_kien: number | null
}

type Dong = DongNhapDeNghi & {
  code: string | null
  /** Tên / ĐVT hiển thị (sau khi gắn mã = theo danh mục). */
  ten: string
  dvt: string
  /** ĐVT trên phiếu đề nghị — gắn mã khác ĐVT thì nói ra (số duyệt tính theo ĐVT cũ). */
  dvt_de_nghi: string
  gia_du_kien: number | null
  /** Mã vừa gắn ở màn này (dòng "chưa có mã" của phiếu). */
  ganMoi: boolean
}

/**
 * KHO NHẬP HÀNG ĐÃ MUA — khuôn F (0238 · Đ3, bản vẽ DN-3
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g, Q10–Q14 duyệt 13/10/2026).
 *
 * Chủ dự án 13/10: phiếu đề nghị duyệt xong thì KHO tự đi mua và tự nhập kho,
 * không qua Cung ứng. Lưới điền sẵn các dòng CÒN PHẢI NHẬP (số duyệt − đã nhập);
 * Kho ghi số thực nhận + đơn giá thật theo hoá đơn. Ghi sổ ra một PNK mã lý do
 * N2 có đơn giá (giá trị tồn đúng), in 01-VT, đảo được như mọi phiếu nhập.
 *
 * Luật chặn ở `lib/de-nghi-nhap` — cùng hàm service dùng, nên câu chặn ở thanh
 * đáy chính là lỗi server sẽ trả. Khung < 1000px: bỏ cột Đã nhập + Thành tiền
 * (đã nhập xuống thành gợi ý dưới Số duyệt, tổng ở thanh chốt).
 */
export function NhapDeNghiScreen({
  phieu,
  dong,
  nccGoiY,
  nhomOptions,
  canCreateMa,
  today,
  nguoiMua,
}: {
  phieu: { id: string; code: string; status: string; approved_by_name: string | null }
  dong: DongCho[]
  nccGoiY: string[]
  nhomOptions: string[]
  canCreateMa: boolean
  today: string
  nguoiMua: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [head, setHead] = useState({
    noi_mua: '',
    supplier_doc_no: '',
    doc_date: today,
    backdate_reason: '',
    note: '',
  })
  const [rows, setRows] = useState<Dong[]>(() =>
    dong.map((d) => ({
      line_id: d.line_id,
      name: d.name,
      material_id: d.material_id,
      can: d.can,
      daNhap: d.da_nhap,
      qty: conPhaiNhap(d.can, d.da_nhap),
      unit_price: d.gia_du_kien,
      note: '',
      code: d.code,
      ten: d.name,
      dvt: d.unit,
      dvt_de_nghi: d.unit,
      gia_du_kien: d.gia_du_kien,
      ganMoi: false,
    })),
  )
  const [gan, setGan] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const khung = useRef<HTMLDivElement>(null)
  const hep = useBeRong(khung) < 1000

  const patch = (i: number, p: Partial<Dong>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const kiem = useMemo(
    () => kiemNhapDeNghi({ noi_mua: head.noi_mua }, rows),
    [head, rows],
  )
  const ngay = kiemNgayChungTu({
    docDate: head.doc_date,
    today,
    lyDo: head.backdate_reason,
  })
  const tien = tienNhap(rows)
  const coNhap = rows.filter((r) => r.qty > 0)
  const deSau = rows.filter((r) => !(r.qty > 0)).length

  const focus = (id: string) =>
    setTimeout(() => {
      const el = document.getElementById(id) as HTMLInputElement | null
      el?.focus()
      el?.select?.()
    }, 0)

  const chan = !kiem.ok ? kiem.message : ngay.muc !== 'ok' ? ngay.message : undefined

  function nhayToi() {
    if (!kiem.ok) {
      if (kiem.focus === 'noi_mua') return focus('nhap-noi-mua')
      if (kiem.o === 'ma') return setGan(kiem.focus)
      return focus(`nhap-${kiem.o ?? 'qty'}-${kiem.focus}`)
    }
    if (ngay.muc !== 'ok')
      focus(ngay.muc === 'can_ly_do' ? 'nhap-ly-do-lui' : 'nhap-ngay')
  }

  function ganMa(i: number, m: MaGan) {
    const trung = rows.findIndex((r, j) => j !== i && r.material_id === m.id)
    if (trung >= 0)
      toast.error(
        `${m.code} đã gắn ở dòng ${trung + 1}`,
        'Vẫn gắn được — hai dòng đề nghị cùng một mã thì tồn cộng chung.',
      )
    patch(i, { material_id: m.id, code: m.code, ten: m.name, dvt: m.unit, ganMoi: true })
    setGan(null)
    focus(`nhap-qty-${i}`)
  }

  async function ghi() {
    if (chan) return nhayToi()
    setBusy(true)
    try {
      const res = await api<{ doc_id: string; code: string; status: string }>(
        `/api/dept/warehouse/de-nghi/${phieu.id}/nhap`,
        {
          method: 'POST',
          body: {
            noi_mua: head.noi_mua.trim(),
            supplier_doc_no: head.supplier_doc_no.trim() || null,
            doc_date: head.doc_date || null,
            backdate_reason: head.backdate_reason.trim() || null,
            note: head.note.trim() || null,
            lines: rows.map((r) => ({
              line_id: r.line_id,
              material_id: r.material_id,
              qty: r.qty > 0 ? r.qty : 0,
              unit_price: r.unit_price,
              note: r.note.trim() || null,
            })),
          },
        },
      )
      toast.success(
        `Đã ghi ${res.code}`,
        res.status === 'done'
          ? `Nhập đủ — ${phieu.code} chuyển sang Xong.`
          : `${coNhap.length} dòng vào kho · ${fmt(tien)} đ. ${phieu.code} còn dòng chưa nhập.`,
      )
      router.push(`/warehouse/de-nghi/${phieu.id}`)
      router.refresh()
    } catch (e) {
      toast.error('Chưa ghi sổ được', apiErrorText(e))
      setBusy(false)
    }
  }

  const soCot = hep ? 8 : 10

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          void ghi()
        }
      }}
    >
      <ScreenFrame>
        <Crumb
          path={[
            { label: 'Kho', href: '/warehouse/nhap' },
            { label: 'Đề nghị mua', href: '/warehouse/de-nghi' },
            { label: phieu.code, href: `/warehouse/de-nghi/${phieu.id}` },
            'Nhập hàng đã mua',
          ]}
        />
        <ActionPane>
          <ActionGroup label="Phiếu nhập">
            <Action primary onClick={() => void ghi()} disabled={busy} title={chan}>
              {busy ? 'Đang ghi sổ…' : 'Ghi phiếu nhập kho'}
            </Action>
            <Action
              icon="huy"
              disabled={busy}
              onClick={() => router.push(`/warehouse/de-nghi/${phieu.id}`)}
            >
              Thôi
            </Action>
          </ActionGroup>
        </ActionPane>

        <DocHead
          compact
          kind="Phiếu nhập kho · mua theo đề nghị"
          code="Chưa có số"
          sub={
            <span className="flex flex-wrap items-center gap-2">
              <Tag tone="done">
                <span className="num font-bold">N2</span>
              </Tag>
              <span>
                Mua theo {phieu.code} · {phieu.approved_by_name ?? 'lãnh đạo'} đã duyệt ·
                số PNK cấp khi ghi sổ
              </span>
            </span>
          }
        >
          <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
        </DocHead>

        <HeadChips>
          <HeadField label="Nơi mua" need empty={!head.noi_mua.trim()} width={230}>
            <input
              id="nhap-noi-mua"
              list="nhap-ncc"
              defaultValue={head.noi_mua}
              onBlur={(e) => setHead((h) => ({ ...h, noi_mua: e.target.value }))}
              onChange={(e) => setHead((h) => ({ ...h, noi_mua: e.target.value }))}
              placeholder="tên tiệm / NCC"
              aria-label="Nơi mua"
              disabled={busy}
              className="text-k-sm h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-1.5 placeholder:text-[var(--ink-3)] focus:border-[var(--act)]"
            />
          </HeadField>
          <HeadField label="Số hoá đơn / biên nhận" width={130}>
            <TextInput
              value={head.supplier_doc_no}
              onCommit={(v) => setHead((h) => ({ ...h, supplier_doc_no: v }))}
              placeholder="không bắt buộc"
              mono
              label="Số hoá đơn / biên nhận"
              disabled={busy}
            />
          </HeadField>
          <HeadField label="Ngày nhập" need={ngay.muc === 'chan'} empty>
            <span id="nhap-ngay">
              <DateInput
                value={head.doc_date}
                onChange={(v) => setHead((h) => ({ ...h, doc_date: v }))}
                label="Ngày nhập"
              />
            </span>
          </HeadField>
          {ngay.muc === 'can_ly_do' || head.backdate_reason ? (
            <HeadField
              label="Lý do nhập lùi"
              need
              empty={!head.backdate_reason.trim()}
              width={220}
            >
              <TextInput
                id="nhap-ly-do-lui"
                value={head.backdate_reason}
                onCommit={(v) => setHead((h) => ({ ...h, backdate_reason: v }))}
                placeholder="lùi quá 7 ngày phải ghi lý do"
                label="Lý do nhập lùi ngày"
                disabled={busy}
              />
            </HeadField>
          ) : null}
          <HeadChip label="Người mua" value={nguoiMua} plain />
          <HeadField label="Ghi chú" width={hep ? 160 : 240}>
            <TextInput
              value={head.note}
              onCommit={(v) => setHead((h) => ({ ...h, note: v }))}
              placeholder="không bắt buộc"
              label="Ghi chú phiếu nhập"
              disabled={busy}
            />
          </HeadField>
        </HeadChips>
        <datalist id="nhap-ncc">
          {nccGoiY.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        {kiem.ok && kiem.canhBao.length > 0 && (
          <NoticeBar tone="warn" tag="Nhập vượt">
            {kiem.canhBao.map((c) => c.cau).join(' · ')} — trong ngưỡng {pct(VUOT_TU_DO)}{' '}
            (mua theo cuộn / thùng hay lố), ghi được; dòng sổ mang vết vượt để lãnh đạo
            thấy.
          </NoticeBar>
        )}

        <div ref={khung} className="h-0 w-full" aria-hidden />
        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <Grid minWidth={hep ? 760 : 1000}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th width={hep ? 96 : 116}>Mã</Th>
              <Th>Tên vật tư</Th>
              <Th width={56}>ĐVT</Th>
              <ThSo w={80}>Số duyệt</ThSo>
              {!hep && <ThSo w={80}>Đã nhập</ThSo>}
              <ThSo w={104}>Nhận lần này</ThSo>
              <ThSo w={112}>Đơn giá thật</ThSo>
              {!hep && <ThSo w={112}>Thành tiền</ThSo>}
              <Th width={hep ? 150 : 200}>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {rows.map((r, i) => {
                const v = mucVuot(r.can, r.daNhap, r.qty)
                const lechDvt = r.ganMoi && r.dvt.trim().toLowerCase() !== r.dvt_de_nghi.trim().toLowerCase() // prettier-ignore
                return (
                  <GridRow key={r.line_id}>
                    <td className="k-c-n">{i + 1}</td>
                    <td>
                      {r.code && !r.ganMoi ? (
                        <Code>{r.code}</Code>
                      ) : r.code ? (
                        <span className="flex items-center gap-1">
                          <Code>{r.code}</Code>
                          <GridBtn onClick={() => setGan(i)} title="Đổi mã vừa gắn">
                            đổi
                          </GridBtn>
                        </span>
                      ) : (
                        <GridBtn onClick={() => setGan(i)} disabled={busy}>
                          gắn mã
                        </GridBtn>
                      )}
                    </td>
                    <td className="max-w-0" title={r.ten}>
                      <span className="block truncate">{r.ten}</span>
                      {r.ganMoi && r.ten !== r.name && (
                        <CellHint tone="neutral">đề nghị ghi: {r.name}</CellHint>
                      )}
                    </td>
                    <td className="text-[var(--ink-3)]">
                      {r.dvt}
                      {lechDvt && (
                        <CellHint tone="warn">đề nghị: {r.dvt_de_nghi}</CellHint>
                      )}
                    </td>
                    <td className="k-r num">
                      {fmt(r.can)}
                      {hep && r.daNhap > 0 && (
                        <CellHint tone="neutral">đã nhập {fmt(r.daNhap)}</CellHint>
                      )}
                    </td>
                    {!hep && (
                      <td className="k-r num text-[var(--ink-3)]">
                        {r.daNhap > 0 ? fmt(r.daNhap) : '—'}
                      </td>
                    )}
                    <td className="k-r">
                      <NumInput
                        id={`nhap-qty-${i}`}
                        value={String(r.qty)}
                        onCommit={(x) => patch(i, { qty: docSo(x) ?? 0 })}
                        disabled={busy}
                        aria-label={`Nhận lần này ${r.code ?? r.name}`}
                      />
                      {!(r.qty > 0) ? (
                        <CellHint tone="neutral">để chuyến sau</CellHint>
                      ) : v > 0 ? (
                        <CellHint tone="warn">
                          vượt {pct(v)}
                          {v > VUOT_TU_DO ? ' · cần lý do' : ''}
                        </CellHint>
                      ) : null}
                    </td>
                    <td className="k-r">
                      <NumInput
                        id={`nhap-gia-${i}`}
                        value={r.unit_price == null ? '' : String(r.unit_price)}
                        onCommit={(x) => patch(i, { unit_price: docSo(x) })}
                        disabled={busy}
                        aria-label={`Đơn giá thật ${r.code ?? r.name}`}
                      />
                      {r.gia_du_kien != null && r.unit_price !== r.gia_du_kien && (
                        <CellHint tone="neutral">dự kiến {fmt(r.gia_du_kien)}</CellHint>
                      )}
                    </td>
                    {!hep && (
                      <td className="k-r num">
                        {r.qty > 0 && r.unit_price != null ? (
                          fmt(Math.round(r.qty * r.unit_price))
                        ) : (
                          <span className="text-[var(--ink-empty)]">—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <TextInput
                        id={`nhap-note-${i}`}
                        value={r.note}
                        onCommit={(x) => patch(i, { note: x })}
                        placeholder={
                          v > VUOT_TU_DO
                            ? 'bắt buộc: vì sao vượt'
                            : r.unit_price === 0
                              ? 'bắt buộc: vì sao giá 0'
                              : 'không bắt buộc'
                        }
                        label={`Ghi chú ${r.code ?? r.name}`}
                        disabled={busy}
                      />
                    </td>
                  </GridRow>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={soCot} className="py-6 text-center text-[var(--ink-3)]">
                    Không còn dòng nào phải nhập — mọi dòng đã nhập đủ số duyệt. Quay lại
                    phiếu {phieu.code} để xem tình hình nhập.
                  </td>
                </tr>
              )}
            </GridBody>
            <GridFoot>
              <td colSpan={hep ? 6 : 8}>
                {coNhap.length} dòng nhập lần này
                {deSau > 0 && ` · ${deSau} dòng để chuyến sau (nhận 0)`}
              </td>
              {!hep && <td className="k-r num">{fmt(tien)}</td>}
              <td className="font-normal text-[var(--ink-3)]">
                {hep ? `${fmt(tien)} · ` : ''}chưa VAT
              </td>
            </GridFoot>
          </Grid>
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng nhập', value: coNhap.length },
            ...(deSau > 0 ? [{ label: 'Để sau', value: deSau }] : []),
          ]}
          grand={{ label: 'Tiền phiếu nhập (chưa VAT)', value: fmt(tien) }}
          actions={
            <>
              {/* Không dùng `blocked` của CommitBar: kit ghi "Chưa LƯU được",
                  ở đây là ghi SỔ — câu phải nói đúng việc bị chặn. */}
              {chan && (
                <button
                  type="button"
                  className="text-k-sm max-w-[460px] truncate font-semibold text-[var(--warn)] underline-offset-2 hover:underline"
                  title={chan}
                  onClick={nhayToi}
                >
                  Chưa ghi sổ được: {chan} →
                </button>
              )}
              <span className="text-k-label text-[var(--ink-3)]">Ctrl + Enter</span>
              <Action primary onClick={() => void ghi()} disabled={busy} title={chan}>
                {busy ? 'Đang ghi sổ…' : 'Ghi phiếu nhập kho'}
              </Action>
            </>
          }
        />
        <StatusBar
          left={[
            'Hàng vào khu tiếp nhận · cất kệ là bước riêng',
            'Phiếu nhập có đơn giá thật → giá trị tồn đúng; đảo được như mọi PNK',
          ]}
          right="Không qua Cung ứng — Kho tự mua theo số duyệt"
        />
      </ScreenFrame>
      {gan != null && rows[gan] && (
        <GanMaSheet
          ten={rows[gan].name}
          dvt={rows[gan].dvt_de_nghi}
          nhomOptions={nhomOptions}
          canCreate={canCreateMa}
          onClose={() => setGan(null)}
          onDone={(m) => ganMa(gan, m)}
        />
      )}
    </div>
  )
}
