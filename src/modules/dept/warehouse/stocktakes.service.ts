import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { canEnterWorkspace } from '@/workspaces/access'
import { kiemCuoiTheoNhom, lyDoKhongTuDuyet } from '@/lib/kho-kiem-ke'
import { dungNxt, kyThang } from '@/lib/kho-nxt'
import { todayVn } from '@/lib/date-vn'
import { nxtRepo } from './nxt.repo'
import { tomTatLenh } from '@/lib/kho-ton-lenh'
import { hangLenhService } from './hang-lenh.service'
import { docsRepo, insertMovements, warehousesRepo } from './stock.repo'
import { stockService } from './stock.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { LSX_XUAT_DUOC } from '@/lib/kho-phieu-xuat'
import {
  catBu,
  ghiChuDong,
  nhanLyDoCapNhat,
  type MaLyDoCapNhat,
} from '@/lib/kho-cap-nhat-ton'

/** Phần tổ đã lấy cho một lệnh — lưu ở `scope_ref.xuat_bu[material_id]` (K6). */
type PhanXuatBu = { lsx_id: string; qty: number }
import {
  bookQtyAt,
  danhSachDemNhom,
  dotNhomDaDuyet,
  materialsInScope,
  nguoiKho,
  stocktakesRepo,
  type Stocktake,
  type StocktakeScope,
  type TakeLine,
} from './stocktakes.repo'

/**
 * ĐỢT KIỂM KÊ (0199/0200) — Đợt 3 §2.2 của `docs/thiet-ke-kho.md`.
 *
 * Vòng đời: Mở → Đang đếm → Đối chiếu → Đã duyệt (hoặc Huỷ).
 *
 * Ba thứ làm nên giá trị của nó, và cả ba đều dễ làm sai theo cách không ai
 * phát hiện:
 *
 *   ① PHẠM VI chốt lúc mở, lưu vào chứng từ. Không có đường "cả danh mục".
 *   ② SỔ ĐÓNG BĂNG tại `freeze_at`, và chênh tính so với số đóng băng đó.
 *   ③ ĐẾM MÙ: số sổ không rời server khi đợt đang đếm.
 */

/**
 * Ai vào được khu Kho thì xem được đợt. Trước 19/10/2026 hàm đọc gọi
 * `assertAction(user, 'warehouse.stock.read')` — mã quyền KHÔNG có trong
 * `actions.ts`, nên mọi tài khoản không phải admin ăn lỗi 500 "Unknown action".
 * Không ai thấy vì chưa có màn nào gọi tới.
 */
async function assertRead(user: User): Promise<void> {
  if (!(await canEnterWorkspace(user, 'warehouse'))) {
    throw Forbidden('Kiểm kê thuộc khu Kho. Nhờ quản trị cấp quyền xem khu Kho.')
  }
}

/** Ai cũng xem được nếu xem được kho; sửa thì cần quyền ghi. */
async function assertWrite(user: User): Promise<void> {
  await assertAction(user, 'warehouse.stock.write')
}

function scopeOf(t: Stocktake): StocktakeScope {
  const ref = t.scope_ref as Record<string, unknown>
  if (t.scope_kind === 'group') {
    return { kind: 'group', groups: (ref.groups as string[]) ?? [] }
  }
  if (t.scope_kind === 'list') {
    return { kind: 'list', material_ids: (ref.material_ids as string[]) ?? [] }
  }
  return { kind: 'bin', bin_ids: (ref.bin_ids as string[]) ?? [] }
}

/**
 * ĐẾM MÙ ĐƯỢC THỰC THI Ở SERVER, không ở CSS.
 *
 * Giấu cột bằng giao diện là giấu với người nhìn màn hình, không giấu với
 * người mở tab mạng của trình duyệt — và người đếm muốn xem số sổ thì đó đúng
 * là người sẽ mở. Số chỉ được gửi đi khi đợt đã qua bước đếm, hoặc khi đợt
 * khai rõ là đếm mở.
 */
