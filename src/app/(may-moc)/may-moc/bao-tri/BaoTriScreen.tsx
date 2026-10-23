'use client'

import { Fragment, useState } from 'react'
import {
  Btn,
  Cell,
  Chip,
  Empty,
  FilterBar,
  NoticeBar,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  TFoot,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { dmy, everyTxt, inspectionSoon, vnd } from '@/lib/may-moc'
import type {
  AssetsMeta,
  AssetFormOptions,
  PlanView,
} from '@/modules/core/assets/assets.service'
import type { WorkOrderRow } from '@/modules/core/assets/assets.repo'
import { AssetCode, DueText } from '../_ui/shared'
import { PlanDoneSheet } from '../_ui/asset-dialogs'

type Plan = PlanView & { last_cost: number | null }
type Done = WorkOrderRow & {
  asset_code: string
  asset_name: string
  dept_name: string | null
  tech_name: string | null
}
export type Tab = 'todo' | 'all' | 'kd' | 'done'

/**
 * LỊCH BẢO TRÌ (khuôn C) — "Hạng mục nào tới hạn, cái nào đã làm?" Lịch tự tính
 * theo chu kỳ: giờ chạy (máy có đồng hồ) hoặc ngày / tháng. "Đã làm" ghi phiếu
 * và dời lịch sang kỳ sau. Kiểm định bắt buộc nhắc trước 30 ngày.
 */
export function BaoTriScreen({
  meta,
  plans,
  done30,
  options,
  initialTab = 'todo',
}: {
  meta: AssetsMeta
  plans: Plan[]
  done30: Done[]
  options: AssetFormOptions
  /** `?tab=kd` từ ô "Kiểm định ≤ 30 ngày" ở Việc hôm nay. */
  initialTab?: Tab
}) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [dept, setDept] = useState('')
  const [doing, setDoing] = useState<Plan | null>(null)
  const inDept = (name: string | null) => !dept || name === dept
  const p = plans.filter((x) => inDept(x.asset.dept_name))
  const todo = p.filter((x) => x.state !== 'ok')
  const kd = p.filter((x) => x.is_inspection)
  const done = done30.filter((w) => inDept(w.dept_name))
  const rows = tab === 'todo' ? todo : tab === 'kd' ? kd : p
  const deptNames = [
    ...new Set(plans.map((x) => x.asset.dept_name).filter((x): x is string => !!x)),
  ].sort((a, b) => a.localeCompare(b, 'vi'))
  const od = p.filter((x) => x.state === 'od').length

  return (
    <ScreenFrame tableMin={1000}>
      <ScreenHeader
        compact
        eyebrow="Máy móc & bảo trì"
        title="Lịch bảo trì"
        facts={[
          { label: 'Quá hạn', value: `${od}`, tone: od ? 'stop' : undefined },
          {
            label: 'Trong 7 ngày',
            value: `${p.filter((x) => x.state === 'soon').length}`,
            tone: p.some((x) => x.state === 'soon') ? 'warn' : undefined,
          },
          {
            label: 'Kiểm định ≤ 30 ngày',
            value: `${kd.filter((x) => inspectionSoon(x.due.days)).length}`,
          },
        ]}
      />
      <FilterBar dense label="Lọc lịch">
        <Chip on={tab === 'todo'} count={todo.length} onClick={() => setTab('todo')}>
          Cần làm
        </Chip>
        <Chip on={tab === 'all'} count={p.length} onClick={() => setTab('all')}>
          Toàn bộ lịch
        </Chip>
        <Chip on={tab === 'kd'} count={kd.length} onClick={() => setTab('kd')}>
          Kiểm định
        </Chip>
        <Chip on={tab === 'done'} count={done.length} onClick={() => setTab('done')}>
          Đã làm 30 ngày
        </Chip>
        <Pick
          label="Tổ"
          value={dept}
          onChange={setDept}
          options={[
            { value: '', label: 'Mọi tổ' },
            ...deptNames.map((d) => ({ value: d, label: d })),
          ]}
        />
        <span className="text-k-label ml-auto text-[var(--ink-3)]">
          Quá hạn: đỏ · ≤ 7 ngày: cam · bấm “Đã làm” để ghi lại, lịch tự dời kỳ sau
        </span>
      </FilterBar>
      {tab === 'kd' && (
        <NoticeBar tone="warn" tag="Kiểm định bắt buộc">
          Lò hơi, bình khí nén, xe nâng, cân, xe tải, PCCC, trạm biến áp phải kiểm định /
          đăng kiểm định kỳ — hệ thống nhắc trước 30 ngày.
        </NoticeBar>
      )}

      {tab === 'done' ? (
        done.length === 0 ? (
          <Empty
            headline="Chưa có phiếu nào trong 30 ngày"
            reason="Chưa ai ghi bảo trì, sửa chữa hay kiểm định trong 30 ngày qua."
            next={<Btn onClick={() => setTab('todo')}>Xem việc cần làm</Btn>}
          />
        ) : (
          <Table label="Phiếu đã làm 30 ngày">
            <THead pinFirst>
              <th>Ngày</th>
              <th>Số phiếu</th>
              <th>Máy</th>
              <th>Loại</th>
              <th>Nội dung</th>
              <th>Người làm</th>
              <th style={{ textAlign: 'right' }}>Giờ dừng</th>
              <th style={{ textAlign: 'right' }}>Chi phí (đ)</th>
            </THead>
            <tbody>
              {done.map((w) => (
                <Row key={w.id}>
                  <Cell pin num>
                    {dmy(w.done_on)}
                  </Cell>
                  <Cell num>{w.no}</Cell>
                  <Cell grow>
                    <AssetCode code={w.asset_code} /> {w.asset_name}
                  </Cell>
                  <Cell>
                    {w.kind === 'SC' ? (
                      <Tag tone="warn">Sửa chữa</Tag>
                    ) : w.kind === 'KD' ? (
                      <Tag tone="run">Kiểm định</Tag>
                    ) : (
                      <Tag tone="done">Bảo dưỡng</Tag>
                    )}
                  </Cell>
                  <Cell title={w.title}>{w.title}</Cell>
                  <Cell muted>{w.tech_name ?? w.vendor ?? ''}</Cell>
                  <Cell num>{w.downtime_hours || ''}</Cell>
                  <Cell num>{vnd(w.cost)}</Cell>
                </Row>
              ))}
            </tbody>
            <TFoot
              label={<td colSpan={6}>Cộng {done.length} phiếu</td>}
              cells={
                <>
                  <td className="num">
                    {done
                      .reduce((s, w) => s + w.downtime_hours, 0)
                      .toLocaleString('vi-VN')}
                  </td>
                  <td className="num">{vnd(done.reduce((s, w) => s + w.cost, 0))}</td>
                </>
              }
            />
          </Table>
        )
      ) : rows.length === 0 ? (
        <Empty
          headline={
            plans.length === 0
              ? 'Chưa có lịch bảo trì nào'
              : tab === 'todo'
                ? 'Không có việc quá hạn hay tới hạn trong 7 ngày'
                : dept
                  ? 'Không có hạng mục nào khớp'
                  : tab === 'kd'
                    ? 'Chưa có hạng mục kiểm định nào'
                    : 'Chưa có hạng mục nào'
          }
          reason={
            plans.length === 0
              ? 'Lịch sinh ra khi thêm máy (theo lịch mẫu của nhóm) hoặc thêm hạng mục ở hồ sơ máy.'
              : tab === 'todo'
                ? 'Mọi hạng mục đang còn xa hạn — số 0 ở đây là tin tốt.'
                : dept
                  ? 'Bộ lọc tổ hiện tại không để lại dòng nào.'
                  : // Trước 23/10/2026 thẻ Kiểm định trống luôn nói "bộ lọc tổ…" dù không lọc.
                    'Thêm hạng mục ở hồ sơ máy và đánh dấu "Là kiểm định, đăng kiểm bắt buộc".'
          }
          next={
            plans.length === 0 ? (
              <Btn primary href="/may-moc/may">
                Mở danh sách máy
              </Btn>
            ) : (
              <Btn
                onClick={() => {
                  setTab('all')
                  setDept('')
                }}
              >
                Xem toàn bộ lịch
              </Btn>
            )
          }
        />
      ) : (
        <Table label="Lịch bảo trì">
          <THead pinFirst>
            <th>Máy</th>
            <th>Hạng mục</th>
            <th>Chu kỳ</th>
            <th>Lần trước</th>
            <th>Hạn</th>
            <th style={{ textAlign: 'right' }}>Chi phí kỳ trước</th>
            <th />
          </THead>
          <tbody>
            {rows.map((x, k) => (
              <Fragment key={x.id}>
                {/* Như demo: "Cần làm" chia hai nhóm, mỗi nhóm một dòng đầu có số. */}
                {tab === 'todo' && x.state !== rows[k - 1]?.state && (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-k-sm bg-[var(--surface-raised)] font-semibold"
                      style={{ color: x.state === 'od' ? 'var(--stop)' : 'var(--warn)' }}
                    >
                      {x.state === 'od' ? 'Quá hạn' : 'Đến hạn trong 7 ngày'} ·{' '}
                      {rows.filter((r) => r.state === x.state).length}
                    </td>
                  </tr>
                )}
                <Row>
                  <Cell pin rowHeader>
                    <AssetCode code={x.asset.code} />
                    <span
                      className="text-k-label block max-w-[220px] truncate text-[var(--ink-3)]"
                      title={`${x.asset.name} · ${x.asset.dept_name ?? ''}`}
                    >
                      {x.asset.name}
                      {x.asset.dept_name ? ` · ${x.asset.dept_name}` : ''}
                    </span>
                  </Cell>
                  <Cell grow title={x.task}>
                    {x.is_inspection && (
                      <>
                        <Tag tone="warn">Kiểm định</Tag>{' '}
                      </>
                    )}
                    {x.task}
                  </Cell>
                  <Cell muted>{everyTxt(x.every_n, x.unit)}</Cell>
                  <Cell num>
                    {dmy(x.last_date)}
                    {x.unit === 'h' && x.last_hours != null
                      ? ` · ${vnd(x.last_hours)} h`
                      : ''}
                  </Cell>
                  <Cell>
                    <DueText due={x.due} />
                  </Cell>
                  <Cell num>
                    {x.last_cost != null ? (
                      vnd(x.last_cost)
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  <Cell>
                    {meta.can_work && (
                      <Btn
                        primary={x.state !== 'ok'}
                        icon="tick"
                        onClick={() => setDoing(x)}
                      >
                        {x.is_inspection ? 'Đã kiểm định' : 'Đã làm'}
                      </Btn>
                    )}
                  </Cell>
                </Row>
              </Fragment>
            ))}
          </tbody>
          <TFoot
            label={
              <td colSpan={7}>
                Cộng {rows.length} hạng mục
                {tab === 'todo' ? ' quá hạn hoặc tới hạn trong 7 ngày' : ''} · không gồm
                máy chưa sử dụng, đã thanh lý và hạng mục tạm dừng
              </td>
            }
            cells={null}
          />
        </Table>
      )}
      {doing && (
        <PlanDoneSheet
          plan={doing}
          techs={options.techs}
          me={meta.employee_id}
          onClose={() => setDoing(null)}
        />
      )}
    </ScreenFrame>
  )
}
