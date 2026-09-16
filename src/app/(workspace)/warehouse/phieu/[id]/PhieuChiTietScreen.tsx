'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { isoToVn } from '@/lib/date-vn'
import { useToast } from '@/components/ui/Toast'
import { nhanLyDo } from '@/lib/kho-ma-ly-do'
import type { KetQuaDao } from '@/lib/kho-dao-phieu'
import {
  Action,
  ActionGroup,
  ActionPane,
  Code,
  Crumb,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  NoticeBar,
  Sheet,
  SheetActions,
  StatusBar,
  Tag,
  Td,
  TextArea,
  Th,
} from '@/components/kit'

export type PhieuDoc = {
  id: string
  code: string
  kind: 'receipt' | 'issue' | 'transfer' | 'stocktake'
  doc_date: string
  counterparty: string | null
  reason: string | null
  note: string | null
  status: 'pending' | 'posted' | 'rejected'
  supplier_doc_no: string | null
  reversal_of_code: string | null
  created_by_name: string | null
  created_at: string
  approved_by_name: string | null
  approved_at: string | null
  reject_reason: string | null
}

export type PhieuDong = {
  id: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  direction: 'in' | 'out'
  qty: number
  qty_rejected: number
  qty_ordered: number | null
  shelf_location: string | null
  note: string | null
  ma_ly_do: string | null
}

const LOAI: Record<PhieuDoc['kind'], string> = {
  receipt: 'Phiếu nhập kho',
  issue: 'Phiếu xuất kho',
  transfer: 'Phiếu chuyển kho',
  stocktake: 'Biên bản kiểm kê',
}

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * CHI TIẾT PHIẾU KHO — Khuôn D.
 *
 * Tờ này phải tự kể ba chuyện (nguyên tắc 2 của sổ thiết kế): đã vào sổ chưa,
 * ai ghi, và CÒN HIỆU LỰC KHÔNG. Chuyện thứ ba là chuyện màn cũ không kể —
 * phiếu đã bị đảo trông y hệt phiếu còn sống.
 */