function maskBook(t: Stocktake, lines: TakeLine[]): TakeLine[] {
  const hide = t.blind_count && (t.status === 'open' || t.status === 'counting')
  if (!hide) return lines
  return lines.map((l) => ({ ...l, book_qty_frozen: null }))
}

/**
 * TRƯỞNG KHO = người đứng đầu phòng thuộc khu Kho (`departments.head_user_id`),
 * hoặc quản trị. Q2 bản vẽ "Kho cho người mới" (27/10/2026): trưởng kho ghi
 * "Cập nhật số thực tế" là đổi tồn ngay; người khác có vai Kho chỉ gửi, trưởng
 * kho duyệt. Đọc cả danh sách phòng chứ không `findHeadedBy` — một người đứng
 * đầu hai phòng thì `maybeSingle` trả null im lặng.
 */
export async function laTruongKho(user: User): Promise<boolean> {
  if (user.role === 'admin') return true
  const ds = await departmentsRepo.list()
  return ds.some((d) => d.workspace_id === 'warehouse' && d.head_user_id === user.id)
}

/** Đợt sinh từ màn Cập nhật số thực tế (khác đợt kiểm kê định kỳ). */
function laNhanh(t: Stocktake): boolean {
  return t.scope_kind === 'list' && t.scope_ref.nhanh === true
}

export type KetQuaApDung = {
  doc_id: string
  doc_code: string
  /** Số dòng thừa/thiếu ghi vào phiếu KK (N4/X5). */
  applied: number
  /** Phiếu xuất bù cho lệnh (dòng "tổ đã lấy"), mỗi lệnh một phiếu. */
  xuat_bu: { id: string; code: string; lsx_code: string }[]
}

/**
 * ÁP CHÊNH của một đợt vào sổ — dùng chung cho Duyệt (kiểm kê định kỳ) và
 * Cập nhật số thực tế. Chênh là DELTA so với sổ chốt (xem `approve`).
 *
 * Dòng giảm hàng mà `scope_ref.xuat_bu` ghi "tổ đã lấy" đi thành PHIẾU XUẤT X1
 * cho lệnh (vào giá thành), làm TRƯỚC: guard tồn / trạng thái lệnh của phiếu
 * xuất có thể chặn, và chặn thì chưa có phiếu KK nào được ghi. Lấn phần giữ
 * cho lệnh khác được xác nhận sẵn kèm lý do — hàng đã rời kệ, đây là ghi bù
 * chuyện đã xảy ra, không phải xin lấy hàng.
 */
