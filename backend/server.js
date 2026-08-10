require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { loadDB, saveDB } = require('./db');
const { parseChiTieuSPTT, parseChiTieuKeHoach, parseDuLieu, parseTienVe } = require('./parser');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());

// Serve React build (frontend/dist)
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(DIST));
app.use(express.json());

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db = await loadDB();
  const idx = db.users.findIndex(u => u.username === username && u.password === password);
  if (idx === -1) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
  const token = crypto.randomBytes(24).toString('hex');
  db.users[idx].token = token;
  await saveDB(db);
  const { password: _, token: __, ...safeUser } = db.users[idx];
  res.json({ user: safeUser, token });
});

// Mọi API phía dưới đều yêu cầu đăng nhập (trừ /api/login ở trên)
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  const db = await loadDB();
  const user = db.users.find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại' });
  const { password: _, token: __, ...safeUser } = user;
  req.user = safeUser;
  next();
}

// Chỉ role admin mới được upload / xóa dữ liệu / quản lý tài khoản
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Chỉ tài khoản Admin mới được thực hiện thao tác này' });
  next();
}

app.use('/api', requireAuth);
app.use('/api/upload', requireAdmin);
app.use('/api/data', requireAdmin);
app.use('/api/users', requireAdmin);

app.post('/api/logout', async (req, res) => {
  const db = await loadDB();
  const idx = db.users.findIndex(u => u.id === req.user.id);
  if (idx !== -1) { db.users[idx].token = null; await saveDB(db); }
  res.json({ ok: true });
});

// Endpoint này chỉ admin gọi được (requireAdmin ở trên) — trả cả password để admin xem/đối chiếu.
// Không trả "token" vì đó là phiên đăng nhập đang hoạt động, lộ ra có thể bị chiếm phiên người khác.
app.get('/api/users', async (req, res) => {
  const db = await loadDB();
  res.json(db.users.map(({ token: __, ...u }) => u));
});

app.post('/api/users', async (req, res) => {
  const db = await loadDB();
  const { username, password, role, dsm, full_name } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username đã tồn tại' });
  }
  const newUser = { id: db.nextId.users++, username, password, role, dsm: dsm || null, full_name };
  db.users.push(newUser);
  await saveDB(db);
  const { password: _, token: __, ...safeUser } = newUser;
  res.json(safeUser);
});

app.put('/api/users/:id', async (req, res) => {
  const db = await loadDB();
  const id = parseInt(req.params.id);
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy user' });
  const { password, role, dsm, full_name } = req.body;
  if (password) db.users[idx].password = password;
  if (role) db.users[idx].role = role;
  if (dsm !== undefined) db.users[idx].dsm = dsm;
  if (full_name) db.users[idx].full_name = full_name;
  await saveDB(db);
  res.json({ ok: true });
});

app.delete('/api/users/:id', async (req, res) => {
  const db = await loadDB();
  const id = parseInt(req.params.id);
  db.users = db.users.filter(u => u.id !== id || u.username === 'admin');
  await saveDB(db);
  res.json({ ok: true });
});

