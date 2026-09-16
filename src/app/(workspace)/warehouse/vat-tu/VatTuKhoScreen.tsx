'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  NoticeBar,
  NumInput,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  THead,
  Table,
  TextInput,
} from '@/components/kit'
import { RO_VT, RO_VT_NHAN, RO_VT_VIEC, type RoVatTu } from './ro-vat-tu'

export type VatTuRow = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  shelf_location: string | null
  min_stock: number
  needs_review: boolean
  is_active: boolean
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/**
 * DANH MỤC VẬT TƯ — bản của Kho (Bước 4). Artboard 5:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * BA Ô SỬA THẲNG TRÊN DÒNG (ĐVT · Kệ · Ngưỡng) — rời ô là `PATCH
 * materials/[id]`, sổ vết 0177 tự ghi. Không mở hộp thoại cho ba ô này: Kho
 * khai một lượt mấy chục mã, mỗi mã một hộp thoại là mấy chục lần bấm thừa.
 *
 * Danh mục KHÔNG có vòng đời duyệt (nguyên lý "danh mục ≠ chứng từ"): sửa tại
 * chỗ, có vết, không có nút "gửi duyệt". Cờ `needs_review` không phải một bậc
 * duyệt — nó là hàng đợi việc "Cung ứng khai vội, Kho xác nhận lại".
 */
