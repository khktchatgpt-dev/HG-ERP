'use client'

import { useState } from 'react'
import type { LsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import type { LsxGroup, LsxLine } from '@/modules/dept/production/lsx-lines.repo'
import type { LsxTemplate } from '@/lib/lsx-template'
import { coThongSo, gomThongSo } from '@/lib/lsx-spec-summary'
import {
  Btn,
  Cell,
  Chip,
  FilterBar,
  Code,
  Crumb,
  Empty,
  Row,
  ScreenFrame,
  ScreenHeader,
  StatusBar,
  THead,
  Table,
  Tag,
  showNum,
} from '@/components/kit'
import { PhieuLenh } from './phieu-lenh'

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const conLai = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

/**
 * HỒ SƠ LỆNH CHO NGƯỜI MUA — "lệnh này làm cái gì, bằng vật liệu gì, hạn nào".
 *
 * Màn anh em với `/mua-hang/yeu-cau/[id]` (vật tư của lệnh): cùng một lệnh,
 * hai câu hỏi khác nhau, nên hai màn chứ không một màn nhồi đôi.
 *
 *   · màn kia — "còn thiếu gì, đã đặt đơn nào"  (trục: mua đủ chưa)
 *   · màn này — "làm cái gì, thông số ra sao"   (trục: nội dung lệnh)
 *
 * 05/10/2026 — dựng lại theo artboard đã duyệt (chủ dự án: "xem lsx hiện tại
 * rất khó nhìn", "trước hết cần cho xem đủ thông tin của lsx"):
 *   · đầu trang gom ĐỦ thông tin lệnh (phát hành, bản chỉnh sửa + lý do, cont,
 *     giao khách còn/quá bao nhiêu ngày, mốc vật tư, đơn khách, ghi chú) —
 *     khối "Mốc thời gian" cũ bỏ vì đã nằm hết ở đây;
 *   · khối "Sản phẩm phải làm" (mã·tên·ĐVT·SL) thay bằng ĐÚNG PHIẾU LỆNH
 *     (`PhieuLenh`): cột theo mẫu khách, nhóm theo PO, màu như phiếu in;
 *   · khối thông số gom theo lệnh giữ, đứng dưới phiếu (Q3 chốt giữ).
 *
 * KHÔNG SERVICE MỚI: `buildLsxSupplyDetail` cho phần mua, `lsxLinesService.sheet`
 * cho phiếu — cùng nguồn với phiếu in và Excel.
 */
export function HoSoLenhScreen({
  lsx,
  dau,
  template,
  groups,
  today,
  imageUrls,
}: {
  lsx: LsxSupplyDetail
  dau: {
    issued_at: string | null
    revision: number
    revised_at: string | null
    revision_note: string | null
    note: string | null
  }
  template: LsxTemplate
  groups: (LsxGroup & { lines: LsxLine[] })[]
  today: string
  imageUrls: Record<string, string>
}) {
  const [xem, setXem] = useState<'phieu' | 'thongso'>('phieu')
  const lines = groups.flatMap((g) => g.lines)
  const nhom = gomThongSo(
    lsx.products.map((p) => ({ code: p.code, name: p.name, specs: p.specs })),
  )
  const tongSl = lines.reduce((a, l) => a + l.qty, 0)
  const dvt = [...new Set(lines.map((l) => l.unit).filter(Boolean))]
  const conMoc = conLai(lsx.materials_due_at, today)
  const conGiao = conLai(lsx.ship_date, today)
  const con = (n: number | null) =>
    n == null ? null : n < 0 ? (
      <Tag tone="stop">quá {Math.abs(n)} ngày</Tag>
    ) : (
      <span className="text-[var(--ink-3)]">còn {n} ngày</span>
    )

  return (
    <ScreenFrame>
      <Crumb
        path={[
          'Mua hàng',
          { label: 'Vật tư theo lệnh', href: '/mua-hang/yeu-cau' },
          { label: lsx.code, href: `/mua-hang/yeu-cau/${lsx.id}` },
          'Hồ sơ lệnh',
        ]}
      />
      <ScreenHeader
        compact
        eyebrow={lsx.customer_name}
        title={lsx.code}
        facts={[
          { label: 'Sản phẩm', value: String(lines.length) },
          {
            label: 'Tổng SL',
            value: `${showNum(tongSl)}${dvt.length === 1 ? ' ' + dvt[0] : ''}`,
          },
          { label: 'Phát hành', value: ngay(dau.issued_at) || '—' },
          {
            label: 'Bản',
            value: dau.revision
              ? `chỉnh sửa ${dau.revision} · ${ngay(dau.revised_at)}`
              : 'gốc',
          },
          {
            label: 'Cont',
            value: lsx.container_summary || 'chưa khai',
            tone: lsx.container_summary ? undefined : 'warn',
          },
          {
            label: 'Giao khách',
            value: (
              <>
                {ngay(lsx.ship_date) || 'chưa có'} {con(conGiao)}
              </>
            ),
            tone: lsx.ship_date ? undefined : 'warn',
          },
          {
            label: 'Mốc vật tư',
            value: (
              <>
                {ngay(lsx.materials_due_at) || 'chưa có'} {con(conMoc)}
              </>
            ),
            tone: lsx.materials_due_at ? undefined : 'warn',
          },
          // Chỉ ĐẾM đơn khách (05/10/2026, chủ dự án: "phần đơn hiển thị ở trên
          // nên bỏ đi cho gọn") — LAURA 01 có 11 đơn, liệt kê mã chiếm ba dòng
          // đầu trang; mã đơn nằm ở từng nhóm của phiếu bên dưới.
          {
            label: 'Đơn khách',
            value: lsx.order_codes.length ? String(lsx.order_codes.length) : 'không có',
            tone: lsx.order_codes.length ? undefined : 'warn',
          },
        ]}
        actions={
          <>
            <Btn icon="vattu" href={`/mua-hang/yeu-cau/${lsx.id}`}>
              Vật tư của lệnh
            </Btn>
            {/*
              PHIẾU LỆNH gốc của Bán hàng: xem = `/print/lsx/[id]`, tải =
              `/api/dept/production/lsx/[id]/export` (.xlsx bày giống hệt phiếu in,
              kèm ảnh) — ai xem được phiếu thì tải được.
            */}
            <Btn icon="in" onClick={() => window.open(`/print/lsx/${lsx.id}`, '_blank')}>
              Xem phiếu lệnh
            </Btn>
            <Btn icon="excel" href={`/api/dept/production/lsx/${lsx.id}/export`}>
              Xuất LSX
            </Btn>
            <Btn
              icon="baoCao"
              href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=lsx`}
            >
              Báo cáo lệnh
            </Btn>
          </>
        }
      />
      {/* Lý do bản chỉnh sửa + ghi chú lệnh — chữ Bán hàng viết cho xưởng, người
          mua phải đọc trước khi hứa với NCC. */}
      {(dau.revision_note || dau.note) && (
        <div className="text-k-sm border-b border-[var(--line)] bg-[var(--rev-wash)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
          {dau.revision_note && (
            <div>
              <b>Lần chỉnh sửa {dau.revision}:</b> {dau.revision_note}
            </div>
          )}
          {dau.note && (
            <div>
              <b>Ghi chú lệnh:</b> {dau.note}
            </div>
          )}
        </div>
      )}

      {/*
        MỘT VÙNG CUỘN DUY NHẤT (05/10/2026 — chủ dự án: "có 2 thanh scroll rất khó
        dùng"): bản trước thân màn cuộn dọc, bên trong phiếu lại cuộn riêng ở
        560px — hai thanh lồng nhau và chiều cao cứng không hợp màn 730px lẫn
        1080px. Nay phiếu và khối thông số là HAI CÁCH XEM, cái đang chọn chiếm
        trọn phần còn lại của khung và tự cuộn (dọc lẫn ngang) — đầu bảng, cột
        Mã SP, chân tổng dính đúng vì cùng một vùng cuộn.
      */}
      <FilterBar dense label="Xem theo">
        <Chip on={xem === 'phieu'} count={lines.length} onClick={() => setXem('phieu')}>
          Phiếu lệnh
        </Chip>
        <Chip on={xem === 'thongso'} onClick={() => setXem('thongso')}>
          Thông số gom
        </Chip>
        <span className="text-k-label ml-auto text-[var(--ink-3)]">
          {xem === 'phieu'
            ? `${groups.length} nhóm · đúng cột của phiếu in, nhóm theo đơn hàng / số PO`
            : 'cả lệnh có mấy loại sơn, kính, vải — để chép sang đơn mua'}
        </span>
      </FilterBar>
      {xem === 'phieu' &&
        (lines.length === 0 ? (
          <Empty
            headline="Lệnh chưa có dòng sản phẩm nào"
            reason="Dòng lệnh do Bán hàng soạn ở màn lệnh của họ. Lệnh không có dòng thì không tính ra được cần mua gì — mọi con số vật tư của lệnh này bằng 0 vì lý do đó, không phải vì đã mua đủ."
            next={
              <Btn icon="vattu" href={`/mua-hang/yeu-cau/${lsx.id}`}>
                Xem vật tư của lệnh
              </Btn>
            }
          />
        ) : (
          <PhieuLenh
            template={template}
            groups={groups}
            revision={dau.revision}
            imageUrls={imageUrls}
          />
        ))}
      {xem === 'thongso' && (
        <div className="min-h-0 flex-1 overflow-auto">
          {!coThongSo(nhom) ? (
            <Empty
              headline="Lệnh chưa khai thông số nào"
              reason="Sơn, gỗ, kính, nệm được Bán hàng khai trên dòng lệnh lúc soạn. Chưa có thì người mua không có gì để chép sang đơn — phải hỏi trước khi đặt, đừng đoán theo lệnh cũ."
              next={
                <Btn icon="quayLai" href={`/mua-hang/yeu-cau/${lsx.id}`}>
                  Về vật tư của lệnh
                </Btn>
              }
            />
          ) : (
            <Table>
              <THead>
                <th>Hạng mục</th>
                <th>Thông số</th>
                <th>Ghi chú</th>
              </THead>
              <tbody>
                {nhom.map((g) => (
                  <Row key={g.key}>
                    <Cell>{g.label}</Cell>
                    {/* Ô này BẺ DÒNG: Cell mặc định nowrap (đúng cho ô số/mã), nhưng
                        danh sách 11 mã ở đây dài 300px và đẩy bảng cuộn ngang. */}
                    <Cell className="whitespace-normal">
                      {g.chung ? (
                        <b>{g.chung}</b>
                      ) : g.theoGiaTri.length > 0 ? (
                        <span className="flex flex-col gap-1">
                          {g.theoGiaTri.map((v) => (
                            <span key={v.value}>
                              <b>{v.value}</b>{' '}
                              <span className="text-[var(--ink-3)]">
                                — {v.codes.length} mã:{' '}
                              </span>
                              {v.codes.map((c) => (
                                <Code key={c}>{c}</Code>
                              ))}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <Tag tone="warn">chưa khai</Tag>
                      )}
                    </Cell>
                    <Cell muted>
                      {g.chung
                        ? 'cả lệnh dùng chung'
                        : g.thieu > 0
                          ? `${g.thieu}/${lsx.products.length} mã bỏ trống ô này`
                          : `${g.theoGiaTri.length} loại khác nhau`}
                    </Cell>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      )}

      <StatusBar
        left={[`Lệnh ${lsx.code}`, lsx.customer_name]}
        right={`${lines.length} mã · ${showNum(tongSl)} SP · ${lsx.pos.length} đơn mua`}
      />
    </ScreenFrame>
  )
}
