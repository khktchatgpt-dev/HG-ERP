# Cần gì → dùng gì

Bảng này xếp theo **VIỆC CẦN LÀM**, không theo file.

**Nguồn sự thật** là JSDoc trên khai báo kiểu props trong `src/components/kit/*.tsx` (sách tra `/design-lab/thanh-phan` đã xoá 07/10/2026). Bảng này chỉ để tìm đúng thành phần; thuộc tính và cách dùng thì mở file đó mà đọc, đừng đoán từ tên. Muốn xem nó chạy thật thì `grep` tên thành phần trong `src/app` tìm màn đang dùng.

Mọi thứ import từ `@/components/kit`.

## Khung màn

| Cần                                                    | Dùng                                                                                                                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khung màn có bảng dài: đầu/chân dính, cuộn trong khung | `ScreenFrame` (+ `tableMin`), `ScreenHeader`                                                                                                                                                                                                                   |
| Khung màn chứng từ: thân + cột dữ kiện + thanh đáy     | `DocScreen`, `DocBody`, `StatusBar`                                                                                                                                                                                                                            |
| Ô việc có số ở trang vào việc                          | `WorkTiles`, `WorkTile`                                                                                                                                                                                                                                        |
| Làn việc của hộp thư (số trên tab do kit tự đếm)       | `WorkLanes`                                                                                                                                                                                                                                                    |
| Soi một dòng mà không rời danh sách                    | `InspectPanel`, `InspectSection`                                                                                                                                                                                                                               |
| Vỏ app                                                 | **Không dựng trong page.** Vỏ thật của app là `WorkspaceShell` (`src/components/workspace/*`, gắn ở `(<ws>)/layout.tsx`). `NavRail`/`TopBar`/`UserCard`/`Count` của kit từng CHỈ dùng trong màn mẫu `/design-lab` (đã xoá 07/10/2026) — nay không màn nào dùng |
| Thanh lệnh đầu màn mẫu (đường dẫn + ô "Đi tới…")       | `CommandBar`: cũng chỉ từng ở màn mẫu đã xoá, cùng lý do                                                                                                                                                                                                       |

## Bảng và lưới

| Cần                                                         | Dùng                                         |
| ----------------------------------------------------------- | -------------------------------------------- |
| Danh sách toàn trang, có thể dài (tự ảo hoá từ 200 dòng)    | `Table` + `THead`/`Row`/`Cell`/`TFoot`       |
| Sắp xếp, ẩn cột, mật độ, nhớ theo người                     | `useKitTable` + `SortHead` + `TableSettings` |
| Hàng lọc: chip có số đếm + ô tìm                            | `FilterBar`, `Chip`, `SearchInput`           |
| Lưới dòng NẰM TRONG một khối chứng từ, có thanh công cụ     | `Grid` và các mảnh `Grid*`, `Th`, `Td`       |
| Ma trận hai tầng tiêu đề (chi tiết × công đoạn), ô bấm được | `MatrixTable`                                |

## Chứng từ (vòng đời)

| Cần                                                                  | Dùng                                                 |
| -------------------------------------------------------------------- | ---------------------------------------------------- |
| Mã, loại chứng từ + đang ở bước nào                                  | `DocHead`, `StatusTrack`                             |
| Ai đang giữ tờ này, bao lâu rồi                                      | `HolderBar`                                          |
| Một dòng: trạng thái + ai giữ + chuyển bước                          | `DocStatus`                                          |
| Trang đa nhiệm: bấm mục nào chỉ hiện mục đó                          | `DocMenu`, `DocMenuPanel`                            |
| Phạm vi Của tôi / Cả phòng cho cả màn (nhớ theo tài khoản)           | `ScopeSwitch` (+ `useScopePref`, `lib/supply-scope`) |
| Chữ phụ nhạt / chữ nhấn trễ-để ý-xong (thay tự tô màu)               | `Hint`, `ToneText`                                   |
| Tên bấm được (NCC, người mua, khách) — không phải mã chứng từ        | `TextLink`                                           |
| Nhãn nhóm + vạch ngăn trên hàng lọc; hàng lọc mảnh / thanh hành động | `BarLabel`, `BarSep`, `FilterBar dense tone`         |
| Việc tiếp theo + người giữ                                           | `NextAction`                                         |
| Bước chính duy nhất, và lý do chưa bấm được                          | `PrimaryStep` (`why`)                                |
| Điều kiện đủ/thiếu trước khi đi tiếp                                 | `Checks`                                             |
| Dải lệnh theo nhóm (góc trên phải)                                   | `ActionPane`, `ActionGroup`, `Action`                |
| Đường dẫn + lật tờ trước/sau                                         | `Crumb`                                              |
| Chuỗi chứng từ cha → con                                             | `DocChain`                                           |
| Nút đếm chứng từ liên quan                                           | `SmartLinks`                                         |
| Lưới nhãn–giá trị của đầu chứng từ                                   | `FieldGrid`, `Field`, `FieldGroup`                   |
| Khối gập được, tóm tắt khi đóng                                      | `FastTab`                                            |
| Cột dữ kiện bên phải                                                 | `FactBox`, `FactSection`, `FactKv`                   |
| Trạng thái một dòng kèm lý do / chi tiết một dòng                    | `LineStatus` / `LineDetail`                          |
| Đời chứng từ theo mốc                                                | `Timeline`                                           |
| Trao đổi ngay trên chứng từ                                          | `NoteStream`, `NoteComposer`, `Followers`            |
| Vết thay đổi trường: ai, lúc nào, từ gì thành gì                     | `AuditTable`                                         |

