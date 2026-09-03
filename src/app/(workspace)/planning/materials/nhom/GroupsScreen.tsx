'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FolderTree, Layers, Merge, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { api, ApiError } from '@/lib/api'
import { PO_TEMPLATES, poTemplateMeta } from '@/lib/po-template'
import { PageHeader } from '@/components/erp/PageHeader'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { EmptyState } from '@/components/erp/EmptyState'
import { TopProgressBar, Spinner } from '@/components/erp/Spinner'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Badge } from '@/components/Badge'
import type {
  GroupRow,
  GroupsOverview,
} from '@/modules/dept/warehouse/material-groups.service'

const num = (n: number) => n.toLocaleString('vi-VN')

type Dialog =
  | { kind: 'create' }
  | { kind: 'rename-group'; g: GroupRow }
  | { kind: 'rename-sub'; g: GroupRow; from: string }
  | null

/**
 * NHÓM VẬT TƯ — một trang, hai tầng, đúng thứ Cung ứng thiếu (03/09/2026).
 *
 * Nhóm CHÍNH là danh sách chốt (quyết định phạm vi chặn trùng tên): thêm, đổi
 * tên (lan xuống mọi mã), ngừng/xoá khi đã rỗng. Nhóm PHỤ là nhãn trên từng mã
 * — hiện cùng số mã để thấy ngay bản gõ lệch (13 mã) đứng cạnh bản chuẩn
 * (1.596 mã), và "Gộp vào…" xử lý nó trong một bước. Xoá nhóm phụ chỉ bỏ nhãn,
 * không đụng mã.
 *
 * Số mã trống nhóm phụ hiện thành LINK sang màn danh mục đã lọc sẵn nhóm — chỗ
 * "đổi nhóm hàng loạt" lo phần còn lại.
 */
