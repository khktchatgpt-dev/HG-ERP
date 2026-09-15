'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  Num,
  NumInput,
  Row,
  ScreenHeader,
  Sheet,
  SheetActions,
  THead,
  Table,
  Tag,
  TextArea,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError } from '@/lib/api'
import type { BlockedLot } from '@/modules/dept/warehouse/blocked.repo'
import { mucGap, tuoiNgay } from '@/modules/dept/warehouse/blocked.service'

/**
 * HÀNG MẮC — Khuôn C.
 *
 * Cột TUỔI là lý do màn này tồn tại: hàng mắc không ai nhắc thì nằm hết
 * tháng. Nên nó đứng ngay sau tên, đổi màu theo hai mốc của sổ, và bảng xếp
 * theo nó chứ không theo mã.
 */

type Viec = 'mo-khoa' | 'huy' | null

export function HangMacScreen({
  lots,
  canEdit,
  canHuy,
}: {
  lots: BlockedLot[]
  canEdit: boolean
  canHuy: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [viec, setViec] = useState<Viec>(null)
  const [lot, setLot] = useState<BlockedLot | null>(null)
  const [soLuong, setSoLuong] = useState('')
  const [lyDo, setLyDo] = useState('')
  /** Lọc: chỉ lô quá hạn. Mặc định TẮT — ẩn bớt là giấu việc. */
  const [chiQuaHan, setChiQuaHan] = useState(false)

  const now = useMemo(() => new Date(), [])

  const xep = useMemo(() => {
    const withAge = lots.map((l) => ({ l, tuoi: tuoiNgay(l.blocked_at, now) }))
    // Già trước: lô nằm lâu nhất là lô cần quyết gấp nhất. Lô không rõ ngày
    // xuống cuối — không biết tuổi thì không xếp trên thứ biết chắc là gấp.
    withAge.sort((a, b) => (b.tuoi ?? -1) - (a.tuoi ?? -1))
    return chiQuaHan ? withAge.filter((x) => (x.tuoi ?? 0) > 3) : withAge
  }, [lots, now, chiQuaHan])

  const quaHan = useMemo(
    () => lots.filter((l) => (tuoiNgay(l.blocked_at, now) ?? 0) > 3).length,
    [lots, now],
  )
  const theoNcc = useMemo(
    () => new Set(lots.map((l) => l.supplier_id).filter(Boolean)).size,
    [lots],
  )

  function mo(v: Viec, l: BlockedLot) {
    setViec(v)
    setLot(l)
    setSoLuong(String(l.qty))
    setLyDo('')
  }

  async function chay(url: string, body: Record<string, unknown>, xong: string) {
    setBusy(true)
    try {
      await api(url, { method: 'POST', body })
      setViec(null)
      setLot(null)
      router.refresh()
      toast.success(xong)
    } catch (err) {
      toast.error(
        'Không thực hiện được',
        err instanceof ApiError ? err.message : 'Có lỗi xảy ra',
      )
    } finally {
      setBusy(false)
    }
  }

  const so = Number(soLuong)
  const soSai = !Number.isFinite(so) || so <= 0 || (lot != null && so > lot.qty + 1e-6)
  const thieu = !lyDo.trim() ? 'Phải ghi lý do' : soSai ? 'Lượng không hợp lệ' : null

  return (
    /*
      Vỏ khu Kho là theme v3 — không dùng ScreenFrame (nó bóp sidebar), và lớp
      `kit` là bắt buộc để token của bộ kit có giá trị. Xem chú ở KiemKeScreen.
    */
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-[calc(100dvh-4rem)] flex-col">
      <ScreenHeader
        compact
        eyebrow="Kho"
        title="Hàng mắc"
        facts={[
          { label: 'Lô đang khoá', value: String(lots.length) },
          {
            label: 'Quá 3 ngày',
            value: String(quaHan),
            tone: quaHan > 0 ? 'warn' : undefined,
          },
          { label: 'Nhà cung cấp liên quan', value: String(theoNcc) },
        ]}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
        <Chip on={chiQuaHan} count={quaHan} onClick={() => setChiQuaHan((v) => !v)}>
          Quá 3 ngày
        </Chip>
      </div>

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {xep.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline={
                chiQuaHan ? 'Không lô nào quá 3 ngày' : 'Không có lô nào đang mắc'
              }
              reason={
                chiQuaHan
                  ? `${lots.length} lô đang khoá nhưng đều mới dưới 3 ngày.`
                  : 'Hàng không đạt được nhận vào sổ ở trạng thái khoá ngay lúc nhập — chưa lô nào đang chờ quyết. Đây là trạng thái tốt, không phải màn hỏng.'
              }
              next={
                chiQuaHan ? (
                  <Btn onClick={() => setChiQuaHan(false)}>
                    Xem tất cả {lots.length} lô
                  </Btn>
                ) : (
                  <Btn href="/warehouse/nhap">Sang màn Nhập kho</Btn>
                )
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead pinFirst>
                <th>Mã</th>
                <th>Tên vật tư</th>
                <th style={{ textAlign: 'right' }}>Còn khoá</th>
                <th style={{ textAlign: 'right' }}>Tuổi</th>
                <th>Lý do khoá</th>
                <th>Nhà cung cấp</th>
                <th>Phiếu gốc</th>
                <th>Kệ</th>
                {canEdit && <th />}
              </THead>
              <tbody>
                {xep.map(({ l, tuoi }) => {
                  const gap = mucGap(tuoi)
                  return (
                    <Row key={`${l.material_id}:${l.bin_id ?? ''}`}>
                      <Cell pin>
                        <Code>{l.material_code ?? '—'}</Code>
                      </Cell>
                      <Cell grow>{l.material_name ?? '—'}</Cell>
                      <Cell num>
                        <Num value={String(l.qty)} strong />{' '}
                        <span className="text-[var(--ink-3)]">{l.material_unit}</span>
                      </Cell>
                      <Cell num>
                        {tuoi == null ? (
                          <span className="text-[var(--ink-3)]">—</span>
                        ) : (
                          <Tag tone={gap}>{tuoi} ngày</Tag>
                        )}
                      </Cell>
                      {/*
                        LÝ DO NGUYÊN VĂN, không rút gọn thành mã. Cung ứng đọc
                        đúng câu này để quyết trả NCC hay nhận giá giảm — tóm
                        tắt nó là lấy mất thứ duy nhất giúp quyết được.
                      */}
                      <Cell muted>{l.reason ?? 'không ai ghi'}</Cell>
                      <Cell muted>{l.supplier_name ?? '—'}</Cell>
                      <Cell muted>
                        {l.doc_code ? <Code>{l.doc_code}</Code> : '—'}
                        {l.po_code && (
                          <>
                            {' · '}
                            <Code>{l.po_code}</Code>
                          </>
                        )}
                      </Cell>
                      <Cell muted>{l.bin_code ?? '—'}</Cell>
                      {canEdit && (
                        <Cell>
                          <div className="flex gap-1">
                            <Btn onClick={() => mo('mo-khoa', l)}>Mở khoá</Btn>
                            {canHuy && (
                              <Btn danger onClick={() => mo('huy', l)}>
                                Huỷ
                              </Btn>
                            )}
                            {l.po_id && (
                              <Btn href={`/planning/pos/${l.po_id}`}>Trả NCC</Btn>
                            )}
                          </div>
                        </Cell>
                      )}
                    </Row>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <Sheet
        open={viec != null}
        onClose={() => setViec(null)}
        title={viec === 'huy' ? 'Xuất huỷ lô hàng mắc' : 'Mở khoá lô hàng'}
        subtitle={
          viec === 'huy'
            ? 'Huỷ là mất tài sản và không lùi lại được — phiếu ghi tên người bấm.'
            : 'Mở khoá là nói "tôi đã kiểm lại và hàng này dùng được". Lý do đi theo lô suốt đời nó.'
        }
        stakes={viec === 'huy' ? 'nang' : 'vua'}
        footer={
          <SheetActions
            onCancel={() => setViec(null)}
            onConfirm={() => {
              if (!lot) return
              const body = {
                material_id: lot.material_id,
                bin_id: lot.bin_id,
                qty: so,
                reason: lyDo.trim(),
              }
              if (viec === 'huy') {
                void chay('/api/dept/warehouse/hang-mac/huy', body, 'Đã lập phiếu huỷ')
              } else {
                void chay(
                  '/api/dept/warehouse/hang-mac/doi-trang-thai',
                  { ...body, from: 'blocked', to: 'ok' },
                  'Đã mở khoá — lượng chuyển sang dùng được',
                )
              }
            }}
            confirmLabel={viec === 'huy' ? 'Xuất huỷ' : 'Mở khoá'}
            stakes={viec === 'huy' ? 'nang' : 'vua'}
            busy={busy}
            disabled={!!thieu}
          />
        }
      >
        {lot && (
          <div className="flex flex-col gap-4">
            <div className="text-[var(--fs-sm)]">
              <Code>{lot.material_code}</Code> {lot.material_name}
              <div className="text-[var(--ink-3)]">
                Đang khoá {lot.qty} {lot.material_unit}
                {lot.bin_code ? ` tại ${lot.bin_code}` : ''}
                {lot.reason ? ` · Lý do khoá: ${lot.reason}` : ''}
              </div>
            </div>

            <label className="flex flex-col gap-1.5 font-semibold text-[var(--fs-sm)]">
              Lượng {viec === 'huy' ? 'huỷ' : 'mở khoá'}
              <NumInput
                value={soLuong}
                onCommit={setSoLuong}
                align="left"
                aria-label="Lượng"
              />
              {/* Xử một phần là chuyện thường: 8 cây cong trong lô 50. */}
              <span className="text-[11.5px] font-normal text-[var(--ink-3)]">
                Xử được một phần — để nguyên {lot.qty} nếu xử cả lô.
              </span>
            </label>

            <label className="flex flex-col gap-1.5 font-semibold text-[var(--fs-sm)]">
              Lý do
              <TextArea
                value={lyDo}
                onChange={setLyDo}
                rows={3}
                placeholder={
                  viec === 'huy'
                    ? 'Ẩm mốc, không tái sử dụng được…'
                    : 'Đã kiểm lại với NCC, đúng quy cách…'
                }
              />
            </label>

            {thieu && (
              <span className="text-[var(--fs-sm)] text-[var(--stop)]">{thieu}</span>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
