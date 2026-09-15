'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Code,
  CoverageBar,
  Empty,
  NoticeBar,
  Num,
  NumInput,
  Row,
  ScreenHeader,
  Sheet,
  SheetActions,
  StatusTrack,
  THead,
  Table,
  Tag,
  TextArea,
  WhyBox,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { Stocktake, TakeLine } from '@/modules/dept/warehouse/stocktakes.repo'

/**
 * MỘT ĐỢT KIỂM KÊ — Khuôn D + F.
 *
 * Lưới là nhân vật chính (khuôn F), đầu đợt co thành một dải chip, và thanh
 * chốt đáy nói VÌ SAO chưa gửi được bằng một câu bấm được.
 *
 * Số sổ: server đã giấu nếu đợt đang đếm mù, nên `book_qty_frozen` null ở đây
 * có hai nghĩa — chưa chốt sổ, hoặc đang mù. Cả hai đều dẫn tới cùng một cách
 * bày (không có cột Sổ), nên màn không cần phân biệt.
 */

const BUOC = ['Mở', 'Đang đếm', 'Đối chiếu', 'Đã duyệt'] as const
const BUOC_AT: Record<Stocktake['status'], number> = {
  open: 0,
  counting: 1,
  review: 2,
  approved: 3,
  cancelled: 0,
}

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

  /** Đợt mù + đang đếm thì KHÔNG có cột Sổ và cột Lệch — server không gửi số. */
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

  /*
   * THANH CHỐT ĐÁY phải nói VÌ SAO chưa gửi được, bằng một câu BẤM ĐƯỢC —
   * không cho bấm rồi mới báo lỗi (luật kiểm của /design-lab).
   */
  const vuong =
    take.status !== 'counting'
      ? null
      : chuaLuu > 0
        ? `Còn ${chuaLuu} dòng vừa gõ chưa lưu`
        : chuaDem > 0
          ? `Còn ${chuaDem}/${progress.total} mã chưa đếm — bỏ trống không phải là số không`
          : null

  return (
    /*
      VỎ CỦA KHU KHO LÀ THEME V3, KHÔNG PHẢI VỎ KIT.

      Không dùng `ScreenFrame`: nó đo padding của cha rồi kéo lề âm + đặt
      chiều cao 100dvh, và trong `WorkspaceShell` v3 nó bóp luôn sidebar —
      nhãn menu cụt thành "T.", "N.", "C." (đo 15/09/2026). ScreenFrame chỉ
      chạy đúng dưới vỏ kit của khu (mua-hang).

      Lớp `kit` là BẮT BUỘC: token của bộ kit (--line, --act, --ink…) khai
      trong lớp đó. Thiếu nó thì mọi `var(--…)` ở đây rỗng và màn mất màu mà
      không báo gì. Cùng cách `PoDetailScreen` làm — màn kit đầu tiên sống
      trong khu v3.
    */
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-[calc(100dvh-4rem)] flex-col">
      <ScreenHeader
        compact
        eyebrow="Kho · Đợt kiểm kê"
        title={<Code>{take.code}</Code>}
        status={
          <StatusTrack label="Vòng đời" steps={[...BUOC]} at={BUOC_AT[take.status]} />
        }
        facts={[
          { label: 'Phạm vi', value: `${take.scope_count} mã` },
          { label: 'Đã đếm', value: `${progress.counted}/${progress.total}` },
          {
            label: 'Dòng lệch',
            // Đang mù thì server trả null — bày "—" chứ không bày 0, vì 0 ở
            // đây là một lời nói dối có tính thuyết phục cao.
            value: progress.diff_count == null ? '—' : String(progress.diff_count),
            tone:
              progress.diff_count != null && progress.diff_count > 0 ? 'warn' : undefined,
          },
          {
            label: 'Chốt sổ',
            value: take.freeze_at
              ? new Date(take.freeze_at).toLocaleString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'chưa chốt',
          },
        ]}
        actions={
          <>
            <Btn href="/warehouse/kiem-ke">← Danh sách đợt</Btn>
            {canEdit && take.status === 'open' && (
              <Btn primary onClick={chotSo}>
                Chốt sổ &amp; bắt đầu đếm
              </Btn>
            )}
            {canEdit && take.status === 'review' && (
              <>
                <Btn onClick={() => setTuChoi(true)}>Trả về đếm lại</Btn>
                <Btn primary onClick={duyet}>
                  Duyệt &amp; áp chênh lệch
                </Btn>
              </>
            )}
          </>
        }
      />

      {take.status === 'open' && (
        <NoticeBar
          tone="warn"
          tag="Chưa chốt sổ"
          action={{ label: 'Chốt sổ ngay', onClick: chotSo }}
        >
          Sổ CHƯA đóng băng. Bấm “Chốt sổ &amp; bắt đầu đếm” ngay trước khi ra kho — chốt
          sớm rồi để cách vài tiếng thì mọi phiếu trong khoảng đó biến thành chênh lệch
          giả.
        </NoticeBar>
      )}
      {take.status === 'counting' && take.blind_count && (
        <NoticeBar
          tone="neutral"
          tag="Đếm mù"
          action={{
            label: 'Xem danh sách đợt',
            onClick: () => router.push('/warehouse/kiem-ke'),
          }}
        >
          Đợt này ĐẾM MÙ: số sổ được giữ lại ở máy chủ, không gửi xuống màn hình. Gõ đúng
          số đếm được ngoài kệ.
        </NoticeBar>
      )}
      {take.reject_reason && take.status === 'counting' && (
        <NoticeBar tone="stop" tag="Bị trả về" action={{ label: 'Đếm lại từ lưới dưới' }}>
          {take.reject_reason}
        </NoticeBar>
      )}
      {take.status === 'approved' && take.doc_code && (
        <NoticeBar
          tone="done"
          tag="Đã duyệt"
          action={{
            label: `Mở phiếu ${take.doc_code}`,
            onClick: () => router.push(`/warehouse/docs?q=${take.doc_code}`),
          }}
        >
          Tồn đã đổi theo đợt này. Sai thì đảo phiếu đó, không sửa đợt.
        </NoticeBar>
      )}

      {take.status !== 'open' && progress.total > 0 && (
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
          <CoverageBar
            ratio={progress.total > 0 ? progress.counted / progress.total : 0}
            label={`Đã đếm ${progress.counted}/${progress.total}`}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {lines.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Chưa có dòng đếm nào"
              reason={
                take.status === 'open'
                  ? `Đợt đã chốt phạm vi ${take.scope_count} mã nhưng chưa chốt sổ — danh sách đếm chỉ sinh ra khi bấm bắt đầu.`
                  : 'Phạm vi của đợt này không còn mã nào.'
              }
              next={
                canEdit && take.status === 'open' ? (
                  <Btn primary onClick={chotSo}>
                    Chốt sổ &amp; bắt đầu đếm
                  </Btn>
                ) : (
                  <Btn href="/warehouse/kiem-ke">← Danh sách đợt</Btn>
                )
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead pinFirst>
                <th>Mã</th>
                <th>Tên vật tư</th>
                {baySo && <th style={{ textAlign: 'right' }}>Sổ (chốt)</th>}
                <th style={{ textAlign: 'right', width: 110 }}>Đếm</th>
                {baySo && <th style={{ textAlign: 'right' }}>Lệch</th>}
                <th>ĐVT</th>
              </THead>
              <tbody>
                {lines.map((l) => {
                  const dangGo = nhap[l.id]
                  const so = dangGo != null ? Number(dangGo) : l.counted_qty
                  const lech =
                    baySo && so != null && l.book_qty_frozen != null
                      ? so - l.book_qty_frozen
                      : null
                  return (
                    <Row key={l.id}>
                      <Cell pin>
                        <Code>{l.material_code ?? '—'}</Code>
                      </Cell>
                      <Cell grow>{l.material_name ?? '—'}</Cell>
                      {baySo && (
                        <Cell num muted>
                          <Num value={fmt(l.book_qty_frozen)} />
                        </Cell>
                      )}
                      <Cell num>
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
                          <Num value={String(l.counted_qty)} strong />
                        )}
                      </Cell>
                      {baySo && (
                        <Cell num>
                          {lech == null ? (
                            <span className="text-[var(--ink-3)]">—</span>
                          ) : lech === 0 ? (
                            <Num value="0" zero="done" muted />
                          ) : (
                            <span
                              className={
                                lech > 0 ? 'text-[var(--warn)]' : 'text-[var(--stop)]'
                              }
                            >
                              {lech > 0 ? '+' : ''}
                              {lech.toLocaleString('vi-VN')}
                            </span>
                          )}
                        </Cell>
                      )}
                      <Cell muted>{l.material_unit ?? ''}</Cell>
                    </Row>
                  )
                })}
              </tbody>
            </Table>

            {/*
              THANH CHỐT ĐÁY — nói vướng gì và gỡ thế nào, ngay tại chỗ.
              Chỉ hiện khi còn việc để chốt; đợt đã duyệt thì nó là rác.
            */}
            {canEdit && take.status === 'counting' && (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-2">
                <span className="text-[var(--fs-sm)] text-[var(--ink-2)]">
                  {vuong ?? 'Đã đếm đủ phạm vi — gửi được rồi.'}
                </span>
                <div className="flex items-center gap-2">
                  <Btn onClick={luuSoDem} disabled={busy || chuaLuu === 0}>
                    Lưu {chuaLuu > 0 ? `${chuaLuu} dòng` : 'số đếm'}
                  </Btn>
                  <Btn
                    primary
                    onClick={guiDoiChieu}
                    disabled={busy || chuaLuu > 0 || chuaDem > 0}
                  >
                    Gửi đối chiếu
                  </Btn>
                </div>
              </div>
            )}

            {take.status === 'review' && baySo && tongLech != null && (
              <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-2">
                <WhyBox
                  lines={[
                    `${progress.diff_count ?? 0} mã lệch so với sổ chốt lúc ${
                      take.freeze_at
                        ? new Date(take.freeze_at).toLocaleString('vi-VN')
                        : '—'
                    }`,
                    'Mã thừa → dòng nhập N4 · Mã thiếu → dòng xuất X5',
                    'Chênh áp là HIỆU so với sổ chốt, không phải đặt tồn = số đếm — hàng nhập trong lúc đếm không bị xoá',
                  ]}
                  result={`${progress.diff_count ?? 0} bút toán điều chỉnh, tổng chênh ${
                    tongLech > 0 ? '+' : ''
                  }${tongLech.toLocaleString('vi-VN')}`}
                />
              </div>
            )}
          </div>
        )}
      </div>

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

function fmt(v: number | null): string {
  return v == null ? '' : String(v)
}
