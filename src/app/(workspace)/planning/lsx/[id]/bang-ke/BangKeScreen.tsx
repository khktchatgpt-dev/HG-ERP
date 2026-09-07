'use client'

import React, { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ClipboardPaste,
  Download,
  FileWarning,
  FlaskConical,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Undo2,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { EmptyState } from '@/components/erp/EmptyState'
import { FilterChip } from '@/components/erp/FilterChip'
import { NumberField } from '@/components/erp/NumberField'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { TopProgressBar } from '@/components/erp/Spinner'
import { Toolbar, ToolbarInput, ToolbarSelect } from '@/components/erp/Toolbar'
import { Tabs, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { MaterialPickDialog, type PoMaterial } from '@/components/supply/MaterialPicker'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import {
  BANG_KE_STATUS,
  BANG_KE_STATUSES,
  estimateByCurrency,
  groupBySupplier,
  groupForBangKe,
  type NccBlock,
  viTriLapRap,
  type BangKeRow,
  type BangKeStatus,
} from '@/lib/lsx-bang-ke'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { HAO_HUT_MAC_DINH, slDatHang } from '@/lib/po-waste'
import { cn } from '@/lib/utils'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { PasteLinesDialog, type PasteConfirm } from '../../../pos/new/PasteLinesDialog'

const STATUS_BADGE: Record<BangKeStatus, BadgeTone> = {
  unconfirmed: 'amber',
  blank: 'gray',
  none: 'red',
  short: 'amber',
  pending: 'amber',
  inflight: 'blue',
  done: 'green',
  extra: 'gray',
}

/** Vạch trái mã hoá mức khẩn — chỉ ba màu vòng đời + xám. */
const STATUS_STRIPE: Record<BangKeStatus, string> = {
  unconfirmed: 'var(--warn)',
  blank: 'var(--muted-foreground)',
  none: 'var(--stop)',
  short: 'var(--warn)',
  pending: 'var(--warn)',
  inflight: 'var(--primary)',
  done: 'var(--done)',
  extra: 'var(--muted-foreground)',
}

const SOURCE_LABEL: Record<BangKeRow['source'], string> = {
  manual: 'nhập tay',
  components: 'định hình',
  bom: 'định mức đã xác nhận',
  bom_draft: 'BOM chưa xác nhận',
  none: 'ngoài định mức',
}

/** Tối đa mã đưa vào một lượt "Soạn đơn cho dòng thiếu" — đơn dài hơn là đơn khó đọc. */
const MAX_PREFILL = 40

/**
 * SỐ CỘT SẢN PHẨM TỐI ĐA.
 *
 * Sổ tay của phòng bày mỗi sản phẩm một CỘT (sheet BKVT file YOTRIO, 3 SP) —
 * đọc một dòng là thấy vật tư này chia cho SP nào bao nhiêu, không phải bấm mở
 * từng dòng. Nhưng chính phòng cũng bỏ khuôn đó khi lệnh nhiều mã: file LSX
 * 06.26.27 có 9 sản phẩm thì họ quay về kê từng khối một SP.
 *
 * Lý do là bề ngang: quá 6 cột thì Cần / Tồn / Còn phải đặt — mấy con số CHÍNH
 * của bảng — bị đẩy khỏi màn. Trên ngưỡng này giữ nguyên cách cũ (nút "dùng cho
 * N SP" mở ra chi tiết), vì thà bấm một nhịp còn hơn mất cột quan trọng.
 */
const MAX_SP_COLS = 6

/**
 * CỘT VẬT TƯ GHIM TRÁI khi bảng phải cuộn ngang.
 *
 * Bày 5 cột sản phẩm đẩy bảng lên 1.771px trong khung 1.135 — cuộn sang phải
 * đọc "Còn phải đặt" là mất luôn tên vật tư, không biết đang đọc dòng nào.
 *
 * BẪY: bảng shadcn ăn `border-collapse` của Tailwind preflight, mà ô sticky
 * trong bảng collapse KHÔNG vẽ được viền của chính nó — viền thuộc về bảng. Nên
 * dựng đường ngăn bằng `box-shadow` bên phải, và ô ghim phải có NỀN ĐỤC, không
 * thì chữ cột sau trôi qua dưới nó.
 */
const GHIM = 'sticky z-10 bg-card shadow-[1px_0_0_0_var(--border)]'

/**
 * Link sang form soạn đơn, điền sẵn mã + SL đề xuất (và NCC nếu biết).
 *
 * Cắt ở MAX_PREFILL: URL dài quá thì proxy/trình duyệt cắt ngang và form nhận
 * được một danh sách mã cụt — thà điền ít mà đúng.
 */
function soanDonHref(
  lsxId: string,
  rows: BangKeRow[],
  hh: number,
  supplierId?: string | null,
): string | null {
  const pick = rows.slice(0, MAX_PREFILL)
  if (pick.length === 0) return null
  const p = new URLSearchParams({
    lsx: lsxId,
    material: pick.map((r) => r.material_code).join(','),
    // SỐ ĐẶT, không phải số còn thiếu: đơn gửi NCC luôn là số đã cộng hao hụt
    // và làm tròn lên. Chép số còn thiếu sang đơn là bỏ mất cả cột hh của mọi
    // mẫu đơn giấy, rồi người soạn phải tự nhân tay từng dòng.
    qty: pick.map((r) => String(slDatHang(r.suggest, hh, r.unit))).join(','),
  })
  if (supplierId) p.set('supplier', supplierId)
  return `/planning/pos/new?${p.toString()}`
}

/** Id neo cho mục lục nhảy tới — tên khối có dấu và khoảng trắng. */
const khoiId = (name: string) =>
  'khoi-' +
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')

const fmt = (n: number) =>
  n === 0 ? '0' : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

type NeedRow = { material_id: string; qty_needed: number; note?: string | null }

/** "loai" = rà còn thiếu gì · "ncc" = cắt đơn cho ai. */
type ViewMode = 'loai' | 'ncc'

/** Khối NCC của lõi, kèm link soạn đơn mà chỉ màn hình cần. */
type NccBlockUi = NccBlock & { href: string | null }

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — màn nhân viên Cung ứng mở đầu ngày.
 *
 * Ba nguyên tắc trình bày (thiết kế lại 05/09/2026):
 *  1. CHỈ ĐỊNH MỨC ĐÃ XÁC NHẬN mới thành số "Cần" — bản nháp hiện riêng, có
 *     công tắc, và luôn mang nhãn cảnh báo. Mua theo bản nháp là mua sai.
 *  2. GOM THEO NHÓM VẬT TƯ như sổ Excel của phòng: người mua gọi NCC theo
 *     nhóm (thép một cuộc, ngũ kim một cuộc), không gọi theo thứ tự bảng chữ.
 *  3. Mỗi dòng trả lời đúng một câu "còn phải đặt bao nhiêu" — cột đó nổi bật
 *     nhất, các số phụ (tồn, đã đặt, đã về) gom lại và giải thích khi rê chuột.
 */
export function BangKeScreen({
  data,
  today,
  canEdit,
}: {
  data: LsxBangKe
  today: string
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const { lsx, rows, summary, groups } = data
  const [status, setStatus] = useState<BangKeStatus | null>(null)
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [showProducts, setShowProducts] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  /** Mã đang mở phần "dùng cho sản phẩm nào". */
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('loai')
  /*
    KHỐI ĐANG THU GỌN. Lưu tên khối đã đóng chứ không lưu khối đang mở: mặc
    định là MỞ HẾT — mở bảng kê ra mà thấy mọi thứ gấp lại thì người dùng
    tưởng lệnh chưa có gì. Đóng là hành động có chủ ý của họ.
  */
  const [dong, setDong] = useState<Set<string>>(new Set())
  const doiKhoi = (k: string) =>
    setDong((cur) => {
      const next = new Set(cur)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  /*
    HAO HỤT: đổi cho CẢ BẢNG, không lưu xuống DB.

    Đây là con số của một lượt đặt hàng, không phải thuộc tính của vật tư — hôm
    nay mua gấp thì để 5%, lô sau đặt dư còn tồn thì để 0%. Lưu lại là biến một
    quyết định nhất thời thành mặc định vĩnh viễn mà không ai nhớ ai đặt.
  */
  const [hh, setHh] = useState(HAO_HUT_MAC_DINH)
  /** Người dùng chủ động mở bảng dù chưa có định mức xác nhận nào. */
  const [forceTable, setForceTable] = useState(false)

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return rows.filter((r) => {
      if (status !== null && r.status !== status) return false
      if (group && r.group_name !== group) return false
      if (nq && !norm(`${r.material_code} ${r.material_name}`).includes(nq)) return false
      return true
    })
  }, [rows, status, group, q])

  /*
    CHIA KHỐI THEO LOẠI TRONG ĐỊNH MỨC (07/09/2026), không theo nhóm kho nữa.

    Sổ tay của phòng tách hẳn "BẢNG KÊ VẬT TƯ NGŨ KIM" khỏi "VẬT TƯ BAO BÌ" khỏi
    khối gỗ/nệm/vải — đó mới là trục người mua dùng. Nhóm KHO quá thô để làm
    tầng duy nhất: lệnh 01/26-27 - MX có 107 mã thì 66 mã dồn vào đúng một nhóm
    "Bu lông - vít - đinh - liên kết", đọc như một khối liền không đầu đuôi.

    Mã chỉ có trên đơn (ngoài định mức) và dòng nhập tay KHÔNG có loại — cho rơi
    về nhóm kho như cũ chứ không đoán bừa một loại cho chúng.

    Khối dài hơn NGUONG_CHIA thì chia tiếp một tầng theo nhóm phụ của danh mục
    (phủ 91%, riêng nhóm bu lông 97%). Khối ngắn thì KHÔNG chia — thêm một tầng
    tiêu đề cho sáu dòng là làm rối chứ không làm rõ.
  */
  /*
    Chia khối bằng ĐÚNG hàm lõi mà file Excel dùng — hai bản dựng riêng thì sớm
    muộn màn và file chia khối khác nhau. Nhãn/thứ tự loại truyền vào từ
    lib/part-groups (lõi không biết gì về nhãn tiếng Việt).
  */
  const sections = useMemo(
    () => groupForBangKe(filtered, partGroupLabel, partGroupRank),
    [filtered],
  )

  /*
    Cột sản phẩm: chỉ bày khi lệnh có 2..MAX_SP_COLS sản phẩm. Một SP thì cột đó
    lặp lại đúng cột "Cần", thêm vào chỉ tốn chỗ.
  */
  const spCols = useMemo(() => {
    const ps = data.products
    return ps.length >= 2 && ps.length <= MAX_SP_COLS ? ps : []
  }, [data.products])

  const shortRows = useMemo(() => rows.filter((r) => r.suggest > 0), [rows])
  /*
    TIỀN TẠM TÍNH cho phần còn phải đặt — theo TỪNG tiền tệ, vì bảng có cả mã
    mua bằng VND lẫn USD. Đếm riêng số mã chưa có giá lần nào: không nói ra thì
    con số tạm tính đọc thành "cả lệnh hết ngần này", trong khi nó mới chỉ gồm
    những mã từng mua.
  */
  const uocTien = useMemo(() => estimateByCurrency(shortRows, hh), [shortRows, hh])
  const khongCoGia = useMemo(
    () => shortRows.filter((r) => !r.last_price).length,
    [shortRows],
  )
  const prefillHref = useMemo(
    () => soanDonHref(lsx.id, shortRows, hh),
    [shortRows, lsx.id, hh],
  )

  /*
    GỘP THEO NHÀ CUNG CẤP — nửa phải sổ tay của phòng (sheet BKVT file YOTRIO:
    "STT | NCC | Tên vật tư | ĐVT | Tổng SL cần đặt"). Đây là bảng để CẮT ĐƠN:
    mỗi khối là một cuộc gọi, một tờ đơn.

    Chỉ lấy dòng CÒN PHẢI ĐẶT. Bày cả mã đã đủ ở đây là lẫn — người đang cắt đơn
    không quan tâm mã đã xong.

    NCC lấy theo lần mua GẦN NHẤT của chính mã đó. Mã chưa mua bao giờ gom vào
    một khối riêng, KHÔNG đoán NCC cho chúng: đoán sai thì đơn gửi nhầm chỗ.
  */
  /*
    Cắt khối bằng ĐÚNG hàm lõi mà file Excel dùng (groupBySupplier) — hai bản
    dựng riêng thì sớm muộn một bên đổi luật và màn với file chia đơn khác nhau.
    Ở đây chỉ thêm phần màn cần mà file không cần: link sang form soạn đơn.

    Ăn theo bộ lọc đang bật, không đọc thẳng shortRows: để nguyên thanh lọc trên
    đầu mà bấm không đổi gì thì đó là nút chết.
  */
  const nccBlocks = useMemo(
    () =>
      groupBySupplier(filtered, hh).map((b) => ({
        ...b,
        href: soanDonHref(lsx.id, b.rows, hh, b.supplier_id),
      })),
    [filtered, lsx.id, hh],
  )

  /** Số mã đang hiện ở chế độ NCC — sau bộ lọc, không phải tổng của lệnh. */
  const nccCount = useMemo(
    () => nccBlocks.reduce((n, b) => n + b.rows.length, 0),
    [nccBlocks],
  )

  const usedIds = useMemo(() => new Set(rows.map((r) => r.material_id)), [rows])
  const suggestById = useMemo(
    () =>
      new Map(rows.filter((r) => r.suggest > 0).map((r) => [r.material_id, r.suggest])),
    [rows],
  )
  const unconfirmedProducts = useMemo(
    () => data.products.filter((p) => !p.bom_confirmed && p.coded_parts > 0),
    [data.products],
  )

  /**
   * KHOÁ BẢNG khi chưa có mã nào dùng được: cột Cần toàn 0 thì bảng 106 dòng
   * chỉ gây nhiễu và làm người mua tưởng đã có số (user chốt 06/09/2026 —
   * "chưa xác nhận thì để trống, hiện nội dung cho nhân viên biết").
   */
  const blockedByBom =
    !data.include_draft && summary.needed === 0 && summary.unconfirmed > 0 && !forceTable

  const manualDisabled = !canEdit || data.manual_error !== null
  const draftHref = `/planning/lsx/${lsx.id}/bang-ke${data.include_draft ? '' : '?nhap=1'}`

  async function saveRows(list: NeedRow[], done: string) {
    if (list.length === 0) return
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'PUT',
        body: { production_order_id: lsx.id, rows: list },
      })
      toast.success(done)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được bảng kê', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeManual(r: BangKeRow) {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'DELETE',
        body: { production_order_id: lsx.id, material_ids: [r.material_id] },
      })
      toast.success(
        r.auto_needed != null
          ? `${r.material_code} quay về số định mức ${fmt(r.auto_needed)}`
          : `Đã bỏ dòng ${r.material_code}`,
      )
      router.refresh()
    } catch (e) {
      toast.error('Không bỏ được dòng', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Dòng tự động → dòng tay với đúng số đang thấy, để sửa ngay sau đó. */
  function override(r: BangKeRow) {
    const start =
      r.source === 'none'
        ? r.pos.reduce((s, p) => s + p.qty_ordered, 0)
        : r.qty_needed || r.draft_needed
    void saveRows(
      [{ material_id: r.material_id, qty_needed: start, note: r.note }],
      `${r.material_code} đã thành dòng nhập tay — sửa số Cần ngay trong ô`,
    )
  }

  function onPicked(list: PoMaterial[]) {
    setPickOpen(false)
    void saveRows(
      list.map((m) => ({ material_id: m.id, qty_needed: 0 })),
      `Đã thêm ${list.length} mã — điền số Cần cho từng dòng`,
    )
  }

  function onPasted(p: PasteConfirm) {
    setPasteOpen(false)
    const list = p.matched.map((m) => ({
      material_id: m.material.id,
      qty_needed: m.qty ?? 0,
      note: m.note,
    }))
    if (list.length === 0) {
      toast.warning('Không có dòng nào khớp mã vật tư để đưa vào bảng kê')
      return
    }
    void saveRows(list, `Đã nhập ${list.length} dòng từ Excel`)
  }

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Cung ứng', href: '/planning' },
          { label: 'Vật tư theo lệnh', href: '/planning/lsx' },
          { label: `LSX ${lsx.code}`, href: `/planning/lsx/${lsx.id}` },
          { label: 'Bảng kê vật tư' },
        ]}
        title={`Bảng kê vật tư · LSX ${lsx.code}`}
        description={`${lsx.customer_name}${lsx.order_codes.length > 0 ? ` · ĐH ${lsx.order_codes.join(', ')}` : ''}`}
        meta={
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {lsx.ship_date && (
              <span>
                Ngày xuất <span className="t-data">{dmy(lsx.ship_date)}</span>
              </span>
            )}
            <span>
              Hạn vật tư{' '}
              {lsx.materials_due_at ? (
                <span className="t-data">{dmy(lsx.materials_due_at)}</span>
              ) : (
                <span className="text-[var(--warn)]">chưa đặt</span>
              )}
            </span>
            <span>
              <span className="t-data">{data.products.length}</span> sản phẩm ·{' '}
              <span className="t-data">{rows.length}</span> mã vật tư
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/planning/lsx/${lsx.id}`}>
                <ShoppingCart />
                Đơn mua của lệnh
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/dept/supply/lsx-report?lsx=${lsx.id}&loai=bangke&hh=${hh}${data.include_draft ? '&nhap=1' : ''}`}
                download
              >
                <Download />
                Xuất bảng kê
              </a>
            </Button>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={manualDisabled}
                  onClick={() => setPasteOpen(true)}
                >
                  <ClipboardPaste />
                  Dán từ Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={manualDisabled}
                  onClick={() => setPickOpen(true)}
                >
                  <Plus />
                  Thêm mã
                </Button>
              </>
            )}
            {canEdit && prefillHref && (
              <Button size="sm" asChild>
                <Link href={prefillHref}>
                  <ShoppingCart />
                  Soạn đơn cho {Math.min(shortRows.length, MAX_PREFILL)} mã thiếu
                </Link>
              </Button>
            )}
          </>
        }
      />

      {data.manual_error && (
        <Notice tone="warn">
          Chưa đọc được bảng kê nhập tay: migration{' '}
          <span className="t-data">0184_supply_lsx_needs</span> chưa áp lên cơ sở dữ liệu.
          Phần định mức vẫn hiện bình thường.
        </Notice>
      )}

      {/*
        ĐƠN GỘP LỆNH NÀY NHƯNG CHƯA CHIA SỐ (0185). Phần của lệnh đang tính
        bằng 0 — im lặng thì người xem tưởng chưa ai đặt gì và đặt chồng thêm
        một đơn nữa. Nói rõ đơn nào và mời vào chia.
      */}
      {data.unsplit_pos.length > 0 && (
        <Notice tone="warn">
          {data.unsplit_pos.map((p) => (
            <span key={p.po_code} className="block">
              Đơn <DocChip>{p.po_code}</DocChip> mua chung cho lệnh này nhưng{' '}
              <b>chưa chia số lượng</b>, nên phần của lệnh đang tính bằng 0. Toàn bộ số
              trên đơn đang thuộc lệnh{' '}
              {p.lsx_chinh ? <DocChip>{p.lsx_chinh}</DocChip> : 'chính của đơn'} — mở đơn
              để chia cho đúng.
            </span>
          ))}
        </Notice>
      )}

      {/* ── Nguồn định mức: nói thẳng số nào dùng được để mua ────────── */}
      <section className="bg-card rounded-lg border">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-md"
              style={{
                background:
                  unconfirmedProducts.length > 0
                    ? 'color-mix(in srgb, var(--warn) 14%, transparent)'
                    : 'color-mix(in srgb, var(--done) 14%, transparent)',
                color: unconfirmedProducts.length > 0 ? 'var(--warn)' : 'var(--done)',
              }}
            >
              {unconfirmedProducts.length > 0 ? (
                <AlertTriangle className="size-5" strokeWidth={1.8} />
              ) : (
                <ShieldCheck className="size-5" strokeWidth={1.8} />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="t-title">Nguồn số &ldquo;Cần&rdquo;</h2>
              <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                {unconfirmedProducts.length > 0 ? (
                  <>
                    <span className="t-data">{unconfirmedProducts.length}</span>/
                    <span className="t-data">{data.products.length}</span> sản phẩm có
                    định mức nhưng <b>Kỹ thuật chưa xác nhận BOM</b>. Số của những sản
                    phẩm này{' '}
                    {data.include_draft ? (
                      <>
                        đang được cộng vào vì bạn bật xem cả bản nháp — đừng gửi đơn dựa
                        trên đó.
                      </>
                    ) : (
                      <>chưa tính vào cột Cần, để không mua theo bản nháp.</>
                    )}
                  </>
                ) : data.need_source === 'none' ? (
                  <>
                    Lệnh chưa có định mức lẫn bảng định hình. Nhập tay bằng &ldquo;Thêm
                    mã&rdquo; hoặc &ldquo;Dán từ Excel&rdquo;.
                  </>
                ) : (
                  <>
                    Toàn bộ định mức của lệnh đã được Kỹ thuật xác nhận — số Cần dùng để
                    mua được.
                  </>
                )}
                {data.manual_count > 0 && (
                  <>
                    {' '}
                    Có <span className="t-data">{data.manual_count}</span> mã do Cung ứng
                    nhập tay, ghi đè định mức.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {unconfirmedProducts.length > 0 && (
              <>
                <Button
                  variant={data.include_draft ? 'secondary' : 'outline'}
                  size="sm"
                  asChild
                >
                  <Link href={draftHref} scroll={false}>
                    <FlaskConical />
                    {data.include_draft
                      ? 'Đang tính cả bản nháp'
                      : 'Tính cả BOM chưa xác nhận'}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProducts((v) => !v)}
                  aria-expanded={showProducts}
                >
                  {showProducts ? 'Ẩn danh sách' : 'Xem sản phẩm chưa chốt'}
                </Button>
              </>
            )}
          </div>
        </div>
        {showProducts && unconfirmedProducts.length > 0 && (
          <ul className="divide-border grid gap-px border-t sm:grid-cols-2 lg:grid-cols-3">
            {unconfirmedProducts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-[12.5px]">
                  <DocChip>{p.code}</DocChip>
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="t-data text-muted-foreground shrink-0 text-[11px]">
                  {fmt(p.qty)} SP · {p.coded_parts} dòng ĐM
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.blocked.length > 0 && (
        <section className="bg-card rounded-lg border">
          <div className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-md"
                style={{
                  background: 'color-mix(in srgb, var(--stop) 14%, transparent)',
                  color: 'var(--stop)',
                }}
              >
                <AlertTriangle className="size-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h2 className="t-title">
                  <span className="t-data">{data.blocked.length}</span> dòng định mức chưa
                  quy đổi được sang đơn vị mua
                </h2>
                <p className="text-muted-foreground mt-0.5 text-[12.5px]">
                  Định mức đếm theo chi tiết, vật tư lại bán theo cây hoặc kg. Số của
                  những dòng này <b>không được cộng vào cột Cần</b> — lấy số thanh làm số
                  cây là mua thừa nhiều lần.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBlocked((v) => !v)}
              aria-expanded={showBlocked}
            >
              {showBlocked ? 'Ẩn danh sách' : 'Xem chi tiết'}
            </Button>
          </div>
          {showBlocked && (
            <ul className="divide-border divide-y border-t">
              {data.blocked.map((b, i) => (
                <li
                  key={`${b.material_code}-${b.product_code}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[12.5px]"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <DocChip>{b.material_code}</DocChip>
                    <span className="truncate">{b.material_name}</span>
                    <span className="text-muted-foreground">
                      SP {b.product_code}
                      {b.part_name ? ` · ${b.part_name}` : ''}
                    </span>
                  </span>
                  <span className="text-[var(--stop)]">{b.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Tóm tắt: 4 con số người mua đọc trước ─────────────────────── */}
      <StatTiles>
        <StatTile
          label="Cần mua thêm"
          value={shortRows.length}
          hint={
            shortRows.length > 0
              ? uocTien.size > 0
                ? `≈ ${[...uocTien].map(([c, v]) => `${moneyShort(v)} ${c}`).join(' + ')}${khongCoGia > 0 ? ` · ${khongCoGia} mã chưa có giá` : ''}`
                : `${fmt(shortRows.reduce((s, r) => s + r.suggest, 0))} đơn vị · chưa mã nào có giá mua`
              : 'không còn mã nào thiếu'
          }
          tone="stop"
          icon={PackageSearch}
          active={status === 'none' || status === 'short'}
          onClick={() => setStatus(status === 'none' ? null : 'none')}
        />
        <StatTile
          label="Đã đặt · đang về"
          value={summary.inflight + summary.pending}
          hint="đơn đã gửi hoặc còn nháp"
          tone="primary"
          icon={ShoppingCart}
          active={status === 'inflight'}
          onClick={() => setStatus(status === 'inflight' ? null : 'inflight')}
        />
        <StatTile
          label="Đủ"
          value={summary.done}
          hint="tồn kho và hàng về đã phủ"
          tone="done"
          icon={CheckCircle2}
          active={status === 'done'}
          onClick={() => setStatus(status === 'done' ? null : 'done')}
        />
        <StatTile
          label="Chưa dùng được"
          value={summary.unconfirmed + summary.blank}
          hint="BOM chưa xác nhận hoặc chưa điền số"
          tone="warn"
          icon={AlertTriangle}
          active={status === 'unconfirmed'}
          onClick={() => setStatus(status === 'unconfirmed' ? null : 'unconfirmed')}
        />
      </StatTiles>

      {/*
        HAI CHẾ ĐỘ XEM, không phải hai trang: cùng một bảng kê, hai cách cắt.
        "Theo loại vật tư" để RÀ (còn thiếu gì); "Gộp theo NCC" để CẮT ĐƠN (gọi
        ai, đơn nào). Sổ tay của phòng để hai thứ này cạnh nhau trên một tờ.
      */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="loai">
              <Package /> Theo loại vật tư
            </TabsTrigger>
            <TabsTrigger value="ncc">
              <Truck /> Gộp theo NCC
              {nccBlocks.length > 0 && (
                <span className="t-data ml-1.5 text-[11px]">{nccBlocks.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {view === 'ncc' && (
          <span className="text-muted-foreground text-[12px]">
            chỉ {nccCount} mã còn phải đặt
          </span>
        )}
        {/*
          HAO HỤT của lượt đặt này. Đặt cạnh công tắc chế độ xem chứ không nhét
          vào thanh lọc: nó không lọc gì cả, nó ĐỔI SỐ trên cột SL đặt và trên
          mọi nút soạn đơn.
        */}
        <label className="text-muted-foreground ml-auto flex items-center gap-1.5 text-[12px]">
          Hao hụt
          <Input
            type="number"
            min={0}
            max={50}
            step={1}
            value={hh}
            onChange={(e) => {
              const v = Number(e.target.value)
              setHh(Number.isFinite(v) ? Math.min(Math.max(v, 0), 50) : 0)
            }}
            // Lăn chuột trên ô số đang focus là đổi số mà không ai định đổi —
            // cùng cách NumberWheelGuard chặn ở form soạn đơn.
            onWheel={(e) => e.currentTarget.blur()}
            className="t-data h-8 w-16 px-2 text-right text-[13px]"
            aria-label="Phần trăm hao hụt khi đặt hàng"
          />
          %
        </label>
      </div>

      <Toolbar
        left={
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              label="Tất cả"
              count={rows.length}
              active={status === null}
              onClick={() => setStatus(null)}
            />
            {BANG_KE_STATUSES.filter((k) => summary[k] > 0).map((k) => (
              <FilterChip
                key={k}
                label={BANG_KE_STATUS[k].label}
                count={summary[k]}
                active={status === k}
                onClick={() => setStatus(status === k ? null : k)}
              />
            ))}
          </div>
        }
        right={
          <>
            {groups.length > 0 && (
              <ToolbarSelect
                value={group}
                onChange={setGroup}
                options={[
                  { value: '', label: 'Mọi nhóm vật tư' },
                  ...groups.map((g) => ({ value: g, label: g })),
                ]}
              />
            )}
            <ToolbarInput
              value={q}
              onChange={setQ}
              placeholder="Tìm mã, tên vật tư…"
              icon={<Search className="size-4" />}
            />
          </>
        }
      />

      {/*
        MỤC LỤC KHỐI — lệnh 107 mã là một mạch cuộn dài; không có chỗ nhảy thì
        muốn xem khối bao bì phải cuộn qua trăm dòng ngũ kim. Chỉ hiện khi có
        từ hai khối trở lên, vì một khối thì mục lục chỉ là một cái nút thừa.
      */}
      {view === 'loai' && !blockedByBom && sections.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-[12px]">Nhảy tới:</span>
          {sections.map((sec) => (
            <Button
              key={sec.name}
              variant="outline"
              size="sm"
              className="h-7 text-[12px]"
              onClick={() => {
                setDong((cur) => {
                  const next = new Set(cur)
                  next.delete(sec.name)
                  return next
                })
                document
                  .getElementById(khoiId(sec.name))
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {sec.name}
              <span className="t-data text-muted-foreground">{sec.rows.length}</span>
              {sec.short > 0 && (
                <span className="t-data text-[var(--stop)]">{sec.short} thiếu</span>
              )}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12px]"
            onClick={() =>
              setDong((cur) =>
                cur.size === sections.length
                  ? new Set()
                  : new Set(sections.map((x) => x.name)),
              )
            }
          >
            {dong.size === sections.length ? 'Mở tất cả' : 'Thu gọn tất cả'}
          </Button>
        </div>
      )}

      {view === 'ncc' && !blockedByBom ? (
        <NccView
          blocks={nccBlocks}
          canEdit={canEdit}
          hh={hh}
          dangLoc={status !== null || group !== '' || q.trim() !== ''}
        />
      ) : blockedByBom ? (
        <section className="bg-card overflow-hidden rounded-lg border">
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span
              className="grid size-12 place-items-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
                color: 'var(--warn)',
              }}
            >
              <FileWarning className="size-6" strokeWidth={1.8} />
            </span>
            <h2 className="t-title">Chưa có định mức nào dùng được để mua</h2>
            <p className="text-muted-foreground max-w-xl text-[13px]">
              Cả <span className="t-data">{summary.unconfirmed}</span> mã vật tư của lệnh
              này đều đến từ hồ sơ sản phẩm mà <b>Kỹ thuật chưa xác nhận BOM</b>. Bảng kê
              để trống có chủ đích: mua theo bản nháp là mua sai số lượng.
            </p>
            <p className="text-muted-foreground max-w-xl text-[12.5px]">
              Việc cần làm: Kỹ thuật mở hồ sơ từng sản phẩm bên dưới và đánh dấu
              &ldquo;BOM đã kiểm tra&rdquo;. Xong bước đó, bảng kê tự có số ngay.
            </p>
            {unconfirmedProducts.length > 0 && (
              <ul className="mt-1 flex max-w-2xl flex-wrap justify-center gap-1.5">
                {unconfirmedProducts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.id}/dinh-muc`}
                      className="hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px]"
                    >
                      <DocChip>{p.code}</DocChip>
                      <span className="max-w-[180px] truncate">{p.name}</span>
                      <span className="text-muted-foreground t-data">
                        {p.coded_parts} dòng
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={draftHref} scroll={false}>
                  <FlaskConical />
                  Xem tạm số theo bản nháp
                </Link>
              </Button>
              {canEdit && !data.manual_error && (
                <Button variant="outline" size="sm" onClick={() => setPickOpen(true)}>
                  <Plus />
                  Tự nhập bảng kê
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setForceTable(true)}>
                Vẫn xem bảng ({rows.length} mã)
              </Button>
            </div>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className="bg-card rounded-lg border">
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={
              rows.length === 0
                ? 'Lệnh chưa có nhu cầu vật tư và chưa có đơn mua nào'
                : 'Không có mã nào khớp bộ lọc'
            }
            description={
              rows.length === 0
                ? 'Bấm "Thêm mã" hoặc "Dán từ Excel" để nhập bảng kê tay, hoặc chờ Kỹ thuật xác nhận định mức.'
                : undefined
            }
          />
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((sec) => (
            <section
              key={sec.name}
              id={khoiId(sec.name)}
              className="bg-card scroll-mt-20 overflow-hidden rounded-lg border"
            >
              {/*
                Tiêu đề khối GHIM khi cuộn (top-14 = chiều cao thanh đầu trang):
                khối ngũ kim 105 dòng thì cuộn tới giữa là quên đang đọc khối
                nào. Bấm vào để thu gọn — đó là cách duy nhất làm trang ngắn lại
                mà không giấu mất dữ liệu.
              */}
              <header className="bg-muted/40 sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 backdrop-blur">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => doiKhoi(sec.name)}
                  aria-expanded={!dong.has(sec.name)}
                  className="h-auto justify-start gap-2 px-0 py-0 hover:bg-transparent hover:text-[var(--primary)]"
                >
                  {dong.has(sec.name) ? (
                    <ChevronRight className="text-muted-foreground size-4" />
                  ) : (
                    <ChevronDown className="text-muted-foreground size-4" />
                  )}
                  <span className="t-title">{sec.name}</span>
                  <span className="t-data text-muted-foreground font-normal">
                    {sec.rows.length} mã
                  </span>
                </Button>
                {sec.short > 0 && (
                  <span className="text-[12px] font-medium text-[var(--stop)]">
                    {sec.short} mã còn phải đặt
                  </span>
                )}
              </header>
              <div className="overflow-x-auto" hidden={dong.has(sec.name)}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className={cn('bg-muted/40 w-1 p-0', 'sticky left-0 z-10')}
                      />
                      <TableHead className={cn(GHIM, 'bg-muted/40 left-1 min-w-[220px]')}>
                        Vật tư
                      </TableHead>
                      {spCols.map((p) => (
                        <TableHead key={p.id} className="min-w-[86px] text-right">
                          <span className="t-data block text-[11px] font-semibold">
                            {p.code}
                          </span>
                          <span className="t-data text-muted-foreground block text-[10.5px] font-normal">
                            {fmt(p.qty)} SP
                          </span>
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Cần</TableHead>
                      <TableHead className="text-right">Đã có</TableHead>
                      <TableHead className="text-right">Đã đặt</TableHead>
                      <TableHead className="text-right">Còn phải đặt</TableHead>
                      <TableHead className="min-w-[92px] text-right">
                        SL đặt
                        <span className="t-data text-muted-foreground ml-1 text-[10.5px] font-normal">
                          +{hh}%
                        </span>
                      </TableHead>
                      <TableHead className="min-w-[112px] text-right">
                        Giá gần nhất
                      </TableHead>
                      <TableHead className="min-w-[125px]">Tình trạng</TableHead>
                      <TableHead className="min-w-[150px]">Đơn mua</TableHead>
                      {canEdit && <TableHead className="w-[130px]" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sec.subs.map((sub) => (
                      <React.Fragment key={sub.name ?? '_'}>
                        {sub.name && (
                          /*
                            Tầng nhóm phụ: một dòng gạch ngang trong thân bảng,
                            KHÔNG phải một bảng con. Bảng con thì mỗi nhóm một
                            hàng tiêu đề riêng, cột lệch nhau và mất luôn cái
                            lợi của bảng dài là dóng số theo cột.
                          */
                          <TableRow className="hover:bg-transparent">
                            <TableCell className="bg-card sticky left-0 z-10 p-0" />
                            <TableCell
                              colSpan={(canEdit ? 10 : 9) + spCols.length}
                              className="bg-muted/40 p-0"
                            >
                              {/*
                                Nhóm phụ cũng gấp được: khối ngũ kim 105 mã chia
                                13 nhóm phụ, gấp hết lại là 13 dòng nhìn hết —
                                đó mới là thứ làm trang ngắn lại thật sự.
                              */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => doiKhoi(`${sec.name}/${sub.name}`)}
                                aria-expanded={!dong.has(`${sec.name}/${sub.name}`)}
                                className="text-muted-foreground h-auto w-full justify-start gap-1.5 rounded-none py-1.5 pl-2 text-[11.5px] font-semibold tracking-wide uppercase hover:bg-transparent hover:text-[var(--primary)]"
                              >
                                {dong.has(`${sec.name}/${sub.name}`) ? (
                                  <ChevronRight className="size-3.5" />
                                ) : (
                                  <ChevronDown className="size-3.5" />
                                )}
                                {sub.name}
                                <span className="t-data font-normal normal-case">
                                  {sub.rows.length} mã
                                </span>
                                {sub.rows.filter((x) => x.suggest > 0).length > 0 && (
                                  <span className="t-data font-normal text-[var(--stop)] normal-case">
                                    {sub.rows.filter((x) => x.suggest > 0).length} thiếu
                                  </span>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )}
                        {(sub.name === null || !dong.has(`${sec.name}/${sub.name}`)) &&
                          sub.rows.map((r) => (
                            <Row
                              key={r.material_id}
                              r={r}
                              hh={hh}
                              spCols={spCols}
                              lsxId={lsx.id}
                              open={openRow === r.material_id}
                              onToggle={() =>
                                setOpenRow(
                                  openRow === r.material_id ? null : r.material_id,
                                )
                              }
                              canEdit={canEdit}
                              editable={!data.manual_error}
                              busy={busy}
                              onSaveQty={(v) =>
                                saveRows(
                                  [
                                    {
                                      material_id: r.material_id,
                                      qty_needed: v,
                                      note: r.note,
                                    },
                                  ],
                                  `${r.material_code}: cần ${fmt(v)} ${r.unit}`,
                                )
                              }
                              onSaveNote={(v) =>
                                saveRows(
                                  [
                                    {
                                      material_id: r.material_id,
                                      qty_needed: r.qty_needed,
                                      note: v || null,
                                    },
                                  ],
                                  v
                                    ? `${r.material_code}: đã ghi chú`
                                    : `${r.material_code}: đã xoá ghi chú`,
                                )
                              }
                              onOverride={() => override(r)}
                              onRemove={() => removeManual(r)}
                            />
                          ))}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-[12px]">
        <b>Còn phải đặt</b> = Cần − đã xuất cho lệnh − tồn khả dụng − đã đặt (đơn đã
        duyệt, chưa về). Đơn nháp và chờ ký không trừ vào số này. Chỉ định mức đã được Kỹ
        thuật xác nhận mới thành số Cần; dòng nhập tay ghi đè định mức của đúng mã đó.
      </p>

      {canEdit && (
        <>
          <MaterialPickDialog
            open={pickOpen}
            onClose={() => setPickOpen(false)}
            template="accessory"
            usedIds={usedIds}
            onAdd={onPicked}
            needs={suggestById}
          />
          <PasteLinesDialog
            open={pasteOpen}
            template="accessory"
            allowFree={false}
            confirmLabel={(n) => `Đưa ${n} dòng vào bảng kê`}
            onClose={() => setPasteOpen(false)}
            onConfirm={onPasted}
          />
        </>
      )}
    </div>
  )
}

/** Một dòng vật tư — tách riêng cho gọn và để ô sửa giữ được state của nó. */
function Row({
  r,
  hh,
  spCols,
  lsxId,
  open,
  onToggle,
  canEdit,
  editable,
  busy,
  onSaveQty,
  onSaveNote,
  onOverride,
  onRemove,
}: {
  r: BangKeRow
  /** Phần trăm hao hụt đang đặt cho cả bảng. */
  hh: number
  /** Sản phẩm được bày thành cột; rỗng = lệnh nhiều SP quá, không bày ma trận. */
  spCols: { id: string; code: string; qty: number }[]
  lsxId: string
  open: boolean
  onToggle: () => void
  canEdit: boolean
  editable: boolean
  busy: boolean
  onSaveQty: (v: number) => void
  onSaveNote: (v: string) => void
  onOverride: () => void
  onRemove: () => void
}) {
  const isManual = r.source === 'manual'
  const onHandTotal = r.available + r.received
  const viTri = viTriLapRap(r)
  return (
    <TableRow>
      <TableCell className="bg-card sticky left-0 z-10 p-0">
        <span
          className="block h-full min-h-[44px] w-1"
          style={{ background: STATUS_STRIPE[r.status] }}
          aria-hidden
        />
      </TableCell>

      <TableCell className={cn(GHIM, 'left-1 align-top')}>
        <div className="flex flex-wrap items-center gap-1.5">
          <DocChip>{r.material_code || '—'}</DocChip>
          <span className="line-clamp-1 font-medium">{r.material_name}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
          <span>{r.unit}</span>
          {/* Quy cách: người đi hỏi giá cần độ dày / chiều dài cây, không chỉ tên. */}
          {r.spec && (
            <>
              <span>·</span>
              <span className="truncate">{r.spec}</span>
            </>
          )}
          {/*
            VỊ TRÍ LẮP RÁP đi cùng dòng phụ, KHÔNG đứng riêng một cột.
            Nguồn của nó là tên chi tiết trong định mức, không phải một trường
            vị trí thật: khung/gỗ thì tên chi tiết tình cờ mô tả vị trí, còn
            ngũ kim thì Kỹ thuật đặt tên chi tiết bằng chính tên vật tư. Đo 20
            lệnh: chỉ 23/294 dòng (8%) có vị trí thật — một cột trống 92% thời
            gian là chép khuôn tờ giấy chứ không theo thực tế.
          */}
          {viTri.length > 0 && (
            <>
              <span>·</span>
              <span className="truncate" title={viTri.join(' · ')}>
                lắp {viTri.slice(0, 2).join(', ')}
                {viTri.length > 2 ? '+' + (viTri.length - 2) : ''}
              </span>
            </>
          )}
          <span>·</span>
          <span
            className={
              r.source === 'bom_draft' || r.deviates ? 'text-[var(--warn)]' : undefined
            }
          >
            {SOURCE_LABEL[r.source]}
          </span>
          {r.deviates && r.auto_needed != null && (
            <span className="text-[var(--warn)]">lệch định mức {fmt(r.auto_needed)}</span>
          )}
          {r.incomplete && <span className="text-[var(--warn)]">thiếu hệ số</span>}
          {r.from_products.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onToggle}
              aria-expanded={open}
              className="h-auto p-0 text-[11px] underline decoration-dotted"
            >
              {open ? 'Ẩn' : `dùng cho ${r.from_products.length} SP`}
            </Button>
          )}
        </div>
        {canEdit && isManual && editable ? (
          <NoteCell value={r.note ?? ''} disabled={busy} onSave={onSaveNote} />
        ) : (
          r.note && (
            <div className="text-muted-foreground mt-0.5 text-[11px] italic">
              {r.note}
            </div>
          )
        )}
        {isManual && r.edited_by && (
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            {r.edited_by} sửa {dmy(r.edited_at)}
          </div>
        )}
        {open && r.from_products.length > 0 && (
          <ul className="bg-muted/40 mt-2 flex flex-col gap-1 rounded-md p-2">
            {r.from_products.map((p) => (
              <li
                key={p.code}
                className="flex flex-wrap items-baseline gap-x-2 text-[11.5px]"
              >
                <DocChip>{p.code}</DocChip>
                <span className="text-muted-foreground max-w-[220px] truncate">
                  {p.name}
                </span>
                <span className="t-data">
                  {fmt(p.per)} × {fmt(p.qty)} SP = {fmt(p.per * p.qty)} {r.unit}
                </span>
                {p.explain && (
                  <span className="text-muted-foreground">({p.explain})</span>
                )}
                {!p.confirmed && (
                  <span className="text-[var(--warn)]">BOM chưa xác nhận</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </TableCell>

      {/*
        MA TRẬN SẢN PHẨM: mỗi SP một cột, số là phần của mã này chia cho SP đó
        (định mức/SP × SL SP). Cộng ngang các cột ra đúng cột "Cần" — người đọc
        tự kiểm được, không phải tin.
      */}
      {spCols.map((p) => {
        const fp = r.from_products.find((x) => x.code === p.code)
        return (
          <TableCell key={p.id} className="text-right">
            {fp ? (
              <>
                <div className="t-data">{fmt(fp.per * fp.qty)}</div>
                <div className="text-muted-foreground mt-0.5 text-[10.5px]">
                  {fmt(fp.per)}/SP
                </div>
              </>
            ) : (
              <span className="text-muted-foreground text-[11px]">—</span>
            )}
          </TableCell>
        )
      })}

      <TableCell className="text-right">
        {canEdit && isManual && editable ? (
          <QtyCell value={r.qty_needed} disabled={busy} onSave={onSaveQty} />
        ) : (
          <div className="t-data">{fmt(r.qty_needed)}</div>
        )}
        {r.draft_needed > 0 && (
          <div className="mt-0.5 text-[11px] text-[var(--warn)]">
            {r.qty_needed > 0 ? '+' : ''}
            {fmt(r.draft_needed)} chờ xác nhận
          </div>
        )}
        {r.qty_issued > 0 && (
          <div className="text-muted-foreground mt-0.5 text-[11px]">
            đã xuất {fmt(r.qty_issued)}
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="t-data cursor-help">{fmt(onHandTotal)}</span>
          </TooltipTrigger>
          <TooltipContent>
            Tồn khả dụng {fmt(r.available)}
            {r.reserved_others > 0 &&
              ` (tồn ${fmt(r.on_hand)}, lệnh khác giữ ${fmt(r.reserved_others)})`}
            {' · '}đã về cho lệnh {fmt(r.received)}
          </TooltipContent>
        </Tooltip>
      </TableCell>

      <TableCell className="text-right">
        <div className="t-data">{fmt(r.ordered)}</div>
        {r.draft + r.pending > 0 && (
          <div className="mt-0.5 text-[11px] text-[var(--warn)]">
            {fmt(r.draft + r.pending)} chưa duyệt
          </div>
        )}
      </TableCell>

      <TableCell className="text-right">
        <span
          className={cn(
            't-data text-[15px] font-semibold',
            r.suggest > 0 ? 'text-[var(--stop)]' : 'text-muted-foreground',
          )}
        >
          {fmt(r.suggest)}
        </span>
      </TableCell>

      {/*
        SL ĐẶT = còn phải đặt + hao hụt, làm tròn LÊN (xem lib/po-waste). Đây là
        con số đi vào đơn gửi NCC, nên nó phải đứng ngay cạnh "còn phải đặt" để
        người mua so được hai số và thấy phần dư là bao nhiêu.
      */}
      <TableCell className="text-right">
        {r.suggest > 0 ? (
          <span className="t-data font-semibold">
            {fmt(slDatHang(r.suggest, hh, r.unit))}
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">—</span>
        )}
      </TableCell>

      {/*
        GIÁ GẦN NHẤT lấy từ dòng đơn thật (xem BangKeRow.last_price). Bày kèm
        tiền tạm tính cho phần còn phải đặt — đó là con số người mua cần để xin
        duyệt, trước đây phải mở tab khác tra rồi bấm máy tính.
      */}
      <TableCell className="text-right">
        {r.last_price ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <div className="t-data">
                  {r.last_price.unit_price.toLocaleString('vi-VN')}
                  <span className="text-muted-foreground ml-1 text-[11px]">
                    {r.last_price.currency}
                  </span>
                </div>
                {r.suggest > 0 && (
                  <div className="text-muted-foreground mt-0.5 text-[11px]">
                    ≈ {(r.suggest * r.last_price.unit_price).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Mua gần nhất của {r.last_price.supplier_name} · đơn {r.last_price.po_code} ·{' '}
              {dmy(r.last_price.at.slice(0, 10))}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-[11px] italic">
            chưa mua bao giờ
          </span>
        )}
      </TableCell>

      <TableCell>
        <Badge tone={STATUS_BADGE[r.status]}>{BANG_KE_STATUS[r.status].label}</Badge>
      </TableCell>

      <TableCell>
        {r.pos.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {r.pos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                <Link href={`/planning/pos/${p.id}`} className="hover:opacity-80">
                  <DocChip>{p.code}</DocChip>
                </Link>
                <span className="max-w-[140px] truncate">{p.supplier_name}</span>
                <span className="text-muted-foreground">
                  {isPoStatus(p.status) ? PO_STATUS_LABEL[p.status] : p.status}
                  {p.expected_at && (
                    <>
                      {' · '}
                      <span className={cn('t-data', p.late && 'text-[var(--stop)]')}>
                        {dmy(p.expected_at)}
                      </span>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TableCell>

      {canEdit && (
        <TableCell>
          <div className="flex flex-col items-end gap-1">
            {r.suggest > 0 && r.material_code && (
              <Button variant="link" size="sm" asChild className="h-auto p-0">
                <Link
                  href={`/planning/pos/new?lsx=${lsxId}&material=${encodeURIComponent(r.material_code)}&qty=${r.suggest}`}
                >
                  <ShoppingCart />
                  Soạn đơn
                </Link>
              </Button>
            )}
            {editable &&
              (isManual ? (
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  disabled={busy}
                  onClick={onRemove}
                >
                  <Undo2 />
                  {r.auto_needed != null ? 'Về định mức' : 'Bỏ dòng'}
                </Button>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto p-0"
                  disabled={busy}
                  onClick={onOverride}
                  title="Chuyển thành dòng nhập tay để sửa số Cần"
                >
                  <Pencil />
                  {r.source === 'none' || r.status === 'unconfirmed'
                    ? 'Nhập số cần'
                    : 'Ghi đè'}
                </Button>
              ))}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

/**
 * XEM THEO NHÀ CUNG CẤP — mỗi khối là một tờ đơn sắp soạn.
 *
 * Cột ở đây ít hơn hẳn bảng chính: đang cắt đơn thì chỉ cần mã, số phải đặt,
 * giá lần trước và thành tiền. Tồn / đã đặt / vị trí lắp ráp là chuyện của lúc
 * rà, bày lại ở đây chỉ làm loãng.
 */
function NccView({
  blocks,
  canEdit,
  dangLoc,
  hh,
}: {
  blocks: NccBlockUi[]
  canEdit: boolean
  /** Hao hụt đang đặt — cột "SL đặt" ở đây phải khớp với bảng chính. */
  hh: number
  /** Có bộ lọc nào đang bật không — quyết định câu giải thích khi rỗng. */
  dangLoc: boolean
}) {
  if (blocks.length === 0) {
    return (
      <section className="bg-card rounded-lg border px-6 py-10 text-center">
        <p className="t-title">
          {dangLoc
            ? 'Bộ lọc đang bật không còn mã nào phải đặt'
            : 'Không còn mã nào phải đặt'}
        </p>
        {/*
          Nói ĐÚNG lý do rỗng. Khi có bộ lọc mà vẫn báo "tồn kho đã phủ hết" thì
          người dùng tin là lệnh xong, trong khi thật ra họ đang nhìn qua một
          khe hẹp do chính mình bật.
        */}
        <p className="text-muted-foreground mt-1 text-[13px]">
          {dangLoc
            ? 'Bỏ bớt bộ lọc ở trên để xem các mã còn lại.'
            : 'Tồn kho và các đơn đã duyệt đã phủ hết nhu cầu của lệnh.'}
        </p>
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b) => (
        <section
          key={b.supplier_id ?? b.supplier_name}
          className="bg-card overflow-hidden rounded-lg border"
        >
          <header className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2 className="t-title truncate">{b.supplier_name}</h2>
              <span className="t-data text-muted-foreground text-[12px] font-normal">
                {b.rows.length} mã
              </span>
              {[...b.tien].map(([cur, v]) => (
                <span key={cur} className="t-data text-[12px]">
                  ≈ {v.toLocaleString('vi-VN')} {cur}
                </span>
              ))}
            </div>
            {canEdit && b.href && (
              <Button size="sm" asChild>
                <Link href={b.href}>
                  <ShoppingCart />
                  {b.supplier_id
                    ? `Soạn đơn ${b.rows.length} mã`
                    : 'Soạn đơn (chọn NCC sau)'}
                </Link>
              </Button>
            )}
          </header>
          {!b.supplier_id && (
            <p className="text-muted-foreground border-b px-4 py-2 text-[12px]">
              Những mã này chưa mua lần nào nên chưa biết gọi ai — phải đi hỏi giá trước.
              Số tạm tính ở các khối trên không gồm chúng.
            </p>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Vật tư</TableHead>
                  <TableHead>ĐVT</TableHead>
                  <TableHead className="text-right">Còn thiếu</TableHead>
                  <TableHead className="text-right">
                    SL đặt
                    <span className="t-data text-muted-foreground ml-1 text-[10.5px] font-normal">
                      +{hh}%
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Giá lần trước</TableHead>
                  <TableHead className="text-right">Tạm tính</TableHead>
                  <TableHead className="min-w-[130px]">Mua lần cuối</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.rows.map((r) => (
                  <TableRow key={r.material_id}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <DocChip>{r.material_code || '—'}</DocChip>
                        <span className="line-clamp-1 font-medium">
                          {r.material_name}
                        </span>
                      </div>
                      {r.spec && (
                        <div className="text-muted-foreground mt-0.5 text-[11px]">
                          {r.spec}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-[12px]">{r.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className="t-data text-muted-foreground">
                        {fmt(r.suggest)}
                      </span>
                    </TableCell>
                    {/*
                      SỐ ĐẶT nổi bật hơn số còn thiếu ở màn này: đang cắt đơn
                      thì con số đi vào tờ đơn mới là con số phải đọc.
                    */}
                    <TableCell className="text-right">
                      <span className="t-data text-[15px] font-semibold text-[var(--stop)]">
                        {fmt(slDatHang(r.suggest, hh, r.unit))}
                      </span>
                    </TableCell>
                    <TableCell className="t-data text-right">
                      {r.last_price
                        ? `${r.last_price.unit_price.toLocaleString('vi-VN')} ${r.last_price.currency}`
                        : '—'}
                    </TableCell>
                    <TableCell className="t-data text-right">
                      {r.last_price
                        ? (
                            slDatHang(r.suggest, hh, r.unit) * r.last_price.unit_price
                          ).toLocaleString('vi-VN')
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[12px]">
                      {r.last_price ? (
                        <>
                          <span className="t-data">
                            {dmy(r.last_price.at.slice(0, 10))}
                          </span>{' '}
                          · {r.last_price.po_code}
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  )
}

function Notice({ tone, children }: { tone: 'warn'; children: React.ReactNode }) {
  return (
    <p
      className="rounded-md border px-3 py-2 text-[12.5px]"
      style={{
        borderColor: `var(--${tone})`,
        background: `color-mix(in srgb, var(--${tone}) 10%, transparent)`,
      }}
    >
      {children}
    </p>
  )
}

/** Ô số Cần của dòng tay: sửa tại chỗ, lưu khi rời ô hoặc Enter, chỉ khi đổi. */
function QtyCell({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled: boolean
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState<number | ''>(value)
  // Ref giữ giá trị MỚI NHẤT: blur có thể tới trước khi React kịp render lại
  // state sau lần gõ cuối — đọc state lúc đó là đọc số cũ và bỏ qua lần lưu.
  const latest = useRef<number | ''>(value)
  const change = (v: number | '') => {
    latest.current = v
    setDraft(v)
  }
  const commit = () => {
    const v = latest.current
    if (v === '' || v === value) {
      change(value)
      return
    }
    onSave(v)
  }
  return (
    <NumberField
      value={draft}
      onValueChange={change}
      disabled={disabled}
      className="t-data ml-auto h-7 w-24 text-right"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') change(value)
      }}
      aria-label="Số cần"
    />
  )
}

/** Ghi chú của dòng tay ("phải lấy tròn bó"): sửa tại chỗ, lưu khi rời ô hoặc Enter. */
function NoteCell({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (v: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const latest = useRef(value)
  const change = (v: string) => {
    latest.current = v
    setDraft(v)
  }
  const commit = () => {
    const v = latest.current.trim()
    if (v === value) return
    onSave(v)
  }
  return (
    <Input
      value={draft}
      onChange={(e) => change(e.target.value)}
      disabled={disabled}
      placeholder="ghi chú…"
      className="mt-1 h-7 max-w-[260px] text-[11px]"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') change(value)
      }}
      aria-label="Ghi chú dòng"
    />
  )
}

/**
 * Tiền rút gọn cho nhãn thẻ số: "12,3 tr" thay vì "12.345.678". Thẻ chỉ có một
 * dòng gợi ý, số đầy đủ đã nằm ở cột "Giá gần nhất" của từng dòng.
 */
function moneyShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} tỷ`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} tr`
  return n.toLocaleString('vi-VN')
}
