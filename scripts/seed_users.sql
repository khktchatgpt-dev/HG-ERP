-- Auto-generated from PhanQuyen_GoogleDrive.xlsx

insert into public.departments (name) values
  ('Ban Giám Đốc'),
  ('Bán Hàng'),
  ('Cắt Vải'),
  ('Hành Chính Nhân Sự'),
  ('Kho'),
  ('Kế Hoạch Sản Xuất-cung ứng'),
  ('Kỹ Thuật'),
  ('QC'),
  ('Tài Chính Kế Toán'),
  ('Xưởng Sản Xuất')
on conflict (name) do nothing;

insert into public.users (email, password_hash, name, role, department_id, title) values
  ('dir1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Điền Hg', 'admin', (select id from public.departments where name = 'Ban Giám Đốc'), 'Giám Đốc'),
  ('hrm1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Trương Văn Hùng', 'manager', (select id from public.departments where name = 'Hành Chính Nhân Sự'), 'Trưởng Phòng HR'),
  ('ketoan3@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Huỳnh Ngọc Thiệt', 'manager', (select id from public.departments where name = 'Tài Chính Kế Toán'), 'Kế Toán Trưởng'),
  ('ketoan2@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Vũ Phương Thảo', 'manager', (select id from public.departments where name = 'Tài Chính Kế Toán'), 'Kế Toán Trưởng'),
  ('ketoan@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Phạm Thị Diện', 'employee', (select id from public.departments where name = 'Tài Chính Kế Toán'), 'NV Kế toán'),
  ('ketoan1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Võ Thị Thu Hồng', 'employee', (select id from public.departments where name = 'Tài Chính Kế Toán'), 'NV Kế toán'),
  ('sale1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn T.Minh Hằng', 'employee', (select id from public.departments where name = 'Bán Hàng'), 'NV Sales'),
  ('sale2@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Phạm Thanh Phương', 'employee', (select id from public.departments where name = 'Bán Hàng'), 'NV Sales'),
  ('kehoach@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Phan Thị Lệ Hằng', 'manager', (select id from public.departments where name = 'Kế Hoạch Sản Xuất-cung ứng'), 'Kế Hoạch Sản Xuất'),
  ('kehoach1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Đặng Thị Thanh Nga', 'employee', (select id from public.departments where name = 'Kế Hoạch Sản Xuất-cung ứng'), 'mua hàng'),
  ('kehoach2@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Thị Phương Nhân', 'employee', (select id from public.departments where name = 'Kế Hoạch Sản Xuất-cung ứng'), 'mua hàng'),
  ('wh1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Khắc Hào', 'manager', (select id from public.departments where name = 'Kho'), 'Thủ kho'),
  ('wh2@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Hà Nguyễn Nữ', 'employee', (select id from public.departments where name = 'Kho'), 'Kho NVL'),
  ('qc1@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Thị Kim Loan', 'employee', (select id from public.departments where name = 'QC'), 'Thống Kê kiêm QC'),
  ('qc2@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Trần Thị Ánh Nguyệt', 'employee', (select id from public.departments where name = 'QC'), 'Thống Kê kiêm QC'),
  ('qc3@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Thị Phúc', 'employee', (select id from public.departments where name = 'QC'), 'Thống Kê kiêm QC'),
  ('nv20@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Trần Văn Đạo', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'Trưởng BP SX'),
  ('nv21@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Bá Thuận', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ cơ điện'),
  ('nv22@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Phạm Thị Thành', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT May'),
  ('nv23@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Văn Bảy', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'QL Xưởng X2'),
  ('nv24@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Đinh Ngọc Quân', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'QL Xưởng X3'),
  ('nv25@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Quốc Dương', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'QL Xưởng X3'),
  ('nv26@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Đồng Văn Đạt', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ hàn'),
  ('nv27@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Phùng Sẵn', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ nguội'),
  ('nv28@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Trương Thị Ngọc Hằng', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ phôi'),
  ('nv29@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Thị Xuân Hồng', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ Sơn sắt'),
  ('nv30@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Phạm Thị Sinh', 'manager', (select id from public.departments where name = 'Xưởng Sản Xuất'), 'TT Tổ sơn nhôm'),
  ('nv31@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Dương Thái Quang', 'manager', (select id from public.departments where name = 'Kỹ Thuật'), 'TT Kỹ thuật xưởng'),
  ('nv32@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Viết Phong', 'employee', (select id from public.departments where name = 'Cắt Vải'), 'NV Cắt Vải'),
  ('kehoach3@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Nguyễn Thị Mộng cam', 'employee', (select id from public.departments where name = 'Kế Hoạch Sản Xuất-cung ứng'), 'mua hàng'),
  ('kehoach4@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Lê Nhật Hằng', 'employee', (select id from public.departments where name = 'Kế Hoạch Sản Xuất-cung ứng'), 'mua hàng'),
  ('it@hoanggia.de', '$2b$12$5PYRc3jsKUIt5gu0p8Zy.u6U5a6YLWg.kL1wt.6rrsBq6CsTUuctK', 'Trần Đại Việt', 'employee', (select id from public.departments where name = 'Kỹ Thuật'), 'Nhân Viên IT')
on conflict (email) do update set name = excluded.name, role = excluded.role, department_id = excluded.department_id, title = excluded.title;
