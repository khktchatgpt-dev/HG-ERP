'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  Num,
  Pick,
  Row,
  ScreenHeader,
  Sheet,
  SheetActions,
  THead,
  Table,
  Tag,
  TextArea,
  Tick,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { Stocktake, StocktakeStatus } from '@/modules/dept/warehouse/stocktakes.repo'

/**
 * ĐỢT KIỂM KÊ — Khuôn C. Câu hỏi: *đợt nào đang chờ tôi, và tới đâu rồi?*
 */

const NHAN: Record<StocktakeStatus, string> = {
  open: 'Mới mở',
  counting: 'Đang đếm',
  review: 'Chờ đối chiếu',
  approved: 'Đã duyệt',
  cancelled: 'Đã huỷ',
}

/**
 * MÀU CHỈ MÃ HOÁ VÒNG ĐỜI, không bao giờ lên nút (nguyên tắc 5 của sổ).
 * `review` là warn vì nó đang chờ NGƯỜI — đó là chỗ đợt đứng im lâu nhất.
 */
const TONE: Record<StocktakeStatus, 'neutral' | 'warn' | 'done' | 'stop'> = {
  open: 'neutral',
  // KHÔNG dùng --act cho 'đang đếm': act là màu của thứ BẤM ĐƯỢC, dùng nó mã
  // hoá vòng đời là phá nguyên tắc 5 (một màu hành động, ba màu vòng đời).
  counting: 'neutral',
  review: 'warn',
  approved: 'done',
  cancelled: 'stop',
}

type ScopeKind = 'bin' | 'group' | 'list'