// ─── UPLOAD ──────────────────────────────────────────────────────────────────
app.post('/api/upload/chi-tieu', upload.single('file'), async (req, res) => {
  try {
    const db = await loadDB();
    const nam = parseInt(req.body.nam);
    const thang = parseInt(req.body.thang);
    const nguon = req.body.nguon || 'sptt';

    const parseFn = nguon === 'ke_hoach' ? parseChiTieuKeHoach : parseChiTieuSPTT;
    const records = parseFn(req.file.buffer, nam, thang);

    // ⚠️ Bảo vệ: CHỈ xóa và ghi mới nếu parse được ít nhất 10 records
    // Tránh xóa mất dữ liệu khi upload nhầm file hoặc file lỗi
    if (records.length < 10) {
      return res.status(400).json({
        error: `File không hợp lệ — chỉ đọc được ${records.length} bản ghi. Vui lòng kiểm tra lại file CHỈ TIÊU SPTT.xlsx.`,
        count: records.length
      });
    }

    // Xóa toàn bộ năm đó (vì parse 12 tháng cùng lúc)
    db.chi_tieu = db.chi_tieu.filter(r => !(r.nam === nam && (r.nguon || 'sptt') === nguon));

    records.forEach(r => { r.id = db.nextId.chi_tieu++; r.nguon = nguon; });
    db.chi_tieu.push(...records);

    const uploadId = db.nextId.uploads++;
    db.uploads.push({ id: uploadId, file_name: req.file.originalname, file_type: 'chi_tieu', nam, thang: 0, created_at: new Date().toISOString() });

    await saveDB(db);
    res.json({ ok: true, count: records.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/doanh-so', upload.single('file'), async (req, res) => {
  try {
    const db = await loadDB();
    const nam = parseInt(req.body.nam);
    const thang = parseInt(req.body.thang);

    const records = parseDuLieu(req.file.buffer, nam, thang);

    // Bảo vệ: từ chối file lỗi/rỗng để không xóa nhầm dữ liệu cũ
    if (records.length < 5) {
      return res.status(400).json({ error: `File không hợp lệ — chỉ đọc được ${records.length} dòng. Kiểm tra lại file Sổ Chi Tiết Bán Hàng.`, count: records.length });
    }

    // Xóa theo đúng kỳ người chọn VÀ các kỳ thực có trong file (tránh sót)
    const periods = new Set(records.map(r => `${r.nam}-${r.thang}`));
    periods.add(`${nam}-${thang}`);
    db.doanh_so = db.doanh_so.filter(r => !periods.has(`${r.nam}-${r.thang}`));

    records.forEach(r => { r.id = db.nextId.doanh_so++; });
    db.doanh_so.push(...records);

    const uploadId = db.nextId.uploads++;
    db.uploads.push({ id: uploadId, file_name: req.file.originalname, file_type: 'doanh_so', nam, thang, created_at: new Date().toISOString() });

    await saveDB(db);
    res.json({ ok: true, count: records.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/tien-ve', upload.single('file'), async (req, res) => {
  try {
    const db = await loadDB();
    const nam = parseInt(req.body.nam);
    const thang = parseInt(req.body.thang);

    const records = parseTienVe(req.file.buffer, nam, thang);

    if (records.length < 3) {
      return res.status(400).json({ error: `File không hợp lệ — chỉ đọc được ${records.length} bút toán thu tiền cho ${thang}/${nam}. Kiểm tra lại file Nhật ký chung.`, count: records.length });
    }

    db.tien_ve = db.tien_ve.filter(r => !(r.nam === nam && r.thang === thang));
    records.forEach(r => { r.id = db.nextId.tien_ve++; });
    db.tien_ve.push(...records);

    const uploadId = db.nextId.uploads++;
    db.uploads.push({ id: uploadId, file_name: req.file.originalname, file_type: 'tien_ve', nam, thang, created_at: new Date().toISOString() });

    await saveDB(db);
    res.json({ ok: true, count: records.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/uploads', async (req, res) => {
  const db = await loadDB();
  res.json(db.uploads.slice(-20).reverse());
});

// Thống kê dữ liệu doanh số theo từng tháng
app.get('/api/data-summary', async (req, res) => {
  const db = await loadDB();
  const map = {};
  const getEntry = (nam, thang) => {
    const key = `${nam}-${thang}`;
    if (!map[key]) map[key] = { nam, thang, so_dong: 0, doanh_so: 0, so_ct: new Set(), tien_ve: 0, co_tien_ve: false };
    return map[key];
  };

  db.doanh_so.forEach(r => {
    const e = getEntry(r.nam, r.thang);
    e.so_dong++;
    e.doanh_so += r.doanh_so_thuc_dat || 0;
    if (r.so_chung_tu) e.so_ct.add(r.so_chung_tu);
  });

  // Gộp tiền về vào đúng kỳ THỰC THU (có thể khác kỳ phát sinh bán hàng) — chuẩn mới, ưu tiên trước
  db.doanh_so.forEach(r => {
    if (r.da_thu_tien !== true) return;
    const e = getEntry(r.nam_thu_tien, r.thang_thu_tien);
    e.tien_ve += r.doanh_so_thuc_dat || 0;
    e.co_tien_ve = true;
    e.co_tien_ve_moi = true;
  });
  // Bảng cũ (Nhật ký chung): chỉ dùng bù cho những KỲ chưa có dữ liệu chuẩn mới, tránh cộng trùng
  db.tien_ve.forEach(r => {
    const e = getEntry(r.nam, r.thang);
    if (e.co_tien_ve_moi) return;
    e.tien_ve += r.so_tien || 0;
    e.co_tien_ve = true;
  });

  const result = Object.values(map)
    .map(m => ({
      nam: m.nam, thang: m.thang, so_dong: m.so_dong, doanh_so: m.doanh_so, so_don_hang: m.so_ct.size,
      tien_ve: m.co_tien_ve ? m.tien_ve : null,
      // Nút "Xóa tiền về" (bảng cũ) chỉ hiện khi kỳ đó còn đang dùng dữ liệu Nhật ký chung, chưa có chuẩn mới
      tien_ve_legacy: !m.co_tien_ve_moi && db.tien_ve.some(r => r.nam === m.nam && r.thang === m.thang)
    }))
    .sort((a, b) => b.nam - a.nam || b.thang - a.thang);
  res.json(result);
});

// Xóa dữ liệu doanh số của 1 tháng
app.delete('/api/data/doanh-so/:nam/:thang', async (req, res) => {
  const db = await loadDB();
  const nam = parseInt(req.params.nam);
  const thang = parseInt(req.params.thang);
  const before = db.doanh_so.length;
  db.doanh_so = db.doanh_so.filter(r => !(r.nam === nam && r.thang === thang));
  const deleted = before - db.doanh_so.length;
  // Xóa lịch sử upload tương ứng
  db.uploads = db.uploads.filter(u => !(u.file_type === 'doanh_so' && u.nam === nam && u.thang === thang));
  await saveDB(db);
  res.json({ ok: true, deleted });
});

// Xóa dữ liệu tiền về của 1 tháng
app.delete('/api/data/tien-ve/:nam/:thang', async (req, res) => {
  const db = await loadDB();
  const nam = parseInt(req.params.nam);
  const thang = parseInt(req.params.thang);
  const before = db.tien_ve.length;
  db.tien_ve = db.tien_ve.filter(r => !(r.nam === nam && r.thang === thang));
  const deleted = before - db.tien_ve.length;
  db.uploads = db.uploads.filter(u => !(u.file_type === 'tien_ve' && u.nam === nam && u.thang === thang));
  await saveDB(db);
  res.json({ ok: true, deleted });
});

// ─── CẤU HÌNH SẢN PHẨM TRỌNG TÂM (SPTT) ─────────────────────────────────────
const SPTT_PRODUCTS = ['solufemo', 'bocalsontb', 'bocalso'];

function isSptt(tenHang) {
  if (!tenHang) return false;
  const lower = tenHang.toLowerCase();
  return SPTT_PRODUCTS.some(p => lower.includes(p));
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Bảng mapping: ten_nhom_kh trong doanh_so → DSM chuẩn
const DSM_MAP = {
  'DSM1': 'DSM1', 'DSM2': 'DSM2', 'DSM3': 'DSM3', 'DSM4': 'DSM4', 'DSM5': 'DSM5',
  'CCO-Chuỗi': 'CCO-Chuỗi', 'CCO-O2': 'CCO-O2', 'CCO-O4': 'CCO-O4',
  // Địa bàn thuộc DSM1 (Hà Nội)
  'Quận Cầu Giấy': 'DSM1',
  'Quận Bắc Từ Liêm': 'DSM1',
  // OTC TLS (Nguyễn Việt Cường - PT) thuộc DSM2
  'OTC TLS': 'DSM2',
  // Cột "Nhóm quản lý vùng" (file chuẩn từ th6.2026 trở đi): OTC1..OTC5, OTC6 = chuỗi
  'OTC1': 'DSM1', 'OTC2': 'DSM2', 'OTC3': 'DSM3', 'OTC4': 'DSM4', 'OTC5': 'DSM5', 'OTC6': 'CCO-Chuỗi',
};

function normDSM(nhomKH) {
  if (!nhomKH) return nhomKH;
  return DSM_MAP[nhomKH] || nhomKH;
}

function getWeekOfMonth(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
}

function filterDS(db, { nam, thang, dsm, tdv, tuan }) {
  let rows = db.doanh_so.filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4));
  if (dsm) rows = rows.filter(r => normDSM(r.ten_nhom_kh) === dsm);
  if (tdv) rows = rows.filter(r => r.ten_nhan_vien === tdv);
  if (tuan) rows = rows.filter(r => r.ngay_hach_toan && getWeekOfMonth(r.ngay_hach_toan) === parseInt(tuan));
  return rows;
}

// Map DSM key from doanh_so (DSM1, DSM3...) to chi_tieu nhan_vien (DSM 01, DSM 03...)
function normalizeDSMKey(dsm) {
  if (!dsm) return dsm;
  return dsm.replace(/^DSM(\d)$/, (_, n) => `DSM 0${n}`).replace(/^DSM(\d{2,})$/, (_, n) => `DSM ${n}`);
}

function getTargetsForLevel(db, { nam, thang, dsm, tdv }) {
  const namInt = parseInt(nam || 2026);
  const thangInt = parseInt(thang || 4);
  let rows = db.chi_tieu.filter(r => r.nam === namInt && r.thang === thangInt);

  if (tdv) {
    // TDV level: get target for specific TDV
    rows = rows.filter(r => r.nhan_vien === tdv);
  } else if (dsm) {
    // DSM level: get target for the DSM row only
    const dsmNorm = normalizeDSMKey(dsm);
    rows = rows.filter(r => r.nhan_vien === dsmNorm || r.nhan_vien === dsm);
  } else {
    // Total level: get only TỔNG KÊNH row
    rows = rows.filter(r => r.nhan_vien === 'TỔNG KÊNH');
  }

  const map = {};
  rows.forEach(r => { map[r.chi_so] = (map[r.chi_so] || 0) + (r.gia_tri || 0); });
  return map;
}

// Doanh số tiền về (nguồn cũ — Sổ Nhật ký chung): chỉ có ở mức Tổng Kênh, không tách được theo DSM/TDV.
// Chỉ còn dùng làm fallback cho các kỳ upload trước khi Sổ chi tiết bán hàng có cột "Tình trạng thu tiền".
function filterTienVe(db, { nam, thang }) {
  return db.tien_ve.filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4));
}

// Chuẩn mới: cột "Tình trạng thu tiền" trong Sổ chi tiết bán hàng cho biết trực tiếp từng dòng bán hàng
// đã được thu tiền vào tháng nào — nhờ vậy tính được Doanh số tiền về theo TỪNG TDV/DSM (không chỉ Tổng Kênh),
// và gộp đúng công nợ phát sinh tháng trước nhưng thu tiền ở tháng sau vào KPI của TDV ở tháng thu tiền.
// Luôn kiểm tra theo TỪNG KỲ (không phải toàn cục) — vì có thể kỳ này đã upload theo chuẩn mới nhưng
// kỳ khác vẫn chỉ có dữ liệu tiền về từ bảng cũ (Nhật ký chung), cần fallback riêng cho từng kỳ đó.
function hasNewThuTienForPeriod(db, namInt, thangInt) {
  return db.doanh_so.some(r => r.da_thu_tien === true && r.nam_thu_tien === namInt && r.thang_thu_tien === thangInt);
}

function filterTienVeV2(db, { nam, thang, dsm, tdv }) {
  const namInt = parseInt(nam || 2026);
  const thangInt = parseInt(thang || 4);
  return db.doanh_so.filter(r =>
    r.da_thu_tien === true &&
    r.nam_thu_tien === namInt &&
    r.thang_thu_tien === thangInt &&
    (!tdv || r.ten_nhan_vien === tdv) &&
    (!dsm || normDSM(r.ten_nhom_kh) === dsm)
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard/summary', async (req, res) => {
  const db = await loadDB();
  const dsRows = filterDS(db, req.query);
  const targets = getTargetsForLevel(db, req.query);

  const tongDSBanHang = dsRows.reduce((s, r) => s + (r.doanh_so_thuc_dat || 0), 0);
  const soDH = new Set(dsRows.map(r => r.so_chung_tu).filter(Boolean)).size;
  const soKH = new Set(dsRows.map(r => r.ten_khach_hang).filter(Boolean)).size;
  // SPTT thực hiện = tổng số lượng bán của sản phẩm trọng tâm (tính cả hàng khuyến mại/tặng)
  const spttThucHien = dsRows.filter(r => isSptt(r.ten_hang)).reduce((s, r) => s + (r.so_luong_ban || 0) + (r.sl_khuyen_mai || 0), 0);

  // Doanh số tiền về: ưu tiên chuẩn mới (cột "Tình trạng thu tiền" trong Sổ chi tiết bán hàng) —
  // tách được theo DSM/TDV. Chỉ dùng bảng tien_ve cũ (Tổng Kênh only) khi chưa có dữ liệu chuẩn mới.
  let tongTienVe = 0, coTienVe = false;
  const namQ = parseInt(req.query.nam || 2026), thangQ = parseInt(req.query.thang || 4);
  if (hasNewThuTienForPeriod(db, namQ, thangQ)) {
    const rowsV2 = filterTienVeV2(db, req.query);
    tongTienVe = rowsV2.reduce((s, r) => s + (r.doanh_so_thuc_dat || 0), 0);
    coTienVe = true;
  } else if (!req.query.dsm && !req.query.tdv) {
    const tienVeRows = filterTienVe(db, req.query);
    tongTienVe = tienVeRows.reduce((s, r) => s + (r.so_tien || 0), 0);
    coTienVe = tienVeRows.length > 0;
  }
  const tongDS = coTienVe ? tongTienVe : tongDSBanHang;

  res.json({
    doanh_so_thuc_hien: tongDS,
    doanh_so_ban_hang: tongDSBanHang,
    doanh_so_tien_ve: coTienVe ? tongTienVe : null,
    muc_tieu_ds: targets['Doanh số'] || 0,
    so_don_hang: soDH,
    muc_tieu_dh: targets['Số lượng đơn hàng'] || 0,
    so_khach_hang: soKH,
    muc_tieu_do_phu: targets['Số lượng độ phủ TB/THÁNG'] || 0,
    sptt_thuc_hien: spttThucHien,
    sptt_muc_tieu: targets['Sản phẩm trọng tâm'] || 0
  });
});

app.get('/api/dashboard/theo-dsm', async (req, res) => {
  const db = await loadDB();
  const { nam, thang } = req.query;

  // Group actual by DSM (ten_nhom_kh)
  const dsmMap = {};
  db.doanh_so
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4))
    .forEach(r => {
      const key = normDSM(r.ten_nhom_kh) || 'Khác'; // chuẩn hóa về DSM đúng
      if (!dsmMap[key]) dsmMap[key] = { ds: 0, dh: new Set(), kh: new Set() };
      dsmMap[key].ds += r.doanh_so_thuc_dat || 0;
      if (r.so_chung_tu) dsmMap[key].dh.add(r.so_chung_tu);
      if (r.ten_khach_hang) dsmMap[key].kh.add(r.ten_khach_hang);
    });

  // Get DSM-level targets (nhan_vien starts with DSM)
  const dsmTargets = {};
  db.chi_tieu
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4) && r.nhan_vien && r.nhan_vien.startsWith('DSM'))
    .forEach(r => {
      if (!dsmTargets[r.nhan_vien]) dsmTargets[r.nhan_vien] = {};
      dsmTargets[r.nhan_vien][r.chi_so] = r.gia_tri;
    });

  const result = Object.entries(dsmMap).map(([dsm, d]) => {
    const dsmKey = normalizeDSMKey(dsm);
    const target = dsmTargets[dsmKey] || dsmTargets[dsm] || {};
    const mucTieu = target['Doanh số'] || 0;
    return {
      dsm,
      thuc_hien: d.ds,
      muc_tieu: mucTieu,
      pct_ht: mucTieu > 0 ? Math.round((d.ds / mucTieu) * 1000) / 10 : 0,
      so_dh: d.dh.size,
      so_kh: d.kh.size
    };
  }).sort((a, b) => a.dsm.localeCompare(b.dsm));

  res.json(result);
});

app.get('/api/dashboard/theo-tdv', async (req, res) => {
  const db = await loadDB();
  const { nam, thang, dsm } = req.query;

  const tdvMap = {};
  db.doanh_so
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4) && (!dsm || normDSM(r.ten_nhom_kh) === dsm))
    .forEach(r => {
      const key = r.ten_nhan_vien || 'Khác';
      if (!tdvMap[key]) tdvMap[key] = { ds: 0, dh: new Set(), kh: new Set(), sptt: 0 };
      tdvMap[key].ds += r.doanh_so_thuc_dat || 0;
      if (r.so_chung_tu) tdvMap[key].dh.add(r.so_chung_tu);
      if (r.ten_khach_hang) tdvMap[key].kh.add(r.ten_khach_hang);
      if (isSptt(r.ten_hang)) tdvMap[key].sptt += (r.so_luong_ban || 0) + (r.sl_khuyen_mai || 0);
    });

  const ctMap = {};
  db.chi_tieu
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4))
    .filter(r => r.nhan_vien && !r.nhan_vien.startsWith('DSM') && !r.nhan_vien.startsWith('TỔNG'))
    .forEach(r => {
      if (!ctMap[r.nhan_vien]) ctMap[r.nhan_vien] = {};
      ctMap[r.nhan_vien][r.chi_so] = r.gia_tri;
    });

  const result = Object.entries(tdvMap).map(([tdv, d]) => {
    const t = ctMap[tdv] || {};
    const mucTieu = t['Doanh số'] || 0;
    return {
      tdv,
      thuc_hien: d.ds,
      muc_tieu: mucTieu,
      pct_ht: mucTieu > 0 ? Math.round((d.ds / mucTieu) * 1000) / 10 : 0,
      so_dh: d.dh.size,
      so_kh: d.kh.size,
      sptt_thuc_hien: d.sptt,
      muc_tieu_dh: t['Số lượng đơn hàng'] || 0,
      muc_tieu_do_phu: t['Số lượng độ phủ TB/THÁNG'] || 0,
      muc_tieu_sptt: t['Sản phẩm trọng tâm'] || 0
    };
  }).sort((a, b) => b.thuc_hien - a.thuc_hien);

  res.json(result);
});

