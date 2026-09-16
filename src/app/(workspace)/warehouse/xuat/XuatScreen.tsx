'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  LY_DO_XUAT_LE,
  lyDoCanLenh,
  themDong,
  thieuTon,
  tinhTongXuat,
  type DongXuat,
  type LoaiXuat,
  type VatTuChon,
} from '@/lib/kho-phieu-xuat'
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
  GridToolbar,
  HeadChips,
  HeadField,
  Lookup,
  NumInput,
  Pick,
  PickFind,
  StatusBar,
  StatusTrack,
  TextInput,
  Th,
} from '@/components/kit'

const fmt = (n: number) => n.toLocaleString('vi-VN')

type LsxOpt = { id: string; code: string; customer_name: string }

/**
 * PHIẾU XUẤT — Khuôn F (bảng nhập liệu), Bước 2 Kho việc 2.
 *
 * Lưới là nhân vật chính; đầu phiếu co thành dải chip vì mỗi hàng đầu trang
 * là một hàng lưới bị lấy mất. Thêm dòng bằng Ô TÌM VẬT TƯ ở cuối lưới (gõ mã
 * hoặc tên, chọn là thành dòng, tồn dùng được tra ngay lúc đó). Một mã một
 * dòng — chọn lại mã đã có thì nhảy tới dòng cũ.
 *
 * Việc 2 dừng ở form: thanh chốt mới có tổng; câu chặn + Ghi sổ là việc 3–4.
 */