export function VatTuKhoScreen({
  rows: initialRows,
  counts,
  total,
  trang,
  soTrang,
  ro,
  q: qUrl,
  nhom,
  nhomOptions,
  dvtOptions,
  canEdit,
}: {
  rows: VatTuRow[]
  counts: Record<RoVatTu, number>
  total: number
  trang: number
  soTrang: number
  ro: RoVatTu
  q: string
  nhom: string
  nhomOptions: string[]
  dvtOptions: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const toast = useToast()
  const [q, setQ] = useState(qUrl)
  const [rows, setRows] = useState(initialRows)
  const [busy, setBusy] = useState<string | null>(null)

  // Dữ liệu server đổi (đổi rổ, sang trang) thì vẽ lại lưới — chỉnh state ngay
  // trong lượt render, không `useEffect` (lệ của kit: xem DateInput).
  const [seen, setSeen] = useState(initialRows)
  if (seen !== initialRows) {
    setSeen(initialRows)
    setRows(initialRows)
  }

  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  /** Ghi một trường của một mã. Lưới cập nhật LẠC QUAN, hỏng thì trả về cũ. */
  async function ghi(id: string, patch: Partial<VatTuRow>, nhan: string) {
    const truoc = rows.find((r) => r.id === id)
    if (!truoc) return
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setBusy(id)
    try {
      await api(`/api/dept/warehouse/materials/${id}`, { method: 'PATCH', body: patch })
    } catch (e) {
      setRows((rs) => rs.map((r) => (r.id === id ? truoc : r)))
      toast.error(`Không lưu được ${nhan} của ${truoc.code}`, apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function daRaXong(r: VatTuRow) {
    await ghi(r.id, { needs_review: false }, 'cờ chờ rà')
    toast.success(`${r.code} đã rà xong`, 'Mã này rời khỏi rổ “Chờ Kho rà” khi tải lại.')
    router.refresh()
  }

  const dangLoc = qUrl.trim() !== '' || nhom !== ''
  const viec = RO_VT_VIEC[ro]

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Danh mục vật tư"
          facts={[
            {
              label: 'Chờ Kho rà',
              value: fmt(counts.review),
              tone: counts.review > 0 ? 'warn' : 'neutral',
            },
            { label: 'Chưa khai ngưỡng', value: fmt(counts.no_min) },
            { label: 'Tất cả', value: fmt(counts.all) },
          ]}
          actions={<Btn href="/warehouse/ton">Xem tồn kho ›</Btn>}
        />

        <FilterBar>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm mã hoặc tên vật tư…"
            width={280}
          />
          <Btn onClick={() => dat({ q: q.trim() || null })}>Tìm</Btn>
          <Pick
            value={nhom}
            onChange={(v) => dat({ nhom: v || null })}
            options={[
              { value: '', label: 'Mọi nhóm vật tư' },
              ...nhomOptions.map((g) => ({ value: g, label: g })),
            ]}
            label="Nhóm vật tư"
            width={190}
          />
          {RO_VT.map((id) => (
            <Chip
              key={id}
              on={ro === id}
              count={counts[id]}
              onClick={() => dat({ ro: id === 'review' ? null : id })}
            >
              {RO_VT_NHAN[id]}
            </Chip>
          ))}
        </FilterBar>

        {viec && (
          <NoticeBar
            tone="warn"
            tag={RO_VT_NHAN[ro]}
            action={{ label: 'Xem tất cả', onClick: () => dat({ ro: 'all' }) }}
          >
            {viec}
          </NoticeBar>
        )}

        {!canEdit && (
          <NoticeBar
            tone="warn"
            tag="Chỉ xem"
            action={{ label: 'Về Tồn kho', onClick: () => router.push('/warehouse/ton') }}
          >
            Đơn vị tính · kệ · ngưỡng là trường của Kho. Tài khoản này xem được nhưng
            không sửa được ở đây.
          </NoticeBar>
        )}

        {rows.length === 0 ? (
          <Empty
            headline={`Không có mã nào trong rổ “${RO_VT_NHAN[ro]}”`}
            reason={
              ro === 'review'
                ? 'Không còn mã nào chờ Kho rà — Cung ứng chưa khai mã mới nào từ lần rà trước.'
                : dangLoc
                  ? 'Rổ này trống với bộ lọc hiện tại. Bỏ lọc để xem lại.'
                  : `Rổ này trống. Danh mục đang có ${fmt(counts.all)} mã.`
            }
            next={
              dangLoc ? (
                <Btn primary onClick={() => dat({ q: null, nhom: null })}>
                  Bỏ lọc
                </Btn>
              ) : (
                <Btn primary onClick={() => dat({ ro: 'all' })}>
                  Xem tất cả {fmt(counts.all)} mã
                </Btn>
              )
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Mã</th>
              <th>Tên vật tư</th>
              <th>ĐVT</th>
              <th>Nhóm</th>
              <th>Kệ gợi ý</th>
              <th style={{ textAlign: 'right' }}>Ngưỡng tối thiểu</th>
              <th />
            </THead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.id}>
                  <Cell pin>
                    <Code>{r.code}</Code>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                  </Cell>
                  <Cell>
                    {canEdit ? (
                      <Pick
                        value={r.unit}
                        onChange={(v) => void ghi(r.id, { unit: v }, 'đơn vị tính')}
                        options={
                          dvtOptions.includes(r.unit)
                            ? dvtOptions.map((u) => ({ value: u, label: u }))
                            : [
                                { value: r.unit, label: r.unit },
                                ...dvtOptions.map((u) => ({ value: u, label: u })),
                              ]
                        }
                        label={`Đơn vị tính ${r.code}`}
                        width={92}
                        disabled={busy === r.id}
                      />
                    ) : (
                      r.unit
                    )}
                  </Cell>
                  <Cell muted>
                    <span className="block truncate" title={r.group_name ?? ''}>
                      {r.group_name ?? '—'}
                    </span>
                    <span className="block text-[10.5px] text-[var(--ink-3)]">
                      {r.sub_group ?? 'chưa có nhóm phụ'}
                    </span>
                  </Cell>
                  <Cell>
                    {canEdit ? (
                      <TextInput
                        value={r.shelf_location ?? ''}
                        onCommit={(v) =>
                          void ghi(r.id, { shelf_location: v.trim() || null }, 'kệ gợi ý')
                        }
                        placeholder="chưa khai"
                        mono
                        label={`Kệ gợi ý ${r.code}`}
                        disabled={busy === r.id}
                        style={{ width: 92 }}
                      />
                    ) : (
                      (r.shelf_location ?? (
                        <span className="text-[var(--ink-empty)]">—</span>
                      ))
                    )}
                  </Cell>
                  <Cell>
                    {canEdit ? (
                      <NumInput
                        value={String(r.min_stock)}
                        onCommit={(v) =>
                          void ghi(
                            r.id,
                            {
                              min_stock:
                                Number(v.replace(/\./g, '').replace(',', '.')) || 0,
                            },
                            'ngưỡng tối thiểu',
                          )
                        }
                        aria-label={`Ngưỡng tối thiểu ${r.code}`}
                        disabled={busy === r.id}
                      />
                    ) : (
                      <span className="num">{fmt(r.min_stock)}</span>
                    )}
                  </Cell>
                  <Cell>
                    <span className="flex items-center justify-end gap-2">
                      {r.needs_review && canEdit && (
                        <Btn
                          primary
                          disabled={busy === r.id}
                          onClick={() => void daRaXong(r)}
                          className="h-6 px-[9px] text-[12px]"
                        >
                          Đã rà xong
                        </Btn>
                      )}
                      <Btn
                        href={`/warehouse/ton?ro=all&q=${encodeURIComponent(r.code)}`}
                        className="h-6 px-[9px] text-[12px]"
                      >
                        Xem tồn
                      </Btn>
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}

        {soTrang > 1 && (
          <div className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[6px] text-[var(--fs-sm)]">
            <span className="text-[var(--ink-3)]">Trang</span>
            <Btn
              disabled={trang <= 1}
              onClick={() => dat({ trang: String(trang - 1) })}
              className="h-6 px-[9px] text-[12px]"
            >
              ‹ Trước
            </Btn>
            <span className="num">
              {trang} / {soTrang}
            </span>
            <Btn
              disabled={trang >= soTrang}
              onClick={() => dat({ trang: String(trang + 1) })}
              className="h-6 px-[9px] text-[12px]"
            >
              Sau ›
            </Btn>
            <span className="ml-auto text-[var(--ink-3)]">50 dòng mỗi trang</span>
          </div>
        )}

        <StatusBar
          left={[
            'Danh mục sửa tại chỗ — rời ô là lưu, mọi lượt sửa vào sổ vết',
            'Giá mua · nhà cung cấp · mẫu đơn là của Cung ứng, không sửa ở đây',
          ]}
          right={`${rows.length} / ${fmt(total)} mã`}
        />
      </ScreenFrame>
    </div>
  )
}
