'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Chip,
  Code,
  Hint,
  NoticeBar,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
  ToneText,
  WhyBox,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { regroupPreview, similarSubs } from '@/lib/material-subgroup'
import type { GroupsOverview } from '@/modules/dept/warehouse/material-groups.service'

export type ChuyenItem = {
  id: string
  code: string
  group_name: string | null
  sub_group: string | null
}

const MOI = '\u0000moi'
const TRONG = '\u0000trong'

/**
 * CHUYỂN NHÓM CHO NHIỀU MÃ (29/09/2026, artboard 17 đã duyệt).
 *
 * Việc thật đo được: 1.288/13.316 mã chưa có nhóm con, và trong 392 mã Sắt thép
 * trống nhóm con có cả inox, nhôm, bu lông lạc nhóm — nên đổi được CẢ nhóm chính.
 * Ghi qua `POST materials/regroup` (có sẵn: ≤500 mã/lượt, ghi vết từng mã).
 * Nhóm con mới gõ được, nhưng báo ngay nếu gần giống nhãn đang có
 * (`similarSubs`) — đừng đẻ thêm cặp như "Đèn - chiếu sáng"/"Đèn chiếu sáng".
 */
export function ChuyenNhomSheet({
  items,
  groups,
  onClose,
  onDone,
}: {
  items: ChuyenItem[]
  /** Nhóm chính đang dùng (danh mục chốt). */
  groups: string[]
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [ov, setOv] = useState<GroupsOverview | null>(null)
  useEffect(() => {
    api<GroupsOverview>('/api/dept/warehouse/material-groups')
      .then(setOv)
      .catch(() => setOv({ groups: [], orphans: [], ungrouped: 0 })) // chỉ mất số xem trước
  }, [])

  const common = items.every((i) => i.group_name === items[0]?.group_name) ? (items[0]?.group_name ?? null) : null // prettier-ignore
  const [group, setGroup] = useState('') // '' = giữ nguyên
  const [pick, setPick] = useState('') // tên nhóm con | TRONG | MOI | '' (chưa chọn)
  const [moi, setMoi] = useState('')
  const dest = group || common
  const row = ov?.groups.find((g) => g.label === dest)
  const subs = row?.subs ?? []

  const sub: string | null | undefined =
    pick === TRONG ? null : pick === MOI ? moi.trim() || undefined : pick || undefined
  const target = { group: group || undefined, sub }
  const giong =
    pick === MOI
      ? similarSubs(
          moi,
          subs.map((s) => s.name),
        )
      : []

  const count = (p: { group: string | null; sub: string | null }) => {
    const g = ov?.groups.find((x) => x.label === p.group)
    if (!g) return 0
    return p.sub ? (g.subs.find((s) => s.name === p.sub)?.count ?? 0) : g.no_sub
  }
  const preview = useMemo(
    () =>
      ov
        ? regroupPreview(
            items.map((i) => ({ group: i.group_name, sub: i.sub_group })),
            target,
            count,
          )
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ov, items, group, sub],
  )

  const why =
    items.length > 500
      ? `một lượt tối đa 500 mã — đang chọn ${items.length}`
      : !group && sub === undefined
        ? pick === MOI
          ? 'chưa gõ tên nhóm con mới'
          : 'chưa chọn nhóm con (hoặc đổi nhóm chính)'
        : !dest
          ? 'các mã đang ở nhiều nhóm khác nhau — chọn nhóm chính trước'
          : preview.length === 0 && ov
            ? 'các mã đã ở đúng chỗ này rồi'
            : null

  async function save() {
    if (why) return
    setBusy(true)
    try {
      const r = await api<{ updated: number }>('/api/dept/warehouse/materials/regroup', {
        method: 'POST',
        body: {
          ids: items.map((i) => i.id),
          group_name: group || undefined,
          sub_group: sub,
        },
      })
      toast.success(
        `Đã chuyển ${r.updated} mã`,
        `${dest}${sub ? ` › ${sub}` : ' · chưa có nhóm con'}`,
      )
      onDone()
    } catch (e) {
      toast.error('Chuyển không được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Chuyển nhóm cho ${items.length} mã`}
      subtitle={common ? `Đang ở ${common}.` : 'Các mã đang ở nhiều nhóm khác nhau.'}
      stakes="nhe"
      width={600}
      footer={
        <div className="flex w-full items-center gap-3">
          <span className="text-k-sm flex-1">
            {why && (
              <ToneText tone="stop" strong={false}>
                Chưa chuyển được: {why}
              </ToneText>
            )}
          </span>
          <SheetActions
            stakes="nhe"
            busy={busy}
            disabled={!!why}
            onCancel={onClose}
            onConfirm={() => void save()}
            cancelLabel="Thôi"
            confirmLabel={`Chuyển ${items.length} mã`}
          />{' '}
          {/* prettier-ignore */}
        </div>
      }
    >
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 12).map((i) => (
          <Code key={i.id}>{i.code}</Code>
        ))}
        {items.length > 12 && <Hint size="sm">+{items.length - 12} mã</Hint>}
      </div>

      <div className="k-sec mt-4">Nhóm chính</div>
      <Pick
        label="Nhóm chính"
        value={group}
        onChange={(v) => {
          setGroup(v)
          setPick('')
        }}
        options={[
          { value: '', label: common ? `Giữ nguyên — ${common}` : '— chọn nhóm chính —' },
          ...groups.filter((g) => g !== common).map((g) => ({ value: g, label: g })),
        ]}
      />
      <div className="mt-1">
        <Hint size="sm">
          Đổi nhóm chính mà không chọn nhóm con thì nhóm con về trống — dùng cho mã inox,
          nhôm, bu lông lạc nhóm.
        </Hint>
      </div>

      <div className="k-sec mt-4">Nhóm con{dest ? ` của ${dest}` : ''}</div>
      {!dest ? (
        <Hint size="sm">Chọn nhóm chính trước — các mã đang ở nhiều nhóm.</Hint>
      ) : (
        <div className="flex flex-wrap gap-2">
          {subs.map((s) => (
            <Chip
              key={s.name}
              on={pick === s.name}
              count={s.count}
              onClick={() => setPick(pick === s.name ? '' : s.name)}
            >
              {s.name}
            </Chip>
          ))}
          <Chip on={pick === TRONG} onClick={() => setPick(pick === TRONG ? '' : TRONG)}>
            để trống
          </Chip>
          <Chip
            icon="them"
            on={pick === MOI}
            onClick={() => setPick(pick === MOI ? '' : MOI)}
          >
            nhóm con mới…
          </Chip>
        </div>
      )}
      {pick === MOI && (
        <div className="mt-2">
          <TextInput
            value={moi}
            onCommit={setMoi}
            label="Tên nhóm con mới"
            placeholder="vd. Tôn lợp - tôn sóng"
          />
        </div>
      )}
      {giong.length > 0 && (
        <div className="mt-2">
          <NoticeBar
            tag="Gần trùng"
            action={{ label: `Dùng “${giong[0]}”`, onClick: () => setPick(giong[0]) }}
          >
            Nhóm này đã có “{giong.join('”, “')}” — hai nhãn một nghĩa thì lọc theo nhóm
            sẽ sót mã.
          </NoticeBar>
        </div>
      )}

      {preview.length > 0 && (
        <div className="mt-4">
          <WhyBox
            lines={preview.map(
              (p) =>
                `${p.group ?? '(chưa nhóm)'} › ${p.sub ?? 'chưa có nhóm con'}: ${p.before} → ${p.after}`,
            )}
            result={`${items.length} mã đổi chỗ`}
          />
        </div>
      )}
      <p className="text-k-sm mt-3 text-[var(--ink-3)]">
        Mỗi mã ghi một dòng vết (ai đổi, lúc nào, trước → sau) — xem ở Lịch sử của mã. Số
        trước/sau đếm mã đang dùng.
      </p>
    </Sheet>
  )
}
