'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Action,
  ActionGroup,
  ActionPane,
  type Check,
  Checks,
  CoverageBar,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  HolderBar,
  NumInput,
  Sheet,
  SheetActions,
  StatusBar,
  StatusTrack,
  Td,
  TextArea,
  Th,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { Stocktake, TakeLine } from '@/modules/dept/warehouse/stocktakes.repo'

/**
 * MỘT ĐỢT KIỂM KÊ — Khuôn D + F, dựng theo mẫu `/design-lab/kho/kiem-ke`.
 *
 * Bản đầu (15/09/2026) dựng bằng `ScreenHeader` + `Table` — tức khuôn DANH
 * SÁCH, không phải khuôn CHỨNG TỪ. Chủ dự án chỉ ra ngay: không giống mẫu.
 * Đúng, và sai ở chỗ nền: đợt kiểm kê CÓ vòng đời, có người giữ, có bảng
 * kiểm trước khi gửi — ba thứ mà khuôn danh sách không có chỗ để bày.
 *
 * Số sổ: server đã giấu nếu đợt đang đếm mù, nên `book_qty_frozen` null ở
 * đây có hai nghĩa (chưa chốt sổ, hoặc đang mù). Cả hai cùng một cách bày.
 */

const BUOC = ['Mở', 'Đang đếm', 'Đối chiếu', 'Đã duyệt']
const BUOC_AT: Record<Stocktake['status'], number> = {
  open: 0,
  counting: 1,
  review: 2,
  approved: 3,
  cancelled: 0,
}

const gio = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

