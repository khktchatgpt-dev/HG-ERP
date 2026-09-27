/**
 * SỔ ĐĂNG KÝ HỌ THÀNH PHẦN — mỗi họ một trang ở `/design-lab/thanh-phan/[slug]`
 * (B7, 24/09/2026 — docs/he-thiet-ke-erp-ke-hoach.md §6, §9.9).
 *
 * VÌ SAO THEO HỌ, KHÔNG THEO TỪNG TÊN. Kit có 102 thành phần, nhưng `GridSep`,
 * `GridBtn`, `Th` không có nghĩa khi đứng một mình — chúng là mảnh của `Grid`.
 * Viết 102 trang thì 40 trang là "xem trang Grid". Một họ = những thứ luôn đi
 * cùng nhau trong một màn; trang của họ bày đủ thuộc tính của TỪNG thành viên.
 *
 * `kit-docs.test.tsx` giữ sổ này trung thực: mọi thành phần xuất khẩu từ kit
 * phải thuộc ĐÚNG MỘT họ, mọi họ phải có trang, mọi trang phải đủ sáu mục. Thêm
 * thành phần vào kit mà quên ghi vào đây là test đỏ — đó chính là chỉ tiêu T8.
 */

export const KIT_GROUPS = [
  'Nền',
  'Nhập liệu',
  'Bảng',
  'Chứng từ',
  'Hồ sơ & bảng nhập',
  'Luồng',
  'Lớp phủ',
  'Khung màn',
  'Trực quan dữ liệu',
] as const

export type KitGroup = (typeof KIT_GROUPS)[number]

export type KitFamily = {
  slug: string
  /** Tên trên tiêu đề trang — thường là thành viên chính. */
  title: string
  group: KitGroup
  /** Thành viên CHÍNH đứng đầu. Mọi tên phải là thành phần xuất khẩu từ kit. */
  members: [string, ...string[]]
  /** Một dòng cho mục lục. */
  blurb: string
}

