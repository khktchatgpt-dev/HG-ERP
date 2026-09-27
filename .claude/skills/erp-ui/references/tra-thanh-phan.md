# Cần gì → dùng gì

Bảng này xếp theo **VIỆC CẦN LÀM**, không theo file.

**Nguồn sự thật** là sách tra `/design-lab/thanh-phan/<slug>` (danh sách họ ở `src/app/design-lab/_lab/kit-families.ts`, thuộc tính sinh từ mã). Bảng này chỉ để tìm đúng trang. Thuộc tính và cách dùng chi tiết thì mở trang đó, đừng đoán từ tên.

Mọi thứ import từ `@/components/kit`.

## Khung màn

| Cần                                                    | Dùng                                                                                                                                                                                                                              | Trang           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Khung màn có bảng dài: đầu/chân dính, cuộn trong khung | `ScreenFrame` (+ `tableMin`), `ScreenHeader`                                                                                                                                                                                      | `screen-frame`  |
| Khung màn chứng từ: thân + cột dữ kiện + thanh đáy     | `DocScreen`, `DocBody`, `StatusBar`                                                                                                                                                                                               | `doc-screen`    |
| Ô việc có số ở trang vào việc                          | `WorkTiles`, `WorkTile`                                                                                                                                                                                                           | `work-tiles`    |
| Làn việc của hộp thư (số trên tab do kit tự đếm)       | `WorkLanes`                                                                                                                                                                                                                       | `work-lanes`    |
| Soi một dòng mà không rời danh sách                    | `InspectPanel`, `InspectSection`                                                                                                                                                                                                  | `inspect-panel` |
| Vỏ app                                                 | **Không dựng trong page.** Vỏ thật của app là `WorkspaceShell` (`src/components/workspace/*`, gắn ở `(<ws>)/layout.tsx`). `NavRail`/`TopBar`/`UserCard`/`Count` của kit hiện CHỈ dùng trong màn mẫu `/design-lab` (đo 24/09/2026) | `app-shell`     |
| Thanh lệnh đầu màn mẫu (đường dẫn + ô "Đi tới…")       | `CommandBar`: cũng chỉ ở màn mẫu, cùng lý do                                                                                                                                                                                      | `command-bar`   |

## Bảng và lưới

| Cần                                                         | Dùng                                         | Trang          |
| ----------------------------------------------------------- | -------------------------------------------- | -------------- |
| Danh sách toàn trang, có thể dài (tự ảo hoá từ 200 dòng)    | `Table` + `THead`/`Row`/`Cell`/`TFoot`       | `table`        |
| Sắp xếp, ẩn cột, mật độ, nhớ theo người                     | `useKitTable` + `SortHead` + `TableSettings` | `table-engine` |
| Hàng lọc: chip có số đếm + ô tìm                            | `FilterBar`, `Chip`, `SearchInput`           | `filter-bar`   |
| Lưới dòng NẰM TRONG một khối chứng từ, có thanh công cụ     | `Grid` và các mảnh `Grid*`, `Th`, `Td`       | `grid`         |
| Ma trận hai tầng tiêu đề (chi tiết × công đoạn), ô bấm được | `MatrixTable`                                | `matrix-table` |

## Chứng từ (vòng đời)

| Cần                                                        | Dùng                                                 | Trang                        |
| ---------------------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Mã, loại chứng từ + đang ở bước nào                        | `DocHead`, `StatusTrack`                             | `doc-head`                   |
| Ai đang giữ tờ này, bao lâu rồi                            | `HolderBar`                                          | `holder-bar`                 |
| Một dòng: trạng thái + ai giữ + chuyển bước                | `DocStatus`                                          | `doc-status`                 |
| Trang đa nhiệm: bấm mục nào chỉ hiện mục đó                | `DocMenu`, `DocMenuPanel`                            | `doc-menu`                   |
| Phạm vi Của tôi / Cả phòng cho cả màn (nhớ theo tài khoản) | `ScopeSwitch` (+ `useScopePref`, `lib/supply-scope`) | `scope-switch`               |
| Việc tiếp theo + người giữ                                 | `NextAction`                                         | `next-action`                |
| Bước chính duy nhất, và lý do chưa bấm được                | `PrimaryStep` (`why`)                                | `primary-step`               |
| Điều kiện đủ/thiếu trước khi đi tiếp                       | `Checks`                                             | `checks`                     |
| Dải lệnh theo nhóm (góc trên phải)                         | `ActionPane`, `ActionGroup`, `Action`                | `action-pane`                |
| Đường dẫn + lật tờ trước/sau                               | `Crumb`                                              | `crumb`                      |
| Chuỗi chứng từ cha → con                                   | `DocChain`                                           | `doc-chain`                  |
| Nút đếm chứng từ liên quan                                 | `SmartLinks`                                         | `smart-links`                |
| Lưới nhãn–giá trị của đầu chứng từ                         | `FieldGrid`, `Field`, `FieldGroup`                   | `field-grid`                 |
| Khối gập được, tóm tắt khi đóng                            | `FastTab`                                            | `fast-tab`                   |
| Cột dữ kiện bên phải                                       | `FactBox`, `FactSection`, `FactKv`                   | `fact-box`                   |
| Trạng thái một dòng kèm lý do / chi tiết một dòng          | `LineStatus` / `LineDetail`                          | `line-status`, `line-detail` |
| Đời chứng từ theo mốc                                      | `Timeline`                                           | `timeline`                   |
| Trao đổi ngay trên chứng từ                                | `NoteStream`, `NoteComposer`, `Followers`            | `notes`                      |
| Vết thay đổi trường: ai, lúc nào, từ gì thành gì           | `AuditTable`                                         | `audit-table`                |

