'use client'

import { useState } from 'react'
import {
  Chip,
  Hint,
  NoticeBar,
  Pick,
  Sheet,
  SheetActions,
  TextInput,
  ToneText,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { similarSubs } from '@/lib/material-subgroup'
import type { GroupRow } from '@/modules/dept/warehouse/material-groups.service'

const n = (x: number) => x.toLocaleString('vi-VN')

function Foot({
  why,
  busy,
  label,
  danger,
  onCancel,
  onGo,
}: {
  why: string | null
  busy: boolean
  label: string
  danger?: boolean
  onCancel: () => void
  onGo: () => void
}) {
  // prettier-ignore
  return (
    <div className="flex w-full items-center gap-3">
      <span className="text-k-sm flex-1">{why && <ToneText tone="stop" strong={false}>Chưa làm được: {why}</ToneText>}</span>
      <SheetActions stakes={danger ? 'nang' : 'vua'} busy={busy} disabled={!!why} onCancel={onCancel} onConfirm={onGo} cancelLabel="Thôi" confirmLabel={label} /> {/* prettier-ignore */}
    </div>
  )
}

/**
 * THÊM / ĐỔI TÊN NHÓM CHÍNH. Đổi tên kéo theo MỌI mã đang mang tên cũ (service
 * cascade, gồm cả mã ngừng dùng) — nói số mã trước khi bấm.
 */
export function NhomTenSheet({
  group,
  onClose,
  onDone,
}: {
  /** Có = đổi tên nhóm này; không = thêm nhóm mới. */
  group?: GroupRow
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(group?.label ?? '')
  const why = name.trim().length < 2 ? 'tên nhóm ít nhất 2 ký tự' : group && name.trim() === group.label ? 'tên chưa đổi' : null // prettier-ignore

  async function go() {
    if (why) return
    setBusy(true)
    try {
      if (group) {
        const r = await api<{ moved: number }>(`/api/dept/warehouse/material-groups/${group.id}`, { method: 'PATCH', body: { name: name.trim() } }) // prettier-ignore
        toast.success(`Đã đổi tên nhóm`, `${r.moved} mã đổi theo sang “${name.trim()}”.`)
      } else {
        await api('/api/dept/warehouse/material-groups', {
          method: 'POST',
          body: { name: name.trim() },
        })
        toast.success('Đã thêm nhóm chính', name.trim())
      }
      onDone()
    } catch (e) {
      toast.error(group ? 'Đổi tên không được' : 'Thêm không được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={group ? `Đổi tên nhóm “${group.label}”` : 'Thêm nhóm chính'}
      subtitle={group ? `${n(group.total)} mã đang mang tên nhóm này.` : 'Nhóm chính là danh sách chốt — vật tư mới chỉ chọn được nhóm có ở đây.'} // prettier-ignore
      stakes="vua"
      width={520}
      footer={<Foot why={why} busy={busy} label={group ? 'Đổi tên' : 'Thêm nhóm'} onCancel={onClose} onGo={() => void go()} />} // prettier-ignore
    >
      <TextInput
        value={name}
        onCommit={setName}
        label="Tên nhóm chính"
        placeholder="vd. Nhựa - cao su kỹ thuật"
      />
      {group && group.total > 0 && (
        <div className="mt-3">
          <NoticeBar tag="Hệ quả">
            {n(group.total)} mã đổi tên nhóm theo, kể cả mã đã ngừng dùng. Bộ lọc, bảng
            giá, đơn soạn sau đều thấy tên mới.
          </NoticeBar>
        </div>
      )}
      {!group && (
        <Hint size="sm">
          Trùng tên nhóm đã có (kể cả nhóm đã ngừng) thì máy chặn và chỉ cách bật lại.
        </Hint>
      )}
    </Sheet>
  )
}

/**
 * MỘT NHÃN NHÓM CON — gộp vào nhãn khác · đổi tên · xoá (mã về trống).
 * Nhóm con là chữ tự do trên vật tư (0111) nên cả ba là một câu update các mã
 * trong đúng nhóm chính này. Không hoàn tác được — nói trước.
 */
export function NhomConSheet({
  group,
  sub,
  suggest,
  onClose,
  onDone,
}: {
  group: GroupRow
  sub: string
  /** Nhãn gần giống nhiều mã hơn — mặc định chọn sẵn để gộp vào. */
  suggest?: string
  onClose: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const cnt = group.subs.find((s) => s.name === sub)?.count ?? 0
  const others = group.subs.filter((s) => s.name !== sub)
  const [mode, setMode] = useState<'gop' | 'ten' | 'xoa'>(others.length ? 'gop' : 'ten')
  const [to, setTo] = useState(suggest ?? others[0]?.name ?? '')
  const [ten, setTen] = useState(sub)
  const giong =
    mode === 'ten'
      ? similarSubs(
          ten,
          others.map((o) => o.name),
        )
      : []
  const toCnt = group.subs.find((s) => s.name === to)?.count ?? 0

  const why =
    mode === 'gop' && !to
      ? 'chưa chọn nhãn để gộp vào'
      : mode === 'ten' && ten.trim().length < 2
        ? 'tên ít nhất 2 ký tự'
        : mode === 'ten' && ten.trim() === sub
          ? 'tên chưa đổi'
          : null

  async function go() {
    if (why) return
    setBusy(true)
    try {
      const body =
        mode === 'xoa'
          ? { action: 'delete', group_name: group.label, name: sub }
          : {
              action: 'rename',
              group_name: group.label,
              from: sub,
              to: mode === 'gop' ? to : ten.trim(),
            }
      await api('/api/dept/warehouse/material-groups/subgroups', { method: 'POST', body })
      toast.success(
        mode === 'xoa'
          ? 'Đã xoá nhãn'
          : mode === 'gop'
            ? 'Đã gộp nhãn'
            : 'Đã đổi tên nhãn',
        mode === 'xoa'
          ? `${cnt} mã về “chưa có nhóm con”.`
          : `${cnt} mã sang “${mode === 'gop' ? to : ten.trim()}”.`,
      )
      onDone()
    } catch (e) {
      toast.error('Không làm được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Nhóm con “${sub}”`}
      subtitle={`${group.label} · ${n(cnt)} mã đang mang nhãn này`}
      stakes={mode === 'xoa' ? 'nang' : 'vua'}
      width={560}
      footer={<Foot why={why} busy={busy} danger={mode === 'xoa'} label={mode === 'gop' ? `Gộp ${n(cnt)} mã` : mode === 'xoa' ? 'Xoá nhãn' : 'Đổi tên'} onCancel={onClose} onGo={() => void go()} />} // prettier-ignore
    >
      <div className="flex flex-wrap gap-2">
        {others.length > 0 && (
          <Chip on={mode === 'gop'} onClick={() => setMode('gop')}>
            Gộp vào nhãn khác
          </Chip>
        )}
        <Chip on={mode === 'ten'} onClick={() => setMode('ten')}>
          Đổi tên
        </Chip>
        <Chip on={mode === 'xoa'} onClick={() => setMode('xoa')}>
          Xoá nhãn
        </Chip>
      </div>

      <div className="mt-3">
        {
          mode === 'gop' &&
          <Pick label="Gộp vào" value={to} onChange={setTo} options={others.map((o) => ({ value: o.name, label: `${o.name} · ${n(o.count)} mã` }))} /> // prettier-ignore
        }
        {mode === 'ten' && <TextInput value={ten} onCommit={setTen} label="Tên mới" />}
      </div>
      {giong.length > 0 && (
        <div className="mt-2">
          <NoticeBar
            tag="Gần trùng"
            action={{
              label: `Gộp vào “${giong[0]}”`,
              onClick: () => {
                setTo(giong[0])
                setMode('gop')
              },
            }}
          >
            {' '}
            {/* prettier-ignore */}
            Nhóm này đã có “{giong.join('”, “')}” — đổi tên thành nhãn gần giống là đẻ
            thêm một cặp trùng.
          </NoticeBar>
        </div>
      )}

      <div className="mt-3">
        <NoticeBar tag="Hệ quả" tone={mode === 'xoa' ? 'stop' : undefined}>
          {mode === 'gop'
            ? `${n(cnt)} mã chuyển sang “${to}” (${n(toCnt)} → ${n(toCnt + cnt)}); nhãn “${sub}” biến mất khỏi danh sách chọn.`
            : mode === 'xoa'
              ? `${n(cnt)} mã về “chưa có nhóm con” — phải chia lại từ rổ chia nhóm.`
              : `${n(cnt)} mã đổi nhãn theo.`}{' '}
          Không có hoàn tác — muốn tách lại phải chuyển tay từng mã.
        </NoticeBar>
      </div>
    </Sheet>
  )
}
