'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isoToVn } from '@/lib/date-vn'
import { ketQuaPhieu } from '@/lib/da-ve'
import {
  Action,
  ActionGroup,
  ActionPane,
  Code,
  Crumb,
  DocHead,
  FastTab,
  Field,
  FieldGrid,
  Grid,
  GridBody,
  GridFoot,
  GridHead,
  GridRow,
  Hint,
  NoticeBar,
  ScreenFrame,
  StatusBar,
  Tag,
  Td,
  Th,
  Timeline,
} from '@/components/kit'
import type { ChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'
import { SuaPhieuSheet, type Kieu } from '../sua-phieu'

const so = (n: number) => n.toLocaleString('vi-VN')
/** "03/10/2026 09:51" giờ VN — cố định múi giờ để server và trình duyệt ra cùng chữ. */
const gio = (iso: string) => {
  const vn = new Date(Date.parse(iso) + 7 * 3_600_000).toISOString()
  return `${isoToVn(vn.slice(0, 10))} ${vn.slice(11, 16)}`
}
const TRONG = <span className="text-[var(--ink-3)]">— chưa ghi</span>

/**
 * CHI TIẾT PHIẾU NHẬP THEO ĐƠN — khu Mua hàng (04/10/2026, bản vẽ J3/J4 canvas
 * "Cung ứng · Hàng về" › Bản 7, chủ dự án duyệt).
 *
 * Câu màn trả lời: "phiếu tôi lập ghi gì, đúng chưa, sửa thế nào?". Trước đây
 * bấm số phiếu ở Đã về là mở thẳng bản in — không có chỗ nào XEM lại phiếu
 * trong khu Mua hàng (trang chi tiết chỉ có ở khu Kho).
 *
 * Ba cách sửa đã có từ 02/10 (thông tin · số lượng · chênh lệch) thành ba nút
 * riêng; phiếu đã đảo khoá cả ba và trỏ sang phiếu đang hiệu lực.
 */
export function PhieuNhapChiTietScreen({
  ct,
  canWrite,
}: {
  ct: ChiTietPhieuNhap
  /** Ghi phiếu kho được (`warehouse.stock.write`). */
  canWrite: boolean
}) {
  const router = useRouter()
  const { row, dao, nhap_cho: nc, dong, khac } = ct
  const [sua, setSua] = useState<Kieu | null>(null)
  const daDao = row.phieu.reversed
  const kq = ketQuaPhieu(row.phieu)
  const motDon = kq.some((k) => k.kind === 'thieu' || k.kind === 'sai_quy_cach')
  const thieu = [
    !row.supplier_doc_no?.trim() && 'số phiếu giao NCC',
    !row.counterparty?.trim() && 'người giao',
  ].filter((v): v is string => !!v)
  const dangHieuLuc = khac.filter((k) => k.con_hieu_luc)
  const khoaSua = !canWrite
    ? 'Tài khoản này không có quyền ghi phiếu kho.'
    : daDao
      ? `Phiếu đã đảo — sửa trên phiếu đang hiệu lực${dangHieuLuc.length ? ` (${dangHieuLuc.map((k) => k.code).join(', ')})` : ''}.`
      : undefined
  const donVi = [...new Set(dong.map((d) => d.unit).filter(Boolean))]
  const lenh = nc?.lenh ?? [row.lsx_code, ...(row.lsx_them ?? [])].filter(Boolean)

  return (
    <ScreenFrame>
      <Crumb
        path={[
          { label: 'Theo dõi đơn hàng', href: '/mua-hang/theo-doi' },
          { label: 'Đã về', href: '/mua-hang/theo-doi/da-ve' },
          row.code,
        ]}
      />
      <ActionPane>
        <ActionGroup label="Bản in">
          <Action
            icon="in"
            primary={!daDao}
            onClick={() => window.open(`/print/warehouse/${row.doc_id}`, '_blank')}
          >
            In phiếu 01-VT
          </Action>
        </ActionGroup>
        <ActionGroup label="Sửa phiếu">
          {row.phieu.cho_lap_lai && canWrite ? (
            <Action
              icon="nhapKho"
              primary
              onClick={() =>
                router.push(`/mua-hang/don/${row.po_id}/nhan?sua=${row.doc_id}`)
              }
            >
              Lập lại phiếu
            </Action>
          ) : (
            <>
              <Action
                icon="sua"
                disabled={!!khoaSua}
                title={khoaSua}
                onClick={() => setSua('thong-tin')}
              >
                Sửa thông tin
              </Action>
              <Action
                icon="dao"
                disabled={!!khoaSua}
                title={khoaSua}
                onClick={() => setSua('so-luong')}
              >
                Sửa số lượng / dòng
              </Action>
              <Action
                icon="giaTang"
                disabled={!!khoaSua}
                title={khoaSua}
                onClick={() => setSua('chenh-lech')}
              >
                Điều chỉnh chênh lệch
              </Action>
            </>
          )}
        </ActionGroup>
        <ActionGroup label="Đơn">
          <Action icon="don" onClick={() => router.push(`/mua-hang/don/${row.po_id}`)}>
            Mở đơn mua
          </Action>
          {motDon && (
            <Action
              icon="nhanHang"
              onClick={() => router.push(`/mua-hang/theo-doi/da-ve?don=${row.po_id}`)}
            >
              Xử lý giao nhận
            </Action>
          )}
        </ActionGroup>
      </ActionPane>

      <DocHead
        compact
        kind="Phiếu nhập kho · theo đơn mua"
        code={row.code}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {daDao ? (
              <Tag tone="stop">Đã đảo · không còn tính tồn</Tag>
            ) : (
              <Tag tone="done">Đã ghi sổ</Tag>
            )}
            {!daDao &&
              kq.map((k) => (
                <Tag key={k.kind} tone={k.tone}>
                  {k.text}
                </Tag>
              ))}
            <span>
              {row.supplier_name} · nhập cho{' '}
              <Code as="a" href={`/mua-hang/don/${row.po_id}`}>
                {row.po_code}
              </Code>
            </span>
          </span>
        }
      />

      {dao && (
        <NoticeBar
          tone="stop"
          tag="Đã đảo"
          action={
            dangHieuLuc[0]
              ? { label: `Mở ${dangHieuLuc[0].code}`, onClick: () => router.push(`/mua-hang/theo-doi/da-ve/${dangHieuLuc[0].doc_id}`) } // prettier-ignore
              : undefined
          }
        >
          Đảo bởi <b>{dao.code}</b> lúc {gio(dao.at)}
          {dao.actor ? ` · ${dao.actor}` : ''}
          {dao.reason ? ` — “${dao.reason}”` : ''}. Số trên phiếu này không còn tính vào
          tồn.
          {row.thay_boi
            ? ` Phiếu ghi lại: ${row.thay_boi}.`
            : dangHieuLuc.length > 0
              ? ` Phiếu nhập khác của đơn: ${dangHieuLuc.map((k) => k.code).join(', ')}.`
              : ''}
        </NoticeBar>
      )}
      {!daDao && thieu.length > 0 && (
        <NoticeBar
          tone="warn"
          tag="Thiếu thông tin"
          action={
            canWrite
              ? { label: 'Bổ sung thông tin', onClick: () => setSua('thong-tin') }
              : undefined
          }
        >
          Chưa có <b>{thieu.join(' và ')}</b> — Kế toán đối chiếu công nợ bằng số phiếu
          NCC.
        </NoticeBar>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <FastTab title="Thông tin phiếu" defaultOpen>
          <FieldGrid>
            <Field label="Nhà cung cấp">{nc?.ncc.join('; ') || row.supplier_name}</Field>
            <Field label="Đơn mua">
              <Code as="a" href={`/mua-hang/don/${row.po_id}`}>
                {row.po_code}
              </Code>
              {row.owner_name && <Hint> · phụ trách {row.owner_name}</Hint>}
            </Field>
            <Field label="Lệnh SX">
              {lenh.length > 0 ? (
                <span className="num">{lenh.join(' · ')}</span>
              ) : (
                <span className="text-[var(--ink-3)]">không theo lệnh</span>
              )}
            </Field>
            <Field label="Đợt giao">
              {nc?.dot ?? <span className="text-[var(--ink-3)]">đơn không chia đợt</span>}
            </Field>
            <Field label="Ngày chứng từ">
              <span className="num">{isoToVn(row.doc_date.slice(0, 10))}</span>
            </Field>
            <Field label="Ghi sổ">
              <span className="num">{gio(ct.created_at)}</span>
              {ct.nguoi_lap && <> · {ct.nguoi_lap}</>}
            </Field>
            <Field label="Số phiếu giao NCC">
              {row.supplier_doc_no?.trim() ? (
                <span className="num">{row.supplier_doc_no}</span>
              ) : (
                TRONG
              )}
            </Field>
            <Field label="Người giao">{row.counterparty?.trim() || TRONG}</Field>
            <Field label="Ghi chú phiếu">
              {row.ghi_chu?.trim() || <span className="text-[var(--ink-3)]">—</span>}
            </Field>
          </FieldGrid>
        </FastTab>

        <FastTab title={`Hàng nhập · ${dong.length} dòng`} defaultOpen>
          <Grid minWidth={900}>
            <GridHead>
              <Th width={40}>#</Th>
              <Th width={110}>Mã</Th>
              <Th>Tên vật tư</Th>
              <Th width={56}>ĐVT</Th>
              <Th num width={110}>
                Đặt (dòng đơn)
              </Th>
              <Th num width={120}>
                {daDao ? 'Đã nhận (đã đảo)' : 'Nhận phiếu này'}
              </Th>
              <Th width={130}>Tình trạng</Th>
              <Th>Ghi chú</Th>
            </GridHead>
            <GridBody>
              {dong.map((d, i) => (
                <GridRow key={d.id}>
                  <Td num>{i + 1}</Td>
                  <Td>
                    <Code>{d.code}</Code>
                  </Td>
                  <Td>{d.name}</Td>
                  <Td>{d.unit}</Td>
                  <Td num>
                    {d.qty_ordered != null ? (
                      so(d.qty_ordered)
                    ) : (
                      <Hint title="Dòng đơn mua của dòng này đã bị gỡ khỏi đơn">
                        dòng đơn đã gỡ
                      </Hint>
                    )}
                  </Td>
                  <Td num>
                    <span
                      className={
                        daDao ? 'text-[var(--ink-3)] line-through' : 'font-semibold'
                      }
                    >
                      {so(d.qty)}
                    </span>
                    {d.kg_can != null && <Hint> · {so(d.kg_can)} kg cân</Hint>}
                  </Td>
                  <Td tone={d.khoa ? 'warn' : undefined}>
                    {d.khoa ? 'Sai quy cách · khoá' : 'Đạt'}
                  </Td>
                  <Td>{d.note ?? ''}</Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={5}>{dong.length} dòng</Td>
              <Td num>
                {donVi.length === 1
                  ? `${so(dong.reduce((a, d) => a + d.qty, 0))} ${donVi[0]}`
                  : ''}
              </Td>
              <Td colSpan={2}>
                <span className="font-normal text-[var(--ink-3)]">
                  {donVi.length > 1
                    ? `không cộng tổng vì khác ĐVT (${donVi.join(', ')}) · `
                    : ''}
                  không gồm đơn giá — tiền xem ở đơn mua
                </span>
              </Td>
            </GridFoot>
          </Grid>
        </FastTab>

        {khac.length > 0 && (
          <FastTab title="Phiếu nhập khác của đơn" defaultOpen>
            <div className="text-k-sm flex flex-wrap gap-x-5 gap-y-1 px-[var(--gutter)] py-2">
              {khac.map((k) => (
                <span key={k.doc_id} className="flex items-center gap-1.5">
                  <Code as="a" href={`/mua-hang/theo-doi/da-ve/${k.doc_id}`}>
                    {k.code}
                  </Code>
                  <span className="num text-[var(--ink-3)]">
                    {isoToVn(k.at.slice(0, 10))}
                  </span>
                  {k.con_hieu_luc ? (
                    <Tag tone="done">đang hiệu lực</Tag>
                  ) : (
                    <Tag tone="neutral">đã đảo</Tag>
                  )}
                </span>
              ))}
            </div>
          </FastTab>
        )}

        <FastTab title="Lịch sử phiếu" defaultOpen>
          <div className="px-[var(--gutter)] py-1">
            <Timeline marks={ct.lich_su} />
          </div>
        </FastTab>
      </div>

      <StatusBar
        left={[
          'Sửa thông tin không đổi tồn · sửa số lượng = đảo rồi lập lại · hàng đã dùng thì điều chỉnh chênh lệch',
          'Vết mọi lần sửa nằm ở Lịch sử phiếu và Trao đổi của đơn',
        ]}
        right={`${dong.length} dòng`}
      />
      {sua && <SuaPhieuSheet row={row} kieuBanDau={sua} onClose={() => setSua(null)} />}
    </ScreenFrame>
  )
}