## Hồ sơ danh mục (E) và bảng nhập (F)

| Cần                                                    | Dùng                                 | Trang          |
| ------------------------------------------------------ | ------------------------------------ | -------------- |
| Dải hiệu suất; mỗi ô BẮT BUỘC có mẫu số (`basis`)      | `MetricStrip`, `Metric`              | `metric-strip` |
| Cảnh báo sửa danh mục đang được dùng ở N chỗ           | `MasterWarn`                         | `master-warn`  |
| Đầu đơn co thành dải chip để nhường chỗ cho lưới       | `HeadChips`, `HeadChip`, `HeadField` | `head-chips`   |
| Thanh chốt đáy: tổng + vì sao chưa lưu được (bấm được) | `CommitBar`                          | `commit-bar`   |

## Nhập liệu

| Cần                                               | Dùng                    | Trang        |
| ------------------------------------------------- | ----------------------- | ------------ |
| Ô số (chốt khi rời ô, trả chuỗi thô)              | `NumInput`              | `num-input`  |
| Ô chữ một dòng / nhiều dòng                       | `TextInput`, `TextArea` | `text-input` |
| Chọn một trong danh sách NGẮN                     | `Pick`                  | `pick`       |
| Chọn trong danh sách DÀI, hoặc tra từ server      | `Combobox`              | `combobox`   |
| Ngày (`dd/mm/yyyy`, lịch tiếng Việt, giá trị ISO) | `DateInput`             | `date-input` |
| Ô đánh dấu có nhãn                                | `Tick`                  | `tick`       |

## Nút, lớp phủ, phản hồi

| Cần                                                    | Dùng                                               | Trang        |
| ------------------------------------------------------ | -------------------------------------------------- | ------------ |
| Nút; đang chạy (`busy`); khoá theo quyền (`blockedBy`) | `Btn`, `PermHint`                                  | `btn`        |
| Menu ⋯ các tác vụ phụ                                  | `Menu`                                             | `menu`       |
| Hộp xác nhận: nói hậu quả, danh sách bị ảnh hưởng      | `Sheet`, `Consequence`, `Affected`, `SheetActions` | `sheet`      |
| Khung nổi không chặn trang                             | `Popover`                                          | `popover`    |
| Chú giải khi rê / focus                                | `Tip`                                              | `tip`        |
| Báo kết quả sau thao tác                               | `useToast` (trong `ToastProvider`)                 | `toast`      |
| Dải thông báo một dòng kèm việc gỡ; lỗi hệ thống       | `NoticeBar`                                        | `notice-bar` |
| Rỗng: lý do + việc tiếp (bắt buộc)                     | `Empty`                                            | `empty`      |
| Đang tải                                               | `Loading`                                          | `loading`    |

## Bày chữ và số

| Cần                                                  | Dùng          | Trang          |
| ---------------------------------------------------- | ------------- | -------------- |
| Mã chứng từ / vật tư (đơn cách; `as="a"` thành link) | `Code`        | `code`         |
| Số, tiền theo định dạng VN                           | `Num`         | `num`          |
| Nhãn trạng thái theo tone vòng đời                   | `Tag`         | `tag`          |
| Icon theo khái niệm nghiệp vụ                        | `Ico`         | `icon`         |
| Phép tính nguyên văn của một con số                  | `WhyBox`      | `why-box`      |
| Thanh tỉ lệ phủ có nhãn                              | `CoverageBar` | `coverage-bar` |
| Hai mẫu số % đặt cạnh nhau (chi tiết vs bộ)          | `DualPct`     | `dual-pct`     |
| Chênh lệch có dấu (không chỉ bằng màu)               | `DeltaNum`    | `delta-num`    |
| Sản lượng theo ngày, đi bằng phím                    | `DayStrip`    | `day-strip`    |
| So sánh một/hai chuỗi bằng thanh ngang               | `MiniBars`    | `mini-bars`    |

Không thấy thứ cần tìm thì kit đang thiếu. Làm theo mục "Khi kit thiếu" trong `SKILL.md`, đừng chế CSS tại chỗ.
