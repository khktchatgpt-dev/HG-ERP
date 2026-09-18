'use client'

import { useState, type CSSProperties } from 'react'
import type { LsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  Btn,
  Cell,
  Chip,
  Code,
  CoverageBar,
  Crumb,
  Empty,
  Metric,
  MetricStrip,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  Sheet,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
  showNum,
} from '@/components/kit'

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

const conLai = (iso: string | null, today: string): number | null => {
  if (!iso) return null
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(iso) - t(today)) / 86_400_000)
}

/**
 * TỔNG SỐ LƯỢNG THEO ĐVT — cộng riêng từng đơn vị, KHÔNG quy đổi.
 *
 * Dòng tổng trước đây gõ cứng chữ "cái" cho mọi lệnh, trong khi dòng lệnh có
 * sẵn `unit`: lệnh khai theo Bộ đọc ra "350 cái" là một con số SAI NGHĨA, và
 * người mua lấy nó đi đặt bao bì. Nhiều ĐVT trên một lệnh thì bày cạnh nhau
 * ("350 Cái · 12 Bộ") chứ không cộng gộp — cộng Cái với Bộ không ra số nào.
 */
function tongTheoDvt(products: LsxSupplyDetail['products']): string {
  const theo = new Map<string, number>()
  for (const p of products) {
    const dv = p.unit?.trim() ?? ''
    theo.set(dv, (theo.get(dv) ?? 0) + p.qty)
  }
  return [...theo].map(([dv, tong]) => `${sl(tong)}${dv ? ` ${dv}` : ''}`).join(' · ')
}

/** Số lượng luôn hiện, kể cả 0 — `showNum` trả chuỗi rỗng cho 0. */
const sl = (v: number) => v.toLocaleString('vi-VN')

/**
 * SẢN PHẨM CỦA LỆNH — MỘT BẢNG, dựng lại 17/09/2026 theo chốt của chủ dự án
 * ("chuyển về 1 dạng bảng cho tính năng xem ảnh và in lsx").
 *
 * Bản trước là dải ảnh cuộn ngang, và nó hỏng ở đúng chỗ người mua cần:
 *
 *  · SỐ LƯỢNG KHÔNG ĐỌC ĐƯỢC. `×50` in 10,5px màu `--ink-3`, dán chung hàng
 *    với mã — mà mã lại `truncate`, nên trên thẻ 104px một mã dài đẩy nó sát
 *    mép. Số lượng là con số nghiệp vụ, không phải chú thích của mã.
 *  · ĐVT BỊ GÕ CỨNG. Dòng tổng ghi "cái" cho mọi lệnh, kể cả lệnh khai theo
 *    Bộ — xem `tongTheoDvt`.
 *  · CUỘN NGANG GIẤU MẤT NỬA LỆNH. Lệnh 17 mã thì quá nửa số lượng nằm ngoài
 *    khung, không so được mã nào nặng mã nào nhẹ — đúng thứ quyết định vật tư
 *    nào phải lo trước.
 *
 * Bảng giữ lại được ảnh (ô 30px, bấm vào xem lớn) mà vẫn xếp số theo cột, nên
 * không phải đánh đổi nhận diện lấy con số.
 *
 * XEM ẢNH ĐI BẰNG `Sheet` BÁM MÉP PHẢI, không phải lớp phủ giữa màn: chủ dự án
 * đã chê đúng kiểu đó ("mở modal che hết màn hình… rất nguy hiểm", 15/09/2026).
 * Bám mép phải thì bảng đơn mua vẫn đọc được bên trái trong lúc soi ảnh.
 */