## Hồ sơ danh mục (E) và bảng nhập (F)

| Cần                                                    | Dùng                                 |
| ------------------------------------------------------ | ------------------------------------ |
| Dải hiệu suất; mỗi ô BẮT BUỘC có mẫu số (`basis`)      | `MetricStrip`, `Metric`              |
| Cảnh báo sửa danh mục đang được dùng ở N chỗ           | `MasterWarn`                         |
| Đầu đơn co thành dải chip để nhường chỗ cho lưới       | `HeadChips`, `HeadChip`, `HeadField` |
| Thanh chốt đáy: tổng + vì sao chưa lưu được (bấm được) | `CommitBar`                          |

## Nhập liệu

| Cần                                               | Dùng                    |
| ------------------------------------------------- | ----------------------- |
| Ô số (chốt khi rời ô, trả chuỗi thô)              | `NumInput`              |
| Ô chữ một dòng / nhiều dòng                       | `TextInput`, `TextArea` |
| Chọn một trong danh sách NGẮN                     | `Pick`                  |
| Chọn trong danh sách DÀI, hoặc tra từ server      | `Combobox`              |
| Ngày (`dd/mm/yyyy`, lịch tiếng Việt, giá trị ISO) | `DateInput`             |
| Ô đánh dấu có nhãn                                | `Tick`                  |

## Nút, lớp phủ, phản hồi

| Cần                                                    | Dùng                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| Nút; đang chạy (`busy`); khoá theo quyền (`blockedBy`) | `Btn`, `PermHint`                                  |
| Menu ⋯ các tác vụ phụ                                  | `Menu`                                             |
| Hộp xác nhận: nói hậu quả, danh sách bị ảnh hưởng      | `Sheet`, `Consequence`, `Affected`, `SheetActions` |
| Khung nổi không chặn trang                             | `Popover`                                          |
| Chú giải khi rê / focus                                | `Tip`                                              |
| Báo kết quả sau thao tác                               | `useToast` (trong `ToastProvider`)                 |
| Dải thông báo một dòng kèm việc gỡ; lỗi hệ thống       | `NoticeBar`                                        |
| Rỗng: lý do + việc tiếp (bắt buộc)                     | `Empty`                                            |
| Đang tải                                               | `Loading`                                          |

## Bày chữ và số

| Cần                                                  | Dùng          |
| ---------------------------------------------------- | ------------- |
| Mã chứng từ / vật tư (đơn cách; `as="a"` thành link) | `Code`        |
| Số, tiền theo định dạng VN                           | `Num`         |
| Nhãn trạng thái theo tone vòng đời                   | `Tag`         |
| Icon theo khái niệm nghiệp vụ                        | `Ico`         |
| Phép tính nguyên văn của một con số                  | `WhyBox`      |
| Thanh tỉ lệ phủ có nhãn                              | `CoverageBar` |
| Hai mẫu số % đặt cạnh nhau (chi tiết vs bộ)          | `DualPct`     |
| Chênh lệch có dấu (không chỉ bằng màu)               | `DeltaNum`    |
| Sản lượng theo ngày, đi bằng phím                    | `DayStrip`    |
| So sánh một/hai chuỗi bằng thanh ngang               | `MiniBars`    |

Không thấy thứ cần tìm thì kit đang thiếu. Làm theo mục "Khi kit thiếu" trong `SKILL.md`, đừng chế CSS tại chỗ.
