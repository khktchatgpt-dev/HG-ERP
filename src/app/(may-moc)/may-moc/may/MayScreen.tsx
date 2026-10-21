'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Empty,
  FilterBar,
  Hint,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { normalizeSearch } from '@/lib/search-text'
import { inBooks, isDown, vnd } from '@/lib/may-moc'
import type {
  AssetView,
  AssetsMeta,
  AssetFormOptions,
} from '@/modules/core/assets/assets.service'
import { AssetCode, DueText, StatusTag } from '../_ui/shared'
import { AssetFormSheet } from '../_ui/asset-dialogs'
import { ImportSheet } from '../_ui/import-dialogs'
import { ReportIssueSheet } from '../_ui/issue-dialogs'

type Tab = 'machine' | 'tool' | 'out'
export type Loc = '' | 'down' | 'od' | 'idle'

/**
 * MÁY MÓC (khuôn C · Danh sách) — "Trong số máy, máy nào cần tôi động vào?"
 * Ba thẻ: máy · dụng cụ cầm tay · đã thanh lý/mất. Chip đếm bằng ĐÚNG hàm lọc
 * của bảng (`match` dưới đây). Bấm dòng mở hồ sơ máy — cùng trang tem QR dẫn tới.
 */
export function MayScreen({
  meta,
  assets,
  options,
  openImport = false,
  initialLoc = '',
}: {
  meta: AssetsMeta
  assets: AssetView[]
  options: AssetFormOptions
  openImport?: boolean
  /** `?loc=down` từ ô "Máy đang dừng" ở Việc hôm nay. */
  initialLoc?: Loc
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('machine')
  const [loc, setLoc] = useState<Loc>(initialLoc)
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('')
  const [group, setGroup] = useState('')
  const [dialog, setDialog] = useState<null | 'add' | 'addTool' | 'import' | 'report'>(
    openImport ? 'import' : null,
  )

  const inTab = useMemo(
    () =>
      assets.filter((a) =>
        tab === 'out' ? !inBooks(a.status) : inBooks(a.status) && a.kind === tab,
      ),
    [assets, tab],
  )
  const base = useMemo(() => {
    const t = normalizeSearch(q).split(/\s+/).filter(Boolean)
    return inTab.filter(
      (a) =>
        (!dept || a.department_id === dept) &&
        (!group || a.group_id === group) &&
        t.every((w) =>
          normalizeSearch(
            `${a.code} ${a.name} ${a.model ?? ''} ${a.serial ?? ''} ${a.holder?.name ?? ''}`,
          ).includes(w),
        ),
    )
  }, [inTab, q, dept, group])
  const match = (a: AssetView, l: Loc) =>
    l === '' ||
    (l === 'down' ? isDown(a.status) : l === 'od' ? a.overdue : a.status === 'chua_dung')
  const rows = base.filter((a) => match(a, loc))
  const count = (l: Loc) => base.filter((a) => match(a, l)).length
  const machines = assets.filter((a) => a.kind === 'machine' && inBooks(a.status))
  const tools = assets.filter((a) => a.kind === 'tool' && inBooks(a.status))
  const out = assets.filter((a) => !inBooks(a.status))
  const groups = options.groups.filter((g) => (tab === 'out' ? true : g.kind === tab))
  const deptsUsed = options.depts.filter((d) =>
    inTab.some((a) => a.department_id === d.id),
  )
  const reportable = assets
    .filter((a) => inBooks(a.status))
    .map((a) => ({ id: a.id, code: a.code, name: a.name }))

  return (
    <ScreenFrame tableMin={1080}>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title="Máy móc"
        facts={[
          { label: 'Máy', value: `${machines.length}` },
          {
            label: 'Đang dừng',
            value: `${machines.filter((a) => isDown(a.status)).length}`,
            tone: machines.some((a) => isDown(a.status)) ? 'stop' : undefined,
          },
          { label: 'Dụng cụ', value: `${tools.length}` },
        ]}
        actions={
          <>
            {meta.can_edit && (
              <Btn
                primary
                icon="them"
                onClick={() => setDialog(tab === 'tool' ? 'addTool' : 'add')}
              >
                {tab === 'tool' ? 'Thêm dụng cụ' : 'Thêm máy'}
              </Btn>
            )}
            {meta.can_edit && (
              <Btn icon="excel" onClick={() => setDialog('import')}>
                Nhập từ Excel
              </Btn>
            )}
            <Btn icon="in" href={`/may-moc/tem${dept ? `?to=${dept}` : ''}`}>
              In tem QR
            </Btn>
            <Btn
              icon="canhBao"
              onClick={() => setDialog('report')}
              disabled={reportable.length === 0}
            >
              Báo hỏng
            </Btn>
          </>
        }
      />
      <FilterBar dense label="Loại">
        <Chip
          on={tab === 'machine'}
          count={machines.length}
          onClick={() => {
            setTab('machine')
            setGroup('')
          }}
        >
          Máy, thiết bị
        </Chip>
        <Chip
          on={tab === 'tool'}
          count={tools.length}
          onClick={() => {
            setTab('tool')
            setGroup('')
            setLoc('')
          }}
        >
          Dụng cụ cầm tay
        </Chip>
        <Chip
          on={tab === 'out'}
          count={out.length}
          onClick={() => {
            setTab('out')
            setGroup('')
            setLoc('')
          }}
        >
          Đã thanh lý, mất
        </Chip>
      </FilterBar>
      <FilterBar dense label="Lọc máy">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm tên, mã tem, serial, người giữ…"
          width={260}
          label="Tìm máy"
        />
        <Pick
          label="Tổ"
          value={dept}
          onChange={setDept}
          options={[
            { value: '', label: 'Mọi tổ' },
            ...deptsUsed.map((d) => ({ value: d.id, label: d.name })),
          ]}
        />
        <Pick
          label="Nhóm"
          value={group}
          onChange={setGroup}
          options={[
            { value: '', label: 'Mọi nhóm' },
            ...groups.map((g) => ({ value: g.id, label: g.name })),
          ]}
        />
        {tab === 'machine' && (
          <>
            <Chip on={loc === ''} count={count('')} onClick={() => setLoc('')}>
              Tất cả
            </Chip>
            <Chip
              on={loc === 'down'}
              count={count('down')}
              onClick={() => setLoc(loc === 'down' ? '' : 'down')}
            >
              Đang dừng
            </Chip>
            <Chip
              on={loc === 'od'}
              count={count('od')}
              onClick={() => setLoc(loc === 'od' ? '' : 'od')}
            >
              Có việc quá hạn
            </Chip>
            <Chip
              on={loc === 'idle'}
              count={count('idle')}
              onClick={() => setLoc(loc === 'idle' ? '' : 'idle')}
            >
              Chưa đưa vào dùng
            </Chip>
          </>
        )}
      </FilterBar>

      {assets.length === 0 ? (
        <Empty
          level={2}
          headline="Chưa có máy nào trong hệ thống"
          reason="Lịch bảo trì, báo hỏng và chi phí đều tính trên danh sách máy, nên chúng cũng đang trống."
          next={
            meta.can_edit ? (
              <>
                <Btn primary icon="excel" onClick={() => setDialog('import')}>
                  Nhập từ Excel
                </Btn>
                <Btn icon="them" onClick={() => setDialog('add')}>
                  Thêm máy
                </Btn>
              </>
            ) : (
              <Hint size="sm">
                Tổ Cơ điện nhập danh sách máy — nhờ họ hoặc quản trị hệ thống.
              </Hint>
            )
          }
        />
      ) : rows.length === 0 ? (
        <Empty
          headline={
            inTab.length === 0
              ? tab === 'tool'
                ? 'Chưa có dụng cụ nào'
                : tab === 'out'
                  ? 'Chưa có máy nào thanh lý hay mất'
                  : 'Chưa có máy nào'
              : 'Không có dòng nào khớp bộ lọc'
          }
          reason={
            inTab.length === 0
              ? 'Thẻ này đang trống.'
              : `Có ${inTab.length} dòng ở thẻ này — bộ lọc hiện tại không để lại dòng nào.`
          }
          next={
            inTab.length === 0 && tab === 'tool' && meta.can_edit ? (
              <Btn primary icon="them" onClick={() => setDialog('addTool')}>
                Thêm dụng cụ
              </Btn>
            ) : (
              <Btn
                icon="boLoc"
                onClick={() => {
                  setLoc('')
                  setQ('')
                  setDept('')
                  setGroup('')
                }}
              >
                Bỏ lọc
              </Btn>
            )
          }
        />
      ) : (
        <Table label="Danh sách máy">
          <THead pinFirst>
            <th>Mã tem</th>
            <th>Tên</th>
            <th>Nhóm</th>
            <th>Đặt tại</th>
            <th>{tab === 'tool' ? 'Người giữ' : 'Phụ trách'}</th>
            <th style={{ textAlign: 'right' }}>Giờ chạy</th>
            <th>{tab === 'out' ? 'Ngày ra sổ' : 'Việc bảo trì gần nhất'}</th>
            <th>Trạng thái</th>
          </THead>
          <tbody>
            {rows.map((a) => (
              <Row
                key={a.id}
                onClick={() => router.push(`/may-moc/may/${encodeURIComponent(a.code)}`)}
              >
                <Cell pin rowHeader>
                  <AssetCode code={a.code} />
                </Cell>
                <Cell
                  grow
                  title={[a.name, a.model, a.serial].filter(Boolean).join(' · ')}
                >
                  <span className="block truncate">{a.name}</span>
                  {(a.model || a.serial) && (
                    <span className="text-k-label block truncate text-[var(--ink-3)]">
                      {[a.model, a.serial && `serial ${a.serial}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </Cell>
                <Cell muted title={a.group_name}>
                  {/* Tên nhóm dài ("Máy cắt (cưa sắt, cưa nhôm, cắt ống, laser)")
                      từng đẩy bảng tràn ngang ở 1280px, khuất cột Trạng thái. */}
                  <span className="block max-w-[170px] truncate">{a.group_name}</span>
                </Cell>
                <Cell>
                  {a.dept_name ?? (
                    <span className="text-[var(--ink-empty)]">chưa gán</span>
                  )}
                </Cell>
                <Cell>
                  {a.kind === 'tool' ? (
                    a.holder ? (
                      <>
                        {a.holder.name}
                        {a.holder.left_on != null && (
                          <>
                            {' '}
                            <Tag tone="stop">Đã nghỉ</Tag>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-[var(--ink-empty)]">trong kho</span>
                    )
                  ) : (
                    (a.resp_name ?? (
                      <span className="text-[var(--ink-empty)]">chưa giao</span>
                    ))
                  )}
                </Cell>
                <Cell num>{a.hours_per_day ? vnd(a.hours) : ''}</Cell>
                <Cell>
                  {tab === 'out' ? (
                    <span className="text-k-sm font-mono">{a.disposed_on ?? '—'}</span>
                  ) : a.next_plan ? (
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate" title={a.next_plan.task}>
                        {a.next_plan.is_inspection && <b>Kiểm định </b>}
                        {a.next_plan.task}
                      </span>
                      <DueText due={a.next_plan.due} />
                    </span>
                  ) : (
                    <span className="text-[var(--ink-empty)]">
                      {a.kind === 'tool'
                        ? ''
                        : a.status === 'chua_dung'
                          ? 'chưa dùng — chưa tính lịch'
                          : 'chưa có lịch'}
                    </span>
                  )}
                </Cell>
                <Cell>
                  <StatusTag kind={a.kind} status={a.status} />
                  {a.open_issue && (
                    <span className="text-k-label block font-mono text-[var(--ink-3)]">
                      {a.open_issue.no}
                    </span>
                  )}
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={<td colSpan={5}>Cộng {rows.length} dòng đang hiện</td>}
            cells={null}
            caveatSpan={3}
            caveat={
              tab === 'machine'
                ? `không gồm ${tools.length} dụng cụ và ${out.length} máy đã thanh lý / mất`
                : undefined
            }
          />
        </Table>
      )}

      {dialog === 'add' && (
        <AssetFormSheet
          options={options}
          onClose={() => setDialog(null)}
          onCreated={(code) =>
            router.push(`/may-moc/may/${encodeURIComponent(code)}?muc=tem`)
          }
        />
      )}
      {dialog === 'addTool' && (
        <AssetFormSheet options={options} kind="tool" onClose={() => setDialog(null)} />
      )}
      {dialog === 'import' && (
        <ImportSheet
          onClose={() => {
            setDialog(null)
            // Bỏ `?nhap=1` để tải lại trang không bật hộp lần nữa.
            if (openImport) router.replace('/may-moc/may', { scroll: false })
          }}
        />
      )}
      {dialog === 'report' && (
        <ReportIssueSheet assets={reportable} onClose={() => setDialog(null)} />
      )}
    </ScreenFrame>
  )
}