export function GroupsScreen({
  data,
  canEdit,
}: {
  data: GroupsOverview
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [dlg, setDlg] = useState<Dialog>(null)
  const [name, setName] = useState('')
  const [mergeTo, setMergeTo] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const active = data.groups.filter((g) => g.is_active)
  const inactive = data.groups.filter((g) => !g.is_active)
  const stats = useMemo(() => {
    const subs = active.reduce((s, g) => s + g.subs.length, 0)
    const noSub = active.reduce((s, g) => s + g.no_sub, 0)
    // Nhóm phụ lẻ loi (≤ 5 mã) trong nhóm có nhóm phụ khác ≥ 50 mã — thường là
    // bản gõ lệch của nhãn chuẩn, đáng gộp.
    const suspect = active.reduce(
      (s, g) =>
        s +
        (g.subs.some((x) => x.count >= 50)
          ? g.subs.filter((x) => x.count <= 5).length
          : 0),
      0,
    )
    return { subs, noSub, suspect }
  }, [active])

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setBusy(true)
    try {
      const r = await api<Record<string, unknown>>(url, { method, body })
      router.refresh()
      return r
    } catch (e) {
      toast.error('Thao tác thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
      return null
    } finally {
      setBusy(false)
    }
  }

  function open(d: Dialog) {
    setDlg(d)
    setName(
      d?.kind === 'rename-group' ? d.g.label : d?.kind === 'rename-sub' ? d.from : '',
    )
    setMergeTo('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dlg) return
    const v = name.trim()
    if (dlg.kind === 'create') {
      const r = await send('/api/dept/warehouse/material-groups', 'POST', { name: v })
      if (r) toast.success(`Đã thêm nhóm "${v}"`)
    } else if (dlg.kind === 'rename-group') {
      const r = await send(`/api/dept/warehouse/material-groups/${dlg.g.id}`, 'PATCH', {
        name: v,
      })
      if (r) toast.success(`Đã đổi tên nhóm`, `${num(Number(r.moved ?? 0))} mã đổi theo`)
    } else if (dlg.kind === 'rename-sub') {
      const to = mergeTo || v
      const r = await send('/api/dept/warehouse/material-groups/subgroups', 'POST', {
        action: 'rename',
        group_name: dlg.g.label,
        from: dlg.from,
        to,
      })
      if (r)
        toast.success(
          r.merged ? `Đã gộp vào "${to}"` : `Đã đổi tên nhóm phụ`,
          `${num(Number(r.moved ?? 0))} mã chuyển theo`,
        )
    }
    if (!busy) setDlg(null)
  }

  async function removeGroup(g: GroupRow) {
    const ok = await confirm({
      title: `Xoá nhóm "${g.label}"?`,
      description: 'Chỉ xoá được khi nhóm không còn mã nào. Không hoàn tác.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    const r = await send(`/api/dept/warehouse/material-groups/${g.id}`, 'DELETE')
    if (r) toast.success(`Đã xoá nhóm "${g.label}"`)
  }

  async function toggleGroup(g: GroupRow) {
    const r = await send(`/api/dept/warehouse/material-groups/${g.id}`, 'PATCH', {
      is_active: !g.is_active,
    })
    if (r)
      toast.success(
        g.is_active ? `Đã ngừng nhóm "${g.label}"` : `Đã bật lại "${g.label}"`,
      )
  }

  /** Mẫu đơn mặc định của nhóm (0183) — chỉ mồi cho vật tư MỚI. */
  async function setTemplate(g: GroupRow, tpl: string) {
    const r = await send(`/api/dept/warehouse/material-groups/${g.id}`, 'PATCH', {
      po_template: tpl || null,
    })
    if (r)
      toast.success(
        tpl
          ? `Vật tư mới của "${g.label}" sẽ dùng mẫu ${poTemplateMeta(tpl as never).label}`
          : `Đã bỏ mẫu mặc định của "${g.label}"`,
        'Vật tư đã khai giữ nguyên mẫu của chúng',
      )
  }

  async function removeSub(g: GroupRow, sub: { name: string; count: number }) {
    const ok = await confirm({
      title: `Xoá nhóm phụ "${sub.name}"?`,
      description: `${num(sub.count)} mã đang mang nhãn này sẽ về TRỐNG nhóm phụ (mã không mất).`,
      tone: 'danger',
      confirmLabel: 'Xoá nhãn',
    })
    if (!ok) return
    const r = await send('/api/dept/warehouse/material-groups/subgroups', 'POST', {
      action: 'delete',
      group_name: g.label,
      name: sub.name,
    })
    if (r) toast.success(`Đã xoá nhóm phụ "${sub.name}"`, `${num(sub.count)} mã về trống`)
  }

  const listHref = (g: string, extra = '') =>
    `/planning/materials?group=${encodeURIComponent(g)}${extra}`

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư & giá mua', href: '/planning/materials' },
          { label: 'Nhóm vật tư' },
        ]}
        title="Nhóm vật tư"
        description="Nhóm chính là danh sách chốt — quyết định phạm vi chặn trùng tên khi khai vật tư. Nhóm phụ là nhãn trên từng mã: đổi tên, gộp bản gõ lệch, xoá nhãn thừa."
        actions={
          canEdit && (
            <Button size="sm" onClick={() => open({ kind: 'create' })}>
              <Plus /> Thêm nhóm chính
            </Button>
          )
        }
      />

      <StatTiles>
        <StatTile label="Nhóm chính" value={active.length} icon={FolderTree} />
        <StatTile label="Nhóm phụ" value={stats.subs} icon={Tags} />
        <StatTile
          label="Mã trống nhóm phụ"
          value={num(stats.noSub)}
          icon={Layers}
          tone={stats.noSub > 0 ? 'warn' : 'default'}
          hint="gán ở màn danh mục: lọc nhóm → tích → đổi nhóm phụ"
        />
        <StatTile
          label="Nhóm phụ nghi gõ lệch"
          value={stats.suspect}
          icon={Merge}
          tone={stats.suspect > 0 ? 'stop' : 'default'}
          hint="≤ 5 mã, đứng cạnh nhãn ≥ 50 mã cùng nhóm"
        />
      </StatTiles>

      {(data.orphans.length > 0 || data.ungrouped > 0) && (
        <div className="rounded-lg border px-3.5 py-2.5 text-[13px]">
          {data.ungrouped > 0 && (
            <span>
              <b>{num(data.ungrouped)}</b> mã chưa có nhóm chính.{' '}
            </span>
          )}
          {data.orphans.length > 0 && (
            <span>
              Tên nhóm không có trong danh mục:{' '}
              {data.orphans.map((o) => (
                <Link
                  key={o.name}
                  href={listHref(o.name)}
                  className="mr-2 hover:underline"
                >
                  <Badge tone="amber">
                    {o.name} · {num(o.total)}
                  </Badge>
                </Link>
              ))}
              — thêm nhóm đúng tên, hoặc đổi nhóm cho các mã đó.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {active.length === 0 && (
          <EmptyState icon={<FolderTree />} title="Chưa có nhóm chính nào" />
        )}
        {active.map((g) => (
          <section key={g.id} className="bg-card rounded-xl border">
            <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <Link href={listHref(g.label)} className="t-title hover:underline">
                {g.label}
              </Link>
              <span className="t-data text-muted-foreground text-[12px]">
                {num(g.total)} mã
              </span>
              {g.no_sub > 0 && (
                <Link
                  href={listHref(g.label)}
                  className="text-[12px] hover:underline"
                  style={{ color: 'var(--warn)' }}
                  title="Mã trong nhóm chưa có nhóm phụ — tích chọn ở màn danh mục rồi đổi nhóm phụ"
                >
                  {num(g.no_sub)} trống nhóm phụ
                </Link>
              )}
              {/*
                MẪU ĐƠN MẶC ĐỊNH CỦA NHÓM (0183) — mồi cho vật tư MỚI khai vào
                nhóm này. Không đụng vật tư đã có: mẫu thuộc về vật tư/đơn, đây
                chỉ là giá trị khởi đầu để người khai khỏi phải nhớ.
              */}
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Mẫu đơn</span>
                {canEdit ? (
                  <ToolbarSelect
                    value={g.meta?.po_template ?? ''}
                    onChange={(v) => void setTemplate(g, v)}
                    aria-label={`Mẫu đơn mua mặc định của nhóm ${g.label}`}
                    options={[
                      { value: '', label: '— chưa đặt —' },
                      ...PO_TEMPLATES.map((t) => ({
                        value: t,
                        label: poTemplateMeta(t).label,
                      })),
                    ]}
                  />
                ) : (
                  <span className="text-[12px]">
                    {g.meta?.po_template
                      ? poTemplateMeta(g.meta.po_template as never).label
                      : '—'}
                  </span>
                )}
              </span>
              {canEdit && (
                <span className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => open({ kind: 'rename-group', g })}
                    title="Đổi tên — mọi mã trong nhóm đổi theo"
                  >
                    <Pencil /> Đổi tên
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={g.total > 0}
                    onClick={() => void toggleGroup(g)}
                    title={
                      g.total > 0
                        ? 'Còn mã trong nhóm — đổi nhóm cho chúng trước'
                        : 'Ngừng dùng'
                    }
                  >
                    Ngừng
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={g.total > 0}
                    onClick={() => void removeGroup(g)}
                    title={
                      g.total > 0
                        ? 'Còn mã trong nhóm — đổi nhóm cho chúng trước'
                        : 'Xoá hẳn'
                    }
                  >
                    <Trash2 /> Xoá
                  </Button>
                </span>
              )}
            </header>
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {g.subs.length === 0 && (
                <span className="text-muted-foreground text-[12.5px]">
                  Chưa có nhóm phụ — gõ nhãn mới ngay trên form vật tư, hoặc đổi nhóm phụ
                  hàng loạt ở màn danh mục.
                </span>
              )}
              {g.subs.map((s) => {
                const suspect =
                  s.count <= 5 && g.subs.some((x) => x.count >= 50 && x.name !== s.name)
                return (
                  <span
                    key={s.name}
                    className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-[12.5px]"
                    style={suspect ? { borderColor: 'var(--stop)' } : undefined}
                    title={
                      suspect
                        ? 'Ít mã, đứng cạnh nhãn lớn — nhiều khả năng gõ lệch, nên gộp'
                        : undefined
                    }
                  >
                    <Link href={listHref(g.label)} className="hover:underline">
                      {s.name}
                    </Link>
                    <span className="t-data text-muted-foreground text-[11px]">
                      {num(s.count)}
                    </span>
                    {canEdit && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => open({ kind: 'rename-sub', g, from: s.name })}
                          aria-label={`Đổi tên hoặc gộp nhóm phụ ${s.name}`}
                          title="Đổi tên / gộp vào nhãn khác"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={() => void removeSub(g, s)}
                          aria-label={`Xoá nhóm phụ ${s.name}`}
                          title="Xoá nhãn — mã về trống nhóm phụ"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </span>
                )
              })}
            </div>
          </section>
        ))}

        {inactive.length > 0 && (
          <div className="text-[12.5px]">
            <Button size="sm" variant="ghost" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Ẩn' : 'Xem'} {inactive.length} nhóm đã ngừng
            </Button>
            {showInactive && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {inactive.map((g) => (
                  <span
                    key={g.id}
                    className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5"
                  >
                    {g.label}
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-[12px]"
                        onClick={() => void toggleGroup(g)}
                      >
                        bật lại
                      </Button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={dlg !== null}
        onClose={() => setDlg(null)}
        title={
          dlg?.kind === 'create'
            ? 'Thêm nhóm chính'
            : dlg?.kind === 'rename-group'
              ? `Đổi tên nhóm "${dlg.g.label}"`
              : dlg?.kind === 'rename-sub'
                ? `Nhóm phụ "${dlg.from}" — ${dlg.g.label}`
                : ''
        }
        maxWidth="sm:max-w-md"
      >
        {dlg && (
          <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
            {dlg.kind === 'rename-group' && (
              <p className="text-muted-foreground text-xs">
                {num(dlg.g.total)} mã đang mang tên này sẽ đổi theo. Bộ lọc, phiếu in và
                đơn cũ đọc tên mới.
              </p>
            )}
            {dlg.kind === 'rename-sub' && dlg.g.subs.length > 1 && (
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Gộp vào nhãn đã có</span>
                <ToolbarSelect
                  value={mergeTo}
                  onChange={setMergeTo}
                  aria-label="Gộp vào nhãn đã có"
                  options={[
                    { value: '', label: '— không gộp, đổi tên mới —' },
                    ...dlg.g.subs
                      .filter((s) => s.name !== dlg.from)
                      .map((s) => ({
                        value: s.name,
                        label: `${s.name} (${num(s.count)})`,
                      })),
                  ]}
                />
              </label>
            )}
            {!(dlg.kind === 'rename-sub' && mergeTo) && (
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  {dlg.kind === 'rename-sub' ? 'Tên mới của nhóm phụ' : 'Tên nhóm'}
                </span>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setDlg(null)}>
                Huỷ
              </Button>
              <Button
                type="submit"
                disabled={busy || (!mergeTo && name.trim().length < 2)}
              >
                {busy && <Spinner size={12} />}
                {dlg.kind === 'create'
                  ? 'Thêm'
                  : dlg.kind === 'rename-sub' && mergeTo
                    ? 'Gộp'
                    : 'Đổi tên'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
