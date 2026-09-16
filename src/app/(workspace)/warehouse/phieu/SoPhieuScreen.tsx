'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isoToVn } from '@/lib/date-vn'
import { MA_LY_DO_KHO, nhanLyDo } from '@/lib/kho-ma-ly-do'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  NoticeBar,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  Tag,
} from '@/components/kit'
import { RO_PHIEU, RO_PHIEU_NHAN, type RoPhieu } from './ro-phieu'

export type PhieuRow = {
  id: string
  code: string
  kind: 'receipt' | 'issue' | 'transfer' | 'stocktake'
  doc_date: string
  counterparty: string | null
  reason: string | null
  status: 'pending' | 'posted' | 'rejected'
  /** Có = phiếu NÀY LÀ phiếu đảo của tờ kia. */
  reversal_of_code: string | null
  /** Ngược lại: tờ NÀY đã bị một phiếu đảo huỷ hiệu lực. */
  da_bi_dao: boolean
  created_by_name: string | null
  ma_ly_do: string[]
}

const fmt = (n: number) => n.toLocaleString('vi-VN')

/** Mã lý do đeo màu theo HƯỚNG, không theo vòng đời — vào xanh, ra lam, chuyển xám. */
function MaLyDo({ ma }: { ma: string }) {
  const huong = MA_LY_DO_KHO.find((x) => x.ma === ma)?.huong
  return (
    <Tag tone={huong === 'in' ? 'done' : 'neutral'}>
      <span className="num font-bold">{ma}</span>
    </Tag>
  )
}

/**
 * SỔ PHIẾU KHO — Khuôn C. Artboard 6:
 * https://claude.ai/artifact/G9Zso3vzCHUYpNGRp9o7Nf
 *
 * BỘ LỌC CHÍNH LÀ MÃ LÝ DO, không phải ngày: người đi soát hỏi "tháng này có
 * bao nhiêu phiếu huỷ", không hỏi "phiếu ngày 12/09".
 *
 * Phiếu đảo và phiếu gốc nằm cạnh nhau trong sổ, phiếu gốc gạch ngang — sổ
 * phải cộng lại đúng bằng những gì đã xảy ra, kể cả cái sai.
 */
