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
  kiemTruocGhiSoHoan,
  tinhTongHoan,
  vuotDaLinh,
  type DauPhieuHoan,
  type DongHoan,
} from '@/lib/kho-hoan-kho'
import {
  Action,
  ActionGroup,
  ActionPane,
  Btn,
  CellHint,
  Code,
  CommitBar,
  Crumb,
  DateInput,
  DocHead,
  Empty,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  GridToolbar,
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

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * HOÀN KHO TỪ SẢN XUẤT — Khuôn F. Bản thiết kế:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf (artboard 8 + 8b).
 *
 * KHÁC HẲN hai màn nhập kia: TẬP VẬT TƯ LÀ ĐÓNG. Không ô tìm mã — lưới điền
 * sẵn từ phần lệnh đã lĩnh chưa hoàn, trần từng dòng là chính con số đó.
 *
 * Cũng không có cột Tình trạng: service chặn `qty_rejected` cho phiếu hoàn —
 * hàng lỗi xử ở xưởng, không đẩy sang kho thành "hàng khoá" rồi để đó.
 */
export function HoanKhoScreen({
  lsx,
  lsxId,
  rows: initialRows,
  to,
  today,
  nguoiNhan,
  canEdit,
  company,
  tpl,
}: {
  lsx: { id: string; code: string; customer_name: string | null; status: string }[]
  lsxId: string
  rows: DongHoan[]
  to: string[]
  today: string
  nguoiNhan: string
  canEdit: boolean
  company: PrintCompany
  tpl: DocTemplate
}) {
  const router = useRouter()
  const toast = useToast()

  const [rows, setRows] = useState(initialRows)
  const [head, setHead] = useState<DauPhieuHoan>({
    lsx_id: lsxId,
    to: '',
    doc_date: today,
    note: '',
  })
  const [xemIn, setXemIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [daThu, setDaThu] = useState(false)

  const dat = (p: Partial<DauPhieuHoan>) => setHead((h) => ({ ...h, ...p }))
  const patch = (i: number, p: Partial<DongHoan>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongHoan(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSoHoan(head, rows), [head, rows])
  const lenh = lsx.find((l) => l.id === head.lsx_id) ?? null
  const thieu = (o: 'lenh' | 'to') => daThu && !kiem.ok && kiem.focus === o

  const doiLenh = (id: string) =>
    router.push(id ? `/warehouse/nhap/hoan-kho?lsx=${id}` : '/warehouse/nhap/hoan-kho')

  const nhayToi = () => {
    setDaThu(true)
    if (kiem.ok) return
    if (typeof kiem.focus === 'number') {
      const el = document.getElementById(
        `hoan-qty-${kiem.focus}`,
      ) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }
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
    if (!ghiDuoc) return
    setBusy(true)
    try {
      const res = await api<{ id: string; code: string }>(
        '/api/dept/warehouse/docs/receipt',
        {
          method: 'POST',
          body: {
            // Hoàn kho: gắn LỆNH, KHÔNG gắn đơn mua. Service tự đặt mã lý do
            // N3 và trừ lại phần "đã cấp" của lệnh.
            po_id: null,
            production_order_id: head.lsx_id,
            counterparty: head.to.trim(),
            reason: `Hoàn kho từ sản xuất — ${lenh?.code ?? ''}`.trim(),
            doc_date: head.doc_date || null,
            note: head.note.trim() || null,
            lines: rows
              .filter((r) => r.qty > 0)
              .map((r) => ({
                material_id: r.material_id,
                qty: r.qty,
                note: r.note.trim() || null,
              })),
          },
        },
      )
      const q = new URLSearchParams({
        vua_ghi: res.id,
        ma: res.code,
        chi_tiet: `${tong.so_dong} dòng hoàn · ${fmt(tong.tong)} đơn vị về kho`,
      })
      router.push(`/warehouse/nhap?${q}`)
      router.refresh()
    } catch (e) {
      toast.error('Chưa ghi sổ được', apiErrorText(e))
      setBusy(false)
    }
  }

  const dauPhieu = (
    <FastTab title="Đầu phiếu" defaultOpen>
      <FieldGrid>
        <Field label="Lệnh sản xuất" tone={thieu('lenh') ? 'stop' : undefined}>
          <PickFind
            value={head.lsx_id}
            onChange={doiLenh}
            options={lsx.map((l) => ({
              value: l.id,
              label: l.code,
              hint: l.customer_name ?? undefined,
            }))}
            label="Lệnh sản xuất"
            emptyLabel={`— ${lsx.length} lệnh —`}
            placeholder="gõ số lệnh…"
            disabled={busy}
          />
        </Field>
        <Field label="Tổ trả" tone={thieu('to') ? 'stop' : undefined}>
          <Pick
            value={head.to}
            onChange={(v) => dat({ to: v })}
            options={[
              { value: '', label: '— chưa chọn —' },
              ...to.map((t) => ({ value: t, label: t })),
            ]}
            label="Tổ trả"
            width={180}
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
        <Field label="Người nhận">
          <span className="text-[var(--ink-3)]">{nguoiNhan} · theo phiên đăng nhập</span>
        </Field>
        <Field label="Ghi chú phiếu">
          <TextInput
            value={head.note}
            onCommit={(v) => dat({ note: v })}
            placeholder="ví dụ: tổ cắt dư sau khi đổi bản vẽ"
            label="Ghi chú phiếu"
            disabled={busy}
          />
        </Field>
      </FieldGrid>
    </FastTab>
  )

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
            'Hoàn kho từ sản xuất',
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
            <Action disabled={rows.length === 0} onClick={() => setXemIn(true)}>
              Xem bản in
            </Action>
          </ActionGroup>
          <ActionGroup label="Lệnh">
            <Action
              disabled={!head.lsx_id}
              title={head.lsx_id ? undefined : 'Chọn lệnh trước'}
              onClick={() => router.push(`/warehouse/xuat?lsx=${head.lsx_id}`)}
            >
              Lập phiếu xuất
            </Action>
          </ActionGroup>
        </ActionPane>

        <DocHead
          compact
          kind="Phiếu nhập kho · hoàn từ sản xuất"
          code={lenh?.code ?? 'Chưa chọn lệnh'}
          sub={
            <span className="flex items-center gap-2">
              <Tag tone="done">
                <span className="num font-bold">N3</span>
              </Tag>
              <span>
                Nhập lại vật tư thừa từ SX
                {lenh?.customer_name ? ` · ${lenh.customer_name}` : ''} · số PNK cấp khi
                ghi sổ
              </span>
            </span>
          }
        >
          <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
        </DocHead>

        {dauPhieu}

        {!head.lsx_id ? (
          <Empty
            headline="Chọn lệnh sản xuất để xem có gì hoàn được"
            reason={`Chỉ trả lại được thứ lệnh đã lấy ra khỏi kho, nên lưới dựng từ chính lệnh. Đang có ${lsx.length} lệnh hoàn kho được (đã duyệt, đang SX, hoặc đã xong).`}
            next={
              <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                Chọn ở ô “Lệnh sản xuất” phía trên
              </span>
            }
          />
        ) : rows.length === 0 ? (
          <Empty
            headline={`${lenh?.code} chưa lĩnh vật tư nào`}
            reason="Chỉ trả lại được thứ đã lấy ra khỏi kho. Sổ chưa ghi lần cấp nào cho lệnh này, nên không có gì để hoàn. Nếu tổ đang cầm vật tư thật thì lần cấp đó chưa được ghi sổ."
            next={
              // `Btn` chứ không `Action`: Action là nút của thanh hành động
              // (k-pane), đặt lẻ trong khối rỗng là mượn kiểu của chỗ khác.
              <Btn primary href={`/warehouse/xuat?lsx=${head.lsx_id}`}>
                Lập phiếu xuất cho lệnh này
              </Btn>
            }
          />
        ) : (
          <>
            <GridToolbar count={`${rows.length} dòng · ${tong.so_dong} dòng có số`}>
              <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                Lưới điền sẵn từ <b>phần lệnh đã lĩnh chưa hoàn</b> — không có ô tìm mã:
                chỉ trả được thứ đã lấy
              </span>
            </GridToolbar>

            <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
              <Grid minWidth={880}>
                <GridHead>
                  <Th width={30}>#</Th>
                  <Th width={110}>Mã</Th>
                  <Th>Tên vật tư</Th>
                  <Th width={52}>ĐVT</Th>
                  <Th num width={128}>
                    Đã lĩnh còn lại
                  </Th>
                  <Th num width={120}>
                    Hoàn
                  </Th>
                  <Th width={360}>Ghi chú</Th>
                </GridHead>
                <GridBody>
                  {rows.map((r, i) => {
                    const vuot = vuotDaLinh(r)
                    return (
                      <GridRow key={r.material_id}>
                        <td className="k-r">{i + 1}</td>
                        <td>
                          <Code>{r.code}</Code>
                        </td>
                        <td>{r.name}</td>
                        <td>{r.unit}</td>
                        <td className="k-r num text-[var(--ink-3)]">{fmt(r.issued)}</td>
                        <td className="k-r">
                          <NumInput
                            id={`hoan-qty-${i}`}
                            value={String(r.qty)}
                            onCommit={(v) =>
                              patch(i, {
                                qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                              })
                            }
                            disabled={busy}
                            aria-label={`Hoàn ${r.code}`}
                          />
                          {vuot != null && (
                            <CellHint tone="warn">
                              lệnh chỉ còn ghi đã cấp {fmt(r.issued)} — thừa {fmt(vuot)}
                            </CellHint>
                          )}
                        </td>
                        <td>
                          <TextInput
                            value={r.note}
                            onCommit={(v) => patch(i, { note: v })}
                            disabled={busy}
                            placeholder="ghi chú (không bắt buộc)"
                            label={`Ghi chú ${r.code}`}
                          />
                        </td>
                      </GridRow>
                    )
                  })}
                </GridBody>
                <GridFoot>
                  <td colSpan={4}>Tổng</td>
                  <td className="k-r num">{fmt(tong.tong_da_linh)}</td>
                  <td className="k-r num">{fmt(tong.tong)}</td>
                  <td className="font-normal text-[var(--ink-3)]">
                    {tong.so_dong} dòng hoàn · giá vốn theo lần cấp
                  </td>
                </GridFoot>
              </Grid>
            </div>

            <CommitBar
              totals={[
                { label: 'Dòng hoàn', value: tong.so_dong },
                { label: 'Đã lĩnh', value: fmt(tong.tong_da_linh) },
              ]}
              grand={{ label: 'Hoàn về kho', value: fmt(tong.tong) }}
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
          </>
        )}

        <StatusBar
          left={[
            'Mọi dòng mang mã N3 · hàng về khu tiếp nhận · không có cột Tình trạng — hàng lỗi xử ở xưởng',
            'Ghi sổ xong, phần “đã cấp” của lệnh giảm đúng bằng số hoàn',
          ]}
          right={head.lsx_id ? `${rows.length} mã lệnh đang giữ` : `${lsx.length} lệnh`}
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
                counterparty: head.to.trim() || null,
                reason: `Hoàn kho từ sản xuất — ${lenh?.code ?? ''}`.trim(),
                note: head.note.trim() || null,
                creator_name: nguoiNhan,
              }}
              lines={rows
                .filter((r) => r.qty > 0)
                .map<WarehousePrintLine>((r) => ({
                  id: r.material_id,
                  material_code: r.code,
                  material_name: r.name,
                  material_unit: r.unit,
                  // "Theo chứng từ" = phần lệnh đã lĩnh, "Thực nhập" = phần trả
                  // lại. Hai cột của mẫu 01-VT ở đây đọc được đúng nghĩa.
                  qty_doc: r.issued,
                  qty: r.qty,
                  note: r.note || null,
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