app.get('/api/dashboard/trend-tuan', async (req, res) => {
  const db = await loadDB();
  const rows = filterDS(db, req.query);

  const weeks = {};
  rows.forEach(r => {
    if (!r.ngay_hach_toan) return;
    const w = getWeekOfMonth(r.ngay_hach_toan);
    if (w < 1 || w > 5) return;
    if (!weeks[w]) weeks[w] = { ds: 0, dh: new Set(), kh: new Set() };
    weeks[w].ds += r.doanh_so_thuc_dat || 0;
    if (r.so_chung_tu) weeks[w].dh.add(r.so_chung_tu);
    if (r.ten_khach_hang) weeks[w].kh.add(r.ten_khach_hang);
  });

  const result = [1, 2, 3, 4, 5].map(w => ({
    tuan: w,
    label: `Tuần ${w}`,
    doanh_so: weeks[w]?.ds || 0,
    so_dh: weeks[w]?.dh.size || 0,
    so_kh: weeks[w]?.kh.size || 0
  }));

  res.json(result);
});

// Metadata for filters
app.get('/api/metadata/nam-thang', async (req, res) => {
  const db = await loadDB();
  const periods = [...new Set(db.doanh_so.map(r => `${r.nam}-${r.thang}`))].sort().map(s => {
    const [nam, thang] = s.split('-');
    return { nam: parseInt(nam), thang: parseInt(thang) };
  });
  res.json(periods);
});

