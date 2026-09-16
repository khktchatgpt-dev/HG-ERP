'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  WarehouseDocPrintSheet,
  type WarehousePrintLine,
} from '@/app/print/warehouse/WarehouseDocPrintSheet'
import type { PrintCompany } from '@/app/print/PrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  LY_DO_NGOAI_DON,
  donMoCuaNcc,
  kiemTruocGhiSoNgoai,
  themDongNhan,
  timLyDoNgoaiDon,
  tinhTongNhan,
  type DauPhieuNgoai,
  type DongNhanNgoai,
  type TinhTrangNhan,
  type VatTuNhan,
} from '@/lib/kho-nhap-ngoai-don'
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
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridBtn,
  GridFoot,
  GridHead,
  GridRow,
  GridToolbar,
  Lookup,
  NoticeBar,
  NumInput,
  Pick,
  PickFind,
  ScreenFrame,
  Sheet,
  StatusBar,
  StatusTrack,
  Tag,
  TextInput,
  Th,
} from '@/components/kit'

const TINH_TRANG: { value: TinhTrangNhan; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * NHẬN HÀNG KHÔNG THEO ĐƠN — Khuôn F (bảng nhập liệu), anh em với
 * `/warehouse/nhap/[poId]`. Bản thiết kế:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf (artboard 7 + 7b).
 *
 * Đầu phiếu dựng y hệt màn nhận theo đơn (FastTab + FieldGrid): thủ kho đi
 * lại giữa hai màn suốt, đầu phiếu khác hình là bắt họ học hai lần.
 *
 * Khác ở ba chỗ, và cả ba đều có lý do nghiệp vụ:
 *   · KHÔNG có cột Đặt / Đã về — không có đơn nào để so;
 *   · BẮT CHỌN vì sao không có đơn, vì đường này dễ bị dùng để né mở đơn mua;
 *   · NCC vừa gõ mà đang có đơn mở thì nói ngay, kèm đường sang đó.
 */
export function NhapNgoaiDonScreen({
  ncc,
  openPos,
  today,
  nguoiNhan,
  canEdit,
  company,
  tpl,
}: {
  ncc: { id: string; name: string; code: string | null }[]
  openPos: { code: string; supplier_name: string }[]
  today: string
  nguoiNhan: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()
  const toast = useToast()

  const [head, setHead] = useState<DauPhieuNgoai>({
    nguoi_giao: '',
    ly_do: '',
    supplier_doc_no: '',
    doc_date: today,
    note: '',
  })
  const [rows, setRows] = useState<DongNhanNgoai[]>([])
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dangTra, setDangTra] = useState(false)
  const [daThu, setDaThu] = useState(false)

  const dat = (p: Partial<DauPhieuNgoai>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongNhanNgoai>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongNhan(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoNgoai(head, rows), [head, rows])
  const lyDo = timLyDoNgoaiDon(head.ly_do)
  const donMo = useMemo(
    () => donMoCuaNcc(head.nguoi_giao, openPos),
    [head.nguoi_giao, openPos],
  )
  const thieu = (o: 'nguoi_giao' | 'ly_do' | 'ghi_chu') =>
    daThu && !kiem.ok && kiem.focus === o

  async function timVatTu(q: string): Promise<VatTuNhan[]> {
    const res = await api<{ rows: VatTuNhan[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function chonVatTu(vt: VatTuNhan) {
    // Tồn hiện tại chỉ để ĐỐI CHIẾU BẰNG MẮT — nhập không có trần như xuất.
    // Tra được thì tốt, không tra được vẫn thêm dòng: đây không phải hàng rào.
    setDangTra(true)
    let ton: number | null = null
    try {
      const res = await api<{ rows: { material_id: string; on_hand: number }[] }>(
        `/api/dept/warehouse/stock/ton?ids=${vt.id}`,
      )
      ton = res.rows[0]?.on_hand ?? 0
    } catch {
      ton = null
    } finally {
      setDangTra(false)
    }
    const r = themDongNhan(rows, vt, ton)
    if (r.trung) {
      toast.error(
        `${vt.code} đã có ở dòng ${r.index + 1}`,
        'Một mã một dòng — sửa số ở dòng đó.',
      )
    } else {
      setRows(r.rows)
    }
    setTimeout(() => focusQty(r.index), 0)
  }

  const focusQty = (i: number) => {
    const el = document.getElementById(`nhan-qty-${i}`) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const nhayToi = () => {
    setDaThu(true)
    if (kiem.ok) return
    if (typeof kiem.focus === 'number') {
      if (kiem.focus < 0) return
      const id = kiem.reason === 'khoa_thieu_ly_do' ? 'nhan-note' : 'nhan-qty'
      const el = document.getElementById(`${id}-${kiem.focus}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
      return
    }
    const el = document.getElementById(`head-${kiem.focus}`) as HTMLInputElement | null
    el?.focus()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : !kiem.ok
      ? kiem.message
      : busy
        ? 'Đang ghi sổ…'
        : undefined
  const ghiDuoc = blocked == null

  async function ghiSo() {
    if (!ghiDuoc || !lyDo) return
    setBusy(true)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            // po_id null = mua ngoài. Service tự gắn mã lý do N2 cho mọi dòng
            // không có po_line_id, và chặn nếu lỡ gửi kèm dòng đơn.
            po_id: null,
            counterparty: head.nguoi_giao.trim(),
            supplier_doc_no: head.supplier_doc_no.trim() || null,
            doc_date: head.doc_date || null,
            // Lý do đi vào ô `reason` dưới dạng NHÃN ĐÃ CHỌN, nên sổ phiếu đọc
            // ra câu người ta hiểu chứ không phải một mã nội bộ. Câu gõ thêm ở
            // lại ô ghi chú — hai thứ khác nhau, đừng dán vào một ô.
            reason: lyDo.nhan,
            note: head.note.trim() || null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.id,
                qty: r.qty,
                stock_status: r.tinh_trang,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      const q = new URLSearchParams({
        vua_ghi: res.id,
        ma: res.code,
        chi_tiet: `${tong.so_dong} dòng · ${fmt(tong.tong)} đơn vị${
          tong.vao_khoa > 0 ? ` · ${fmt(tong.vao_khoa)} vào khoá` : ''
        }`,
      })
      router.push(`/warehouse/nhap?${q}`)
      router.refresh()
    } catch (e) {
      toast.error('Chưa ghi sổ được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault()
          if (ghiDuoc) void ghiSo()
          else nhayToi()
        }
      }}
    >
      <ScreenFrame>
        <Crumb
          path={[
            { label: 'Kho', href: '/warehouse/nhap' },
            { label: 'Hàng về', href: '/warehouse/nhap' },
            'Nhận hàng không theo đơn',
          ]}
        />

        <ActionPane>
          <ActionGroup label="Phiếu">
            <Action
              primary
              disabled={!ghiDuoc}
              title={blocked}
              onClick={() => void ghiSo()}
            >
              {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
            </Action>
            <Action disabled={busy} onClick={() => router.push('/warehouse/nhap')}>
              Huỷ
            </Action>
          </ActionGroup>
          <ActionGroup label="Bản in">
            <Action onClick={() => setXemIn(true)}>Xem bản in</Action>
          </ActionGroup>
          <ActionGroup label="Theo đơn">
            <Action onClick={() => router.push('/warehouse/nhap')}>
              Nhận theo đơn mua
            </Action>
          </ActionGroup>
        </ActionPane>

        <DocHead
          compact
          kind="Phiếu nhập kho · không theo đơn"
          code="Chưa có số"
          sub={
            <span className="flex items-center gap-2">
              <Tag tone="done">
                <span className="num font-bold">N2</span>
              </Tag>
              <span>Nhập mua ngoài đơn · số PNK cấp khi ghi sổ</span>
            </span>
          }
        >
          <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
        </DocHead>

        <FastTab title="Đầu phiếu" defaultOpen>
          <FieldGrid>
            <Field label="Người giao" tone={thieu('nguoi_giao') ? 'stop' : undefined}>
              <TextInput
                id="head-nguoi_giao"
                value={head.nguoi_giao}
                onCommit={(v) => dat({ nguoi_giao: v })}
                placeholder="tên NCC / nơi mua / người mang tới"
                label="Người giao"
                disabled={busy}
              />
            </Field>
            <Field label="Lấy tên từ danh mục">
              <PickFind
                value=""
                onChange={(v) => {
                  const s = ncc.find((x) => x.id === v)
                  if (s) dat({ nguoi_giao: s.name })
                }}
                options={ncc.map((s) => ({
                  value: s.id,
                  label: s.name,
                  hint: s.code ?? undefined,
                }))}
                label="Chọn nhà cung cấp có sẵn"
                emptyLabel={`— ${ncc.length} nhà cung cấp —`}
                placeholder="gõ tên NCC…"
                disabled={busy}
              />
            </Field>
            <Field label="Vì sao không có đơn" tone={thieu('ly_do') ? 'stop' : undefined}>
              <Pick
                value={head.ly_do}
                onChange={(v) => dat({ ly_do: v })}
                options={[
                  { value: '', label: '— chưa chọn —' },
                  ...LY_DO_NGOAI_DON.map((x) => ({ value: x.ma, label: x.nhan })),
                ]}
                label="Vì sao không có đơn"
                width={220}
                disabled={busy}
              />
            </Field>
            <Field label="Ngày chứng từ">
              <DateInput
                value={head.doc_date}
                onChange={(v) => dat({ doc_date: v })}
                label="Ngày chứng từ"
              />
            </Field>
            <Field label="Số phiếu NCC">
              <TextInput
                value={head.supplier_doc_no}
                onCommit={(v) => dat({ supplier_doc_no: v })}
                placeholder="số trên phiếu của họ"
                mono
                label="Số phiếu NCC"
                disabled={busy}
              />
            </Field>
            <Field label="Ghi chú phiếu" tone={thieu('ghi_chu') ? 'stop' : undefined}>
              <TextInput
                id="head-ghi_chu"
                value={head.note}
                onCommit={(v) => dat({ note: v })}
                placeholder={
                  lyDo?.batGhiChu
                    ? 'bắt buộc: nói rõ hàng này ở đâu ra'
                    : 'ghi chú (không bắt buộc)'
                }
                label="Ghi chú phiếu"
                disabled={busy}
              />
              {lyDo && <CellHint tone="neutral">{lyDo.heQua}</CellHint>}
            </Field>
            <Field label="Người nhận">
              <span className="text-[var(--ink-3)]">
                {nguoiNhan} · theo phiên đăng nhập
              </span>
            </Field>
          </FieldGrid>
        </FastTab>

        {donMo.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Có đơn thì nhận theo đơn"
            action={{
              label: 'Xem đơn của NCC này',
              onClick: () => router.push('/warehouse/nhap'),
            }}
          >
            <b>{head.nguoi_giao.trim()}</b> đang có <b>{donMo.length}</b> đơn mua còn mở (
            {donMo
              .slice(0, 3)
              .map((p) => p.code)
              .join(', ')}
            {donMo.length > 3 ? '…' : ''}). Nếu chuyến hàng này thuộc một trong số đó,
            nhận theo đơn — tờ ngoài đơn không vào đối chiếu công nợ của Cung ứng.
          </NoticeBar>
        )}

        <GridToolbar count={`${rows.length} dòng${dangTra ? ' · đang tra tồn…' : ''}`}>
          <Lookup<VatTuNhan>
            search={timVatTu}
            onPick={(vt) => void chonVatTu(vt)}
            keyOf={(vt) => vt.id}
            render={(vt) => (
              <span className="flex items-baseline gap-2">
                <Code>{vt.code}</Code>
                <span className="truncate">{vt.name}</span>
                <span className="ml-auto text-[var(--ink-3)]">{vt.unit}</span>
              </span>
            )}
            label="Thêm mã vật tư"
            placeholder="gõ mã hoặc tên để thêm dòng…"
            width={320}
            disabled={busy}
          />
          <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
            Không có cột <b>Đặt</b> vì không có đơn để so — cột Tồn nay chỉ để đối chiếu
            bằng mắt
          </span>
        </GridToolbar>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
          <Grid minWidth={900}>
            <GridHead>
              <Th width={30}>#</Th>
              <Th width={110}>Mã</Th>
              <Th>Tên vật tư</Th>
              <Th width={52}>ĐVT</Th>
              <Th num width={92}>
                Tồn nay
              </Th>
              <Th num width={110}>
                Nhận
              </Th>
              <Th width={146}>Tình trạng</Th>
              <Th width={320}>Ghi chú</Th>
              <Th width={44} />
            </GridHead>
            <GridBody>
              {rows.map((r, i) => (
                <GridRow key={r.id}>
                  <td className="k-r">{i + 1}</td>
                  <td>
                    <Code>{r.code}</Code>
                  </td>
                  <td>{r.name}</td>
                  <td>{r.unit}</td>
                  <td className="k-r num text-[var(--ink-3)]">
                    {r.ton == null ? '—' : fmt(r.ton)}
                  </td>
                  <td className="k-r">
                    <NumInput
                      id={`nhan-qty-${i}`}
                      value={String(r.qty)}
                      onCommit={(v) =>
                        patch(i, {
                          qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                        })
                      }
                      disabled={busy}
                      aria-label={`Nhận ${r.code}`}
                    />
                    {r.tinh_trang === 'blocked' && r.qty > 0 && (
                      <CellHint tone="warn">
                        {fmt(r.qty)} {r.unit} vào KHOÁ
                      </CellHint>
                    )}
                  </td>
                  <td>
                    <Pick
                      value={r.tinh_trang}
                      onChange={(v) => patch(i, { tinh_trang: v as TinhTrangNhan })}
                      options={TINH_TRANG}
                      label={`Tình trạng ${r.code}`}
                      width={130}
                      disabled={busy}
                    />
                  </td>
                  <td>
                    <TextInput
                      id={`nhan-note-${i}`}
                      value={r.note}
                      onCommit={(v) => patch(i, { note: v })}
                      disabled={busy}
                      placeholder={
                        r.tinh_trang === 'blocked'
                          ? 'bắt buộc: vì sao sai quy cách'
                          : 'ghi chú (không bắt buộc)'
                      }
                      label={`Ghi chú ${r.code}`}
                    />
                  </td>
                  <td>
                    <GridBtn
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      title={`Bỏ dòng ${r.code}`}
                      disabled={busy}
                    >
                      Bỏ
                    </GridBtn>
                  </td>
                </GridRow>
              ))}
              {rows.length === 0 && (
                <GridRow>
                  <td colSpan={9} className="text-[var(--ink-3)]">
                    Chưa có dòng nào — gõ mã hoặc tên vật tư ở ô tìm trên lưới. Mã chưa có
                    trong danh mục thì xin mã ở{' '}
                    <a
                      className="font-semibold text-[var(--act)] hover:underline"
                      href="/warehouse/vat-tu"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Danh mục vật tư ↗
                    </a>{' '}
                    rồi quay lại.
                  </td>
                </GridRow>
              )}
            </GridBody>
            <GridFoot>
              <td colSpan={5}>Tổng</td>
              <td className="k-r num">{fmt(tong.tong)}</td>
              <td colSpan={3} className="font-normal text-[var(--ink-3)]">
                {tong.so_dong} dòng · {fmt(tong.dung_duoc)} dùng được ·{' '}
                {fmt(tong.vao_khoa)} vào khoá
              </td>
            </GridFoot>
          </Grid>
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng', value: tong.so_dong },
            { label: 'Nhận', value: fmt(tong.tong) },
            { label: 'Vào khoá', value: fmt(tong.vao_khoa) },
          ]}
          grand={{ label: 'Dùng được', value: fmt(tong.dung_duoc) }}
          blocked={blocked}
          onGoBlocked={kiem.ok ? undefined : nhayToi}
          actions={
            <>
              <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">
                Ctrl + Enter
              </span>
              <Action
                primary
                disabled={!ghiDuoc}
                title={blocked}
                onClick={() => void ghiSo()}
              >
                {busy ? 'Đang ghi sổ…' : 'Ghi sổ'}
              </Action>
            </>
          }
        />

        <StatusBar
          left={[
            'Mọi dòng mang mã N2 · hàng đạt vào khu tiếp nhận · hàng sai quy cách vào kệ khoá',
            'Cất vào kệ thật là bước riêng — phiếu này chỉ đưa hàng vào sổ',
          ]}
          right="Không gắn đơn mua — Cung ứng KHÔNG đối chiếu công nợ tờ này"
        />

        {xemIn && (
          <Sheet
            open
            onClose={() => setXemIn(false)}
            width={900}
            title="Xem trước phiếu nhập kho"
            subtitle="Dựng từ bản đang gõ — chưa ghi sổ, chưa có số phiếu. Đúng mẫu 01-VT sẽ in ra."
          >
            <WarehouseDocPrintSheet
              head={{
                kind: 'receipt',
                code: null,
                date: new Date(head.doc_date),
                supplier_doc_no: head.supplier_doc_no.trim() || null,
                counterparty: head.nguoi_giao.trim() || null,
                reason: lyDo?.nhan ?? null,
                note: head.note.trim() || null,
                creator_name: nguoiNhan,
              }}
              lines={rows
                .filter((r) => r.qty > 0)
                .map<WarehousePrintLine>((r) => ({
                  id: r.id,
                  material_code: r.code,
                  material_name: r.name,
                  material_unit: r.unit,
                  // Không có đơn nên "theo chứng từ" chính là số thực nhận —
                  // in một cột trống ở đó là mời người đọc đi tìm con số không
                  // tồn tại.
                  qty_doc: r.qty,
                  qty: r.qty,
                  note:
                    r.tinh_trang === 'blocked'
                      ? ['Sai quy cách', r.note].filter(Boolean).join(' · ')
                      : r.note || null,
                }))}
              company={company}
              tpl={tpl}
            />
          </Sheet>
        )}
      </ScreenFrame>
    </div>
  )
}