export function KiemKeScreen({
  takes,
  total,
  page,
  status,
  canEdit,
  bins,
  groups,
}: {
  takes: Stocktake[]
  total: number
  page: number
  status: StocktakeStatus | null
  canEdit: boolean
  bins: { id: string; code: string; name: string | null; count: number }[]
  groups: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [moMoi, setMoMoi] = useState(false)

  // Form mở đợt
  const [scopeKind, setScopeKind] = useState<ScopeKind>('bin')
  const [binIds, setBinIds] = useState<string[]>([])
  const [groupNames, setGroupNames] = useState<string[]>([])
  const [blind, setBlind] = useState(true)
  const [note, setNote] = useState('')

  const dangChay = useMemo(
    () => takes.filter((t) => t.status === 'counting' || t.status === 'review').length,
    [takes],
  )
  const choDoiChieu = useMemo(
    () => takes.filter((t) => t.status === 'review').length,
    [takes],
  )

  function pushStatus(v: string) {
    router.push(v === 'all' ? '/warehouse/kiem-ke' : `/warehouse/kiem-ke?status=${v}`)
  }

  /*
   * Phạm vi CHƯA CHỌN thì không cho mở — và nút nói vướng gì ngay tại chỗ,
   * không cho bấm rồi mới báo lỗi (luật kiểm của /design-lab).
   */
  const thieuPhamVi =
    (scopeKind === 'bin' && binIds.length === 0) ||
    (scopeKind === 'group' && groupNames.length === 0)

  async function moDot() {
    setBusy(true)
    try {
      const scope =
        scopeKind === 'bin'
          ? { kind: 'bin' as const, bin_ids: binIds }
          : { kind: 'group' as const, groups: groupNames }
      const out = await api<{ id: string; code: string; scope_count: number }>(
        '/api/dept/warehouse/stocktakes',
        {
          method: 'POST',
          body: { scope, blind_count: blind, note: note.trim() || null },
        },
      )
      setMoMoi(false)
      toast.success(`Đã mở đợt ${out.code}`, `${out.scope_count} mã trong phạm vi`)
      router.push(`/warehouse/kiem-ke/${out.id}`)
    } catch (err) {
      toast.error(
        'Mở đợt thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi xảy ra',
      )
    } finally {
      setBusy(false)
    }
  }

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
        eyebrow="Kho"
        title="Đợt kiểm kê"
        facts={[
          { label: 'Đang hiện', value: `${takes.length} / ${total}` },
          {
            label: 'Đang chạy',
            value: String(dangChay),
          },
          {
            label: 'Chờ đối chiếu',
            value: String(choDoiChieu),
            tone: choDoiChieu > 0 ? 'warn' : undefined,
          },
        ]}
        actions={
          canEdit ? (
            <Btn primary onClick={() => setMoMoi(true)}>
              + Mở đợt kiểm kê
            </Btn>
          ) : null
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
        <Chip on={!status} onClick={() => pushStatus('all')}>
          Tất cả
        </Chip>
        {(['open', 'counting', 'review', 'approved'] as const).map((s) => (
          <Chip key={s} on={status === s} onClick={() => pushStatus(s)}>
            {NHAN[s]}
          </Chip>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {takes.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline={status ? `Không đợt nào ở "${NHAN[status]}"` : 'Chưa có đợt nào'}
              reason={
                status
                  ? `Sổ có ${total} đợt khớp bộ lọc này.`
                  : 'Kiểm kê là chứng từ nặng nhất trong kho — mỗi đợt chốt một phạm vi và một mốc sổ, nên tồn sau kiểm luôn tra ngược được.'
              }
              next={
                <>
                  {status && <Btn onClick={() => pushStatus('all')}>Xem tất cả</Btn>}
                  {canEdit && (
                    <Btn primary onClick={() => setMoMoi(true)}>
                      + Mở đợt kiểm kê
                    </Btn>
                  )}
                </>
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead pinFirst>
                <th>Đợt</th>
                <th>Trạng thái</th>
                <th>Phạm vi</th>
                <th style={{ textAlign: 'right' }}>Số mã</th>
                <th>Chốt sổ</th>
                <th>Đếm</th>
                <th>Người mở</th>
              </THead>
              <tbody>
                {takes.map((t) => (
                  <Row
                    key={t.id}
                    onClick={() => router.push(`/warehouse/kiem-ke/${t.id}`)}
                  >
                    <Cell pin>
                      <Code>{t.code}</Code>
                    </Cell>
                    <Cell>
                      <Tag tone={TONE[t.status]}>{NHAN[t.status]}</Tag>
                    </Cell>
                    <Cell grow muted>
                      {moTaPhamVi(t, bins)}
                    </Cell>
                    <Cell num>
                      <Num value={String(t.scope_count)} />
                    </Cell>
                    <Cell muted>
                      {t.freeze_at ? (
                        new Date(t.freeze_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      ) : (
                        /* Chưa chốt sổ là một TRẠNG THÁI, không phải ô trống. */
                        <span>chưa chốt</span>
                      )}
                    </Cell>
                    <Cell muted>{t.blind_count ? 'mù' : 'mở'}</Cell>
                    <Cell muted>{t.created_by_name ?? '—'}</Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <Sheet
        open={moMoi}
        onClose={() => setMoMoi(false)}
        title="Mở đợt kiểm kê"
        subtitle="Chốt phạm vi trước. Sổ đóng băng khi bấm Bắt đầu đếm, không phải bây giờ."
        width={560}
        footer={
          <SheetActions
            onCancel={() => setMoMoi(false)}
            onConfirm={moDot}
            confirmLabel="Mở đợt"
            busy={busy}
            disabled={thieuPhamVi}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <Pick
            label="Phạm vi theo"
            value={scopeKind}
            onChange={(v) => setScopeKind(v as ScopeKind)}
            options={[
              { value: 'bin', label: 'Khu kệ — đi tới chỗ hàng nằm' },
              { value: 'group', label: 'Nhóm vật tư' },
            ]}
          />

          {scopeKind === 'bin' && (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-[var(--fs-sm)]">Chọn khu</div>
              <div className="flex max-h-56 flex-col gap-1 overflow-auto rounded-[var(--radius-sm)] border border-[var(--line)] p-2">
                {bins.length === 0 ? (
                  <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
                    Kho chưa khai khu nào — mở Sơ đồ kệ để khai trước.
                  </span>
                ) : (
                  /*
                    `Tick` dùng `label` làm aria-label, KHÔNG vẽ chữ — nó sinh
                    ra cho cột chọn dòng trong bảng, nơi tên nằm ở ô bên cạnh.
                    Dùng trần ở đây thì ra 13 ô vuông trống, không ai biết đang
                    chọn khu nào (đo 15/09/2026). Bọc nhãn là việc của chỗ gọi.
                  */
                  /*
                    SỐ MÃ ĐI KÈM TỪNG KHU, và khu rỗng thì KHÔNG TÍCH ĐƯỢC.

                    Bản đầu cho tích mọi khu rồi trả 400 "phạm vi không có mã
                    nào" — người dùng bấm xong mới biết. Với tồn đang 0 trên
                    cả 13.229 mã thì MỌI khu đều rỗng, nên màn mời người ta
                    vào ngõ cụt đúng 13 lần. Chặn ở đây, nói lý do ở dưới.
                  */
                  bins.map((b) => (
                    <label
                      key={b.id}
                      className={
                        b.count > 0
                          ? 'flex cursor-pointer items-center gap-2 text-[var(--fs-sm)]'
                          : 'flex items-center gap-2 text-[var(--fs-sm)] opacity-45'
                      }
                    >
                      <Tick
                        checked={binIds.includes(b.id)}
                        disabled={b.count === 0}
                        label={`${b.code}${b.name ? ` · ${b.name}` : ''} — ${b.count} mã`}
                        onChange={() =>
                          setBinIds((s) =>
                            s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id],
                          )
                        }
                      />
                      <span className="font-[family-name:var(--font-mono)]">
                        {b.code}
                      </span>
                      {b.name && <span className="text-[var(--ink-3)]">{b.name}</span>}
                      <span className="ml-auto font-[family-name:var(--font-mono)] text-[var(--ink-3)]">
                        {b.count > 0 ? `${b.count} mã` : 'trống'}
                      </span>
                    </label>
                  ))
                )}
              </div>
              <span className="text-[11.5px] text-[var(--ink-3)]">
                Đếm theo khu lấy mã đang CÓ LƯỢNG ở khu đó, không lấy theo kệ gợi ý trên
                danh mục — thứ thật sự nằm ở đó mới là thứ phải đếm. Khu “trống” không
                tích được vì không có gì để đếm; muốn kiểm cả mã tồn 0 thì chọn phạm vi
                theo NHÓM.
              </span>
            </div>
          )}

          {scopeKind === 'group' && (
            <div className="flex flex-col gap-1.5">
              <div className="font-semibold text-[var(--fs-sm)]">Chọn nhóm</div>
              <div className="flex max-h-56 flex-col gap-1 overflow-auto rounded-[var(--radius-sm)] border border-[var(--line)] p-2">
                {groups.map((g) => (
                  <label
                    key={g}
                    className="flex cursor-pointer items-center gap-2 text-[var(--fs-sm)]"
                  >
                    <Tick
                      checked={groupNames.includes(g)}
                      label={g}
                      onChange={() =>
                        setGroupNames((s) =>
                          s.includes(g) ? s.filter((x) => x !== g) : [...s, g],
                        )
                      }
                    />
                    <span>{g}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[var(--fs-sm)]">
            <Tick
              checked={blind}
              label="Đếm mù — giấu số sổ với người đếm"
              onChange={() => setBlind((v) => !v)}
            />
            <span className="font-semibold">Đếm mù — giấu số sổ với người đếm</span>
          </label>
          <span className="-mt-3 text-[11.5px] text-[var(--ink-3)]">
            Bỏ đếm mù thì số đếm bị số sổ dẫn dắt, và kiểm kê chỉ còn tự xác nhận chính
            nó. Server giữ số sổ lại chứ không chỉ ẩn cột.
          </span>

          <label className="flex flex-col gap-1.5 font-semibold text-[var(--fs-sm)]">
            Ghi chú đợt
            <TextArea
              value={note}
              onChange={setNote}
              rows={2}
              placeholder="Kiểm định kỳ quý III / kiểm đột xuất sau sự cố…"
            />
          </label>

          {thieuPhamVi && (
            <span className="text-[var(--fs-sm)] text-[var(--stop)]">
              Chọn ít nhất một {scopeKind === 'bin' ? 'khu' : 'nhóm'} thì mới mở được đợt
              — không có đường đếm cả danh mục.
            </span>
          )}
        </div>
      </Sheet>
    </div>
  )
}

/** Phạm vi nói bằng TÊN người đọc hiểu, không bằng id. */
function moTaPhamVi(
  t: Stocktake,
  bins: { id: string; code: string }[],
): string {
  const ref = t.scope_ref as Record<string, unknown>
  if (t.scope_kind === 'group') {
    const gs = (ref.groups as string[]) ?? []
    return gs.length ? gs.join(' · ') : '—'
  }
  if (t.scope_kind === 'list') {
    const ids = (ref.material_ids as string[]) ?? []
    return `Danh sách ${ids.length} mã`
  }
  const ids = (ref.bin_ids as string[]) ?? []
  const names = ids.map((id) => bins.find((b) => b.id === id)?.code ?? id)
  return names.length ? names.join(' · ') : '—'
}