app.get('/api/metadata/dsm', async (req, res) => {
  const db = await loadDB();
  const { nam, thang } = req.query;
  const dsms = [...new Set(
    db.doanh_so
      .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4))
      .map(r => normDSM(r.ten_nhom_kh)).filter(Boolean)
  )].sort();
  res.json(dsms);
});

app.get('/api/metadata/tdv', async (req, res) => {
  const db = await loadDB();
  const { nam, thang, dsm } = req.query;
  const tdvs = [...new Set(
    db.doanh_so
      .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4) && (!dsm || normDSM(r.ten_nhom_kh) === dsm))
      .map(r => r.ten_nhan_vien).filter(Boolean)
  )].sort();
  res.json(tdvs);
});

// Chi tiết giao dịch
app.get('/api/giao-dich', async (req, res) => {
  const db = await loadDB();
  const { page = 1, limit = 50 } = req.query;
  let rows = filterDS(db, req.query);
  rows.sort((a, b) => (b.ngay_hach_toan || '').localeCompare(a.ngay_hach_toan || ''));
  const total = rows.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  res.json({ total, data: rows.slice(start, start + parseInt(limit)) });
});

// ─── TRANG MỤC TIÊU: pivot table ─────────────────────────────────────────────
app.get('/api/muc-tieu', async (req, res) => {
  const db = await loadDB();
  const { nam, thang } = req.query;
  const namInt = parseInt(nam || 2026);
  const thangInt = parseInt(thang || 4); // 0 = cả năm

  // Khi thang=0: lấy tháng 1 để lấy parent_dsm/nhom, nhưng dùng chi_tieu_nam làm gia_tri
  const filterThang = thangInt === 0 ? 1 : thangInt;
  const rows = db.chi_tieu.filter(r => r.nam === namInt && r.thang === filterThang);

  // Pivot: map[nhan_vien] → object chứa tất cả chi_so
  const pivot = {};
  const allChiSo = new Set();

  rows.forEach(r => {
    const nv = r.nhan_vien;
    // Khi cả năm: dùng chi_tieu_nam thay gia_tri
    const giaTriHienThi = thangInt === 0 ? r.chi_tieu_nam : r.gia_tri;
    if (!pivot[nv]) pivot[nv] = {
      nhan_vien: nv,
      nhom: r.nhom,
      parent_dsm: r.parent_dsm || null,
      nguon: r.nguon
    };
    pivot[nv][r.chi_so] = giaTriHienThi;
    pivot[nv][r.chi_so + '_nam'] = r.chi_tieu_nam;
    allChiSo.add(r.chi_so);
  });

  // Xây thứ tự: TỔNG KÊNH → DSM 01 → [TDV của DSM01] → DSM 02 → [TDV DSM02] → ...
  const DSM_ORDER = ['DSM 01', 'DSM 02', 'DSM 03', 'DSM 04', 'DSM 5', 'CCO'];
  const result = [];

  // 1. TỔNG KÊNH đầu tiên
  if (pivot['TỔNG KÊNH']) result.push(pivot['TỔNG KÊNH']);

  // 2. Từng DSM theo thứ tự, sau đó TDV trực thuộc
  const allDSMs = [...new Set(
    Object.values(pivot)
      .filter(r => !r.parent_dsm && r.nhan_vien !== 'TỔNG KÊNH')
      .map(r => r.nhan_vien)
  )];

  // Sắp xếp DSM theo DSM_ORDER, DSM không có trong list thì để cuối
  const sortedDSMs = [
    ...DSM_ORDER.filter(d => allDSMs.includes(d)),
    ...allDSMs.filter(d => !DSM_ORDER.includes(d)).sort()
  ];

  for (const dsm of sortedDSMs) {
    if (pivot[dsm]) result.push({ ...pivot[dsm], is_dsm: true });

    // TDV thuộc DSM này (parent_dsm === dsm), giữ nguyên thứ tự trong file
    const tdvs = rows
      .filter(r => r.parent_dsm === dsm && r.chi_so === (rows.find(x => x.parent_dsm === dsm)?.chi_so))
      .map(r => r.nhan_vien)
      .filter((v, i, a) => a.indexOf(v) === i); // unique, giữ thứ tự

    // Lấy TDV theo thứ tự id gốc
    const tdvOrdered = [...new Set(
      rows.filter(r => r.parent_dsm === dsm).map(r => r.nhan_vien)
    )];

    for (const tdv of tdvOrdered) {
      if (pivot[tdv]) result.push({ ...pivot[tdv], is_tdv: true });
    }
  }

  // Chỉ số theo thứ tự ưu tiên
  const chiSoOrder = ['Doanh số', 'Số lượng đơn hàng', 'Giá trị trung bình đơn hàng', 'Số lượng độ phủ TB/THÁNG', 'Sản phẩm trọng tâm'];
  const orderedChiSo = [
    ...chiSoOrder.filter(c => allChiSo.has(c)),
    ...[...allChiSo].filter(c => !chiSoOrder.includes(c)).sort()
  ];

  res.json({ rows: result, chi_so_list: orderedChiSo });
});

