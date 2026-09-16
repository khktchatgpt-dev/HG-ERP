'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import {
  danhGiaVuot,
  kiemTruocGhiSo,
  tinhTong,
  type DongNhan,
  type TinhTrang,
} from '@/lib/kho-phieu-nhap'
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
  GridFoot,
  GridHead,
  GridRow,
  GridToolbar,
  LineStatus,
  NoticeBar,
  NumInput,
  Pick,
  StatusBar,
  StatusTrack,
  TextInput,
  Th,
} from '@/components/kit'

const TINH_TRANG: { value: TinhTrang; label: string }[] = [
  { value: 'ok', label: 'Đạt' },
  { value: 'blocked', label: 'Sai quy cách' },
]

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * PHIẾU NHẬP THEO ĐƠN — màn chứng từ + lưới (Bước 1 Kho). Bản thiết kế:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf (artboard 2).
 *
 * Ba cột số Đặt · Đã về · Lần này (SAP MIGO / BC). Tình trạng chỉ HAI giá trị
 * vì thủ kho vừa nhận vừa kiểm (chốt 15/09): Đạt → tồn dùng được; Sai quy
 * cách → vào kệ khoá, bắt ghi chú — lý do đi theo lô suốt đời nó.
 *
 * Cảnh báo hiện NGAY DƯỚI Ô khi gõ (CellHint), thanh chốt nói vì sao chưa ghi
 * sổ được bằng câu bấm được (nhảy tới ô phải sửa). Không lưu nháp: phiếu lập
 * trong ba phút, nháp là chỗ quên.
 *
 * VIỆC 3 dừng ở form: nút Ghi sổ còn khoá kèm lý do. Việc 4 nối POST
 * `docs/receipt` + hộp lý do nhận vượt.
 */