export function PhieuChiTietScreen({
  doc,
  lines,
  soDongKiemKe,
  reversedBy,
  dao,
  canEdit,
}: {
  doc: PhieuDoc
  lines: PhieuDong[]
  soDongKiemKe: number
  reversedBy: { id: string; code: string } | null
  dao: KetQuaDao
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [moDao, setMoDao] = useState(false)
  const [lyDo, setLyDo] = useState('')
  const [dangChay, setDangChay] = useState(false)

  const tongQty = lines.reduce((s, l) => s + l.qty, 0)
  const tongLoai = lines.reduce((s, l) => s + (l.qty_rejected ?? 0), 0)
  const coCotDat = lines.some((l) => l.qty_ordered != null)
  const laNhap = doc.kind === 'receipt'
  // Biên bản kiểm kê chỉ sinh dòng LỆCH, nên gọi nó là 'Thực xuất' là nói sai
  // bản chất: đó là phần chênh giữa tồn sổ và tồn đếm được.
  const nhanCotSL =
    doc.kind === 'receipt' ? 'Thực nhập' : doc.kind === 'issue' ? 'Thực xuất' : 'SL lệch'

  async function ghiDao() {
    if (!lyDo.trim()) return
    setDangChay(true)
    try {
      const out = await api<{ id: string; code: string }>(
        `/api/dept/warehouse/docs/${doc.id}/reverse`,
        { method: 'POST', body: { reason: lyDo.trim() } },
      )
      setMoDao(false)
      setLyDo('')
      toast.success(`Đã lập phiếu đảo ${out.code}`)
      router.push(`/warehouse/phieu/${out.id}`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof ApiError ? apiErrorText(e) : 'Không đảo được phiếu')
    } finally {
      setDangChay(false)
    }
  }

  const doiUng: [ReactNode, ReactNode][] = [
    ['Đối ứng', doc.counterparty ?? '—'],
    ['Lý do ghi tay', doc.reason ?? '—'],
  ]
  if (doc.supplier_doc_no) {
    doiUng.push([
      'Số phiếu NCC',
      <span key="ncc" className="num">
        {doc.supplier_doc_no}
      </span>,
    ])
  }

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <DocScreen dense>
        <Crumb
          path={[
            { label: 'Kho', href: '/warehouse/nhap' },
            { label: 'Sổ phiếu', href: '/warehouse/phieu' },
            doc.code,
          ]}
        />

        <DocHead
          compact
          kind={LOAI[doc.kind]}
          code={doc.code}
          sub={
            <span className="flex items-center gap-2">
              <span className="num">{isoToVn(doc.doc_date)}</span>
              {doc.status === 'posted' && <Tag tone="done">đã ghi sổ</Tag>}
              {doc.status === 'pending' && <Tag tone="warn">chờ duyệt</Tag>}
              {doc.status === 'rejected' && <Tag tone="stop">đã từ chối</Tag>}
              {doc.reversal_of_code && (
                <Tag tone="neutral">đảo của {doc.reversal_of_code}</Tag>
              )}
            </span>
          }
        />

        <ActionPane>
          <ActionGroup label="Chứng từ">
            <Action
              strong
              onClick={() => window.open(`/print/warehouse/${doc.id}`, '_blank')}
            >
              In phiếu
            </Action>
            <Action onClick={() => router.push('/warehouse/phieu')}>Về sổ phiếu</Action>
          </ActionGroup>
          <ActionGroup label="Sửa sai">
            <Action
              disabled={!canEdit || !dao.duoc}
              title={
                !canEdit
                  ? 'Bạn không có quyền ghi sổ kho — việc này của thủ kho.'
                  : dao.duoc
                    ? undefined
                    : `${dao.vuong}. ${dao.goBang}`
              }
              onClick={() => setMoDao(true)}
            >
              Đảo phiếu
            </Action>
          </ActionGroup>
        </ActionPane>

        {reversedBy && (
          <NoticeBar
            tone="stop"
            tag="Tờ này đã bị đảo"
            action={{
              label: `Mở ${reversedBy.code}`,
              onClick: () => router.push(`/warehouse/phieu/${reversedBy.id}`),
            }}
          >
            Toàn bộ bút toán của phiếu đã được ghi ngược bằng {reversedBy.code}, nên tờ
            này KHÔNG còn tác dụng lên tồn. Nó vẫn nằm trong sổ vì sổ kho chỉ cộng thêm,
            không xoá.
          </NoticeBar>
        )}

        {!reversedBy && !dao.duoc && doc.status === 'posted' && (
          <NoticeBar tone="warn" tag="Không đảo được" action={{ label: 'Đã hiểu' }}>
            {dao.vuong}. {dao.goBang}
          </NoticeBar>
        )}

        <DocBody
          aside={
            <FactBox>
              <FactSection title="Lập phiếu">
                <FactKv
                  rows={[
                    ['Người lập', doc.created_by_name ?? '—'],
                    [
                      'Ghi lúc',
                      <span key="ghi" className="num">
                        {isoToVn(doc.created_at.slice(0, 10))}
                      </span>,
                    ],
                    [
                      'Ngày chứng từ',
                      <span key="ngay" className="num">
                        {isoToVn(doc.doc_date)}
                      </span>,
                    ],
                  ]}
                />
              </FactSection>

              <FactSection title={laNhap ? 'Bên giao' : 'Bên nhận'}>
                <FactKv rows={doiUng} />
              </FactSection>

              {(doc.reversal_of_code || reversedBy) && (
                <FactSection title="Quan hệ đảo">
                  <FactKv
                    rows={[
                      doc.reversal_of_code
                        ? ['Đảo cho phiếu', <Code key="goc">{doc.reversal_of_code}</Code>]
                        : ['Bị đảo bởi', <Code key="dao">{reversedBy!.code}</Code>],
                    ]}
                  />
                </FactSection>
              )}

              {doc.status !== 'posted' && (
                <FactSection title="Vòng duyệt">
                  <FactKv
                    rows={[
                      ['Người duyệt', doc.approved_by_name ?? '—'],
                      [
                        'Lúc',
                        doc.approved_at ? (
                          <span className="num">
                            {isoToVn(doc.approved_at.slice(0, 10))}
                          </span>
                        ) : (
                          '—'
                        ),
                      ],
                      ['Lý do từ chối', doc.reject_reason ?? '—'],
                    ]}
                  />
                </FactSection>
              )}

              {doc.note && (
                <FactSection title="Ghi chú">
                  <p className="px-[var(--gutter)] py-[6px] text-[12px] text-[var(--ink-2)]">
                    {doc.note}
                  </p>
                </FactSection>
              )}
            </FactBox>
          }
        >
          <Grid minWidth={coCotDat ? 880 : 780}>
            <GridHead>
              <Th width={44}>STT</Th>
              <Th width={120}>Mã VT</Th>
              <Th>Tên vật tư</Th>
              <Th width={56}>ĐVT</Th>
              <Th width={150}>Lý do</Th>
              {coCotDat && (
                <Th num width={92}>
                  Theo ĐH
                </Th>
              )}
              <Th num width={92}>
                {nhanCotSL}
              </Th>
              <Th num width={78}>
                Loại
              </Th>
              <Th width={96}>Kệ</Th>
              <Th>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {lines.map((l, i) => (
                <GridRow key={l.id}>
                  <Td num>{i + 1}</Td>
                  <Td>
                    <Code>{l.material_code ?? '—'}</Code>
                  </Td>
                  <Td>{l.material_name ?? '—'}</Td>
                  <Td>{l.material_unit ?? '—'}</Td>
                  <Td>
                    {l.ma_ly_do ? (
                      <span
                        className="whitespace-nowrap"
                        title={nhanLyDo(l.ma_ly_do) ?? undefined}
                      >
                        <span className="num font-bold">{l.ma_ly_do}</span>
                        <span className="ml-1.5 text-[11px] text-[var(--ink-3)]">
                          {nhanLyDo(l.ma_ly_do)}
                        </span>
                      </span>
                    ) : (
                      <span
                        className="text-[var(--ink-empty)]"
                        title="Dòng ghi trước 15/09/2026 và loại chứng từ không suy được mã chắc chắn — đoán bừa là bịa một con số cho báo cáo."
                      >
                        chưa có mã
                      </span>
                    )}
                  </Td>
                  {coCotDat && (
                    <Td num>{l.qty_ordered != null ? so(l.qty_ordered) : '—'}</Td>
                  )}
                  <Td num>{so(l.qty)}</Td>
                  <Td num tone={l.qty_rejected > 0 ? 'stop' : undefined}>
                    {l.qty_rejected > 0 ? so(l.qty_rejected) : ''}
                  </Td>
                  <Td>{l.shelf_location ?? '—'}</Td>
                  <Td>{l.note ?? ''}</Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={coCotDat ? 6 : 5}>
                Tổng {lines.length} dòng
                {soDongKiemKe > 0 && ` · biên bản kiểm kê ${soDongKiemKe} dòng đã đếm`}
              </Td>
              <Td num>{so(tongQty)}</Td>
              <Td num>{tongLoai > 0 ? so(tongLoai) : ''}</Td>
              <Td colSpan={2} />
            </GridFoot>
          </Grid>
        </DocBody>

        <StatusBar
          left={[
            'Phiếu đã ghi không sửa, không xoá — sai thì lập phiếu đảo, cả hai tờ cùng nằm trong sổ',
            tongLoai > 0
              ? 'Cột Loại là hàng QC trả về: đã vào đối chiếu NCC, CHƯA vào tồn'
              : 'Tổng không gồm hàng QC loại',
          ]}
          right={`${lines.length} dòng`}
        />
      </DocScreen>

      <Sheet
        open={moDao}
        onClose={() => setMoDao(false)}
        title={`Đảo ${doc.code}`}
        subtitle="Ghi ngược toàn bộ bút toán của phiếu — không sửa, không xoá tờ cũ"
        stakes="nang"
        footer={
          <SheetActions
            onCancel={() => setMoDao(false)}
            onConfirm={ghiDao}
            confirmLabel="Ghi phiếu đảo"
            stakes="nang"
            busy={dangChay}
            disabled={!lyDo.trim()}
          />
        }
      >
        <div className="flex flex-col gap-3 p-[var(--gutter)] text-[12.5px]">
          <p className="text-[var(--ink-2)]">
            Hệ thống lập một phiếu {laNhap ? 'xuất' : 'nhập'} mới ghi ngược{' '}
            <b className="num">{so(tongQty)}</b> đơn vị trên {lines.length} dòng. Tồn về
            đúng trạng thái trước khi ghi {doc.code}; đơn hàng và đợt giao liên quan tự
            lùi lại.
          </p>
          {dao.duoc && dao.canhBao && (
            <p className="rounded-[var(--radius)] border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-[var(--ink-2)]">
              {dao.canhBao}
            </p>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-[.04em] text-[var(--ink-2)] uppercase">
              Vì sao đảo — bắt buộc
            </span>
            <TextArea
              value={lyDo}
              onChange={setLyDo}
              rows={3}
              placeholder="Ví dụ: ghi nhầm mã vật tư, đã nhập lại bằng phiếu khác"
            />
            <span className="text-[11px] text-[var(--ink-3)]">
              Câu này đi vào sổ và người đi soát sẽ đọc. Viết đủ để người khác hiểu mà
              không phải hỏi lại.
            </span>
          </label>
        </div>
      </Sheet>
    </div>
  )
}
