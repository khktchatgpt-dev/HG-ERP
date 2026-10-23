import { khoangTrongKy } from '@/lib/nhan-su/bien-dong'

/**
 * ĐIỀU KIỆN GỬI DUYỆT BẢNG LƯƠNG — hàm thuần, dùng chung màn Bảng lương, service gửi và màn
 * duyệt của Kế toán trưởng. Tách khỏi service 23/10/2026 khi thêm điều kiện "mọi người làm trong
 * kỳ đều có phiếu": người có hồ sơ mà cả kỳ không tính được ngày nào (chưa đăng ký vân tay, chưa
 * ghép mã máy) sẽ không có dòng trong bản chốt → không có phiếu → trước đây bảng lương chỉ ít đi
 * một người, không báo gì (chủ dự án: "có thể có những người không nằm trên máy chấm công").
 */

export type DieuKienGui = { ma: string; ten: string; ok: boolean; chiTiet: string }

export type PhieuDieuKien = { employeeId: string; van: string[] }

export type NguoiThieu = { ma: string; ten: string; to: string | null }

/**
 * Người đang làm trong kỳ (theo ngày vào / ngày làm cuối) mà không có phiếu lương.
 * Bỏ qua tổ KHÔNG thuộc khối bảng lương nào (khoán ngoài: Bốc xếp, Nguội Anh Sự — Kế toán trả
 * riêng); người chưa có tổ vẫn tính là thiếu để lộ ra. Chưa tính (0 phiếu) thì không có gì để so.
 */
export function nguoiThieuPhieu(
  emps: {
    id: string
    code: string
    full_name: string
    team: string | null
    hire_date: string | null
    leave_date: string | null
  }[],
  khoiCuaTo: Map<string, string | null>,
  phieu: { employeeId: string }[],
  ky: { tu: string; den: string },
): NguoiThieu[] {
  if (!phieu.length) return []
  const co = new Set(phieu.map((p) => p.employeeId))
  return emps
    .filter(
      (e) =>
        !co.has(e.id) &&
        !!khoangTrongKy(
          { hireDate: e.hire_date, leaveDate: e.leave_date },
          ky.tu,
          ky.den,
        ) &&
        (e.team == null || khoiCuaTo.get(e.team) !== null),
    )
    .map((e) => ({ ma: e.code, ten: e.full_name, to: e.team }))
    .sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }))
}

export function dieuKienGui(
  phieu: PhieuDieuKien[],
  canTinhLai: boolean,
  thieuPhieu: NguoiThieu[] = [],
): DieuKienGui[] {
  const dem = (re: RegExp) => phieu.filter((p) => p.van.some((v) => re.test(v))).length
  const thieuHeSo = [
    ...new Set(phieu.flatMap((p) => p.van.filter((v) => v.startsWith('Thiếu hệ số')))),
  ]
  return [
    {
      ma: 'tinh_lai',
      ten: 'Số đang khớp nguồn',
      ok: !canTinhLai,
      chiTiet: canTinhLai ? 'nguồn đã đổi sau lần tính — bấm Tính lại' : 'khớp',
    },
    {
      ma: 'du_nguoi',
      ten: 'Ai làm trong kỳ cũng có phiếu',
      ok: thieuPhieu.length === 0,
      chiTiet: thieuPhieu.length
        ? `${thieuPhieu.length} người không có phiếu: ${thieuPhieu
            .slice(0, 3)
            .map((x) => `${x.ma} ${x.ten}`)
            .join(', ')}${thieuPhieu.length > 3 ? '…' : ''}`
        : 'đủ',
    },
    {
      ma: 'ho_so',
      ten: 'Ai cũng có hồ sơ lương',
      ok: dem(/^Chưa có hồ sơ lương/) === 0,
      chiTiet: `${dem(/^Chưa có hồ sơ lương/)} người chưa có`,
    },
    {
      ma: 'stk',
      ten: 'Ai cũng có STK',
      ok: dem(/^Thiếu STK/) === 0,
      chiTiet: `${dem(/^Thiếu STK/)} người thiếu`,
    },
    {
      ma: 'he_so',
      ten: 'Hệ số khung có giờ',
      ok: thieuHeSo.length === 0,
      chiTiet: thieuHeSo.length
        ? thieuHeSo.map((v) => v.replace('Thiếu hệ số ', '')).join(', ')
        : 'đủ',
    },
    {
      ma: 'am',
      ten: 'Không thực lĩnh âm',
      ok: dem(/^Thực lĩnh âm/) === 0,
      chiTiet: `${dem(/^Thực lĩnh âm/)} phiếu`,
    },
  ]
}
