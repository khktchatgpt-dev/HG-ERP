# Sản xuất — quy trình và vai trò

Viết 18/09/2026, theo yêu cầu "định hình các quy trình, các vai trò nghiệp vụ
trước khi thiết kế". Dựng theo **sáu bước** ở mục 5 của
[`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md): câu hỏi nghiệp vụ →
máy trạng thái → ngoại lệ → ai giữ bóng → vết → **rồi mới** chọn khuôn màn.

Mọi con số dưới đây **đo trên DB thật ngày 18/09/2026**, không ước lượng.

---

## 0. Vì sao phải quay lại bước 1

Khu Sản xuất đã có 4 workspace và 13 màn, roadmap 6 giai đoạn báo xong 23/08.
Nhưng dữ liệu:

| Bảng                                   |                               Dòng |
| -------------------------------------- | ---------------------------------: |
| `production_orders`                    | 19 (13 duyệt · 1 đang SX · 5 nháp) |
| `production_order_lines`               |                                291 |
| `production_components` (định hình)    |        875 — chỉ trên **7/19 lệnh** |
| `production_jobs` (lộ trình + giao tổ) |        **4**, không job nào có hạn |
| `production_entries` (sổ sản lượng)    |                              **0** |
| `production_entry_docs` (phiếu PBS)    |                              **0** |
| `production_transfers` (giao tổ)       |                              **0** |
| `production_day_locks` (chốt sổ)       |                              **0** |
| `production_daily_targets` (chỉ tiêu)  |                              **0** |

Mọi màn tiến độ / tuần / chỉ tiêu / theo tổ / báo cáo / toàn cảnh đều là **dẫn
xuất của `production_entries`**. Bảng đó rỗng nên các màn đó rỗng. Vấn đề không
nằm ở màn — nằm ở chỗ chuỗi chứng từ chưa được ai chốt là đúng, nên chưa ai ghi.

---

## 1. Bước 1 — Sáu vai, mỗi vai MỘT câu hỏi

Câu hỏi viết theo lời người làm, không phải "cần màn gì".

| Vai                | Ai (đo trên DB)                                                  | Câu hỏi nghiệp vụ                                              |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| **Bán hàng**       | `sales_staff` — quyền `production.lsx.issue`                     | Đơn khách này đã có lệnh SX chưa, bao giờ xong để tôi hẹn giao? |
| **Kế hoạch SX**    | `planner` — `production.plan.manage`                             | Lệnh nào phải vào xưởng tuần này, giao tổ nào, hạn nào?        |
| **Thống kê tổ**    | 7 tài khoản `production_stat`, mỗi tổ một                        | Hôm nay tổ tôi làm được bao nhiêu, ghi vào đâu, đã chốt chưa?  |
| **Tổ trưởng**      | 4 tài khoản `production_leader` (Phôi · Sơn Sắt · Sơn Nhôm · May) | Tổ tôi đang nợ việc gì, hàng vào tổ đã đủ chưa?                |
| **Quản đốc xưởng** | 3 người phòng Xưởng SX — **chỉ có `production_staff`**            | Lệnh nào đang kẹt, kẹt ở công đoạn nào, ai phải gỡ?            |
| **Giám đốc**       | `director`                                                       | Có lệnh nào sắp trễ hạn giao không, và vì sao?                 |

**Phát hiện 1 — vai "quản đốc" chưa tồn tại trong RBAC.** 3 người phòng Xưởng
Sản Xuất chỉ mang `production_staff`, tức có `production.member`,
`production.team.manage`, `production.incident.report` — **không** có
`production.progress.track` (hiện chỉ `director` + `admin`), không ghi sổ được,
không lên kế hoạch được. Vai giữ câu hỏi "lệnh nào đang kẹt" đang không có
quyền nào để làm gì với câu trả lời.

**Phát hiện 2 — biên chế thống kê đã đổi.** Ghi chép cũ (07/2026) nói xưởng có
**2 thống kê, mỗi người ôm nhiều công đoạn**. DB hôm nay có **7 tài khoản
"Thống kê Tổ X"** — Phôi, Hàn, Nguội, May, Sơn Sắt, Sơn Nhôm, Cơ Điện. Hai mô
hình này dẫn tới hai thiết kế màn ghi sổ khác hẳn nhau (xem Q1).

**Phát hiện 3 — tổ trưởng vừa có mặt vừa không.** Ghi chép cũ chốt "tổ trưởng
không dùng hệ thống", nhưng DB có 4 tài khoản `production_leader` giữ quyền
`production.jobs.confirm` — quyền mà **không vai nào khác có**. Nếu tổ trưởng
thật sự không đăng nhập thì chuyển tiếp "xác nhận xong việc" hiện không ai bấm
được (xem Q2).

---

## 2. Bước 2 — Máy trạng thái

Phép thử: vẽ được lên một tờ A4 mà không mũi tên nào cụt.

### 2.1 Lệnh sản xuất — ĐÃ CÓ, 7 trạng thái

```
nháp ──gửi duyệt──▶ chờ GĐ duyệt ──duyệt──▶ đã duyệt ──ghi sổ lần đầu──▶ đang SX
  ▲                      │                                                  │
  └───────từ chối────────┘                                            đóng lệnh
                                                                            │
  huỷ theo đơn ◀──đơn khách huỷ── (mọi trạng thái)                          ▼
                                                                      hoàn thành
```

| Chuyển tiếp                | Ai làm được                            | Điều kiện           | Hệ quả                          | Đường lùi        |
| -------------------------- | -------------------------------------- | ------------------- | ------------------------------- | ---------------- |
| Phát hành lệnh             | `sales_staff` (`production.lsx.issue`)  | có đơn khách        | lệnh `nháp`                     | xoá khi còn nháp |
| Duyệt / từ chối            | `director` (`production.lsx.approve`)   | —                   | `đã duyệt` / `bị từ chối`       | gửi lại          |
| **Vào sản xuất**           | **KHÔNG AI BẤM — máy tự đổi**          | phiếu PBS đầu tiên  | `đang SX` + đơn `in_production` | —                |
| Đóng lệnh                  | `production.progress.track`            | mọi job đã xong     | `hoàn thành` → Sales giao hàng  | ép qua kèm lý do |

**Lỗ hổng A — "đang sản xuất" là hệ quả của việc ghi sổ, không phải quyết định
của ai.** Lệnh chỉ rời `đã duyệt` khi có người ghi phiếu đầu tiên. Xưởng bắt
đầu cắt phôi từ thứ Hai mà thống kê ghi sổ vào thứ Sáu thì hệ thống tin rằng
lệnh chưa vào xưởng suốt 4 ngày. Đây đúng là điều tiêu chí 2.5 cấm (_trạng thái
là sự thật đã xảy ra_) — nhưng đảo lại: sự thật xảy ra rồi mà trạng thái chưa
biết.

**Lỗ hổng B — không ai đóng lệnh.** 5 lệnh MX quá hạn xuất (07/09, 13/09) vẫn
đứng `đã duyệt` / `đang SX`. Cửa `complete` có gate "mọi job đã xong", mà toàn
hệ chỉ có 4 job — với 18/19 lệnh gate rỗng nên đóng lúc nào cũng được, chỉ là
không ai vào đóng. Trạng thái lệnh hiện **không dùng để tin được**.

### 2.2 Phiếu báo sản lượng (PBS) — ĐÃ CÓ, và đây là nguyên tử của cả khu

```
(lập phiếu) ──▶ nháp ──ghi sổ chính thức──▶ đã xác nhận ──▶ [khoá khi chốt sổ ngày]
                  │                              │
                 xoá                     xoá nguyên phiếu (trước khi chốt)
```

Mỗi lượt ghi = một phiếu có số hiệu `PBS-…`, gắn (lệnh × công đoạn × tổ × ngày
× người lập). Máy luật `cho_xac_nhan` / `tu_choi` (tầng tổ trưởng duyệt) **vẫn
còn trong `lib/entry-doc-flow` nhưng đang tắt** theo quyết định 27/08: gửi là
chính thức luôn, người chốt là chính thống kê.

### 2.3 Sổ ngày của tổ — ĐÃ CÓ

```
đang mở ──thống kê chốt sổ──▶ đã chốt ──mở khoá──▶ đang mở
```

**Lỗ hổng C — đường lùi nằm ngoài xưởng.** `production.daylock.lock` có ở
`production_stat`, nhưng `production.daylock.unlock` **chỉ `director` + `admin`**.
Chốt nhầm lúc 5 giờ chiều là phải gọi Giám đốc. Đây là loại ma sát giết một đợt
chạy thử.

### 2.4 Phiếu giao tổ (`production_transfers`) — CÓ BẢNG, 0 DÒNG, Q3 ĐÃ CHỐT: SỐNG

Bàn giao WIP vào tổ theo đợt (`issue` / `return`), dựng từ cột "SL giao 1..4"
của sổ Excel thật. Tồn WIP tại tổ = giao − trả − đã làm. **Chưa ai dùng vì chưa
có màn** — Q3 (22/09) xác nhận xưởng thật sự đếm hàng lúc giao giữa tổ, nên
bảng này không tắt: cần dựng màn Giao tổ.

### 2.5 Chặng từ "sơn xong" tới "giao được" — ĐÃ CHỐT VÀ ĐÃ DỰNG 18/09

> **Quyết định của chủ dự án (18/09/2026):**
>
> - Xưởng **tách đếm riêng cả bốn bước** sau sơn: lắp ráp · bao bì & tem nhãn ·
>   đóng gói · hoàn thiện.
> - Đóng gói xong thì hàng **xếp chờ container, KHÔNG nhập kho thành phẩm** —
>   nên chặng này kết thúc bằng một con số trên lệnh, không đẻ chứng từ kho nào.
>
> **Đã dựng**: [`src/lib/finish-stages.ts`](../src/lib/finish-stages.ts) + nối
> vào tầng tổng hợp, màn ghi sổ và đường ghi. Mỗi dòng SP có thêm một dòng
> **"Bộ thành phẩm"** đơn vị BỘ, tổng cần = SL đặt, sản lượng **ghi thẳng**
> (không suy từ chi tiết). Dòng này là ẢO cho tới lượt ghi đầu tiên, rồi được
> vật chất hoá thành `production_components` thật — cùng lối đi cụm mặc nhiên
> đã dùng.
>
> **Carton và màng PE KHÔNG vào sổ sản lượng.** Hồ sơ SP có 426 dòng nhóm
> PACKAGING nhưng chúng là **vật tư tiêu hao** ở bước đóng gói, không phải thứ
> tổ nào gia công — đưa vào sổ là bắt thống kê báo "hôm nay làm được 200 cái
> carton".
>
> Phần bên dưới giữ nguyên làm hồ sơ chẩn đoán.



Lộ trình mặc định trong [`src/lib/stage-route.ts`](../src/lib/stage-route.ts)
dừng ở **sơn**:

| Nhóm chi tiết | Số dòng (875) | Lộ trình                        |
| ------------- | ------------: | ------------------------------- |
| FRAME         |           414 | phôi · hàn · nguội · mài · sơn  |
| NGU_KIM       |           342 | — (hàng mua, cố ý không đi đâu) |
| WOOD          |           117 | mộc · sơn                       |
| FABRIC        |             2 | may                             |

Không dòng nào thuộc PACKAGING / CUSHION. Nghĩa là **lắp ráp · bao bì · đóng
gói · hoàn thiện không có một dòng việc nào** — 4 trong 12 công đoạn của danh
mục không bao giờ xuất hiện trên sổ. Hệ quả dây chuyền:

- Câu hỏi quan trọng nhất của một lệnh — _"đã xong bao nhiêu BỘ để giao?"_ —
  không trả lời được. Sơn xong không phải là giao được.
- Kho chỉ quản vật tư, **không có nhập kho thành phẩm**. Chuỗi
  `Sản xuất → Kho → Giao hàng` đứt ở đây, nên Bán hàng không có căn cứ nào từ
  hệ thống để hẹn ngày giao.
- Gate "đóng lệnh khi mọi job xong" vì thế cũng không có nghĩa.

Đây là **lỗ hổng thiết kế lớn nhất**, và nó nằm ở quy trình chứ không ở màn.

---

## 3. Bước 3 — Ngoại lệ, liệt kê TRƯỚC

Mỗi ngoại lệ phải nối được vào một chuyển tiếp có thật. Nối không được = máy
trạng thái còn thiếu.

| Ngoại lệ (lời xưởng)                                                                | Nối vào đâu                     | Hiện có?      |
| ----------------------------------------------------------------------------------- | ------------------------------- | ------------- |
| Ghi nhầm số, phát hiện ngay                                                         | xoá dòng / xoá nguyên phiếu     | ✅            |
| Ghi nhầm, phát hiện sau khi đã chốt sổ                                              | mở khoá → sửa → chốt lại        | ⚠ phải nhờ GĐ |
| Hàng phế phát hiện ở công đoạn sau, hôm đó không có hàng đạt                        | dòng chỉ-có-phế (`qty=0`)       | ✅            |
| Công đoạn sau vượt số công đoạn trước                                               | cảnh báo chuỗi, **không chặn**  | ✅            |
| Một phần công đoạn do NCC làm                                                       | gia công ngoài có gắn công đoạn | ✅            |
| Tổ trả lại hàng lỗi cho tổ trước                                                    | `transfers.direction='return'`  | ⚠ chưa dùng   |
| Lệnh chạy dở thì khách đổi số lượng                                                 | sửa dòng lệnh                   | ✅ (bắt lý do) |
| Lệnh chạy dở thì khách huỷ                                                          | `cancelled`                     | ✅            |
| Lệnh làm xong 95%, 5% còn lại chờ vật tư, cần giao trước phần xong                  | số bộ hoàn thiện < SL lệnh      | ✅ (18/09)    |
| Hàng đã đóng gói xong, nằm chờ container                                            | số bộ đóng gói trên lệnh        | ✅ (18/09)    |
| **Làm dư ra vài bộ so với lệnh**                                                    | —                               | ❌ **cụt**    |

Hai dòng đầu đã nối được sau khi dựng chặng thành phẩm (§2.5). Dòng cuối vẫn
cụt: sổ cảnh báo khi ghi vượt số cần nhưng không chặn, và chưa có chỗ nào nói
"lệnh này làm dư 3 bộ" thành một con số đọc được.

---

## 4. Bước 4 — Ai giữ bóng

Trạng thái không có người giữ là trạng thái chết.

| Trạng thái      | Người giữ bóng     | Đo được bao lâu? | Ghi chú                                |
| --------------- | ------------------ | ---------------- | -------------------------------------- |
| nháp            | Bán hàng           | ✅               |                                        |
| chờ GĐ duyệt    | Giám đốc           | ✅               |                                        |
| đã duyệt        | **? không ai**     | ❌               | chờ ai — chờ vật tư hay chờ xưởng nhận? |
| đang SX         | Quản đốc           | ✅               | nhưng vai này chưa có quyền            |
| hoàn thành      | Bán hàng (giao)    | ✅               |                                        |
| PBS nháp        | Thống kê lập phiếu | ✅               |                                        |
| sổ ngày đang mở | Thống kê tổ        | ✅               |                                        |

**Lỗ hổng D — "đã duyệt" không có chủ.** 13/19 lệnh đang nằm ở đây. Không ai
chịu trách nhiệm đẩy nó sang "đang SX", và không có đồng hồ nào đếm nó đã nằm
bao lâu.

---

## 5. Bước 5 — Vết

| Chuyển tiếp                | Ghi lại gì                           | Bắt lý do?             |
| -------------------------- | ------------------------------------ | ---------------------- |
| Duyệt / từ chối lệnh       | ai · lúc nào · `rejected_reason`     | ✅ khi từ chối         |
| Sửa kế hoạch job đang chạy | diff vào `production_plan_changes`   | ✅                     |
| Ghi phiếu PBS              | số phiếu · người lập · thời điểm     | —                      |
| Xoá phiếu / xoá dòng       | xoá cứng                             | ❌ **không để lại vết** |
| Chốt / mở khoá sổ ngày     | ai · lúc nào                         | ❌ mở khoá không bắt lý do |
| Đóng lệnh ép qua gate      | lý do                                | ✅                     |

**Lỗ hổng E — xoá phiếu không để lại vết**, trong khi nguyên lý 1.4 của tài
liệu luồng là _không xoá, chỉ đảo_. Sổ sản lượng là căn cứ tính lương sản phẩm
về sau; xoá cứng một phiếu đã chính thức là mất dấu.

---

## 6. Bước 6 — Bây giờ mới tới khuôn màn

Ánh xạ sang sáu khuôn của [`/design-lab`](../src/app/design-lab/page.tsx):

| Vai / câu hỏi              | Khuôn                | Màn hiện có              | Việc phải làm                       |
| -------------------------- | -------------------- | ------------------------ | ----------------------------------- |
| Thống kê: hôm nay ghi gì   | **F** bảng nhập liệu | `/thongke/ghi`           | giữ; đối chiếu với khuôn F          |
| Thống kê: đã chốt chưa     | **A** vào việc       | `/thongke/ngay`          | giữ                                 |
| Tổ trưởng: tổ tôi nợ gì    | **A**                | `/to`                    | chờ Q2 rồi quyết                    |
| Quản đốc: lệnh nào kẹt     | **C** danh sách      | `/production` (theme cũ) | thiết kế lại; cần vai + quyền trước |
| Kế hoạch: giao tổ, hạn     | **C + D**            | `/kehoach-sx` (6 màn)    | nhiều màn, chưa có dữ liệu để kiểm  |
| Một lệnh cụ thể đang ở đâu | **D** chứng từ       | `/production/lsx/[id]`   | thiết kế lại theo khuôn D           |
| **Nhập kho thành phẩm**    | **D**                | ❌ chưa có               | **thiết kế mới**                    |

Lưu ý: 13 màn hiện có **đều đang ở theme cũ** (`components/erp` + `shadcn`, 0
file dùng `@/components/kit`). Chuyển sang kit mới chỉ làm khi có việc nghiệp vụ
chạm vào màn đó — không chuyển vì thẩm mỹ.

---

## 7. Năm việc phải vá dù thiết kế đi hướng nào

Đều là dữ liệu/quyền, không phải tính năng mới:

1. **`stage_code` của tổ khuyết 4/9**: Tổ Sơn Nhôm (2 người), Cắt Vải, Cơ Điện,
   Xưởng SX để trống. Và **không tổ nào mang mã `mai` hoặc `moc`** — trong khi
   lộ trình FRAME cần mài, 117 chi tiết gỗ cần mộc. Job "mài" duy nhất đang có
   `team = null`.
2. **Quyền mở khoá sổ ngày** phải xuống tới xưởng (§2.3).
3. **Vai quản đốc** chưa tồn tại (§1).
4. **12/19 lệnh chưa định hình chi tiết** — không định hình thì không có dòng
   việc nào để ghi.
5. **5 lệnh quá hạn vẫn mở** — cần đóng, nếu không mọi báo cáo đều sai.

---

## 8. Sáu câu phải chốt trước khi vẽ màn

Không có câu trả lời thì thiết kế nào cũng là đoán.

> **Q3, Q4 và Q5 đã chốt** (Q3: 22/09, Q4+Q5: 18/09) — xem khung ở §2.5 và dưới
> đây. Q1, Q2, Q6 vẫn treo (Q2, Q6 xem cập nhật ở [[san-xuat-quy-trinh-vai-tro]]
> trong memory — có thể đã chốt sau ngày viết tài liệu này, chưa đồng bộ lại).

- **Q1 — Ai ghi sổ?** Một thống kê cho mỗi tổ (đúng như 7 tài khoản đang có),
  hay hai thống kê ôm nhiều tổ (đúng như ghi chép 07/2026)? Trả lời này quyết
  định màn ghi sổ mở ra là "tổ của tôi" hay "chọn tổ trước đã".
- **Q2 — Tổ trưởng có đăng nhập không?** Có thì bật lại tầng "gửi tổ trưởng
  duyệt" (máy luật còn nguyên, chỉ đổi một khối). Không thì nên thu 4 tài khoản
  `production_leader` lại, vì quyền `production.jobs.confirm` hiện không ai
  khác bấm được.
- ~~**Q3 — Giao hàng giữa tổ có đếm không?**~~ **CHỐT 22/09: CÓ.** Xưởng thực
  sự đếm số lượng lúc chuyển WIP giữa tổ. `production_transfers` sống —
  `transfers.service.ts`/`transfers.repo.ts` đã có sẵn (backend đủ từ trước),
  còn thiếu duy nhất màn giao diện. Việc tiếp theo: dựng màn Giao tổ (khuôn F
  hoặc khay nhanh từ M3/M5, theo mẫu cột "SL giao 1..4" của sổ Excel cũ).
- ~~**Q4 — Sau sơn thì còn những bước nào?**~~ **CHỐT 18/09: tách đếm riêng cả
  bốn** — lắp ráp · bao bì · đóng gói · hoàn thiện. Đã dựng, xem §2.5.
- ~~**Q5 — Thành phẩm có nhập kho không?**~~ **CHỐT 18/09: không.** Đóng gói
  xong là xếp chờ container; chặng này kết thúc bằng con số trên lệnh, không
  dựng chứng từ kho thành phẩm.
- **Q6 — Mài và mộc do tổ nào làm?** Hoặc xưởng không tách hai công đoạn đó ra
  và nên bỏ khỏi lộ trình mặc định.

---

## Nguồn

- Luồng: [`tieu-chi-workflow-erp.md`](tieu-chi-workflow-erp.md)
- Khuôn màn: [`/design-lab`](../src/app/design-lab/page.tsx)
- Lộ trình công đoạn: [`src/lib/stage-route.ts`](../src/lib/stage-route.ts)
- Đơn vị đếm theo công đoạn: [`src/lib/default-assembly.ts`](../src/lib/default-assembly.ts)
- Quyền khu SX: [`src/modules/dept/production/perms.ts`](../src/modules/dept/production/perms.ts)
- Máy trạng thái lệnh: [`src/modules/dept/production/lsx.service.ts`](../src/modules/dept/production/lsx.service.ts)
