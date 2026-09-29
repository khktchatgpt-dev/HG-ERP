'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PAGE_SIZE } from '@/components/warehouse/materials-constants'
import {
  Ico,
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
} from '@/components/kit'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { SuaVatTuSheet } from './sua-vat-tu'

export type VatTuRow = {
  id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  sub_group: string | null
  spec: string | null
  last_purchase_price: number | null
  price_unit: string | null
  needs_review: boolean
}

export function VatTuScreen({
  rows,
  counts,
  groups,
  page,
  filters,
  canEdit,
  tax,
  suppliers,
}: {
  rows: VatTuRow[]
  counts: { total: number; active: number; noShelf: number; needsReview: number }
  groups: string[]
  page: number
  filters: { q: string; nhom: string; ra: boolean }
  /** Quyền `warehouse.material.update_purchasing` — đúng quyền service kiểm khi lưu. */
  canEdit: boolean
  tax: MaterialTaxonomy
  /** NCC cho ô "NCC mặc định". */
  suppliers: { value: string; label: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [dangChay, batDau] = useTransition()

  /*
    Ô TÌM GÕ Ở CLIENT, TRUY VẤN Ở SERVER — nên phải có bản nháp cục bộ.

    Đẩy thẳng mỗi phím lên URL thì mỗi ký tự là một vòng server trên bảng
    13.226 dòng, và con trỏ nhảy về đầu ô giữa chừng. Chờ 350ms không gõ nữa
    mới đi hỏi. `useTransition` giữ danh sách CŨ trên màn trong lúc chờ thay vì
    chớp sang trống — trống một nhịp đọc thành "không có kết quả".
  */
  const [nhap, setNhap] = useState(filters.q)
  /*
    Kéo ô nhập về khớp URL khi URL đổi từ NƠI KHÁC — nút "Bỏ lọc", nút Back của
    trình duyệt, hay link ai đó gửi. Chỉnh NGAY TRONG RENDER theo mẫu React
    ("adjust state when a prop changes"), không dùng effect: setState trong
    effect đẻ thêm một vòng render thừa và cổng lint của dự án chặn thẳng.
  */
  const [qTruoc, setQTruoc] = useState(filters.q)
  if (filters.q !== qTruoc) {
    setQTruoc(filters.q)
    setNhap(filters.q)
  }
  useEffect(() => {
    if (nhap === filters.q) return
    const t = setTimeout(() => doiLoc({ q: nhap, trang: '1' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nhap])

  function doiLoc(patch: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === '0') p.delete(k)
      else p.set(k, v)
    }
    batDau(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }))
  }

  /*
    PANEL SỬA nằm trên URL (`?sua=<id>`) — màn khác (soạn đơn, hồ sơ NCC) dẫn
    thẳng tới được, và Back của trình duyệt đóng panel như người dùng chờ đợi.
  */
  // Đóng NGAY ở client: đợi router.push chạy lại trang 13k mã mới đóng thì
  // panel treo cả giây sau khi bấm Thôi (đo 29/09).
  const [dong, setDong] = useState<string | null>(null)
  const suaUrl = canEdit ? params.get('sua') : null
  const sua = suaUrl && suaUrl !== dong ? suaUrl : null
  // URL đã bỏ `sua` → quên mốc đóng, để bấm lại đúng mã đó vẫn mở được.
  if (!suaUrl && dong) setDong(null)
  const dongPanel = () => {
    setDong(suaUrl)
    doiLoc({ sua: '' })
  }
  const suaHref = (id: string) => {
    const p = new URLSearchParams(params.toString())
    p.set('sua', id)
    return `${pathname}?${p.toString()}`
  }

  const dangLoc = !!filters.q || !!filters.nhom || filters.ra
  const soTrang = Math.max(1, Math.ceil(counts.total / PAGE_SIZE))
  const tu = counts.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const den = Math.min(page * PAGE_SIZE, counts.total)
  const coGia = rows.filter((r) => (r.last_purchase_price ?? 0) > 0).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Vật tư"
        facts={[
          { label: 'Mã trong danh mục', value: counts.total.toLocaleString('vi-VN') },
          /*
            "Chờ Kho rà" là việc CÓ NGƯỜI PHẢI LÀM nên tô hổ phách khi còn; các
            ô còn lại chỉ là quy mô danh mục, không phải cảnh báo — tô màu hết
            thì màu hết nghĩa.
          */
          {
            label: 'Chờ Kho rà',
            value: String(counts.needsReview),
            tone: counts.needsReview > 0 ? 'warn' : 'neutral',
          },
          { label: 'Đang hiện', value: `${tu}–${den}` },
        ]}
      />

      <FilterBar>
        <SearchInput
          value={nhap}
          onChange={setNhap}
          placeholder="Tìm mã hoặc tên vật tư…"
          width={320}
        />
        <Pick
          label="Nhóm vật tư"
          value={filters.nhom}
          onChange={(v) => doiLoc({ nhom: v, trang: '1' })}
          options={[
            { value: '', label: 'Mọi nhóm' },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
          width={230}
        />
        <Chip
          on={filters.ra}
          count={counts.needsReview}
          onClick={() => doiLoc({ ra: filters.ra ? '' : '1', trang: '1' })}
        >
          Chờ Kho rà
        </Chip>
        {dangLoc && (
          <Btn
            icon="boLoc"
            onClick={() => doiLoc({ q: '', nhom: '', ra: '', trang: '1' })}
          >
            Bỏ lọc
          </Btn>
        )}
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          headline="Không có vật tư nào khớp"
          reason={
            dangLoc
              ? `Danh mục có ${counts.total.toLocaleString('vi-VN')} mã khớp bộ lọc hiện tại — trang ${page} thì đã hết dòng. Thử bỏ bớt điều kiện hoặc quay về trang 1.`
              : 'Danh mục vật tư đang trống. Kiểm lại kết nối dữ liệu — đây không phải trạng thái bình thường.'
          }
          next={
            <Btn
              icon="boLoc"
              primary
              onClick={() => doiLoc({ q: '', nhom: '', ra: '', trang: '1' })}
            >
              Bỏ lọc, về trang 1
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th>Nhóm con</th>
            <th>Quy cách</th>
            <th>ĐVT</th>
            <th style={{ textAlign: 'right' }}>Giá mua gần nhất</th>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.id}>
                <Cell pin>
                  {canEdit ? (
                    <Code
                      as="a"
                      href={suaHref(r.id)}
                      title={`Sửa ${r.code}`}
                      // Bấm lại ngay mã vừa đóng: URL chưa kịp bỏ `sua` nên mốc
                      // "đã đóng" phải xoá ở đây, không chờ URL.
                      onClick={() => setDong(null)}
                    >
                      {r.code}
                    </Code>
                  ) : (
                    <Code>{r.code}</Code>
                  )}
                </Cell>
                {/*
                  TÊN VẬT TƯ LÀ CỘT NGƯỜI TA TÌM, nên nó ăn phần dư và có sàn
                  rộng hơn mặc định — tên ở đây dài ("Ắc quy Delkor 95D 26L").
                */}
                <Cell grow className="min-w-[260px]">
                  <span className="flex items-center gap-2">
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                    {r.needs_review && <Tag tone="warn">Chờ rà</Tag>}
                  </span>
                </Cell>
                {/*
                  NHÓM CON BỊ CHẶN BỀ RỘNG. Không chặn thì chuỗi dài nhất của
                  cột ("Ắc – tăng đơ – đầu nối lắp ráp") kéo cột lên 221px —
                  RỘNG HƠN cả cột tên (đo 17/09/2026). Nhóm là thứ đọc lướt để
                  định vị, không phải thứ đọc từng chữ.
                */}
                <Cell
                  muted
                  className="max-w-[150px]"
                  title={r.sub_group ?? r.group_name ?? ''}
                >
                  {r.sub_group ?? r.group_name ?? ''}
                </Cell>
                <Cell muted>{r.spec ?? ''}</Cell>
                <Cell muted>{r.unit}</Cell>
                <Cell num>
                  {/*
                    Ô TRỐNG Ở ĐÂY CÓ NGHĨA: "chưa từng mua qua hệ thống", không
                    phải nhập thiếu. 955/13.226 mã có giá — hệ thống mới chạy 69
                    đơn, nên trống là đúng chứ không phải hỏng.
                  */}
                  <Num
                    value={showMoney(r.last_purchase_price)}
                    strong={(r.last_purchase_price ?? 0) > 0}
                  />
                  {(r.last_purchase_price ?? 0) > 0 && r.price_unit && (
                    <span className="text-k-label ml-1 text-[var(--ink-3)]">
                      /{r.price_unit}
                    </span>
                  )}
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={
              <td colSpan={4}>
                Trang {page}/{soTrang} · {tu}–{den} trong{' '}
                {counts.total.toLocaleString('vi-VN')} mã
              </td>
            }
            /* 6 cột = label(4) + caveat(2); không còn ô số nào để cộng —
               "giá mua gần nhất" là giá của MỘT lần mua, cộng lại vô nghĩa. */
            cells={null}
            caveat={`${coGia}/${rows.length} dòng trên trang này có giá mua. Ô trống = chưa từng mua qua hệ thống, KHÔNG phải giá bằng 0.`}
          />
        </Table>
      )}

      <StatusBar
        left={[
          <span key="p" className="flex items-center gap-2">
            <Btn
              icon="truoc"
              disabled={page <= 1 || dangChay}
              onClick={() => doiLoc({ trang: String(page - 1) })}
            >
              Trước
            </Btn>
            <Btn
              disabled={page >= soTrang || dangChay}
              onClick={() => doiLoc({ trang: String(page + 1) })}
            >
              Sau
              <Ico name="sau" />
            </Btn>
          </span>,
          dangChay
            ? 'Đang tải…'
            : dangLoc
              ? 'Khung nhìn: đang lọc'
              : 'Khung nhìn: tất cả',
          canEdit ? 'Bấm mã để sửa vật tư' : 'Chỉ xem — sửa vật tư do phòng Cung ứng / Kho',
        ]}
        right={`${tu}–${den} / ${counts.total.toLocaleString('vi-VN')}`}
      />
      {sua && (
        <SuaVatTuSheet
          key={sua}
          id={sua}
          tax={tax}
          suppliers={suppliers}
          onClose={dongPanel}
          onSaved={() => {
            dongPanel()
            router.refresh()
          }}
        />
      )}
    </ScreenFrame>
  )
}