function SanPham({
  products,
  imageUrls,
  coDonKhach,
}: {
  products: LsxSupplyDetail['products']
  imageUrls: Record<string, string>
  coDonKhach: boolean
}) {
  const [pref, setPref] = useLocalPref('hg.mua-hang.lenh.san-pham', '1')
  // '0' là giá trị thu gọn của bản dải ảnh — người dùng cũ đã có nó trong máy.
  const mo = pref !== '0'
  const [xem, setXem] = useState<LsxSupplyDetail['products'][number] | null>(null)
  const thieuAnh = products.filter((p) => !p.image_file_id).length
  const anhXem = xem?.image_file_id ? imageUrls[xem.image_file_id] : undefined

  return (
    <div
      className="flex shrink-0 flex-col border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]"
      style={
        {
          // Bảng PHỤ 5 cột — không cần bề rộng tối thiểu 680px của bảng chính.
          '--table-min': '460px',
          '--table-inline-max': '236px',
        } as CSSProperties
      }
    >
      <div className="flex items-center gap-2 text-[var(--fs-sm)]">
        <b className="text-[var(--ink)]">Sản phẩm của lệnh</b>
        <span className="num text-[var(--ink-3)]">
          {products.length} mã
          {products.length > 0 && ` · ${tongTheoDvt(products)}`}
        </span>
        {thieuAnh > 0 && products.length > 0 && (
          <span className="text-[10.5px] text-[var(--warn)]">
            {thieuAnh} mã chưa có ảnh trong hồ sơ SP
          </span>
        )}
        {products.length > 0 && (
          <span className="ml-auto">
            <Chip on={mo} onClick={() => setPref(mo ? '0' : '1')}>
              {mo ? 'Thu gọn' : 'Mở bảng'}
            </Chip>
          </span>
        )}
      </div>

      {products.length === 0 ? (
        /*
          NÓI LÝ DO, KHÔNG CHỈ NÓI "TRỐNG" — và nói đúng ai còn nợ việc. Dòng
          lệnh do Bán hàng soạn; lệnh chưa gắn đơn khách thì thường cũng chưa
          có dòng, nên phân biệt hai cảnh để người đọc biết đi đòi cái gì.
        */
        <div className="mt-1 text-[var(--fs-sm)] text-[var(--ink-3)]">
          {coDonKhach
            ? 'Bán hàng chưa soạn dòng lệnh — soạn xong thì sản phẩm hiện ở đây.'
            : 'Lệnh chưa gắn đơn hàng khách và cũng chưa có dòng lệnh nào, nên chưa biết phải làm sản phẩm gì.'}
        </div>
      ) : (
        mo && (
          <div className="mt-2 flex flex-col border-t border-[var(--line)]">
            <Table inline>
              <THead>
                <th className="w-[46px]" />
                <th>Mã SP</th>
                <th>Tên sản phẩm</th>
                <th style={{ textAlign: 'right' }}>Số lượng</th>
                <th className="w-[68px]">ĐVT</th>
              </THead>
              <tbody>
                {products.map((p) => {
                  const src = p.image_file_id ? imageUrls[p.image_file_id] : undefined
                  return (
                    /*
                      CẢ DÒNG mở ô xem ảnh, không phải riêng cái ảnh: ô ảnh
                      rộng 30px là đích bấm quá nhỏ, và dòng không có ảnh vẫn
                      phải mở được — chỗ đó nói ra là hồ sơ SP còn thiếu ảnh,
                      kèm đường đi bổ sung.
                    */
                    <Row key={p.code} onClick={() => setXem(p)}>
                      <Cell>
                        <span className="flex h-[26px] w-[30px] items-center justify-center overflow-hidden rounded-[2px] border border-[var(--line)] bg-[var(--surface-hover)]">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài, kích thước theo hồ sơ SP; next/image không thêm được gì ở ô 30px
                            <img
                              src={src}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[9px] text-[var(--ink-empty)]">—</span>
                          )}
                        </span>
                      </Cell>
                      <Cell>
                        {p.product_id ? (
                          /*
                            Mã đi thẳng vào hồ sơ SP; chặn nổi bọt để bấm mã
                            không mở kèm ô xem ảnh phía sau lưng.
                          */
                          <Code
                            as="a"
                            href={`/products/${p.product_id}`}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            {p.code}
                          </Code>
                        ) : (
                          <span
                            className="num text-[var(--ink-2)]"
                            title="Dòng lệnh gõ tay — không trỏ vào hồ sơ SP nào"
                          >
                            {p.code}
                          </span>
                        )}
                      </Cell>
                      <Cell grow>
                        <span className="truncate" title={p.name}>
                          {p.name}
                        </span>
                      </Cell>
                      <Cell num>
                        <Num value={sl(p.qty)} strong />
                      </Cell>
                      <Cell muted>{p.unit ?? '—'}</Cell>
                    </Row>
                  )
                })}
              </tbody>
              {/*
                Chân bảng KHÔNG cộng chéo ĐVT — lệnh khai vừa Cái vừa Bộ thì
                bày hai con số cạnh nhau, chứ một số gộp thì không đọc ra cái
                gì mà vẫn trông như một con số dùng được.
              */}
              <TFoot
                label={<td colSpan={3}>Cộng {products.length} mã</td>}
                cells={
                  <td className="num" colSpan={2}>
                    {tongTheoDvt(products)}
                  </td>
                }
              />
            </Table>
          </div>
        )
      )}

      <Sheet
        open={!!xem}
        onClose={() => setXem(null)}
        stakes="nhe"
        width={460}
        title={xem?.code ?? ''}
        subtitle={xem?.name}
        footer={
          xem?.product_id ? (
            <Btn href={`/products/${xem.product_id}`}>Mở hồ sơ sản phẩm</Btn>
          ) : (
            <span className="text-[var(--fs-sm)] text-[var(--ink-3)]">
              Dòng lệnh gõ tay — không trỏ vào hồ sơ SP nào
            </span>
          )
        }
      >
        {anhXem ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài, không biết trước kích thước
          <img
            src={anhXem}
            alt={xem?.code ?? ''}
            className="max-h-[54vh] w-full rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-hover)] object-contain"
          />
        ) : (
          /* Trạng thái rỗng phải nói LÝ DO và VIỆC LÀM TIẾP — ảnh nằm ở hồ sơ
             SP do Kỹ thuật giữ, nên chỉ đường sang đó chứ không dừng ở "trống". */
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--line)] px-4 py-8 text-center text-[var(--fs-sm)] text-[var(--ink-3)]">
            Hồ sơ sản phẩm chưa có ảnh. Kỹ thuật nạp ảnh vào hồ sơ thì màn này hiện theo.
          </div>
        )}
        <div className="mt-3 flex items-baseline gap-4 text-[var(--fs-sm)]">
          <span className="text-[var(--ink-3)]">Số lượng phải làm</span>
          <span className="num text-[15px] font-semibold text-[var(--ink)]">
            {xem ? sl(xem.qty) : ''}
            {xem?.unit && (
              <span className="ml-1 text-[11px] font-normal text-[var(--ink-3)]">
                {xem.unit}
              </span>
            )}
          </span>
        </div>
      </Sheet>
    </div>
  )
}