export const KIT_FAMILIES: KitFamily[] = [
  // ── Nền ────────────────────────────────────────────────────────────────
  { slug: 'btn', title: 'Btn', group: 'Nền', members: ['Btn', 'PermHint'], blurb: 'Nút hành động; khoá mềm nói lý do tại chỗ.' }, // prettier-ignore
  { slug: 'tag', title: 'Tag', group: 'Nền', members: ['Tag'], blurb: 'Nhãn trạng thái theo tone vòng đời.' }, // prettier-ignore
  { slug: 'code', title: 'Code', group: 'Nền', members: ['Code'], blurb: 'Mã chứng từ / vật tư, chữ đơn cách.' }, // prettier-ignore
  { slug: 'num', title: 'Num', group: 'Nền', members: ['Num'], blurb: 'Số và tiền: định dạng VN, số 0 không tô đỏ.' }, // prettier-ignore
  { slug: 'coverage-bar', title: 'CoverageBar', group: 'Nền', members: ['CoverageBar'], blurb: 'Thanh tỉ lệ phủ có nhãn.' }, // prettier-ignore
  { slug: 'notice-bar', title: 'NoticeBar', group: 'Nền', members: ['NoticeBar'], blurb: 'Dải thông báo một dòng kèm việc gỡ.' }, // prettier-ignore
  { slug: 'loading', title: 'Loading', group: 'Nền', members: ['Loading'], blurb: 'Khung chờ tải theo dòng.' }, // prettier-ignore
  { slug: 'empty', title: 'Empty', group: 'Nền', members: ['Empty'], blurb: 'Trạng thái rỗng: bắt buộc lý do và việc làm tiếp.' }, // prettier-ignore
  { slug: 'icon', title: 'Ico', group: 'Nền', members: ['Ico'], blurb: 'Icon theo khái niệm nghiệp vụ.' }, // prettier-ignore

  // ── Nhập liệu ──────────────────────────────────────────────────────────
  { slug: 'num-input', title: 'NumInput', group: 'Nhập liệu', members: ['NumInput'], blurb: 'Ô số chốt khi rời ô; trả chuỗi thô, chỗ gọi tự đọc số kiểu Việt.' }, // prettier-ignore
  { slug: 'text-input', title: 'TextInput', group: 'Nhập liệu', members: ['TextInput', 'TextArea'], blurb: 'Ô chữ một dòng và nhiều dòng.' }, // prettier-ignore
  { slug: 'pick', title: 'Pick', group: 'Nhập liệu', members: ['Pick'], blurb: 'Chọn một trong danh sách ngắn.' }, // prettier-ignore
  { slug: 'tick', title: 'Tick', group: 'Nhập liệu', members: ['Tick'], blurb: 'Ô đánh dấu có nhãn.' }, // prettier-ignore
  { slug: 'combobox', title: 'Combobox', group: 'Nhập liệu', members: ['Combobox'], blurb: 'Chọn trong danh sách dài / tra từ server.' }, // prettier-ignore
  { slug: 'date-input', title: 'DateInput', group: 'Nhập liệu', members: ['DateInput'], blurb: 'Ô ngày dd/mm/yyyy + lịch tiếng Việt.' }, // prettier-ignore

  // ── Bảng ───────────────────────────────────────────────────────────────
  { slug: 'table', title: 'Table', group: 'Bảng', members: ['Table', 'THead', 'Row', 'Cell', 'GroupRow', 'TFoot'], blurb: 'Bảng danh sách: tiêu đề + chân dính, ảo hoá từ 200 dòng.' }, // prettier-ignore
  { slug: 'filter-bar', title: 'FilterBar', group: 'Bảng', members: ['FilterBar', 'Chip', 'SearchInput'], blurb: 'Hàng lọc trên bảng: chip đếm + ô tìm.' }, // prettier-ignore
  { slug: 'scope-switch', title: 'ScopeSwitch', group: 'Bảng', members: ['ScopeSwitch'], blurb: 'Phạm vi Của tôi | Cả phòng — nhớ theo tài khoản, mặc định theo vai.' }, // prettier-ignore
  { slug: 'table-engine', title: 'useKitTable', group: 'Bảng', members: ['SortHead', 'TableSettings'], blurb: 'Máy bảng: sắp xếp, ẩn cột, mật độ, nhớ theo người.' }, // prettier-ignore
  { slug: 'grid', title: 'Grid', group: 'Bảng', members: ['Grid', 'GridHead', 'GridBody', 'GridFoot', 'GridRow', 'Th', 'Td', 'CellHint', 'GridCheck', 'GridToolbar', 'GridBtn', 'GridSep'], blurb: 'Lưới dòng của chứng từ, có thanh công cụ.' }, // prettier-ignore
  { slug: 'matrix-table', title: 'MatrixTable', group: 'Bảng', members: ['MatrixTable'], blurb: 'Ma trận hai tầng tiêu đề, ô bấm được.' }, // prettier-ignore

  // ── Chứng từ (khuôn D) ─────────────────────────────────────────────────
  { slug: 'doc-screen', title: 'DocScreen', group: 'Chứng từ', members: ['DocScreen', 'DocBody', 'StatusBar'], blurb: 'Khung màn chứng từ: thân + cột FactBox + thanh đáy.' }, // prettier-ignore
  { slug: 'crumb', title: 'Crumb', group: 'Chứng từ', members: ['Crumb'], blurb: 'Đường dẫn + lật tờ trước/sau.' }, // prettier-ignore
  { slug: 'action-pane', title: 'ActionPane', group: 'Chứng từ', members: ['ActionPane', 'ActionGroup', 'Action'], blurb: 'Dải lệnh theo nhóm của chứng từ.' }, // prettier-ignore
  { slug: 'doc-head', title: 'DocHead', group: 'Chứng từ', members: ['DocHead', 'StatusTrack'], blurb: 'Đầu chứng từ: mã, loại, dải bước vòng đời.' }, // prettier-ignore
  { slug: 'doc-status', title: 'DocStatus', group: 'Chứng từ', members: ['DocStatus'], blurb: 'Một dòng: trạng thái (bấm xem vòng đời), ai giữ, chuyển bước.' }, // prettier-ignore
  { slug: 'doc-menu', title: 'DocMenu', group: 'Chứng từ', members: ['DocMenu', 'DocMenuPanel'], blurb: 'Menu ngang: bấm mục nào, thân trang chỉ hiện mục đó.' }, // prettier-ignore
  { slug: 'holder-bar', title: 'HolderBar', group: 'Chứng từ', members: ['HolderBar'], blurb: 'Ai đang giữ tờ này, bao lâu rồi.' }, // prettier-ignore
  { slug: 'checks', title: 'Checks', group: 'Chứng từ', members: ['Checks'], blurb: 'Danh sách điều kiện đủ/thiếu trước khi đi tiếp.' }, // prettier-ignore
  { slug: 'fast-tab', title: 'FastTab', group: 'Chứng từ', members: ['FastTab'], blurb: 'Khối gập được có tóm tắt khi đóng.' }, // prettier-ignore
  { slug: 'field-grid', title: 'FieldGrid', group: 'Chứng từ', members: ['FieldGrid', 'Field', 'FieldGroup'], blurb: 'Lưới nhãn–giá trị của đầu chứng từ.' }, // prettier-ignore
  { slug: 'line-status', title: 'LineStatus', group: 'Chứng từ', members: ['LineStatus'], blurb: 'Trạng thái một dòng, kèm lý do.' }, // prettier-ignore
  { slug: 'line-detail', title: 'LineDetail', group: 'Chứng từ', members: ['LineDetail'], blurb: 'Chi tiết một dòng, mở dưới lưới.' }, // prettier-ignore
  { slug: 'fact-box', title: 'FactBox', group: 'Chứng từ', members: ['FactBox', 'FactSection', 'FactKv'], blurb: 'Cột dữ kiện bên phải chứng từ.' }, // prettier-ignore
  { slug: 'audit-table', title: 'AuditTable', group: 'Chứng từ', members: ['AuditTable'], blurb: 'Vết thay đổi: ai, lúc nào, từ gì thành gì.' }, // prettier-ignore
  { slug: 'smart-links', title: 'SmartLinks', group: 'Chứng từ', members: ['SmartLinks'], blurb: 'Nút đếm chứng từ liên quan.' }, // prettier-ignore

  // ── Hồ sơ & bảng nhập (khuôn E, F) ─────────────────────────────────────
  { slug: 'metric-strip', title: 'MetricStrip', group: 'Hồ sơ & bảng nhập', members: ['MetricStrip', 'Metric'], blurb: 'Dải hiệu suất; mỗi ô bắt buộc mẫu số.' }, // prettier-ignore
  { slug: 'master-warn', title: 'MasterWarn', group: 'Hồ sơ & bảng nhập', members: ['MasterWarn'], blurb: 'Cảnh báo sửa danh mục đang được dùng.' }, // prettier-ignore
  { slug: 'head-chips', title: 'HeadChips', group: 'Hồ sơ & bảng nhập', members: ['HeadChips', 'HeadChip', 'HeadField'], blurb: 'Đầu đơn co thành dải chip.' }, // prettier-ignore
  { slug: 'commit-bar', title: 'CommitBar', group: 'Hồ sơ & bảng nhập', members: ['CommitBar'], blurb: 'Thanh chốt: tổng + vì sao chưa lưu được.' }, // prettier-ignore

  // ── Luồng ──────────────────────────────────────────────────────────────
  { slug: 'timeline', title: 'Timeline', group: 'Luồng', members: ['Timeline'], blurb: 'Đời chứng từ theo mốc thời gian.' }, // prettier-ignore
  { slug: 'next-action', title: 'NextAction', group: 'Luồng', members: ['NextAction'], blurb: 'Việc tiếp theo, ai giữ, chờ bao lâu.' }, // prettier-ignore
  { slug: 'doc-chain', title: 'DocChain', group: 'Luồng', members: ['DocChain'], blurb: 'Chuỗi chứng từ cha → con.' }, // prettier-ignore
  { slug: 'primary-step', title: 'PrimaryStep', group: 'Luồng', members: ['PrimaryStep'], blurb: 'Bước chính duy nhất của màn.' }, // prettier-ignore
  { slug: 'notes', title: 'NoteStream', group: 'Luồng', members: ['NoteStream', 'NoteComposer', 'Followers'], blurb: 'Trao đổi trên chứng từ.' }, // prettier-ignore

  // ── Lớp phủ ────────────────────────────────────────────────────────────
  { slug: 'tip', title: 'Tip', group: 'Lớp phủ', members: ['Tip'], blurb: 'Chú giải khi rê / focus.' }, // prettier-ignore
  { slug: 'menu', title: 'Menu', group: 'Lớp phủ', members: ['Menu'], blurb: 'Menu ⋯ các tác vụ phụ.' }, // prettier-ignore
  { slug: 'popover', title: 'Popover', group: 'Lớp phủ', members: ['Popover'], blurb: 'Khung nổi không chặn trang.' }, // prettier-ignore
  { slug: 'sheet', title: 'Sheet', group: 'Lớp phủ', members: ['Sheet', 'Affected', 'Consequence', 'SheetActions'], blurb: 'Hộp xác nhận: nói hậu quả trước khi bấm.' }, // prettier-ignore
  { slug: 'toast', title: 'ToastProvider', group: 'Lớp phủ', members: ['ToastProvider'], blurb: 'Báo kết quả sau thao tác.' }, // prettier-ignore

  // ── Khung màn ──────────────────────────────────────────────────────────
  { slug: 'screen-frame', title: 'ScreenFrame', group: 'Khung màn', members: ['ScreenFrame', 'ScreenHeader'], blurb: 'Khung màn: bảng cuộn trong khung, đầu màn.' }, // prettier-ignore
  { slug: 'work-lanes', title: 'WorkLanes', group: 'Khung màn', members: ['WorkLanes'], blurb: 'Làn việc của hộp thư.' }, // prettier-ignore
  { slug: 'work-tiles', title: 'WorkTiles', group: 'Khung màn', members: ['WorkTiles', 'WorkTile'], blurb: 'Ô việc của màn Vào việc.' }, // prettier-ignore
  { slug: 'inspect-panel', title: 'InspectPanel', group: 'Khung màn', members: ['InspectPanel', 'InspectSection'], blurb: 'Khung soi bên phải danh sách.' }, // prettier-ignore
  { slug: 'why-box', title: 'WhyBox', group: 'Khung màn', members: ['WhyBox'], blurb: 'Bày phép tính nguyên văn của một con số.' }, // prettier-ignore
  { slug: 'command-bar', title: 'CommandBar', group: 'Khung màn', members: ['CommandBar'], blurb: 'Thanh lệnh đầu màn mẫu.' }, // prettier-ignore
  { slug: 'app-shell', title: 'NavRail', group: 'Khung màn', members: ['NavRail', 'TopBar', 'UserCard', 'Count'], blurb: 'Vỏ app: thanh bên, thanh trên, huy hiệu đếm.' }, // prettier-ignore

  // ── Trực quan dữ liệu ──────────────────────────────────────────────────
  { slug: 'dual-pct', title: 'DualPct', group: 'Trực quan dữ liệu', members: ['DualPct'], blurb: 'Hai mẫu số % đặt cạnh nhau.' }, // prettier-ignore
  { slug: 'delta-num', title: 'DeltaNum', group: 'Trực quan dữ liệu', members: ['DeltaNum'], blurb: 'Chênh lệch có dấu, không chỉ bằng màu.' }, // prettier-ignore
  { slug: 'day-strip', title: 'DayStrip', group: 'Trực quan dữ liệu', members: ['DayStrip'], blurb: 'Dải cột theo ngày, đi được bằng phím.' }, // prettier-ignore
  { slug: 'mini-bars', title: 'MiniBars', group: 'Trực quan dữ liệu', members: ['MiniBars'], blurb: 'Thanh ngang so sánh một/hai chuỗi.' }, // prettier-ignore
]

export function familyOf(slug: string): KitFamily | undefined {
  return KIT_FAMILIES.find((f) => f.slug === slug)
}