const so = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function DotScreen({
  take,
  lines,
  progress,
  canEdit,
}: {
  take: Stocktake
  lines: TakeLine[]
  progress: {
    total: number
    counted: number
    remaining: number
    diff_count: number | null
  }
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  /** Số đang gõ, chưa lưu. Khoá theo line_id. */
  const [nhap, setNhap] = useState<Record<string, string>>({})
  const [tuChoi, setTuChoi] = useState(false)
  const [lyDo, setLyDo] = useState('')

  /** Đợt mù + đang đếm thì KHÔNG có cột Sổ — server không gửi số xuống. */
  const baySo = lines.some((l) => l.book_qty_frozen != null) || take.status === 'approved'
  const chuaLuu = Object.keys(nhap).length
  const chuaDem = progress.remaining

  const tongLech = useMemo(() => {
    if (!baySo) return null
    return lines.reduce((s, l) => {
      if (l.counted_qty == null || l.book_qty_frozen == null) return s
      return s + (l.counted_qty - l.book_qty_frozen)
    }, 0)
  }, [lines, baySo])

  /*
   * BẢNG KIỂM TRƯỚC KHI GỬI — nói vướng gì VÀ cách gỡ, ngay từ lúc mở màn.
   * Web hay làm ngược: cho bấm rồi mới báo lỗi.
   */
  const checks = useMemo<Check[]>(() => {
    const out: Check[] = []
    if (take.status === 'open') {
      out.push({
        level: 'stop',
        what: 'Sổ chưa đóng băng — chưa có danh sách đếm',
        fix: 'Bấm “Chốt sổ & bắt đầu đếm” NGAY TRƯỚC khi ra kho. Chốt sớm rồi để cách vài tiếng thì mọi phiếu trong khoảng đó thành chênh lệch giả.',
      })
    }
    if (take.status === 'counting') {
      if (chuaLuu > 0) {
        out.push({
          level: 'stop',
          what: `${chuaLuu} dòng vừa gõ chưa lưu`,
          fix: 'Bấm “Lưu số đếm” ở nhóm Chốt — số chỉ vào sổ khi đã lưu.',
        })
      }
      if (chuaDem > 0) {
        out.push({
          level: 'stop',
          what: `Còn ${chuaDem}/${progress.total} mã chưa đếm`,
          fix: 'Đếm nốt, hoặc ghi 0 cho mã thật sự không còn hàng — bỏ trống KHÔNG phải là số không.',
        })
      }
      if (take.blind_count) {
        out.push({
          level: 'warn',
          what: 'Đợt này đếm mù — cột Sổ bị giữ lại ở máy chủ',
          fix: 'Gõ đúng số đếm được ngoài kệ. Số sổ chỉ hiện sau khi gửi đối chiếu.',
        })
      }
    }
    if (take.status === 'review' && (progress.diff_count ?? 0) > 0) {
      out.push({
        level: 'warn',
        what: `${progress.diff_count} mã lệch so với sổ chốt`,
        fix: 'Duyệt sẽ sinh phiếu điều chỉnh: mã thừa → dòng nhập N4, mã thiếu → dòng xuất X5.',
      })
    }
    return out
  }, [take.status, take.blind_count, chuaLuu, chuaDem, progress])

  const chanGui = chuaLuu > 0 || chuaDem > 0

  async function goi<T>(url: string, body?: unknown): Promise<T | null> {
    setBusy(true)
    try {
      const out = await api<T>(url, { method: 'POST', body: body ?? {} })
      router.refresh()
      return out
    } catch (err) {
      toast.error(
        'Không thực hiện được',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
      return null
    } finally {
      setBusy(false)
    }
  }

  async function chotSo() {
    const out = await goi<{ lines: number }>(
      `/api/dept/warehouse/stocktakes/${take.id}/start`,
    )
    if (out) toast.success('Đã chốt sổ', `${out.lines} mã vào danh sách đếm`)
  }

  async function luuSoDem() {
    const counts = Object.entries(nhap)
      .map(([line_id, v]) => ({ line_id, counted_qty: Number(v) }))
      .filter((c) => Number.isFinite(c.counted_qty) && c.counted_qty >= 0)
    if (counts.length === 0) return
    const out = await goi<{ saved: number }>(
      `/api/dept/warehouse/stocktakes/${take.id}/counts`,
      { counts },
    )
    if (out) {
      setNhap({})
      toast.success(`Đã lưu ${out.saved} dòng`)
    }
  }

  async function guiDoiChieu() {
    const out = await goi(`/api/dept/warehouse/stocktakes/${take.id}/submit`)
    if (out) toast.success('Đã gửi đối chiếu')
  }

  async function duyet() {
    const out = await goi<{ doc_code: string; applied: number }>(
      `/api/dept/warehouse/stocktakes/${take.id}/decide`,
      { decision: 'approve' },
    )
    if (out) {
      toast.success(
        `Đã duyệt — phiếu ${out.doc_code}`,
        out.applied === 0
          ? 'Không mã nào lệch, tồn giữ nguyên'
          : `${out.applied} mã được điều chỉnh`,
      )
    }
  }

  async function guiTuChoi() {
    const out = await goi(`/api/dept/warehouse/stocktakes/${take.id}/decide`, {
      decision: 'reject',
      reason: lyDo.trim(),
    })
    if (out) {
      setTuChoi(false)
      setLyDo('')
      toast.success('Đã trả về để đếm lại')
    }
  }

  const phamVi =
    take.scope_kind === 'group'
      ? ((take.scope_ref as { groups?: string[] }).groups ?? []).join(' · ')
      : take.scope_kind === 'bin'
        ? `${((take.scope_ref as { bin_ids?: string[] }).bin_ids ?? []).length} khu`
        : `Danh sách ${((take.scope_ref as { material_ids?: string[] }).material_ids ?? []).length} mã`

  /*
    Vỏ khu Kho là theme v3; `DocScreen` tự gắn lớp `kit`. `-m-6` khử padding
    của <main> để tờ chứng từ tràn sát mép — cùng cách `PoDetailScreen` làm.
  */
  return (
    <div className="theme-v3 text-foreground -m-6">
      <DocScreen>
        <Crumb
          path={['Kho', { label: 'Đợt kiểm kê', href: '/warehouse/kiem-ke' }, take.code]}
        />

        <ActionPane>
          <ActionGroup label="Đợt">
            <Action
              strong
              disabled={!canEdit || take.status !== 'open' || busy}
              title={take.status !== 'open' ? 'Đợt đã chốt sổ — phạm vi không đổi được nữa' : undefined} // prettier-ignore
              onClick={chotSo}
            >
              Chốt sổ &amp; bắt đầu đếm
            </Action>
            <Action
              disabled={!canEdit || take.status === 'approved' || busy}
              title={take.status === 'approved' ? 'Đợt đã duyệt — sai thì đảo phiếu KK' : undefined} // prettier-ignore
              onClick={() => router.push('/warehouse/kiem-ke')}
            >
              Danh sách đợt
            </Action>
          </ActionGroup>

          <ActionGroup label="Chốt">
            <Action
              disabled={!canEdit || take.status !== 'counting' || chuaLuu === 0 || busy}
              title={chuaLuu === 0 ? 'Chưa gõ thêm số nào' : undefined}
              onClick={luuSoDem}
            >
              Lưu số đếm{chuaLuu > 0 ? ` (${chuaLuu})` : ''}
            </Action>
            <Action
              primary
              disabled={!canEdit || take.status !== 'counting' || chanGui || busy}
              title={chanGui ? 'Còn lỗi chặn — xem bảng kiểm phía trên' : undefined}
              onClick={guiDoiChieu}
            >
              Gửi đối chiếu
            </Action>
            <Action
              disabled={!canEdit || take.status !== 'review' || busy}
              title={take.status !== 'review' ? 'Chỉ duyệt được sau bước đối chiếu' : undefined} // prettier-ignore
              onClick={duyet}
            >
              Duyệt đợt
            </Action>
          </ActionGroup>

          <ActionGroup label="Khi không thuận">
            <Action
              disabled={!canEdit || take.status !== 'review' || busy}
              title={take.status !== 'review' ? 'Chỉ trả về được khi đang chờ đối chiếu' : undefined} // prettier-ignore
              onClick={() => setTuChoi(true)}
            >
              Trả về đếm lại
            </Action>
            {/* Tab/nút CHƯA có phân hệ hiện MỜ kèm lý do, không giấu đi. */}
            <Action disabled title="Chưa làm — phân công người đếm theo dòng">
              Chuyển người đếm
            </Action>
            <Action disabled title="Chưa làm — tách mã sang đợt sau">
              Tách mã sang đợt sau
            </Action>
          </ActionGroup>

          <ActionGroup label="In &amp; xuất">
            <Action disabled title="Chưa làm — phiếu đếm giấy cho người ra kho">
              Phiếu đếm giấy
            </Action>
            <Action
              disabled={!take.doc_code}
              title={take.doc_code ? undefined : 'Có sau khi duyệt'}
              onClick={() =>
                take.doc_code &&
                router.push(`/warehouse/docs?q=${encodeURIComponent(take.doc_code)}`)
              }
            >
              Biên bản kiểm kê
            </Action>
          </ActionGroup>
        </ActionPane>

        <DocHead
          compact
          kind="Đợt kiểm kê"
          code={take.code}
          sub={
            <>
              {phamVi} · <span className="num">{take.scope_count}</span> mã ·{' '}
              {take.blind_count ? 'đếm mù' : 'đếm mở'} · mở {gio(take.created_at) ?? '—'}
              {take.created_by_name ? ` bởi ${take.created_by_name}` : ''}
            </>
          }
        >
          <StatusTrack label="Đợt" steps={BUOC} at={BUOC_AT[take.status]} />
        </DocHead>

        <HolderBar
          mine={canEdit}
          who={
            take.status === 'review'
              ? 'Quản lý kho'
              : (take.assigned_to_name ?? 'Kho — chưa phân người đếm')
          }
          what={
            take.status === 'open'
              ? 'Chốt sổ rồi ra kệ đếm'
              : take.status === 'counting'
                ? chanGui
                  ? `Đếm nốt ${chuaDem} mã${chuaLuu > 0 ? ` và lưu ${chuaLuu} dòng vừa gõ` : ''}`
                  : 'Gửi đối chiếu để quản lý kho duyệt'
                : take.status === 'review'
                  ? 'Đối chiếu chênh lệch rồi duyệt'
                  : 'Đã xong — không còn việc'
          }
          age={gio(take.freeze_at) ? `chốt ${gio(take.freeze_at)}` : undefined}
        />

        <Checks
          title={
            checks.some((c) => c.level === 'stop')
              ? 'Chưa gửi đối chiếu được'
              : 'Đọc kỹ phần này trước'
          }
          items={checks}
        />

        <DocBody
          aside={
            <FactBox>
              <FactSection title="Phạm vi đợt">
                <FactKv
                  rows={[
                    ['Kiểu phạm vi', take.scope_kind === 'bin' ? 'Theo khu kệ' : take.scope_kind === 'group' ? 'Theo nhóm vật tư' : 'Danh sách mã'], // prettier-ignore
                    ['Phạm vi', phamVi],
                    ['Số mã', <span key="n" className="num">{take.scope_count}</span>], // prettier-ignore
                    ['Cách đếm', take.blind_count ? 'Mù (giấu số sổ)' : 'Mở'],
                  ]}
                />
              </FactSection>
              <FactSection title="Mốc thời gian">
                <FactKv
                  rows={[
                    ['Mở đợt', gio(take.created_at) ?? '—'],
                    ['Chốt sổ', gio(take.freeze_at) ?? 'chưa chốt'],
                    ['Duyệt', gio(take.approved_at) ?? '—'],
                  ]}
                />
              </FactSection>
              <FactSection title="Người">
                <FactKv
                  rows={[
                    ['Người mở', take.created_by_name ?? '—'],
                    ['Người đếm', take.assigned_to_name ?? 'chưa phân'],
                  ]}
                />
              </FactSection>
              {take.doc_code && (
                <FactSection title="Chứng từ sinh ra">
                  <FactKv
                    rows={[
                      [
                        <span key="k" className="num">{take.doc_code}</span>, // prettier-ignore
                        'Biên bản kiểm kê',
                      ],
                    ]}
                  />
                </FactSection>
              )}
            </FactBox>
          }
        >
          <FastTab
            title="Thông tin đợt"
            defaultOpen
            summary={[
              ['Trạng thái', BUOC[BUOC_AT[take.status]]],
              ['Đã đếm', `${progress.counted}/${progress.total}`],
            ]}
          >
            <FieldGrid>
              <Field label="Mã đợt">
                <span className="num">{take.code}</span>
              </Field>
              <Field label="Kiểu phạm vi">
                {take.scope_kind === 'bin'
                  ? 'Theo khu kệ'
                  : take.scope_kind === 'group'
                    ? 'Theo nhóm vật tư'
                    : 'Danh sách mã'}
              </Field>
              <Field label="Phạm vi">{phamVi}</Field>
              <Field label="Số mã trong phạm vi">
                <span className="num">{take.scope_count}</span>
              </Field>
              <Field label="Chốt sổ lúc" tone={take.freeze_at ? undefined : 'warn'}>
                {gio(take.freeze_at) ?? 'chưa chốt'}
              </Field>
              <Field label="Cách đếm" tone={take.blind_count ? undefined : 'warn'}>
                {take.blind_count ? 'Mù — giấu số sổ' : 'Mở — bày số sổ'}
              </Field>
              <Field label="Người mở">{take.created_by_name ?? '—'}</Field>
              <Field label="Người đếm">{take.assigned_to_name ?? 'chưa phân'}</Field>
              {take.reject_reason && (
                <Field label="Bị trả về" tone="stop">
                  {take.reject_reason}
                </Field>
              )}
              {take.note && <Field label="Ghi chú">{take.note}</Field>}
            </FieldGrid>
          </FastTab>

          <FastTab
            title="Lưới đếm"
            defaultOpen
            flush
            summary={[
              ['Đã đếm', `${progress.counted}/${progress.total}`],
              [
                'Dòng lệch',
                progress.diff_count == null ? '—' : String(progress.diff_count),
              ],
            ]}
            actions={
              progress.total > 0 ? (
                <CoverageBar
                  ratio={progress.total > 0 ? progress.counted / progress.total : 0}
                  label={`${progress.counted}/${progress.total}`}
                />
              ) : undefined
            }
          >
            {lines.length === 0 ? (
              <p className="px-[var(--gutter)] py-3 text-[12.5px] text-[var(--ink-3)]">
                Đợt đã chốt phạm vi {take.scope_count} mã nhưng chưa chốt sổ — danh sách
                đếm chỉ sinh ra khi bấm “Chốt sổ &amp; bắt đầu đếm”.
              </p>
            ) : (
              <Grid minWidth={baySo ? 900 : 760}>
                <GridHead>
                  <Th width={110}>Mã</Th>
                  <Th>Tên vật tư</Th>
                  {baySo && (
                    <Th num width={110}>
                      Sổ (chốt)
                    </Th>
                  )}
                  <Th num width={110}>
                    Đếm
                  </Th>
                  {baySo && (
                    <Th num width={90}>
                      Lệch
                    </Th>
                  )}
                  <Th width={70}>ĐVT</Th>
                </GridHead>
                <GridBody>
                  {lines.map((l) => {
                    const dangGo = nhap[l.id]
                    const n = dangGo != null ? Number(dangGo) : l.counted_qty
                    const lech =
                      baySo && n != null && l.book_qty_frozen != null
                        ? n - l.book_qty_frozen
                        : null
                    return (
                      <GridRow key={l.id}>
                        <Td>
                          <span className="num">{l.material_code ?? '—'}</span>
                        </Td>
                        <Td>{l.material_name ?? '—'}</Td>
                        {baySo && <Td num>{so(l.book_qty_frozen ?? 0)}</Td>}
                        <Td num>
                          {canEdit && take.status === 'counting' ? (
                            <NumInput
                              value={dangGo ?? (l.counted_qty == null ? '' : String(l.counted_qty))} // prettier-ignore
                              onCommit={(v) =>
                                setNhap((s) => {
                                  // Xoá trắng = huỷ sửa, KHÔNG phải gõ 0.
                                  if (v.trim() === '') {
                                    const { [l.id]: _bo, ...con } = s
                                    return con
                                  }
                                  return { ...s, [l.id]: v }
                                })
                              }
                              aria-label={`Số đếm ${l.material_code ?? l.material_id}`}
                            />
                          ) : l.counted_qty == null ? (
                            <span className="text-[var(--ink-3)]">chưa đếm</span>
                          ) : (
                            so(l.counted_qty)
                          )}
                        </Td>
                        {baySo && (
                          <Td
                            num
                            tone={lech == null || lech === 0 ? undefined : lech > 0 ? 'warn' : 'stop'} // prettier-ignore
                          >
                            {lech == null
                              ? '—'
                              : lech === 0
                                ? '0'
                                : `${lech > 0 ? '+' : ''}${so(lech)}`}
                          </Td>
                        )}
                        <Td>{l.material_unit ?? ''}</Td>
                      </GridRow>
                    )
                  })}
                </GridBody>
                {baySo && tongLech != null && (
                  <GridFoot>
                    <Td colSpan={2}>Tổng chênh lệch</Td>
                    <Td num />
                    <Td num />
                    <Td num tone={tongLech === 0 ? undefined : 'warn'}>
                      {tongLech > 0 ? '+' : ''}
                      {so(tongLech)}
                    </Td>
                    <Td />
                  </GridFoot>
                )}
              </Grid>
            )}
          </FastTab>
        </DocBody>

        <StatusBar
          left={[
            `Đợt ${take.code}`,
            BUOC[BUOC_AT[take.status]],
            `${progress.counted}/${progress.total} đã đếm`,
            take.blind_count ? 'đếm mù' : 'đếm mở',
            chuaLuu > 0 ? `${chuaLuu} dòng chưa lưu` : 'đã lưu hết',
          ]}
          right={take.freeze_at ? `sổ chốt ${gio(take.freeze_at)}` : 'sổ chưa đóng băng'}
        />
      </DocScreen>

      <Sheet
        open={tuChoi}
        onClose={() => setTuChoi(false)}
        title="Trả về để đếm lại"
        subtitle="Đợt quay về Đang đếm, số đã đếm giữ nguyên — không phải đếm lại từ đầu."
        stakes="nang"
        footer={
          <SheetActions
            onCancel={() => setTuChoi(false)}
            onConfirm={guiTuChoi}
            confirmLabel="Trả về"
            stakes="nang"
            busy={busy}
            disabled={!lyDo.trim()}
          />
        }
      >
        <label className="flex flex-col gap-1.5 font-semibold text-[var(--fs-sm)]">
          Lý do — người đếm cần biết đếm lại chỗ nào
          <TextArea
            value={lyDo}
            onChange={setLyDo}
            rows={3}
            placeholder="Khu A-03 lệch bất thường, đếm lại giúp…"
          />
        </label>
      </Sheet>
    </div>
  )
}