async function apDung(
  user: User,
  take: Stocktake,
  lines: TakeLine[],
): Promise<KetQuaApDung> {
  const xuatBu = (take.scope_ref.xuat_bu ?? {}) as Record<string, string | PhanXuatBu[]>
  const adjusts = lines
    .map((l) => ({ l, delta: (l.counted_qty ?? 0) - (l.book_qty_frozen ?? 0) }))
    .filter((x) => Math.abs(x.delta) > 1e-9)

  /*
    Dòng giảm có "tổ đã lấy": chia thành phần xuất bù TỪNG lệnh (K6) + phần còn lại
    ghi thiếu X5. Đợt ghi trước 28/10 lưu MỘT lsx_id (chuỗi) = cả phần hụt.
  */
  const theoLenh = new Map<string, { l: TakeLine; qty: number }[]>()
  const kk: typeof adjusts = []
  for (const x of adjusts) {
    const raw = x.delta < 0 ? xuatBu[x.l.material_id] : undefined
    if (!raw) {
      kk.push(x)
      continue
    }
    const phan = catBu(
      typeof raw === 'string' ? [{ lsx_id: raw, qty: Infinity }] : raw,
      -x.delta,
    )
    for (const p of phan)
      theoLenh.set(p.lsx_id, [...(theoLenh.get(p.lsx_id) ?? []), { l: x.l, qty: p.qty }])
    const con = -x.delta - phan.reduce((a, p) => a + p.qty, 0)
    if (con > 1e-9) kk.push({ l: x.l, delta: -con })
  }
  const phieuBu: KetQuaApDung['xuat_bu'] = []
  for (const [lsxId, ds] of theoLenh) {
    const lsx = await productionRepo.findById(lsxId)
    const p = await stockService.createIssueDoc(user, {
      kind: 'lsx',
      production_order_id: lsxId,
      counterparty: `Ghi bù · ${take.code}`,
      note: `Cập nhật số thực tế ${take.code}: tổ đã lấy, chưa ghi sổ`,
      override_reserved: true,
      override_reason: `ghi bù khi cập nhật số thực tế ${take.code}`,
      lines: ds.map(({ l, qty }) => ({
        material_id: l.material_id,
        qty,
        note: `${take.code}: trên máy ${l.book_qty_frozen ?? 0}, thực tế ${l.counted_qty}`,
      })),
    })
    phieuBu.push({ ...p, lsx_code: lsx?.code ?? lsxId })
  }

  const [code, warehouseId] = await Promise.all([
    docsRepo.nextCode('KK'),
    warehousesRepo.mainId(),
  ])
  const doc = await docsRepo.insert({
    code,
    kind: 'stocktake',
    reason: laNhanh(take)
      ? `Cập nhật số thực tế ${take.code}`
      : `Duyệt đợt kiểm kê ${take.code}`,
    note: take.note,
    created_by: user.id,
  })
  if (kk.length > 0) {
    await insertMovements(
      kk.map(({ l, delta }) => ({
        material_id: l.material_id,
        direction: delta > 0 ? ('in' as const) : ('out' as const),
        qty: Math.abs(delta),
        ref_type: 'adjust',
        // N4 thừa / X5 thiếu — hai mã duy nhất của kiểm kê (0197).
        reason_code: delta > 0 ? 'N4' : 'X5',
        note: [
          `Đợt ${take.code}: đếm ${l.counted_qty}, sổ chốt ${l.book_qty_frozen ?? 0}`,
          laNhanh(take) ? l.note : null,
        ]
          .filter(Boolean)
          .join(' · '),
        created_by: user.id,
        doc_id: doc.id,
        warehouse_id: warehouseId,
      })),
    )
  }

  await stocktakesRepo.attachDoc(take.id, doc.id)
  await stocktakesRepo.patch(take.id, {
    status: 'approved',
    doc_id: doc.id,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  })
  return { doc_id: doc.id, doc_code: doc.code, applied: kk.length, xuat_bu: phieuBu }
}

export type NhomMoDot = {
  group_name: string
  co_ton: number
  se_dem: number
  /** Mốc duyệt đợt theo nhóm gần nhất; null = chưa bao giờ kiểm. */
  kiem_cuoi: string | null
}

export type ChuanBiMoDot = {
  nhom: NhomMoDot[]
  nguoi: { id: string; name: string }[]
  /** Q3: hàng của lệnh đã về mà chưa ghi xuất — cảnh báo đầu hộp mở đợt. */
  lenhChuaXuat: { so_lenh: number; so_ma: number }
}