export function XuatScreen({
  lsx,
  to,
  today,
  nguoiLap,
  canEdit,
}: {
  lsx: LsxOpt[]
  to: string[]
  today: string
  nguoiLap: string
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [loai, setLoai] = useState<LoaiXuat>('lsx')
  const [lsxId, setLsxId] = useState('')
  const [lyDo, setLyDo] = useState('')
  const [nguoiNhan, setNguoiNhan] = useState('')
  const [docDate, setDocDate] = useState(today)
  const [rows, setRows] = useState<DongXuat[]>([])
  const [dangTra, setDangTra] = useState(false)

  const patch = (i: number, p: Partial<DongXuat>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const tong = useMemo(() => tinhTongXuat(rows), [rows])
  const canLenh = loai === 'lsx' || lyDoCanLenh(lyDo)
  const lsxChon = lsx.find((l) => l.id === lsxId) ?? null

  async function timVatTu(q: string): Promise<VatTuChon[]> {
    const res = await api<{ rows: VatTuChon[] }>(
      `/api/dept/warehouse/materials?q=${encodeURIComponent(q)}&active_only=true&page_size=20`,
    )
    return res.rows.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit }))
  }

  async function chonVatTu(vt: VatTuChon) {
    // Tra tồn TRƯỚC khi thêm dòng — dòng sinh ra đã mang số tồn, không có
    // khoảng "đang tải" mà người dùng gõ số vào rồi mới thấy thiếu.
    setDangTra(true)
    let qty_ok: number | null = null
    try {
      const res = await api<{ rows: { material_id: string; qty_ok: number }[] }>(
        `/api/dept/warehouse/stock/ton?ids=${vt.id}`,
      )
      qty_ok = res.rows[0]?.qty_ok ?? 0
    } catch (e) {
      toast.error('Không tra được tồn', apiErrorText(e))
    } finally {
      setDangTra(false)
    }
    const r = themDong(rows, vt, qty_ok)
    if (r.trung)
      toast.error(
        `${vt.code} đã có ở dòng ${r.index + 1}`,
        'Một mã một dòng — sửa số ở dòng đó.',
      )
    else setRows(r.rows)
    setTimeout(() => {
      const el = document.getElementById(`xuat-qty-${r.index}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 0)
  }

  const lamMoi = () => {
    setRows([])
    setNguoiNhan('')
    setLyDo('')
    setLsxId('')
  }

  const blocked = !canEdit
    ? 'Tài khoản này không có quyền ghi sổ kho'
    : 'Ghi sổ nối ở việc số 4 của Bước 2 — form đang là việc 2'

  const sub =
    loai === 'lsx'
      ? lsxChon
        ? `Cấp cho lệnh ${lsxChon.code} · ${lsxChon.customer_name}`
        : 'Cấp cho lệnh sản xuất — chưa chọn lệnh'
      : `Xuất lẻ${lyDo ? ` · ${LY_DO_XUAT_LE.find((x) => x.ma === lyDo)?.nhan ?? lyDo}` : ' — chưa chọn lý do'}`

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <Crumb path={[{ label: 'Kho', href: '/warehouse/nhap' }, 'Xuất kho']} />
      <ActionPane>
        <ActionGroup label="Phiếu">
          <Action primary disabled title={blocked}>
            Ghi sổ
          </Action>
          <Action onClick={lamMoi} disabled={rows.length === 0 && !nguoiNhan}>
            Làm mới
          </Action>
        </ActionGroup>
        <ActionGroup label="Sổ">
          <Action onClick={() => router.push('/planning/docs?kind=issue')}>
            Sổ phiếu xuất
          </Action>
        </ActionGroup>
      </ActionPane>
      <DocHead
        compact
        kind="Phiếu xuất kho · theo thực tế lấy"
        code="PXK-…"
        sub={`${sub} · số phiếu cấp khi ghi sổ · người lập ${nguoiLap}`}
      >
        <StatusTrack label="Phiếu" steps={['Đang lập', 'Đã ghi sổ']} at={0} />
      </DocHead>

      <HeadChips>
        <HeadField label="Loại xuất" need>
          <Pick
            value={loai}
            onChange={(v) => {
              setLoai(v as LoaiXuat)
              if (v === 'lsx') setLyDo('')
            }}
            options={[
              { value: 'lsx', label: 'Cho lệnh sản xuất' },
              { value: 'daily', label: 'Xuất lẻ' },
            ]}
            label="Loại xuất"
            width={170}
          />
        </HeadField>
        {loai === 'daily' && (
          <HeadField label="Lý do" need empty={!lyDo}>
            <Pick
              value={lyDo}
              onChange={setLyDo}
              options={[
                { value: '', label: '— chọn lý do —' },
                ...LY_DO_XUAT_LE.map((x) => ({
                  value: x.ma,
                  label: `${x.ma} · ${x.nhan}`,
                })),
              ]}
              label="Lý do xuất lẻ"
              width={260}
            />
          </HeadField>
        )}
        {canLenh && (
          <HeadField label="Lệnh SX" need empty={!lsxId}>
            <PickFind
              value={lsxId}
              onChange={setLsxId}
              options={lsx.map((l) => ({
                value: l.id,
                label: l.code,
                hint: l.customer_name,
              }))}
              label="Lệnh sản xuất"
              placeholder="gõ số lệnh hoặc khách…"
              width={260}
              emptyLabel="— chọn lệnh —"
            />
          </HeadField>
        )}
        <HeadField label="Tổ / người nhận" need empty={!nguoiNhan.trim()}>
          <TextInput
            value={nguoiNhan}
            onCommit={setNguoiNhan}
            placeholder="Tổ Hàn, Tổ Phôi… hoặc tên người"
            label="Tổ / người nhận"
            list="xuat-to-list"
            style={{ width: 220 }}
          />
          <datalist id="xuat-to-list">
            {to.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </HeadField>
        <HeadField label="Ngày chứng từ" need>
          <DateInput value={docDate} onChange={setDocDate} label="Ngày chứng từ" />
        </HeadField>
      </HeadChips>

      <GridToolbar count={`${rows.length} dòng`}>
        <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
          Gõ mã hoặc tên ở ô cuối lưới để thêm dòng · Tồn dùng được tra lúc thêm
        </span>
      </GridToolbar>

      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <Grid minWidth={900}>
          <GridHead>
            <Th width={30}>#</Th>
            <Th width={110}>Mã</Th>
            <Th>Tên vật tư</Th>
            <Th width={56}>ĐVT</Th>
            <Th num width={110}>
              Tồn dùng được
            </Th>
            <Th num width={110}>
              Lần này
            </Th>
            <Th width={260}>Ghi chú</Th>
            <Th width={60}></Th>
          </GridHead>
          <GridBody>
            {rows.map((r, i) => {
              const thieu = thieuTon(r)
              return (
                <GridRow key={r.id}>
                  <td className="k-c-n">{i + 1}</td>
                  <td>
                    <Code>{r.code}</Code>
                  </td>
                  <td className="max-w-0 truncate" title={r.name}>
                    {r.name}
                  </td>
                  <td className="text-[var(--ink-3)]">{r.unit}</td>
                  <td className="k-r num">
                    {r.qty_ok == null ? (
                      <span className="text-[var(--ink-empty)]">?</span>
                    ) : (
                      fmt(r.qty_ok)
                    )}
                  </td>
                  <td className="k-r">
                    <NumInput
                      id={`xuat-qty-${i}`}
                      value={String(r.qty)}
                      onCommit={(v) =>
                        patch(i, {
                          qty: Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                        })
                      }
                      aria-label={`Lần này ${r.code}`}
                    />
                    {thieu != null && (
                      <CellHint tone="warn">
                        tồn {fmt(r.qty_ok ?? 0)}, xuất {fmt(r.qty)} — thiếu {fmt(thieu)}
                      </CellHint>
                    )}
                  </td>
                  <td>
                    <TextInput
                      value={r.note}
                      onCommit={(v) => patch(i, { note: v })}
                      placeholder="ghi chú (không bắt buộc)"
                      label={`Ghi chú ${r.code}`}
                    />
                  </td>
                  <td>
                    <GridBtn
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      Xoá
                    </GridBtn>
                  </td>
                </GridRow>
              )
            })}
            <tr>
              <td className="k-c-n text-[var(--ink-3)]">+</td>
              <td colSpan={7} className="!py-[3px]">
                <Lookup<VatTuChon>
                  search={timVatTu}
                  onPick={(vt) => void chonVatTu(vt)}
                  keyOf={(m) => m.id}
                  render={(m) => (
                    <span className="flex items-baseline gap-2">
                      <Code>{m.code}</Code>
                      <span className="truncate">{m.name}</span>
                      <span className="text-[var(--ink-3)]">{m.unit}</span>
                    </span>
                  )}
                  placeholder={
                    dangTra
                      ? 'Đang tra tồn…'
                      : 'Gõ mã hoặc tên vật tư, Enter để thêm dòng…'
                  }
                  label="Tìm vật tư để thêm dòng"
                  width={420}
                  disabled={dangTra}
                />
              </td>
            </tr>
          </GridBody>
          <GridFoot>
            <td colSpan={5}>Tổng</td>
            <td className="k-r num">{fmt(tong.tong)}</td>
            <td colSpan={2} className="font-normal text-[var(--ink-3)]">
              {tong.so_dong} dòng có số · tổng cộng nhiều đơn vị khác nhau, chỉ để đếm
            </td>
          </GridFoot>
        </Grid>
      </div>

      <CommitBar
        totals={[
          { label: 'Dòng', value: rows.length },
          { label: 'Có số', value: tong.so_dong },
        ]}
        grand={{ label: 'Tổng lượng', value: fmt(tong.tong) }}
        blocked={blocked}
        actions={
          <Action primary disabled title={blocked}>
            Ghi sổ
          </Action>
        }
      />
      <StatusBar
        left={[
          loai === 'lsx'
            ? 'Cho lệnh: mã lý do X1 tự gắn, tiền vào giá thành lệnh'
            : 'Xuất lẻ: mã lý do người chọn, không vào giá thành lệnh',
          'Tồn chỉ đổi khi ghi sổ',
        ]}
        right={`${rows.length} dòng`}
      />
    </div>
  )
}
