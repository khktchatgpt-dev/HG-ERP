'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useBeRong } from '@/lib/use-be-rong'
import { cn } from '@/lib/utils'
import { isoToVn } from '@/lib/date-vn'
import { MA_LY_DO_KHO, nhanLyDo } from '@/lib/kho-ma-ly-do'
import {
  Ico,
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
import { GhiSoNccSheet } from './ghi-so-ncc'

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
  supplier_doc_no: string | null
  /** Đơn mua + lệnh của phiếu (nhập/trả theo đơn); null = phiếu không nối đơn. */
  don: { po_id: string; po_code: string; lsx: string[] } | null
  /** Thuộc rổ "Thiếu số phiếu NCC" — cùng tập với badge menu. */
  thieu_ncc: boolean
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
  thieuGanDay,
  nguoi,
  nguoiLap,
  meId,
}: {
  rows: PhieuRow[]
  dem: Record<RoPhieu, number>
  total: number
  trang: number
  soTrang: number
  ro: RoPhieu
  lyDo: string
  canEdit: boolean
  /** Phần của rổ có ngày chứng từ trong 14 ngày — đúng số badge menu Sổ phiếu. */
  thieuGanDay: number
  /** Ô Người lập: '' mọi người · 'toi' · id người lập. */
  nguoi: string
  nguoiLap: { id: string; name: string; n: number }[]
  meId: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const khung = useRef<HTMLDivElement>(null)
  // Khung hẹp (< 960px: 1024 có sidebar mở) thì ẩn cột Lệnh SX + Người lập + nhãn chữ
  // của mã lý do — luật màn hẹp: ẩn cột bậc thấp thay vì cuộn ngang (12/10/2026).
  const hep = useBeRong(khung) < 960
  const [ghiSo, setGhiSo] = useState<PhieuRow | null>(null)

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
    <div
      className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col"
      // Đối ứng co tới 140px (kit mặc định 200): đo 12/10 bảng 1110px trong khung
      // 1053px (1280, sidebar mở). Tên đầy đủ ở `title`.
      style={{ '--col-grow': '140px' } as CSSProperties}
    >
      <ScreenFrame>
        <ScreenHeader
          compact
          eyebrow="Kho"
          title="Sổ phiếu"
          facts={[
            { label: 'Tất cả', value: fmt(dem.all) },
            { label: 'Phiếu nhập', value: fmt(dem.receipt) },
            { label: 'Phiếu xuất', value: fmt(dem.issue) },
            {
              label: 'Thiếu số phiếu NCC',
              value: `${fmt(dem.thieu_ncc)} · ${fmt(thieuGanDay)} trong 14 ngày`,
              tone: dem.thieu_ncc > 0 ? 'warn' : undefined,
              on: ro === 'thieu_ncc',
              onClick: () => dat({ ro: ro === 'thieu_ncc' ? null : 'thieu_ncc' }),
            },
          ]}
          actions={
            canEdit ? (
              <>
                <Btn icon="nhanHang" href="/warehouse/nhap">
                  Nhận hàng
                </Btn>
                <Btn icon="xuatKho" href="/warehouse/xuat">
                  Xuất kho
                </Btn>
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
            width={hep ? 170 : 240}
          />
          <Pick
            value={nguoi}
            onChange={(v) => dat({ nguoi: v || null })}
            options={[
              { value: '', label: 'Mọi người lập' },
              {
                value: 'toi',
                label: `Tôi lập (${fmt(nguoiLap.find((x) => x.id === meId)?.n ?? 0)})`,
              },
              ...nguoiLap
                .filter((x) => x.id !== meId)
                .map((x) => ({ value: x.id, label: `${x.name} (${fmt(x.n)})` })),
            ]}
            label="Người lập"
            width={hep ? 150 : 190}
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
          {(lyDo || nguoi) && (
            <Btn
              icon="boLoc"
              onClick={() => dat({ ly_do: null, nguoi: null })}
              className="text-k-sm h-[26px] px-2"
            >
              Bỏ lọc
            </Btn>
          )}
        </FilterBar>
        <div ref={khung} className="h-0 w-full" aria-hidden />

        {/*
          DẢI NÀY CHỈ HIỆN KHI ĐANG LỌC. Bản đầu để nó hiện thường trực như một
          lời giải thích — sai luật màu: vàng mã hoá VÒNG ĐỜI DỮ LIỆU, treo
          vĩnh viễn thì nó thành hình nền và lần có cảnh báo thật không ai
          thấy. Câu giải thích chuyển xuống chân màn, chỗ của luật nền.
        */}
        {(lyDo || nguoi || ro !== 'all') && (
          <NoticeBar
            tone="warn"
            tag="Đang lọc"
            action={{
              label: 'Xem cả sổ',
              onClick: () => dat({ ro: null, ly_do: null, nguoi: null }),
            }}
          >
            Sổ đang thu lại còn rổ “{RO_PHIEU_NHAN[ro]}”
            {lyDo && ` và mã lý do ${lyDo} · ${nhanLyDo(lyDo)}`}
            {nguoi &&
              ` · người lập: ${nguoi === 'toi' ? 'tôi' : (nguoiLap.find((x) => x.id === nguoi)?.name ?? '—')}`}
            . Tổng ở đầu trang vẫn là số của CẢ SỔ, không phải của phần đang lọc.
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
              <Btn
                icon="boLoc"
                primary
                onClick={() => dat({ ro: null, ly_do: null, nguoi: null })}
              >
                Xem cả {fmt(dem.all)} phiếu
              </Btn>
            }
          />
        ) : (
          <Table minWidth={hep ? 640 : 900}>
            <THead pinFirst>
              <th style={{ width: 58 }}>Ngày</th>
              <th style={{ width: 150 }}>Số phiếu</th>
              <th style={{ width: hep ? 64 : 120 }}>Lý do</th>
              <th style={{ width: 112 }}>Đơn</th>
              {!hep && <th style={{ width: 132 }}>Lệnh SX</th>}
              <th>Đối ứng</th>
              <th style={{ width: 130 }}>Số phiếu NCC</th>
              {!hep && <th style={{ width: 110 }}>Người lập</th>}
              <th style={{ width: 64 }} />
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
                      title={
                        d.reversal_of_code ? `Đảo của ${d.reversal_of_code}` : undefined
                      }
                    >
                      <Code>{d.code}</Code>
                      {d.da_bi_dao && <Tag tone="stop">đã đảo</Tag>}
                      {d.reversal_of_code && (
                        <span className="text-k-label text-[var(--ink-3)]">đảo</span>
                      )}
                      {d.status === 'pending' && <Tag tone="warn">chờ duyệt</Tag>}
                      {d.status === 'rejected' && <Tag tone="stop">từ chối</Tag>}
                    </span>
                  </Cell>
                  <Cell title={d.ma_ly_do.map((m) => `${m} · ${nhanLyDo(m)}`).join(', ')}>
                    <span className="flex items-center gap-2">
                      {d.ma_ly_do.length === 0 ? (
                        <span className="text-[var(--ink-empty)]">—</span>
                      ) : (
                        <>
                          <MaLyDo ma={d.ma_ly_do[0]} />
                          {!hep && (
                            <span className="text-k-sm truncate text-[var(--ink-2)]">
                              {nhanLyDo(d.ma_ly_do[0])}
                            </span>
                          )}
                          {d.ma_ly_do.length > 1 && (
                            <span className="num text-k-label text-[var(--ink-3)]">
                              +{d.ma_ly_do.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </Cell>
                  <Cell title={d.don?.lsx.join(', ') || undefined}>
                    {d.don ? (
                      <span className="num">{d.don.po_code}</span>
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  {!hep && (
                    <Cell muted title={d.don?.lsx.join(', ') || undefined}>
                      {d.don && d.don.lsx.length > 0 ? (
                        <span className="num">
                          {d.don.lsx[0]}
                          {d.don.lsx.length > 1 && (
                            <span className="text-k-label ml-1">
                              +{d.don.lsx.length - 1}
                            </span>
                          )}
                        </span>
                      ) : d.don ? (
                        'ngoài lệnh'
                      ) : (
                        ''
                      )}
                    </Cell>
                  )}
                  <Cell grow muted title={d.counterparty ?? d.reason ?? ''}>
                    {d.counterparty ?? d.reason ?? '—'}
                  </Cell>
                  <Cell>
                    {d.supplier_doc_no?.trim() ? (
                      <span className="num">{d.supplier_doc_no}</span>
                    ) : d.thieu_ncc ? (
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--warn)]">chưa ghi</span>
                        {canEdit && (
                          <button
                            type="button"
                            className="text-k-sm text-[var(--act-text)] underline underline-offset-2"
                            aria-label={`Ghi số phiếu NCC cho ${d.code}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setGhiSo(d)
                            }}
                          >
                            ghi
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  {!hep && <Cell muted>{d.created_by_name ?? '—'}</Cell>}
                  <Cell>
                    <span className="flex justify-end">
                      <Btn
                        icon="mo"
                        href={`/warehouse/phieu/${d.id}`}
                        className="text-k-sm h-6 px-2"
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
          <div className="text-k-sm flex items-center gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
            <span className="text-[var(--ink-3)]">Trang</span>
            <Btn
              icon="truoc"
              disabled={trang <= 1}
              onClick={() => dat({ trang: String(trang - 1) })}
              className="text-k-sm h-6 px-2"
            >
              Trước
            </Btn>
            <span className="num">
              {trang} / {soTrang}
            </span>
            <Btn
              disabled={trang >= soTrang}
              onClick={() => dat({ trang: String(trang + 1) })}
              className="text-k-sm h-6 px-2"
            >
              Sau
              <Ico name="sau" />
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
      {ghiSo && (
        <GhiSoNccSheet
          doc={{ id: ghiSo.id, code: ghiSo.code, po_code: ghiSo.don?.po_code ?? null }}
          onClose={() => setGhiSo(null)}
        />
      )}
    </div>
  )
}
