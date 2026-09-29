'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  FastTab,
  Menu,
  NoticeBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  TextLink,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { suspectSubs } from '@/lib/material-subgroup'
import type {
  GroupRow,
  GroupsOverview,
} from '@/modules/dept/warehouse/material-groups.service'
import { NhomConSheet, NhomTenSheet } from './nhom-sheets'

const n = (x: number) => x.toLocaleString('vi-VN')
const roChia = (g: string) => `/mua-hang/vat-tu?nhom=${encodeURIComponent(g)}&kn=1`

type Mo =
  | { k: 'them' }
  | { k: 'ten'; g: GroupRow }
  | { k: 'con'; g: GroupRow; sub: string; suggest?: string }
  | null

export function NhomScreen({
  data,
  canEdit,
  templates,
}: {
  data: GroupsOverview
  /** Quyền `warehouse.material.group_manage` — đúng quyền service kiểm. */
  canEdit: boolean
  templates: { value: string; label: string }[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [mo, setMo] = useState<Mo>(null)
  const xong = () => {
    setMo(null)
    router.refresh()
  }

  const dang = data.groups.filter((g) => g.is_active)
  const ngung = data.groups.filter((g) => !g.is_active)
  const nghi = useMemo(
    () => new Map(dang.map((g) => [g.id, suspectSubs(g.subs)])),
    [dang],
  )
  const tongCon = dang.reduce((s, g) => s + g.subs.length, 0)
  const tongTrong = dang.reduce((s, g) => s + g.no_sub, 0)
  const tongNghi = [...nghi.values()].reduce((s, m) => s + m.size, 0)

  async function patch(g: GroupRow, body: Record<string, unknown>, ok: string) {
    try {
      await api(`/api/dept/warehouse/material-groups/${g.id}`, { method: 'PATCH', body })
      toast.success(ok, g.label)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được', apiErrorText(e))
    }
  }
  async function xoa(g: GroupRow) {
    try {
      await api(`/api/dept/warehouse/material-groups/${g.id}`, { method: 'DELETE' })
      toast.success('Đã xoá nhóm', g.label)
      router.refresh()
    } catch (e) {
      toast.error('Không xoá được', apiErrorText(e))
    }
  }

  const conMa = (g: GroupRow) =>
    g.total > 0 ? `Còn ${n(g.total)} mã — chuyển hết sang nhóm khác trước` : undefined

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng · Vật tư"
        title="Nhóm vật tư"
        facts={[
          { label: 'Nhóm chính', value: String(dang.length) },
          { label: 'Nhóm con', value: String(tongCon) },
          {
            label: 'Mã chưa có nhóm con',
            value: n(tongTrong),
            tone: tongTrong > 0 ? 'warn' : 'neutral',
          },
          {
            label: 'Nhãn nghi trùng',
            value: String(tongNghi),
            tone: tongNghi > 0 ? 'warn' : 'neutral',
          },
        ]}
        actions={
          <>
            <Btn icon="truoc" href="/mua-hang/vat-tu">
              Danh mục vật tư
            </Btn>
            <Btn
              icon="them"
              primary
              blockedBy={canEdit ? undefined : 'phòng Cung ứng / Kho'}
              onClick={() => setMo({ k: 'them' })}
            >
              {' '}
              {/* prettier-ignore */}
              Thêm nhóm chính
            </Btn>
          </>
        }
      />

      {tongNghi > 0 && (
        <NoticeBar tag="Nhãn nghi trùng">
          Nhãn có dấu ⚠ gần giống một nhãn khác nhiều mã hơn trong cùng nhóm (bỏ dấu,
          gạch, khoảng trắng) — bấm để gộp.
        </NoticeBar>
      )}
      {(data.ungrouped > 0 || data.orphans.length > 0) && (
        <NoticeBar tag="Chưa vào nhóm" tone="stop">
          {data.ungrouped > 0 && `${n(data.ungrouped)} mã chưa có nhóm chính. `}
          {data.orphans.length > 0 &&
            `Tên nhóm lạ (không có trong danh mục): ${data.orphans.map((o) => `${o.name} · ${n(o.total)} mã`).join('; ')}.`}{' '}
          {/* prettier-ignore */}
        </NoticeBar>
      )}

      <Table label="Nhóm vật tư">
        <THead pinFirst>
          <th>Nhóm chính</th>
          <th style={{ textAlign: 'right' }}>Mã</th>
          <th style={{ textAlign: 'right' }}>Chưa có nhóm con</th>
          <th>Nhóm con · số mã</th>
          <th>Mẫu đơn mặc định</th>
          <th />
        </THead>
        <tbody>
          {dang.map((g) => {
            const sus = nghi.get(g.id)!
            return (
              <Row key={g.id}>
                <Cell pin>
                  <TextLink
                    strong
                    href={`/mua-hang/vat-tu?nhom=${encodeURIComponent(g.label)}`}
                  >
                    {g.label}
                  </TextLink>
                </Cell>
                <Cell num>
                  <Num value={n(g.total)} />
                </Cell>
                <Cell num>
                  {g.no_sub > 0 ? (
                    <TextLink href={roChia(g.label)} title="Mở rổ chia nhóm đã lọc sẵn">
                      {n(g.no_sub)}
                    </TextLink>
                  ) : (
                    <Num value="0" />
                  )}
                </Cell>
                <Cell grow>
                  <span className="flex flex-wrap gap-1 py-1">
                    {g.subs.map((s) => (
                      <Chip
                        key={s.name}
                        count={s.count}
                        icon={sus.has(s.name) ? 'canhBao' : undefined}
                        onClick={() =>
                          canEdit &&
                          setMo({ k: 'con', g, sub: s.name, suggest: sus.get(s.name) })
                        }
                      >
                        {s.name}
                      </Chip>
                    ))}
                  </span>
                </Cell>
                <Cell>
                  {canEdit ? (
                    <Pick
                      label={`Mẫu đơn mặc định của ${g.label}`}
                      value={g.meta.po_template ?? ''}
                      onChange={(v) =>
                        void patch(
                          g,
                          { po_template: v || null },
                          'Đã đổi mẫu đơn mặc định',
                        )
                      }
                      options={[{ value: '', label: '— chưa đặt —' }, ...templates]}
                      width={200}
                    />
                  ) : (
                    (templates.find((t) => t.value === g.meta.po_template)?.label ?? '—')
                  )}
                </Cell>
                <Cell>
                  {canEdit && (
                    <Menu
                      ariaLabel={`Thao tác nhóm ${g.label}`}
                      items={[
                        { label: 'Đổi tên', onClick: () => setMo({ k: 'ten', g }) },
                        { label: 'Ngừng dùng', onClick: () => void patch(g, { is_active: false }, 'Đã ngừng nhóm'), why: conMa(g) }, // prettier-ignore
                        {
                          label: 'Xoá nhóm',
                          danger: true,
                          onClick: () => void xoa(g),
                          why: conMa(g),
                        },
                      ]}
                    />
                  )}
                </Cell>
              </Row>
            )
          })}
        </tbody>
      </Table>

      {ngung.length > 0 && (
        <FastTab
          title={`Nhóm đã ngừng (${ngung.length})`}
          summary={[['Mã', n(ngung.reduce((s, g) => s + g.total, 0))]]}
        >
          <span className="flex flex-wrap gap-2">
            {ngung.map((g) => (
              <Chip
                key={g.id}
                icon="mo"
                onClick={() =>
                  canEdit && void patch(g, { is_active: true }, 'Đã bật lại nhóm')
                }
              >
                {g.label}
              </Chip>
            ))}
          </span>
        </FastTab>
      )}

      <StatusBar
        left={[
          'Số mã đếm mã đang dùng',
          canEdit
            ? 'Bấm nhãn nhóm con để gộp / đổi tên / xoá · bấm nhóm đã ngừng để bật lại'
            : 'Chỉ xem',
        ]}
        right={`${dang.length} nhóm · ${tongCon} nhóm con`}
      />

      {mo?.k === 'them' && <NhomTenSheet onClose={() => setMo(null)} onDone={xong} />}
      {mo?.k === 'ten' && (
        <NhomTenSheet group={mo.g} onClose={() => setMo(null)} onDone={xong} />
      )}
      {mo?.k === 'con' && (
        <NhomConSheet
          group={mo.g}
          sub={mo.sub}
          suggest={mo.suggest}
          onClose={() => setMo(null)}
          onDone={xong}
        />
      )}
    </ScreenFrame>
  )
}