export function LenhScreen({
  lsx,
  today,
  imageUrls,
  canEdit,
}: {
  lsx: LsxSupplyDetail
  today: string
  imageUrls: Record<string, string>
  canEdit: boolean
}) {
  const { coverage: cv } = lsx
  const moc = lsx.materials_due_at ?? lsx.ship_date
  const con = conLai(moc, today)

  const tien: Record<string, number> = {}
  for (const p of lsx.pos) {
    if (p.status === 'cancelled') continue
    tien[p.currency] = (tien[p.currency] ?? 0) + (p.amount ?? 0)
  }
  const tienText = Object.entries(tien)
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `${showMoney(v, { digits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`) // prettier-ignore

  const chuaGui = lsx.pos.filter((p) => p.status === 'draft' || p.status === 'pending_approval').length // prettier-ignore
  const tre = lsx.pos.filter((p) => p.late).length
  /** Ai đang lo lệnh này — suy từ người phụ trách các đơn, như màn cũ vẫn làm. */
  const owners = [
    ...new Set(lsx.pos.map((p) => p.assignee_name).filter((v): v is string => !!v)),
  ]

  return (
    <ScreenFrame>
      <Crumb
        path={[
          'Mua hàng',
          { label: 'Vật tư theo lệnh', href: '/mua-hang/yeu-cau' },
          lsx.code,
        ]}
      />
      <ScreenHeader
        compact
        eyebrow={lsx.customer_name}
        title={lsx.code}
        /*
          DẢI DỮ KIỆN là thứ NHẬN DIỆN lệnh, không phải chỗ bày lại con số.
          "Mã còn hụt" đã rời khỏi đây 15/09/2026 vì dải hiệu suất ngay dưới có
          đúng số đó KÈM MẪU SỐ — một con số đứng hai chỗ là sớm muộn lệch nhau.
          Chỗ trống dành cho hai dữ kiện màn cũ có mà bản này đánh rơi: ngày
          giao khách và ai đang lo lệnh.
        */
        facts={[
          { label: 'Sản phẩm', value: String(lsx.products.length) },
          {
            label: 'Mốc vật tư',
            value: moc ? ngay(moc) : 'chưa có',
            tone: moc ? (con != null && con < 0 ? 'stop' : 'neutral') : 'warn',
          },
          {
            label: 'Ngày giao khách',
            value: lsx.ship_date ? ngay(lsx.ship_date) : 'chưa có',
            tone: lsx.ship_date ? 'neutral' : 'warn',
          },
          {
            label: 'Phụ trách',
            value: owners.length > 0 ? owners.join(', ') : 'chưa giao ai',
            tone: owners.length > 0 ? 'neutral' : 'warn',
          },
          { label: 'Đơn mua', value: String(lsx.pos.length) },
        ]}
        actions={
          <>
            {/*
              BÁO CÁO CỦA RIÊNG LỆNH NÀY — `lsx-report` đã có sẵn 6 sheet (Lệnh ·
              Cần mua · Đặt cho ai · Kỹ thuật cần xử lý · Phân bổ theo SP · Đơn
              mua) cộng một sheet mỗi đơn. Khu mới trước nay không có nút nào
              dẫn tới, nên phần công phu nhất của phòng nằm ngoài tầm với.
            */}
            {/* Đường sang HỒ SƠ LỆNH — màn kia trả lời "lệnh này làm cái gì,
                thông số ra sao"; màn này trả lời "mua đủ chưa". Không có nút
                thì người mua phải gõ URL hoặc đi vòng qua khu cũ. */}
            <Btn icon="lenh" href={`/mua-hang/yeu-cau/${lsx.id}/ho-so`}>
              Hồ sơ lệnh
            </Btn>
            {/*
              IN PHIẾU LỆNH — mẫu chính thức xưởng đang cầm (`/print/lsx/[id]`,
              đã có sẵn từ 0114). Khu Mua hàng trước nay không có đường tới, nên
              người mua muốn đối chiếu tờ giấy trên tay với màn hình thì phải đi
              vòng qua khu Bán hàng. Mở TAB MỚI: in xong còn quay lại chỗ đang
              dở, mà điều hướng cùng tab thì mất bộ lọc đơn đang đặt.
            */}
            <Btn icon="in" onClick={() => window.open(`/print/lsx/${lsx.id}`, '_blank')}>
              In LSX
            </Btn>
            <Btn icon="excel" href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=lsx`}>
              Báo cáo lệnh
            </Btn>
            <Btn
              icon="excel"
              href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=bangke`}
            >
              Bảng kê vật tư
            </Btn>
            {canEdit && (
              <>
                <Btn icon="don" href={`/mua-hang/don?lsx=${lsx.id}`}>
                  Lọc đơn của lệnh
                </Btn>
                <Btn primary icon="them" href={`/mua-hang/don/moi?lsx=${lsx.id}`}>
                  Đặt thêm
                </Btn>
              </>
            )}
          </>
        }
      />

      {/*
        DẢI ĐỘ PHỦ — câu hỏi số một của người mua khi mở một lệnh: còn thiếu
        mấy mã. Mỗi ô kèm MẪU SỐ (luật 6 của sổ thiết kế): "12 / 37 mã" nói
        được điều mà "12" một mình không nói.
      */}
      <MetricStrip>
        <Metric
          label="Đã đủ"
          value={`${cv.covered}/${cv.needed}`}
          basis="tồn khả dụng + đã đặt ≥ còn cần"
          tone={cv.missing === 0 ? 'done' : undefined}
        />
        <Metric
          label="Còn phải đặt"
          value={String(cv.missing)}
          basis={`trên ${cv.needed} mã lệnh cần`}
          tone={cv.missing > 0 ? 'stop' : 'done'}
        />
        <Metric
          label="Đơn chưa gửi NCC"
          value={String(chuaGui)}
          basis={`trên ${lsx.pos.length} đơn của lệnh`}
          tone={chuaGui > 0 ? 'warn' : undefined}
        />
        <Metric
          label="NCC trễ hẹn"
          value={String(tre)}
          basis="đã gửi, qua hẹn chưa về đủ"
          tone={tre > 0 ? 'stop' : undefined}
        />
      </MetricStrip>

      <SanPham
        products={lsx.products}
        imageUrls={imageUrls}
        coDonKhach={lsx.order_codes.length > 0}
      />

      {cv.missing > 0 && cv.missing_top.length > 0 && (
        <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px] text-[var(--fs-sm)]">
          <b className="text-[var(--ink)]">Còn phải đặt:</b>{' '}
          {cv.missing_top.map((m, i) => (
            <span key={m.code}>
              {i > 0 && ' · '}
              <span className="num text-[var(--act)]">{m.code}</span>{' '}
              <span className="text-[var(--ink-2)]">{m.name}</span>{' '}
              <span className="num text-[var(--ink-3)]">
                {showNum(m.qty)} {m.unit}
              </span>
            </span>
          ))}
          {cv.missing > cv.missing_top.length && (
            <span className="text-[var(--ink-3)]">
              {' '}
              · và {cv.missing - cv.missing_top.length} mã nữa
            </span>
          )}
        </div>
      )}

      {lsx.pos.length === 0 ? (
        <Empty
          headline="Lệnh này chưa có đơn mua nào"
          reason={
            cv.missing > 0
              ? `Lệnh còn ${cv.missing} mã chưa đủ — chúng chưa nằm trên đơn nào, nên chưa ai đang lo mua.`
              : 'Tồn kho và các đơn hiện có đã phủ đủ nhu cầu của lệnh, nên chưa cần đặt thêm.'
          }
          next={
            canEdit ? (
              <Btn primary href={`/mua-hang/don/moi?lsx=${lsx.id}`}>
                Soạn đơn cho lệnh này
              </Btn>
            ) : (
              <Btn href="/mua-hang/yeu-cau">Về danh sách lệnh</Btn>
            )
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Đơn</th>
            <th>Nhà cung cấp</th>
            <th>Trạng thái</th>
            <th>Hẹn giao</th>
            <th>Về kho</th>
            <th>Phụ trách</th>
            <th style={{ textAlign: 'right' }}>Giá trị</th>
          </THead>
          <tbody>
            {lsx.pos.map((p) => {
              const conP = conLai(p.expected_at, today)
              return (
                <Row key={p.id}>
                  <Cell pin>
                    <span className="flex items-center gap-2">
                      <Code as="a" href={`/mua-hang/don/${p.id}`}>
                        {p.code}
                      </Code>
                      {/*
                        SỐ ĐH CỦA NCC — cái người mua đọc lên khi gọi điện.
                        NCC không biết mã PO- của mình; họ tra theo số trên tờ
                        giấy họ giữ. 28/66 đơn có số này. Chỉ hiện khi khác mã
                        đơn, tránh in hai lần cùng một chuỗi.
                      */}
                      {p.supplier_doc_no?.trim() && p.supplier_doc_no !== p.code && (
                        <span className="num text-[10.5px] text-[var(--ink-3)]">
                          ĐH {p.supplier_doc_no}
                        </span>
                      )}
                      {/*
                        ĐƠN MUA CHUNG của lệnh khác (0125) phải nói ra: nó nằm
                        đây vì có mua hộ lệnh này, nhưng tiền và tiến độ của nó
                        không thuộc riêng lệnh này.
                      */}
                      {p.shared && (
                        <Tag tone="neutral">
                          mua chung
                          {p.shared_with.length > 0
                            ? ` · ${p.shared_with.join(', ')}`
                            : ''}
                        </Tag>
                      )}
                    </span>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={p.supplier_name}>
                      {p.supplier_name}
                    </span>
                  </Cell>
                  <Cell>
                    <Tag
                      tone={
                        p.status === 'cancelled'
                          ? 'neutral'
                          : p.status === 'received'
                            ? 'done'
                            : p.late
                              ? 'stop'
                              : 'neutral'
                      }
                    >
                      {PO_STATUS_LABEL[p.status as PoStatus] ?? p.status}
                    </Tag>
                  </Cell>
                  <Cell muted>
                    {p.expected_at ? (
                      <span className="flex items-baseline gap-2">
                        <span className="num">{ngay(p.expected_at)}</span>
                        {conP != null && conP < 0 && p.status !== 'received' && (
                          <span className="text-[var(--stop)]">quá {-conP} ngày</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-[var(--warn)]">chưa hẹn</span>
                    )}
                  </Cell>
                  <Cell>
                    {p.line_count > 0 ? (
                      <CoverageBar
                        ratio={(p.line_count - p.lines_missing) / p.line_count}
                        label={`${p.line_count - p.lines_missing}/${p.line_count}`}
                      />
                    ) : (
                      <span className="text-[var(--ink-empty)]">—</span>
                    )}
                  </Cell>
                  <Cell muted>{p.assignee_name ?? '—'}</Cell>
                  <Cell num>
                    <span className="flex items-baseline justify-end gap-1">
                      <Num
                        value={showMoney(p.amount, {
                          digits: p.currency === 'VND' ? 0 : 2,
                        })}
                      />
                      {/*
                        DÒNG CHƯA CÓ GIÁ làm con số trên thành số DƯỚI thực tế.
                        Nói ngay cạnh nó, không để người đọc mang đi cộng.
                      */}
                      {p.unpriced_lines > 0 && (
                        <span className="text-[10.5px] text-[var(--warn)]">
                          {p.unpriced_lines} dòng chưa giá
                        </span>
                      )}
                    </span>
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={<td colSpan={5}>Cộng {lsx.pos.length} đơn của lệnh</td>}
            cells={<td className="num">{tienText.join(' · ')}</td>}
            caveat={
              lsx.pos.some((p) => p.unpriced_lines > 0)
                ? 'Chưa gồm dòng chưa có giá và đơn đã huỷ — con số trên là TẠM TÍNH, đừng dùng để duyệt chi.'
                : 'Cộng riêng từng loại tiền, KHÔNG quy đổi. Chưa gồm đơn đã huỷ.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          lsx.order_codes.length > 0 ? `Đơn hàng: ${lsx.order_codes.join(', ')}` : 'Không gắn đơn hàng', // prettier-ignore
          moc ? `Mốc vật tư ${ngay(moc)}${lsx.materials_due_at ? '' : ' (theo ngày xuất)'}` : 'Chưa đặt mốc vật tư', // prettier-ignore
        ]}
        right={`${lsx.pos.length} đơn · ${cv.missing} mã còn hụt`}
      />
    </ScreenFrame>
  )
}