export function SoPhieuScreen({
  rows,
  dem,
  total,
  trang,
  soTrang,
  ro,
  lyDo,
  canEdit,
}: {
  rows: PhieuRow[]
  dem: Record<RoPhieu, number>
  total: number
  trang: number
  soTrang: number
  ro: RoPhieu
  lyDo: string
  canEdit: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const dat = (p: Record<string, string | null>) => {
    const s = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(p)) {
      if (v) s.set(k, v)
      else s.delete(k)
    }
    if (!('trang' in p)) s.delete('trang')
    const qs = s.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Sổ phiếu"
          facts={[
            { label: 'Phiếu nhập', value: fmt(dem.receipt) },
            { label: 'Phiếu xuất', value: fmt(dem.issue) },
            { label: 'Tất cả', value: fmt(dem.all) },
          ]}
          actions={
            canEdit ? (
              <>
                <Btn href="/warehouse/nhap">Nhận hàng</Btn>
                <Btn href="/warehouse/xuat">Xuất kho</Btn>
              </>
            ) : undefined
          }
        />

        <FilterBar>
          <Pick
            value={lyDo}
            onChange={(v) => dat({ ly_do: v || null })}
            options={[
              { value: '', label: 'Mọi lý do' },
              ...MA_LY_DO_KHO.map((x) => ({ value: x.ma, label: `${x.ma} · ${x.nhan}` })),
            ]}
            label="Mã lý do"
            width={260}
          />
          {RO_PHIEU.map((id) => (
            <Chip
              key={id}
              on={ro === id}
              count={dem[id]}
              onClick={() => dat({ ro: id === 'all' ? null : id })}
            >
              {RO_PHIEU_NHAN[id]}
            </Chip>
          ))}
          {lyDo && (
            <Btn
              onClick={() => dat({ ly_do: null })}
              className="h-[26px] px-[9px] text-[12px]"
            >
              Bỏ lọc lý do
            </Btn>
          )}
        </FilterBar>

        {/*
          DẢI NÀY CHỈ HIỆN KHI ĐANG LỌC. Bản đầu để nó hiện thường trực như một
          lời giải thích — sai luật màu: vàng mã hoá VÒNG ĐỜI DỮ LIỆU, treo
          vĩnh viễn thì nó thành hình nền và lần có cảnh báo thật không ai
          thấy. Câu giải thích chuyển xuống chân màn, chỗ của luật nền.
        */}
        {(lyDo || ro !== 'all') && (
          <NoticeBar
            tone="warn"
            tag="Đang lọc"
            action={{ label: 'Xem cả sổ', onClick: () => dat({ ro: null, ly_do: null }) }}
          >
            Sổ đang thu lại còn rổ “{RO_PHIEU_NHAN[ro]}”
            {lyDo && ` và mã lý do ${lyDo} · ${nhanLyDo(lyDo)}`}. Tổng ở đầu trang vẫn là
            số của CẢ SỔ, không phải của phần đang lọc.
          </NoticeBar>
        )}

        {rows.length === 0 ? (
          <Empty
            headline="Không có phiếu nào trong rổ này"
            reason={
              lyDo
                ? `Chưa phiếu nào mang mã lý do “${lyDo} · ${nhanLyDo(lyDo)}”. Mã lý do bật từ 15/09/2026; phiếu cũ hơn được suy mã từ loại chứng từ.`
                : `Rổ “${RO_PHIEU_NHAN[ro]}” đang trống. Sổ đang có ${fmt(dem.all)} phiếu.`
            }
            next={
              <Btn primary onClick={() => dat({ ro: null, ly_do: null })}>
                Xem cả {fmt(dem.all)} phiếu
              </Btn>
            }
          />
        ) : (
          <Table>
            <THead pinFirst>
              <th>Ngày</th>
              <th>Số phiếu</th>
              <th>Lý do</th>
              <th>Đối ứng</th>
              <th>Người lập</th>
              <th />
            </THead>
            <tbody>
              {rows.map((d) => (
                <Row key={d.id} onClick={() => router.push(`/warehouse/phieu/${d.id}`)}>
                  <Cell pin muted>
                    <span className="num">{isoToVn(d.doc_date).slice(0, 5)}</span>
                  </Cell>
                  <Cell>
                    <span
                      className={cn(
                        'flex items-center gap-2',
                        // Gạch ngang chứ KHÔNG ẩn: phiếu sai vẫn là một dòng
                        // lịch sử, giấu đi là sổ không cộng lại đúng.
                        d.da_bi_dao && 'line-through decoration-[var(--ink-3)]',
                      )}
                    >
                      <Code>{d.code}</Code>
                      {d.da_bi_dao && <Tag tone="stop">đã bị đảo</Tag>}
                      {d.reversal_of_code && (
                        <span className="text-[10.5px] text-[var(--ink-3)]">
                          đảo của {d.reversal_of_code}
                        </span>
                      )}
                      {d.status === 'pending' && <Tag tone="warn">chờ duyệt</Tag>}
                      {d.status === 'rejected' && <Tag tone="stop">đã từ chối</Tag>}
                    </span>
                  </Cell>
                  <Cell>
                    <span className="flex items-center gap-2">
                      {d.ma_ly_do.length === 0 ? (
                        <span className="text-[var(--ink-empty)]">—</span>
                      ) : (
                        <>
                          <MaLyDo ma={d.ma_ly_do[0]} />
                          <span className="truncate text-[11.5px] text-[var(--ink-2)]">
                            {nhanLyDo(d.ma_ly_do[0])}
                          </span>
                          {d.ma_ly_do.length > 1 && (
                            <span className="num text-[10.5px] text-[var(--ink-3)]">
                              +{d.ma_ly_do.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </Cell>
                  <Cell grow muted>
                    <span className="truncate" title={d.counterparty ?? d.reason ?? ''}>
                      {d.counterparty ?? d.reason ?? '—'}
                    </span>
                  </Cell>
                  <Cell muted>{d.created_by_name ?? '—'}</Cell>
                  <Cell>
                    <span className="flex justify-end">
                      <Btn
                        href={`/warehouse/phieu/${d.id}`}
                        className="h-6 px-[9px] text-[12px]"
                      >
                        Mở
                      </Btn>
                    </span>
                  </Cell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}

        {soTrang > 1 && (
          <div className="flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[6px] text-[var(--fs-sm)]">
            <span className="text-[var(--ink-3)]">Trang</span>
            <Btn
              disabled={trang <= 1}
              onClick={() => dat({ trang: String(trang - 1) })}
              className="h-6 px-[9px] text-[12px]"
            >
              ‹ Trước
            </Btn>
            <span className="num">
              {trang} / {soTrang}
            </span>
            <Btn
              disabled={trang >= soTrang}
              onClick={() => dat({ trang: String(trang + 1) })}
              className="h-6 px-[9px] text-[12px]"
            >
              Sau ›
            </Btn>
            <span className="ml-auto text-[var(--ink-3)]">50 phiếu mỗi trang</span>
          </div>
        )}

        <StatusBar
          left={[
            'Sổ chỉ cộng thêm — phiếu đã ghi không sửa, không xoá; sai thì lập phiếu đảo',
            'Mã lý do bật từ 15/09/2026; phiếu cũ hơn suy mã từ loại chứng từ',
          ]}
          right={`${rows.length} / ${fmt(total)} phiếu`}
        />
      </ScreenFrame>
    </div>
  )
}