// ─── KPI THỰC ĐẠT ────────────────────────────────────────────────────────────
const TMAP = JSON.parse(require('fs').readFileSync(path.join(__dirname, 'territory_map.json'), 'utf-8'));

function getDSMofTDV(tdvName, tinhTP) {
  if (!tdvName) return null;
  const name = tdvName.trim();
  // 1. Tra trực tiếp trong tdv_to_dsm
  if (TMAP.tdv_to_dsm[name]) return TMAP.tdv_to_dsm[name];
  // 2. Fuzzy: tìm key nào là substring của name hoặc ngược lại
  for (const [k, v] of Object.entries(TMAP.tdv_to_dsm)) {
    const kn = k.toLowerCase(); const nn = name.toLowerCase();
    if (nn.includes(kn) || kn.includes(nn)) return v;
  }
  // 3. Fallback: dùng tỉnh/thành phố
  if (tinhTP && TMAP.province_to_dsm[tinhTP.trim()]) return TMAP.province_to_dsm[tinhTP.trim()];
  return null;
}

// Chuyển tên TDV trong Sổ chi tiết bán hàng (BCBH) sang đúng tên trong bảng Mục Tiêu KPI (chi_tieu).
// Một số file BCBH (VD: mẫu chuẩn mới) chỉ ghi tên ngắn không kèm địa bàn (VD "Trung Kiên"), trong khi
// Mục Tiêu KPI lưu tên đầy đủ kèm địa bàn (VD "Trung Kiên - YB") — nếu không có trong bảng ánh xạ cố định
// tdv_name_to_chitieu thì dò gần đúng theo danh sách tên thực tế đang có trong Mục Tiêu KPI của kỳ đó.
function normNewline(s) {
  if (!s) return s;
  return String(s).replace(/\r\n/g, '\n');
}