export function PhieuNhapScreen({
  po,
  dot,
  rows: initialRows,
  boQuaTuDo,
  today,
  nguoiNhan,
  canEdit,
}: {
  po: {
    id: string
    code: string
    supplier_name: string
    lsx_code: string | null
    expected_at: string | null
  }
  dot: { id: string; seq: number; total: number; expected_date: string } | null
  rows: DongNhan[]
  boQuaTuDo: number
  today: string
  nguoiNhan: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [docDate, setDocDate] = useState(today)
  const [supplierDocNo, setSupplierDocNo] = useState('')
  const [counterparty, setCounterparty] = useState('')

  const patch = (i: number, p: Partial<DongNhan>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTong(rows), [rows])
  const kiem = useMemo(() => kiemTruocGhiSo(rows), [rows])

  // Nhảy tới ô phải sửa bằng id: kit `NumInput`/`TextInput` là hàm thường,
  // không forwardRef, mà `id` thì đi qua `...rest` xuống <input>.
  const nhayToi = () => {
    if (kiem.ok || kiem.line == null || kiem.line < 0) return
    const el = document.getElementById(
      `${kiem.reason === 'thieu_ghi_chu' ? 'ghi-chu' : 'lan-nay'}-${kiem.line}`,
    ) as HTMLInputElement | null
    el?.focus()
    el?.select()
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : !kiem.ok
      ? kiem.message
      : 'Ghi sổ nối ở việc số 4 của Bước 1 — form đã đủ dữ liệu'

  const dotLabel = dot
    ? `đợt ${dot.seq}/${dot.total} · hẹn ${isoToVn(dot.expected_date)}`
    : po.expected_at
      ? `không theo đợt · hẹn giao ${isoToVn(po.expected_at)}`
      : 'không theo đợt · chưa hẹn ngày'

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <Crumb
        path={[
          { label: 'Kho', href: '/warehouse/nhap' },
          { label: 'Hàng về', href: '/warehouse/nhap' },
          `Nhận hàng ${po.code}`,
        ]}
      />
      <ActionPane>
        <ActionGroup label="Phiếu">
          <Action primary disabled title={blocked}>
            Ghi sổ
          </Action>
          <Action onClick={() => router.push('/warehouse/nhap')}>Huỷ</Action>
        </ActionGroup>
        <ActionGroup label="Đơn">
          <Action onClick={() => router.push(`/mua-hang/don/${po.id}`)}>
            Mở đơn mua
          </Action>
        </ActionGroup>
      </ActionPane>
      <DocHead
        compact
        kind="Phiếu nhập kho · theo đơn mua"
        code={po.code}
        sub={`${po.supplier_name} · ${dotLabel} · số phiếu PNK cấp khi ghi sổ`}
      >
        <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
      </DocHead>

      <FastTab title="Đầu phiếu" defaultOpen>
        <FieldGrid>
          <Field label="Đơn mua">
            <Code as="a" href={`/mua-hang/don/${po.id}`}>
              {po.code}
            </Code>
          </Field>
          <Field label="Nhà cung cấp">{po.supplier_name}</Field>
          <Field label="Lệnh SX">
            {po.lsx_code ? (
              <span className="num">{po.lsx_code}</span>
            ) : (
              <span className="text-[var(--ink-3)]">không theo lệnh</span>
            )}
          </Field>
          <Field label="Đợt giao">{dotLabel}</Field>
          <Field label="Ngày chứng từ">
            <DateInput value={docDate} onChange={setDocDate} label="Ngày chứng từ" />
          </Field>
          <Field label="Số phiếu giao NCC">
            <TextInput
              value={supplierDocNo}
              onCommit={setSupplierDocNo}
              placeholder="số trên phiếu của NCC"
              mono
              label="Số phiếu giao NCC"
            />
          </Field>
          <Field label="Người giao">
            <TextInput
              value={counterparty}
              onCommit={setCounterparty}
              placeholder="tên tài xế / NV giao"
              label="Người giao"
            />
          </Field>
          <Field label="Người nhận">
            <span className="text-[var(--ink-3)]">
              {nguoiNhan} · theo phiên đăng nhập
            </span>
          </Field>
        </FieldGrid>
      </FastTab>

      {boQuaTuDo > 0 && (
        <NoticeBar tone="warn" tag="Dòng tự do" action={{ label: 'Xem ở đơn mua' }}>
          Đơn có <b>{boQuaTuDo}</b> dòng tự do (gỗ / gia công không mã vật tư) — nghiệm
          thu ở trang đơn, không lên phiếu nhập.
        </NoticeBar>
      )}

      <GridToolbar
        count={`${rows.length} dòng · ${rows.filter((r) => !r.editable).length} đã đủ`}
      >
        <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
          Nhận theo phần <b>còn mở</b> của {dot ? 'đợt' : 'đơn'} — dòng đã đủ không có ô
          nhập
        </span>
      </GridToolbar>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <Grid minWidth={980}>
          <GridHead>
            <Th width={30}>#</Th>
            <Th width={96}>Mã</Th>
            <Th>Tên vật tư</Th>
            <Th width={52}>ĐVT</Th>
            <Th num width={80}>
              Đặt
            </Th>
            <Th num width={80}>
              Đã về
            </Th>
            <Th num width={110}>
              Lần này
            </Th>
            <Th width={146}>Tình trạng</Th>
            <Th width={300}>Ghi chú</Th>
          </GridHead>
          <GridBody>
            {rows.map((r, i) => {
              const vuot = r.editable ? danhGiaVuot(r) : null
              return (
                <GridRow key={r.po_line_id}>
                  <td className="k-c-n">{i + 1}</td>
                  <td>
                    <Code>{r.code}</Code>
                  </td>
                  <td className="max-w-0 truncate" title={r.name}>
                    {r.name}
                  </td>
                  <td className="text-[var(--ink-3)]">{r.unit}</td>
                  <td className="k-r num">{fmt(r.qty_ordered)}</td>
                  <td className="k-r num text-[var(--ink-3)]">{fmt(r.qty_received)}</td>
                  <td className="k-r">
                    {r.editable ? (
                      <>
                        <NumInput
                          id={`lan-nay-${i}`}
                          value={String(r.qty)}
                          onCommit={(v) =>
                            patch(i, {
                              qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                            })
                          }
                          aria-label={`Lần này ${r.code}`}
                        />
                        {r.status === 'blocked' && r.qty > 0 && (
                          <CellHint tone="warn">
                            {fmt(r.qty)} {r.unit} vào KHOÁ
                          </CellHint>
                        )}
                        {vuot && (
                          <CellHint tone={vuot.trong_dung_sai ? 'neutral' : 'warn'}>
                            vượt {vuot.pct.toFixed(0)}% ·{' '}
                            {vuot.trong_dung_sai
                              ? `trong dung sai ${r.over_tolerance_pct}%`
                              : `dung sai ${r.over_tolerance_pct}% · cần lý do`}
                          </CellHint>
                        )}
                      </>
                    ) : (
                      <LineStatus kind={r.closed_short ? 'short' : 'done'}>
                        {r.closed_short ? 'đã chốt thiếu' : 'đã đủ'}
                      </LineStatus>
                    )}
                  </td>
                  <td>
                    {r.editable ? (
                      <Pick
                        value={r.status}
                        onChange={(v) => patch(i, { status: v as TinhTrang })}
                        options={TINH_TRANG}
                        label={`Tình trạng ${r.code}`}
                        width={130}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </td>
                  <td>
                    {r.editable ? (
                      <TextInput
                        id={`ghi-chu-${i}`}
                        value={r.note}
                        onCommit={(v) => patch(i, { note: v })}
                        placeholder={
                          r.status === 'blocked'
                            ? 'bắt buộc: vì sao sai quy cách'
                            : 'ghi chú (không bắt buộc)'
                        }
                        label={`Ghi chú ${r.code}`}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </td>
                </GridRow>
              )
            })}
          </GridBody>
          <GridFoot>
            <td colSpan={4}>Tổng</td>
            <td className="k-r num">{fmt(tong.tong_dat)}</td>
            <td className="k-r num">{fmt(tong.tong_da_ve)}</td>
            <td className="k-r num">{fmt(tong.lan_nay)}</td>
            <td colSpan={2} className="font-normal text-[var(--ink-3)]">
              {tong.so_dong_nhan} dòng nhận · {fmt(tong.vao_khoa)} vào khoá ·{' '}
              {fmt(tong.dung_duoc)} dùng được
            </td>
          </GridFoot>
        </Grid>
      </div>

      <CommitBar
        totals={[
          { label: 'Dòng nhận', value: tong.so_dong_nhan },
          { label: 'Lần này', value: fmt(tong.lan_nay) },
          { label: 'Vào khoá', value: fmt(tong.vao_khoa) },
        ]}
        grand={{ label: 'Dùng được', value: fmt(tong.dung_duoc) }}
        blocked={blocked}
        onGoBlocked={kiem.ok ? undefined : nhayToi}
        actions={
          <Action primary disabled title={blocked}>
            Ghi sổ
          </Action>
        }
      />
      <StatusBar
        left={[
          'Hàng đạt vào khu tiếp nhận · hàng sai quy cách vào kệ khoá · tồn chỉ đổi khi ghi sổ',
          'Số Đặt / Đã về cùng nguồn với trang đơn mua',
        ]}
        right={`${rows.length} dòng`}
      />
    </div>
  )
}
