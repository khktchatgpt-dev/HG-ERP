'use client'

import { useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Empty,
  FilterBar,
  NoticeBar,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
  TFoot,
  THead,
  Table,
} from '@/components/kit'
import { normalizeSearch } from '@/lib/search-text'
import { dmy } from '@/lib/may-moc'
import type {
  AssetsMeta,
  AssetFormOptions,
  PersonLite,
} from '@/modules/core/assets/assets.service'
import type { AssetRow } from '@/modules/core/assets/assets.repo'
import { AssetCode, StatusTag } from '../_ui/shared'
import { GiveSheet, RecallSheet, type ToolLite } from '../_ui/tool-dialogs'
import { AssetFormSheet } from '../_ui/asset-dialogs'

type Tool = AssetRow & { group_name: string; dept_name: string | null }
type Holder = { person: PersonLite | null; tools: Tool[]; last_given: string | null }
type Tab = 'held' | 'left' | 'store'
type Dlg =
  | null
  | { give: { emp?: string; ids?: string[] } }
  | { recall: { emp?: string; ids: string[]; note?: string } }
  | 'add'

/**
 * DỤNG CỤ THEO NGƯỜI (khuôn C) — "Ai đang giữ gì, ai nghỉ rồi chưa trả?" Ngày
 * nghỉ đọc từ Hồ sơ nhân viên (không ghi nghỉ việc ở khu này). Giao / thu hồi:
 * Kho + Ban Giám đốc (assets.tools); người không có quyền thấy nút khoá kèm lý do.
 */