function normTDVName(bcbhName, ctNames) {
  if (!bcbhName) return bcbhName;
  const n = bcbhName.trim();
  if (TMAP.tdv_name_to_chitieu[n]) return TMAP.tdv_name_to_chitieu[n];
  if (ctNames && ctNames.length) {
    const nLower = n.toLowerCase();
    const match = ctNames.find(c => {
      const cLower = c.trim().toLowerCase();
      return cLower === nLower || cLower.startsWith(nLower + ' ') || cLower.startsWith(nLower + '-');
    });
    if (match) return match;
  }
  return n;
}

// Tính bảng KPI Thực Đạt (Tổng Kênh → DSM → TDV) cho 1 kỳ — dùng chung cho endpoint JSON và endpoint xuất Excel.
function computeKpiThucDat(db, namInt, thangInt) {
  const newFormat = hasNewThuTienForPeriod(db, namInt, thangInt);

  // Lọc giao dịch PHÁT SINH trong tháng (doanh số bán hàng)
  const rows = db.doanh_so.filter(r => r.nam === namInt && r.thang === thangInt);

  // Build cấu trúc: dsmData[dsm][tdv] = { ds, dh, kh, sptt, tien_ve }
  const dsmData = {};
  function ensureTdv(dsm, tdv) {
    if (!dsmData[dsm]) dsmData[dsm] = {};
    if (!dsmData[dsm][tdv]) dsmData[dsm][tdv] = { ds: 0, dh: new Set(), kh: new Set(), sptt: 0, tien_ve: 0 };
    return dsmData[dsm][tdv];
  }

  for (const r of rows) {
    const dsm = getDSMofTDV(r.ten_nhan_vien, r.tinh_thanh_pho) || 'Khác';
    const tdvBCBH = r.ten_nhan_vien || 'Khác';
    const d = ensureTdv(dsm, tdvBCBH);
    d.ds += r.doanh_so_thuc_dat || 0;
    if (r.so_chung_tu) d.dh.add(r.so_chung_tu);
    if (r.ten_khach_hang) d.kh.add(r.ten_khach_hang);
    if (isSptt(r.ten_hang)) d.sptt += (r.so_luong_ban || 0) + (r.sl_khuyen_mai || 0);
  }

  // Bổ sung doanh số THU TIỀN trong tháng (chuẩn mới, cột "Tình trạng thu tiền") — có thể đến từ
  // giao dịch phát sinh ở tháng khác (VD: bán T5, thu tiền T7 → tính vào KPI T7 của đúng TDV đó).
  // Vì vậy phải quét TOÀN BỘ doanh_so chứ không chỉ giao dịch phát sinh trong tháng đang xem.
  if (newFormat) {
    for (const r of db.doanh_so) {
      if (r.da_thu_tien === true && r.nam_thu_tien === namInt && r.thang_thu_tien === thangInt) {
        const dsm = getDSMofTDV(r.ten_nhan_vien, r.tinh_thanh_pho) || 'Khác';
        const tdvBCBH = r.ten_nhan_vien || 'Khác';
        ensureTdv(dsm, tdvBCBH).tien_ve += r.doanh_so_thuc_dat || 0;
      }
    }
  }

  // Lấy targets từ chi_tieu — chuẩn hóa \r\n thành \n vì tên nhiều dòng (VD "CTV Hà Tĩnh\nCTV ...")
  // có thể lưu khác xuống dòng giữa file Excel gốc và bảng ánh xạ territory_map.json
  const ctRows = db.chi_tieu.filter(r => r.nam === namInt && r.thang === thangInt);
  const ctMap = {};
  ctRows.forEach(r => {
    const nv = normNewline(r.nhan_vien);
    if (!ctMap[nv]) ctMap[nv] = {};
    ctMap[nv][r.chi_so] = r.gia_tri;
  });

  const ctNameList = Object.keys(ctMap);
  function getTarget(tdvBCBH) {
    const ctName = normNewline(normTDVName(tdvBCBH, ctNameList));
    return ctMap[ctName] || ctMap[normNewline(tdvBCBH)] || {};
  }

  function pct(actual, target) {
    if (!target || target === 0) return null;
    return Math.round(actual / target * 1000) / 10;
  }

  // Build kết quả theo thứ tự DSM
  const result = [];
  let tongKenhDS = 0, tongKenhTienVe = 0, tongKenhDH = new Set(), tongKenhKH = new Set(), tongKenhSPTT = 0;

  for (const dsmKey of TMAP.dsm_order) {
    const dsmInfo = TMAP.dsm_groups[dsmKey];
    if (!dsmInfo) continue;

    const tdvMap = dsmData[dsmKey] || {};

    // DSM target: lấy từ chi_tieu cấp DSM
    const dsmCTKey = dsmKey === 'DSM1' ? 'DSM 01'
      : dsmKey === 'DSM2' ? 'DSM 02'
      : dsmKey === 'DSM3' ? 'DSM 03'
      : dsmKey === 'OTC4' ? 'DSM 04'
      : dsmKey === 'DSM5' ? 'DSM 5'
      : 'CCO';
    const dsmTarget = ctMap[dsmCTKey] || {};

    // Tính tổng DSM từ các TDV
    let dsmDS = 0, dsmTienVe = 0, dsmDH = new Set(), dsmKH = new Set(), dsmSPTT = 0;
    const tdvRows = [];

    for (const [tdvBCBH, d] of Object.entries(tdvMap)) {
      const t = getTarget(tdvBCBH);
      const dsBanHang = d.ds, dsTienVe = d.tien_ve, dh = d.dh.size, kh = d.kh.size, sptt = d.sptt;
      // GTTB (giá trị TB/đơn) là chỉ số vận hành theo giao dịch phát sinh — luôn tính theo doanh số bán hàng
      const gttb = dh > 0 ? Math.round(dsBanHang / dh) : 0;
      // KPI Doanh số chính: dùng tiền về khi đã có dữ liệu chuẩn mới, nếu không thì dùng doanh số bán hàng như cũ
      const dsKPI = newFormat ? dsTienVe : dsBanHang;

      dsmDS += dsBanHang; dsmTienVe += dsTienVe;
      d.dh.forEach(x => dsmDH.add(x)); d.kh.forEach(x => dsmKH.add(x)); dsmSPTT += sptt;
      tongKenhDS += dsBanHang; tongKenhTienVe += dsTienVe;
      d.dh.forEach(x => tongKenhDH.add(x)); d.kh.forEach(x => tongKenhKH.add(x)); tongKenhSPTT += sptt;

      tdvRows.push({
        level: 'tdv', dsm: dsmKey, dsm_label: dsmInfo.label,
        name: tdvBCBH, name_chitieu: normTDVName(tdvBCBH, ctNameList),
        ds: dsKPI, doanh_so_ban_hang: dsBanHang, doanh_so_tien_ve: newFormat ? dsTienVe : null,
        dh, kh, sptt, gttb,
        mt_ds: t['Doanh số'] || 0,
        mt_dh: t['Số lượng đơn hàng'] || 0,
        mt_kh: t['Số lượng độ phủ TB/THÁNG'] || 0,
        mt_sptt: t['Sản phẩm trọng tâm'] || 0,
        mt_gttb: t['Giá trị trung bình đơn hàng'] || 0,
        pct_ds: pct(dsKPI, t['Doanh số']),
        pct_dh: pct(dh, t['Số lượng đơn hàng']),
        pct_kh: pct(kh, t['Số lượng độ phủ TB/THÁNG']),
        pct_sptt: pct(sptt, t['Sản phẩm trọng tâm']),
        pct_gttb: pct(gttb, t['Giá trị trung bình đơn hàng']),
      });
    }

    if (Object.keys(tdvMap).length === 0 && !dsmTarget['Doanh số']) continue;

    const dsmDH_n = dsmDH.size, dsmKH_n = dsmKH.size;
    const dsmGTTB = dsmDH_n > 0 ? Math.round(dsmDS / dsmDH_n) : 0;
    const dsmKPI = newFormat ? dsmTienVe : dsmDS;

    result.push({
      level: 'dsm', dsm: dsmKey, dsm_label: dsmInfo.label, name: dsmInfo.label,
      ds: dsmKPI, doanh_so_ban_hang: dsmDS, doanh_so_tien_ve: newFormat ? dsmTienVe : null,
      dh: dsmDH_n, kh: dsmKH_n, sptt: dsmSPTT, gttb: dsmGTTB,
      mt_ds: dsmTarget['Doanh số'] || 0,
      mt_dh: dsmTarget['Số lượng đơn hàng'] || 0,
      mt_kh: dsmTarget['Số lượng độ phủ TB/THÁNG'] || 0,
      mt_sptt: dsmTarget['Sản phẩm trọng tâm'] || 0,
      mt_gttb: dsmTarget['Giá trị trung bình đơn hàng'] || 0,
      pct_ds: pct(dsmKPI, dsmTarget['Doanh số']),
      pct_dh: pct(dsmDH_n, dsmTarget['Số lượng đơn hàng']),
      pct_kh: pct(dsmKH_n, dsmTarget['Số lượng độ phủ TB/THÁNG']),
      pct_sptt: pct(dsmSPTT, dsmTarget['Sản phẩm trọng tâm']),
      pct_gttb: pct(dsmGTTB, dsmTarget['Giá trị trung bình đơn hàng']),
    });
    result.push(...tdvRows.sort((a, b) => b.ds - a.ds));
  }

  // Tổng kênh
  const tkDH = tongKenhDH.size, tkKH = tongKenhKH.size;
  const tkGTTB = tkDH > 0 ? Math.round(tongKenhDS / tkDH) : 0;
  const tkTarget = ctMap['TỔNG KÊNH'] || {};

  // Doanh số tiền về Tổng Kênh: chuẩn mới = tổng tiền về đã tính theo từng TDV ở trên (chính xác hơn,
  // vì gộp đúng công nợ tháng trước thu vào tháng này). Fallback bảng tien_ve cũ nếu chưa có dữ liệu chuẩn mới.
  let tongTienVeFinal = tongKenhTienVe;
  let coTienVe = newFormat;
  if (!newFormat) {
    const tienVeRowsLegacy = db.tien_ve.filter(r => r.nam === namInt && r.thang === thangInt);
    tongTienVeFinal = tienVeRowsLegacy.reduce((s, r) => s + (r.so_tien || 0), 0);
    coTienVe = tienVeRowsLegacy.length > 0;
  }
  const dsKPI = coTienVe ? tongTienVeFinal : tongKenhDS;

  result.unshift({
    level: 'total', name: 'TỔNG KÊNH OTC',
    ds: dsKPI, doanh_so_ban_hang: tongKenhDS, doanh_so_tien_ve: coTienVe ? tongTienVeFinal : null,
    dh: tkDH, kh: tkKH, sptt: tongKenhSPTT, gttb: tkGTTB,
    mt_ds: tkTarget['Doanh số'] || 0, mt_dh: tkTarget['Số lượng đơn hàng'] || 0,
    mt_kh: tkTarget['Số lượng độ phủ TB/THÁNG'] || 0,
    mt_sptt: tkTarget['Sản phẩm trọng tâm'] || 0,
    mt_gttb: tkTarget['Giá trị trung bình đơn hàng'] || 0,
    pct_ds: pct(dsKPI, tkTarget['Doanh số']),
    pct_dh: pct(tkDH, tkTarget['Số lượng đơn hàng']),
    pct_kh: pct(tkKH, tkTarget['Số lượng độ phủ TB/THÁNG']),
    pct_sptt: pct(tongKenhSPTT, tkTarget['Sản phẩm trọng tâm']),
    pct_gttb: pct(tkGTTB, tkTarget['Giá trị trung bình đơn hàng']),
  });

  return result;
}