export const stocktakesService = {
  /**
   * DỮ LIỆU HỘP MỞ ĐỢT (B7a). Số "Sẽ đếm" lấy từ CHÍNH hàm sinh dòng đếm
   * (`danhSachDemNhom`), cảnh báo lệnh từ cùng hàm màn Tồn kho › Theo lệnh.
   */
  async chuanBiMoDot(user: User): Promise<ChuanBiMoDot> {
    await assertRead(user)
    const [ds, nguoi, dot, lenh] = await Promise.all([
      danhSachDemNhom(),
      nguoiKho(),
      dotNhomDaDuyet(),
      hangLenhService.tatCa(user),
    ])
    const cuoi = kiemCuoiTheoNhom(dot)
    const con = tomTatLenh(lenh.rows, lenh.lenh).filter((x) => x.con_kho > 0)
    return {
      nhom: ds.map((n) => ({
        group_name: n.group_name,
        co_ton: n.co_ton,
        se_dem: n.ids.length,
        kiem_cuoi: cuoi.get(n.group_name) ?? null,
      })),
      nguoi,
      lenhChuaXuat: {
        so_lenh: con.length,
        so_ma: con.reduce((s, x) => s + x.con_kho, 0),
      },
    }
  },

  async list(
    user: User,
    opts: { status?: Stocktake['status']; page: number; page_size: number },
  ) {
    await assertRead(user)
    return stocktakesRepo.list(opts)
  },

  async detail(user: User, id: string) {
    await assertRead(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    const lines = await stocktakesRepo.listLines(id)
    const counted = lines.filter((l) => l.counted_qty != null).length
    return {
      take,
      lines: maskBook(take, lines),
      progress: {
        total: lines.length,
        counted,
        remaining: lines.length - counted,
        /*
         * Số dòng LỆCH chỉ có nghĩa sau khi chốt sổ, và chỉ được bày khi
         * không còn đếm mù — nếu không thì nó là một kênh rò rỉ số sổ: người
         * đếm gõ thử một số, thấy "0 dòng lệch", là biết sổ ghi bao nhiêu.
         */
        diff_count:
          take.blind_count && (take.status === 'open' || take.status === 'counting')
            ? null
            : lines.filter(
                (l) =>
                  l.counted_qty != null &&
                  Math.abs(l.counted_qty - (l.book_qty_frozen ?? 0)) > 1e-9,
              ).length,
      },
    }
  },

  /**
   * MỞ ĐỢT — chốt phạm vi, chưa chốt sổ.
   *
   * Tách "mở" khỏi "chốt sổ" có chủ ý: quản lý kho lập đợt chiều hôm trước,
   * người đếm bắt đầu sáng hôm sau. Chốt sổ lúc lập là đóng băng một con số
   * cách lúc đếm 14 tiếng, rồi mọi phiếu trong đêm thành chênh lệch giả.
   */
  async open(
    user: User,
    input: {
      scope: StocktakeScope
      blind_count?: boolean
      assigned_to?: string | null
      note?: string | null
    },
  ): Promise<{ id: string; code: string; scope_count: number }> {
    await assertWrite(user)

    const ids = await materialsInScope(input.scope)
    if (ids.length === 0) {
      throw BadRequest(
        'Phạm vi này không có mã nào — chọn khu khác, nhóm khác, hoặc thêm mã vào danh sách',
      )
    }

    const code = await docsRepo.nextCode('KK')
    const { id } = await stocktakesRepo.insert({
      code,
      scope_kind: input.scope.kind,
      scope_ref:
        input.scope.kind === 'bin'
          ? { bin_ids: input.scope.bin_ids }
          : input.scope.kind === 'group'
            ? { groups: input.scope.groups }
            : { material_ids: input.scope.material_ids },
      scope_count: ids.length,
      blind_count: input.blind_count ?? true,
      assigned_to: input.assigned_to ?? null,
      note: input.note ?? null,
      created_by: user.id,
    })
    return { id, code, scope_count: ids.length }
  },

  /**
   * CHỐT SỔ và bắt đầu đếm. Đây là bước sinh dòng đếm.
   *
   * `freeze_at` lấy giờ server, KHÔNG nhận từ client: một mốc chốt sổ do
   * trình duyệt gửi lên là một mốc người dùng sửa được, và toàn bộ chênh lệch
   * của đợt treo trên nó.
   */
  async startCounting(user: User, id: string): Promise<{ lines: number }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'open') {
      throw Conflict(
        `Đợt đang ở trạng thái "${take.status}" — chỉ đợt mới mở mới chốt sổ được`,
      )
    }

    const ids = await materialsInScope(scopeOf(take))
    if (ids.length === 0) throw BadRequest('Phạm vi rỗng — không có gì để đếm')

    const freezeAt = new Date().toISOString()
    const book = await bookQtyAt(freezeAt, ids)

    await stocktakesRepo.insertLines(
      ids.map((materialId) => {
        const qty = book.get(materialId) ?? 0
        return {
          stocktake_id: id,
          material_id: materialId,
          // `system_qty` (cột 0077) giữ nguyên nghĩa cũ để biên bản in ra
          // không đổi cách đọc; với đợt thì hai cột bằng nhau lúc chốt.
          system_qty: qty,
          book_qty_frozen: qty,
        }
      }),
    )
    await stocktakesRepo.patch(id, { status: 'counting', freeze_at: freezeAt })
    return { lines: ids.length }
  },

  /**
   * GHI SỐ ĐẾM. Nhận nhiều dòng một lượt (lưới đếm lưu dở được).
   *
   * `diff` TÍNH LẠI Ở SERVER so với `book_qty_frozen`, không nhận từ client —
   * và đây là chỗ đếm mù có ý nghĩa thật: client không biết số sổ thì cũng
   * không tính nổi chênh lệch, nên chênh chỉ có một nguồn.
   */
  async saveCounts(
    user: User,
    id: string,
    counts: { line_id: string; counted_qty: number; note?: string | null }[],
  ): Promise<{ saved: number }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'counting') {
      throw Conflict(
        take.status === 'open'
          ? 'Đợt chưa chốt sổ — bấm "Bắt đầu đếm" trước'
          : `Đợt đang ở "${take.status}" — không ghi thêm số đếm được`,
      )
    }

    const byId = new Map((await stocktakesRepo.listLines(id)).map((l) => [l.id, l]))
    let saved = 0
    for (const c of counts) {
      const line = byId.get(c.line_id)
      if (!line) continue // dòng không thuộc đợt này — bỏ qua, không ném
      if (c.counted_qty < 0) throw BadRequest('Số đếm không âm được')
      await stocktakesRepo.patchLine(c.line_id, {
        counted_qty: c.counted_qty,
        diff: c.counted_qty - (line.book_qty_frozen ?? 0),
        counted_by: user.id,
        note: c.note ?? line.note,
      })
      saved += 1
    }
    return { saved }
  },

  /**
   * ĐỐI CHIẾU (B7c) — chênh số lượng + chênh TIỀN của từng dòng, chỉ khi đợt đã
   * qua bước đếm (đang đếm mù thì không có gì để đối chiếu, và trả số sổ ra là
   * phá đếm mù).
   *
   * Q4: đơn giá = bình quân gia quyền của kỳ chứa ngày chốt sổ (đầu tháng → ngày
   * chốt), cùng hàm `dungNxt` của Báo cáo Nhập–Xuất–Tồn — hai màn ra cùng số.
   * Mã chưa lần nhập nào có giá thì chênh tiền `null` (không coi là 0).
   */
  async doiChieu(user: User, id: string) {
    await assertRead(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'review' && take.status !== 'approved') {
      throw Conflict('Chỉ đối chiếu được khi người đếm đã gửi đối chiếu')
    }
    const lines = await stocktakesRepo.listLines(id)
    const ngayChot = take.freeze_at ? todayVn(new Date(take.freeze_at)) : todayVn()
    const ky = kyThang(ngayChot)
    const dong = await nxtRepo.dongSoDen(ngayChot)
    const ids = new Set(lines.map((l) => l.material_id))
    const gia = new Map(
      dungNxt(
        dong.filter((d) => ids.has(d.material_id)),
        ky.tu,
        ngayChot,
      ).map((r) => [r.material_id, r.don_gia]),
    )
    return {
      tu: ky.tu,
      den: ngayChot,
      demBoi: [
        ...new Set(lines.map((l) => l.counted_by).filter((v): v is string => !!v)),
      ],
      dong: lines.map((l) => {
        const chenh =
          Math.round(((l.counted_qty ?? 0) - (l.book_qty_frozen ?? 0)) * 1000) / 1000
        const g = gia.get(l.material_id) ?? null
        return { id: l.id, chenh, don_gia: g, chenh_tien: g == null ? null : chenh * g }
      }),
    }
  },

  /**
   * THÊM TAY MỘT MÃ vào đợt đang đếm (B7b, Q1): người đếm thấy hàng ngoài kệ mà
   * danh sách không có (sổ ghi 0, lâu không có phiếu). Số sổ của dòng mới lấy
   * TẠI `freeze_at` của đợt — cùng mốc với mọi dòng khác, để chênh lệch của nó
   * không ăn phiếu phát sinh sau lúc chốt.
   */
  async themDong(
    user: User,
    id: string,
    materialId: string,
  ): Promise<{ line_id: string }> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'counting' || !take.freeze_at) {
      throw Conflict('Chỉ thêm mã khi đợt đang đếm')
    }
    const lines = await stocktakesRepo.listLines(id)
    const co = lines.find((l) => l.material_id === materialId)
    if (co) return { line_id: co.id }
    const book = await bookQtyAt(take.freeze_at, [materialId])
    const qty = book.get(materialId) ?? 0
    await stocktakesRepo.insertLines([
      {
        stocktake_id: id,
        material_id: materialId,
        system_qty: qty,
        book_qty_frozen: qty,
      },
    ])
    const moi = (await stocktakesRepo.listLines(id)).find(
      (l) => l.material_id === materialId,
    )
    if (!moi) throw new Error('Thêm dòng không thành công')
    return { line_id: moi.id }
  },

  /** Gửi ĐỐI CHIẾU — chốt việc đếm, mở số sổ ra cho người duyệt xem. */
  async submitReview(user: User, id: string): Promise<void> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'counting') {
      throw Conflict(
        `Đợt đang ở "${take.status}" — chỉ đợt đang đếm mới gửi đối chiếu được`,
      )
    }
    const lines = await stocktakesRepo.listLines(id)
    const chuaDem = lines.filter((l) => l.counted_qty == null)
    if (chuaDem.length > 0) {
      /*
       * KHÔNG cho gửi khi còn mã chưa đếm, và nói RÕ còn bao nhiêu.
       *
       * Coi "chưa đếm" như "đếm được 0" là biến một chỗ bỏ sót thành một bút
       * toán xoá sạch tồn của mã đó — đúng hạng lỗi mà kiểm kê phải chống,
       * chứ không phải tạo ra.
       */
      throw BadRequest(
        `Còn ${chuaDem.length}/${lines.length} mã chưa đếm. Đếm nốt, hoặc ghi 0 cho mã thật sự không còn hàng — bỏ trống không phải là số không.`,
      )
    }
    await stocktakesRepo.patch(id, { status: 'review' })
  },

  /**
   * DUYỆT — sinh phiếu KK và bút toán điều chỉnh.
   *
   * CHÊNH ÁP LÀ DELTA so với sổ đóng băng, KHÔNG phải "đặt tồn = số đếm".
   *
   * Khác hẳn `approveStocktake` đời cũ (0157) vốn áp theo tồn LÚC DUYỆT. Ở đó
   * đúng, vì không có mốc chốt sổ nên số đếm được hiểu là "tồn bây giờ". Ở
   * đây số đếm là tồn TẠI freeze_at — đặt tồn = số đếm sẽ xoá sạch mọi phiếu
   * nhập/xuất phát sinh sau lúc chốt, mà đó lại chính là quãng thời gian
   * người ta đang đếm.
   *
   * Ví dụ: sổ chốt 100, đếm được 95 (thiếu 5), trong lúc đếm nhập thêm 20 nên
   * tồn hiện 120. Áp delta −5 → 115, đúng. Đặt tồn = 95 → mất 20 cây vừa nhập.
   */
  async approve(user: User, id: string): Promise<KetQuaApDung> {
    await assertAction(user, 'warehouse.stocktake.approve')
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'review') {
      throw Conflict(`Đợt đang ở "${take.status}" — chỉ đợt chờ đối chiếu mới duyệt được`)
    }
    // Q2 "Kho cho người mới": cập nhật số thực tế của người khác do TRƯỞNG KHO duyệt.
    if (laNhanh(take) && !(await laTruongKho(user))) {
      throw Forbidden('Cập nhật số thực tế do trưởng kho duyệt')
    }

    const lines = await stocktakesRepo.listLines(id)
    // Q2 (B7c, 19/10/2026): người đếm không tự duyệt — luật chung với màn.
    const tuDuyet = lyDoKhongTuDuyet(
      user.id,
      take,
      lines.map((l) => l.counted_by),
    )
    if (tuDuyet) throw Forbidden(tuDuyet)
    return apDung(user, take, lines)
  },

  /**
   * CẬP NHẬT SỐ THỰC TẾ (B1 "Kho cho người mới", 27/10/2026) — một bước: tạo
   * đợt kiểm kê THEO DANH SÁCH MÃ, chốt sổ BÂY GIỜ, ghi luôn số đếm, đưa sang
   * chờ duyệt. Trưởng kho (Q2) thì áp luôn; người khác dừng ở chờ duyệt, trưởng
   * kho duyệt ở Kiểm kê như đợt thường.
   *
   * Chênh tính ở server so với sổ lúc ghi — số "Trên máy" màn đã bày chỉ để
   * người gõ thấy trước. Dòng "tổ đã lấy" (Q3) lưu phần của TỪNG lệnh (K6) vào
   * `scope_ref.xuat_bu` để lúc duyệt (có khi là người khác, hôm sau) vẫn biết ghi
   * phiếu xuất cho ai, bao nhiêu.
   */
  async capNhatNhanh(
    user: User,
    input: {
      ly_do_chung: MaLyDoCapNhat
      ghi_chu?: string | null
      lines: {
        material_id: string
        counted_qty: number
        ly_do?: MaLyDoCapNhat | null
        ghi_chu?: string | null
        /** Phần tổ đã lấy theo từng lệnh (K6). */
        xuat_bu?: { lsx_id: string; qty: number }[] | null
        /** Bản cũ: cả phần hụt cho một lệnh. */
        xuat_bu_lsx_id?: string | null
      }[]
    },
  ): Promise<
    | { trang_thai: 'cho_duyet'; id: string; code: string }
    | ({ trang_thai: 'da_ghi'; id: string; code: string } & KetQuaApDung)
  > {
    await assertWrite(user)
    const ghiChuChung = input.ghi_chu?.trim() || null
    const ids = input.lines.map((l) => l.material_id)
    if (new Set(ids).size !== ids.length) throw BadRequest('Một mã chỉ một dòng')
    for (const l of input.lines) {
      if (l.counted_qty < 0 || !Number.isFinite(l.counted_qty))
        throw BadRequest('Số thực tế không âm được')
      if ((l.ly_do ?? input.ly_do_chung) === 'khac' && !l.ghi_chu?.trim() && !ghiChuChung)
        throw BadRequest('Lý do "Khác" cần ghi chú')
    }

    const freezeAt = new Date().toISOString()
    const book = await bookQtyAt(freezeAt, ids)

    /*
      Xuất bù chỉ có nghĩa ở dòng GIẢM; lệnh phải còn xuất được (guard phiếu xuất).
      Phần của từng lệnh (K6) cắt theo phần hụt TÍNH Ở ĐÂY — sổ có thể đã đổi từ lúc
      màn bày số; phần hụt không lệnh nào nhận thành thiếu (X5) lúc áp.
    */
    const xuatBu: Record<string, PhanXuatBu[]> = {}
    const maLenh = new Map<string, string>()
    for (const l of input.lines) {
      const hut = (book.get(l.material_id) ?? 0) - l.counted_qty
      if (hut <= 1e-9) continue
      const phan = catBu(
        l.xuat_bu?.length
          ? l.xuat_bu
          : l.xuat_bu_lsx_id
            ? [{ lsx_id: l.xuat_bu_lsx_id, qty: hut }]
            : [],
        hut,
      )
      if (phan.length === 0) continue
      for (const p of phan) {
        if (maLenh.has(p.lsx_id)) continue
        const lsx = await productionRepo.findById(p.lsx_id)
        if (!lsx) throw NotFound('Lệnh xuất bù không tồn tại')
        if (!(LSX_XUAT_DUOC as readonly string[]).includes(lsx.status))
          throw BadRequest(`Lệnh ${lsx.code} không ở trạng thái xuất vật tư được`)
        maLenh.set(p.lsx_id, lsx.code)
      }
      xuatBu[l.material_id] = phan
    }

    const code = await docsRepo.nextCode('KK')
    const { id } = await stocktakesRepo.insert({
      code,
      scope_kind: 'list',
      scope_ref: {
        material_ids: ids,
        nhanh: true,
        ly_do_chung: input.ly_do_chung,
        xuat_bu: xuatBu,
      },
      scope_count: ids.length,
      blind_count: false,
      assigned_to: user.id,
      note: ['Cập nhật số thực tế', nhanLyDoCapNhat(input.ly_do_chung), ghiChuChung]
        .filter(Boolean)
        .join(' · '),
      created_by: user.id,
    })
    await stocktakesRepo.insertLines(
      input.lines.map((l) => {
        const so = book.get(l.material_id) ?? 0
        return {
          stocktake_id: id,
          material_id: l.material_id,
          system_qty: so,
          book_qty_frozen: so,
          counted_qty: l.counted_qty,
          diff: l.counted_qty - so,
          counted_by: user.id,
          counted_at: freezeAt,
          note: ghiChuDong({
            ly_do: l.ly_do ?? input.ly_do_chung,
            ghi_chu: l.ghi_chu,
            xuat_bu: (xuatBu[l.material_id] ?? []).map((p) => ({
              code: maLenh.get(p.lsx_id) ?? p.lsx_id,
              qty: p.qty,
            })),
            con_thieu: xuatBu[l.material_id]
              ? so - l.counted_qty - xuatBu[l.material_id].reduce((a, p) => a + p.qty, 0)
              : 0,
          }),
        }
      }),
    )
    await stocktakesRepo.patch(id, { status: 'review', freeze_at: freezeAt })

    if (!(await laTruongKho(user))) return { trang_thai: 'cho_duyet', id, code }
    const take = await stocktakesRepo.findById(id)
    if (!take) throw new Error('Không đọc lại được đợt vừa ghi')
    try {
      const kq = await apDung(user, take, await stocktakesRepo.listLines(id))
      return { trang_thai: 'da_ghi', id, code, ...kq }
    } catch (e) {
      // Áp hỏng thì HUỶ đợt vừa tạo kèm lý do — để lại nó ở "chờ duyệt" thì
      // chính trưởng kho không duyệt được (người đếm không tự duyệt), thành rác.
      await stocktakesRepo.patch(id, {
        status: 'cancelled',
        reject_reason: `Ghi không thành: ${e instanceof Error ? e.message : String(e)}`,
      })
      throw e
    }
  },

  async reject(user: User, id: string, reason: string): Promise<void> {
    await assertAction(user, 'warehouse.stocktake.approve')
    if (!reason.trim()) throw BadRequest('Từ chối phải kèm lý do')
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status !== 'review') {
      throw Conflict(
        `Đợt đang ở "${take.status}" — chỉ đợt chờ đối chiếu mới từ chối được`,
      )
    }
    // Quay về ĐANG ĐẾM chứ không đóng đợt: từ chối nghĩa là "đếm lại chỗ này",
    // và bắt lập đợt mới là bắt đếm lại từ đầu cả phạm vi.
    await stocktakesRepo.patch(id, { status: 'counting', reject_reason: reason.trim() })
  },

  async cancel(user: User, id: string, reason: string): Promise<void> {
    await assertWrite(user)
    const take = await stocktakesRepo.findById(id)
    if (!take) throw NotFound('Đợt kiểm kê không tồn tại')
    if (take.status === 'approved') {
      throw Conflict(
        'Đợt đã duyệt — tồn đã đổi theo. Sai thì đảo phiếu KK, không huỷ đợt.',
      )
    }
    if (user.role !== 'admin' && take.created_by !== user.id) {
      throw Forbidden('Chỉ người mở đợt hoặc quản trị viên huỷ được')
    }
    await stocktakesRepo.patch(id, {
      status: 'cancelled',
      reject_reason: reason.trim() || null,
    })
  },
}