export function DungCuScreen({
  meta,
  holders,
  store,
  options,
}: {
  meta: AssetsMeta
  holders: Holder[]
  store: Tool[]
  options: AssetFormOptions
}) {
  const [tab, setTab] = useState<Tab>('held')
  const [q, setQ] = useState('')
  const [dlg, setDlg] = useState<Dlg>(null)
  const left = holders.filter((h) => h.person?.left_on != null)
  const held = holders.reduce((s, h) => s + h.tools.length, 0)
  const filter = (s: string) =>
    normalizeSearch(q)
      .split(/\s+/)
      .filter(Boolean)
      .every((w) => normalizeSearch(s).includes(w))
  const shownHolders = (tab === 'left' ? left : holders).filter((h) =>
    filter(
      `${h.person?.name} ${h.person?.code} ${h.person?.team ?? ''} ${h.tools.map((t) => `${t.code} ${t.name}`).join(' ')}`,
    ),
  )
  const shownStore = store.filter((t) => filter(`${t.code} ${t.name}`))
  const heldList: ToolLite[] = holders.flatMap((h) =>
    h.tools.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      holder_id: h.person?.id,
      holder_name: h.person?.name,
      holder_left_on: h.person?.left_on ?? null,
    })),
  )
  // Như demo: giao theo CHIẾC — dòng nhập gộp (SL > 1) không giao được (máy chủ cũng chặn).
  const storeList: ToolLite[] = store
    .filter((t) => t.status === 'chua_dung' && t.qty === 1)
    .map((t) => ({ id: t.id, code: t.code, name: t.name }))
  const blocked = meta.can_tools ? undefined : 'Kho / Nhân sự / Ban Giám đốc'

  return (
    <ScreenFrame tableMin={960}>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title="Dụng cụ theo người"
        facts={[
          { label: 'Đang giao', value: `${held}` },
          { label: 'Người giữ', value: `${holders.length}` },
          {
            label: 'Đã nghỉ chưa trả',
            value: `${left.length}`,
            tone: left.length ? 'stop' : undefined,
          },
          // Cùng số với chip "Trong kho" (cả món hỏng nằm kho chờ sửa) — hai số
          // khác nhau dưới một nhãn là lỗi; món hỏng tách ra ô riêng.
          { label: 'Trong kho', value: `${store.length}` },
          ...(store.length > storeList.length
            ? [
                {
                  label: 'Hỏng chờ sửa',
                  value: `${store.length - storeList.length}`,
                  tone: 'warn' as const,
                },
              ]
            : []),
        ]}
        actions={
          <>
            <Btn
              primary
              icon="xuatKho"
              blockedBy={blocked}
              onClick={() => setDlg({ give: {} })}
            >
              Giao dụng cụ
            </Btn>
            <Btn
              icon="nhapKho"
              blockedBy={blocked}
              onClick={() => setDlg({ recall: { ids: [] } })}
            >
              Thu hồi
            </Btn>
            {meta.can_edit && (
              <Btn icon="them" onClick={() => setDlg('add')}>
                Thêm dụng cụ
              </Btn>
            )}
          </>
        }
      />
      {left.map((h) => (
        <NoticeBar
          key={h.person!.id}
          tone="stop"
          tag="Nghỉ việc chưa trả"
          action={
            meta.can_tools
              ? {
                  label: `Thu hồi cả ${h.tools.length}`,
                  onClick: () =>
                    setDlg({
                      recall: {
                        emp: h.person!.id,
                        ids: h.tools.map((t) => t.id),
                      },
                    }),
                }
              : undefined
          }
        >
          {h.person!.name} ({h.person!.team ?? 'chưa xếp tổ'}) nghỉ từ{' '}
          {dmy(h.person!.left_on || null)}, còn giữ {h.tools.length} dụng cụ:{' '}
          {h.tools.map((t) => t.name).join(', ')}.
        </NoticeBar>
      ))}
      <FilterBar dense label="Lọc dụng cụ">
        <Chip on={tab === 'held'} count={holders.length} onClick={() => setTab('held')}>
          Đang giữ
        </Chip>
        <Chip on={tab === 'left'} count={left.length} onClick={() => setTab('left')}>
          Đã nghỉ còn giữ
        </Chip>
        <Chip on={tab === 'store'} count={store.length} onClick={() => setTab('store')}>
          Trong kho
        </Chip>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm nhân viên, mã dụng cụ…"
          width={260}
          label="Tìm"
        />
      </FilterBar>

      {tab === 'store' ? (
        shownStore.length === 0 ? (
          <Empty
            headline="Kho dụng cụ đang trống"
            reason="Mọi dụng cụ đều đang giao cho người, hoặc chưa nhập dụng cụ nào."
            next={
              meta.can_edit ? (
                <Btn icon="them" primary onClick={() => setDlg('add')}>
                  Thêm dụng cụ
                </Btn>
              ) : (
                <span />
              )
            }
          />
        ) : (
          <Table label="Dụng cụ trong kho">
            <THead pinFirst>
              <th>Mã</th>
              <th>Tên</th>
              <th>Nhóm</th>
              <th>Trạng thái</th>
              <th />
            </THead>
            <tbody>
              {shownStore.map((t) => (
                <Row key={t.id}>
                  <Cell pin rowHeader>
                    <AssetCode code={t.code} />
                  </Cell>
                  <Cell grow>{t.name}</Cell>
                  <Cell muted>{t.group_name}</Cell>
                  <Cell>
                    <StatusTag kind="tool" status={t.status} />
                  </Cell>
                  <Cell>
                    {t.status === 'chua_dung' && (
                      <Btn
                        blockedBy={blocked}
                        onClick={() => setDlg({ give: { ids: [t.id] } })}
                      >
                        Giao
                      </Btn>
                    )}
                  </Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={
                <td colSpan={5}>
                  Cộng {shownStore.length} dụng cụ trong kho · dụng cụ hỏng nằm kho chờ
                  sửa, chưa giao được
                </td>
              }
              cells={null}
            />
          </Table>
        )
      ) : shownHolders.length === 0 ? (
        <Empty
          headline={
            tab === 'left'
              ? 'Không ai nghỉ việc mà còn giữ dụng cụ'
              : 'Chưa giao dụng cụ cho ai'
          }
          reason={
            tab === 'left'
              ? 'Đối chiếu ngày nghỉ ở Hồ sơ nhân viên — số 0 là tin tốt.'
              : 'Dụng cụ thêm vào nằm trong kho; giao cho nhân viên để biết ai đang giữ gì.'
          }
          next={
            <Btn
              primary
              icon="xuatKho"
              blockedBy={blocked}
              onClick={() => setDlg({ give: {} })}
            >
              Giao dụng cụ
            </Btn>
          }
        />
      ) : (
        <Table label="Dụng cụ theo người">
          <THead pinFirst>
            <th>Nhân viên</th>
            <th>Tổ</th>
            <th>Đang giữ</th>
            <th>Giao gần nhất</th>
            <th />
          </THead>
          <tbody>
            {shownHolders.map((h) => (
              <Row key={h.person!.id}>
                <Cell pin rowHeader>
                  {h.person!.name}
                  {h.person!.left_on != null && (
                    <>
                      {' '}
                      <Tag tone="stop">Đã nghỉ {dmy(h.person!.left_on || null)}</Tag>
                    </>
                  )}
                  <span className="text-k-label block font-mono text-[var(--ink-3)]">
                    mã NV {h.person!.code}
                  </span>
                </Cell>
                <Cell muted>
                  {[h.person!.job_title, h.person!.team].filter(Boolean).join(' · ') ||
                    '—'}
                </Cell>
                <Cell grow>
                  <span className="flex flex-wrap gap-x-3 gap-y-1">
                    {h.tools.map((t) => (
                      <span key={t.id} className="whitespace-nowrap">
                        <AssetCode code={t.code} /> {t.name}
                      </span>
                    ))}
                  </span>
                </Cell>
                <Cell num>{dmy(h.last_given)}</Cell>
                <Cell>
                  <span className="flex gap-1">
                    {h.person!.left_on == null && (
                      <Btn
                        blockedBy={blocked}
                        onClick={() => setDlg({ give: { emp: h.person!.id } })}
                      >
                        Giao thêm
                      </Btn>
                    )}
                    <Btn
                      blockedBy={blocked}
                      onClick={() =>
                        setDlg({
                          recall: { emp: h.person!.id, ids: h.tools.map((t) => t.id) },
                        })
                      }
                    >
                      Thu hồi
                    </Btn>
                  </span>
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={
              <td colSpan={5}>
                {shownHolders.length} người ·{' '}
                {shownHolders.reduce((s, h) => s + h.tools.length, 0)} dụng cụ · không gồm
                lưỡi cưa, đá mài, que hàn (hàng tiêu hao, quản ở Kho)
              </td>
            }
            cells={null}
          />
        </Table>
      )}

      {dlg && typeof dlg === 'object' && 'give' in dlg && (
        <GiveSheet
          store={storeList}
          employees={options.employees}
          employeeId={dlg.give.emp}
          preselect={dlg.give.ids}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg && typeof dlg === 'object' && 'recall' in dlg && (
        <RecallSheet
          held={heldList}
          holderId={dlg.recall.emp}
          preselect={dlg.recall.ids}
          note={dlg.recall.note}
          onClose={() => setDlg(null)}
        />
      )}
      {dlg === 'add' && (
        <AssetFormSheet options={options} kind="tool" onClose={() => setDlg(null)} />
      )}
    </ScreenFrame>
  )
}