app.get('/api/kpi-thuc-dat', async (req, res) => {
  const db = await loadDB();
  const { nam, thang } = req.query;
  const namInt = parseInt(nam || 2026);
  const thangInt = parseInt(thang || 4);
  res.json(computeKpiThucDat(db, namInt, thangInt));
});

// ─── XUẤT EXCEL KPI THỰC ĐẠT ──────────────────────────────────────────────
const KPI_EXPORT_COLS = [
  { key: 'ds', label: 'Doanh số' },
  { key: 'dh', label: 'Đơn hàng' },
  { key: 'kh', label: 'Độ phủ (KH)' },
  { key: 'gttb', label: 'GT TB Đơn' },
  { key: 'sptt', label: 'SPTT (hộp)' },
];

function safeSheetName(name) {
  return String(name || '').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

function removeDiacritics(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// Bảng KPI (Tổng/DSM/TDV) → mảng 2 dòng header + dữ liệu, dùng chung cho sheet DSM và sheet Tóm tắt TDV
function kpiRowsToSheet(rows, nameCol) {
  const header1 = [...nameCol];
  const header2 = nameCol.map(() => '');
  KPI_EXPORT_COLS.forEach(c => { header1.push(c.label, '', ''); header2.push('Thực hiện', 'Mục tiêu', '% HT'); });
  const data = [header1, header2];
  rows.forEach(r => {
    const row = nameCol.length > 1 ? [r.name, r.dsm_label || ''] : [r.level === 'tdv' ? '    ' + r.name : r.name];
    KPI_EXPORT_COLS.forEach(c => {
      const pct = r['pct_' + c.key];
      row.push(r[c.key] ?? 0, r['mt_' + c.key] ?? 0, pct != null ? pct + '%' : '');
    });
    data.push(row);
  });
  return XLSX.utils.aoa_to_sheet(data);
}

app.get('/api/kpi-thuc-dat/export', async (req, res) => {
  const db = await loadDB();
  const { nam, thang, loai, pham_vi } = req.query;
  const namInt = parseInt(nam || 2026);
  const thangInt = parseInt(thang || 4);
  const allRows = computeKpiThucDat(db, namInt, thangInt);
  const wb = XLSX.utils.book_new();

  if (loai === 'dsm') {
    const dsmKeys = pham_vi && pham_vi !== 'all' ? [pham_vi] : TMAP.dsm_order;
    dsmKeys.forEach(dsmKey => {
      const dsmRow = allRows.find(r => r.level === 'dsm' && r.dsm === dsmKey);
      if (!dsmRow) return;
      const tdvRows = allRows.filter(r => r.level === 'tdv' && r.dsm === dsmKey);
      const ws = kpiRowsToSheet([dsmRow, ...tdvRows], ['Tên / Địa bàn']);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName(dsmRow.dsm_label || dsmKey));
    });
    if (wb.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Không có dữ liệu cho kỳ/DSM đã chọn']]), 'Trống');
    }
  } else if (loai === 'tdv') {
    let tdvRows = allRows.filter(r => r.level === 'tdv');
    if (pham_vi && pham_vi !== 'all') tdvRows = tdvRows.filter(r => r.name === pham_vi);

    const wsSummary = kpiRowsToSheet(tdvRows, ['TDV', 'DSM']);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tóm tắt KPI');

    const tdvNameSet = new Set(tdvRows.map(r => r.name));
    let dsRows = db.doanh_so.filter(r => r.nam === namInt && r.thang === thangInt);
    dsRows = (pham_vi && pham_vi !== 'all')
      ? dsRows.filter(r => r.ten_nhan_vien === pham_vi)
      : dsRows.filter(r => tdvNameSet.has(r.ten_nhan_vien || 'Khác'));
    dsRows = [...dsRows].sort((a, b) => (a.ngay_hach_toan || '').localeCompare(b.ngay_hach_toan || ''));

    const detailData = [['Tên nhân viên', 'Ngày hạch toán', 'Số chứng từ', 'Mã khách hàng', 'Tên khách hàng', 'Tỉnh/Thành phố', 'Tên hàng', 'Số lượng bán', 'SL khuyến mại', 'Đơn giá', 'Doanh số bán', 'Doanh số thực đạt', 'Tình trạng thu tiền']];
    dsRows.forEach(r => detailData.push([
      r.ten_nhan_vien || '', r.ngay_hach_toan || '', r.so_chung_tu || '', r.ma_khach_hang || '',
      r.ten_khach_hang || '', r.tinh_thanh_pho || '', r.ten_hang || '', r.so_luong_ban || 0,
      r.sl_khuyen_mai || 0, r.don_gia || 0, r.doanh_so_ban || 0, r.doanh_so_thuc_dat || 0,
      r.tinh_trang_thu_tien || ''
    ]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailData), 'Chi tiết giao dịch');
  } else {
    return res.status(400).json({ error: 'Thiếu tham số loai (dsm|tdv)' });
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const phamViPart = (pham_vi && pham_vi !== 'all') ? `${removeDiacritics(pham_vi).replace(/\s+/g, '')}_` : '';
  const fileName = `KPI_ThucDat_${loai === 'dsm' ? 'DSM' : 'TDV'}_${phamViPart}T${thangInt}-${namInt}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buf);
});

// Mọi route không phải /api → trả về React app
app.get('*', async (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

const PORT = 5173;
app.listen(PORT, () => console.log(`✅ KPI OTC Dashboard: http://localhost:${PORT}`));
