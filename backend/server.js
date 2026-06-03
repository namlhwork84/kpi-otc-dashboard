const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { loadDB, saveDB } = require('./db');
const { parseChiTieuSPTT, parseDuLieu } = require('./parser');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ─── AUTH ────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.get('/api/users', (req, res) => {
  const db = loadDB();
  res.json(db.users.map(({ password: _, ...u }) => u));
});

app.post('/api/users', (req, res) => {
  const db = loadDB();
  const { username, password, role, dsm, full_name } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username đã tồn tại' });
  }
  const newUser = { id: db.nextId.users++, username, password, role, dsm: dsm || null, full_name };
  db.users.push(newUser);
  saveDB(db);
  const { password: _, ...safeUser } = newUser;
  res.json(safeUser);
});

app.put('/api/users/:id', (req, res) => {
  const db = loadDB();
  const id = parseInt(req.params.id);
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy user' });
  const { password, role, dsm, full_name } = req.body;
  if (password) db.users[idx].password = password;
  if (role) db.users[idx].role = role;
  if (dsm !== undefined) db.users[idx].dsm = dsm;
  if (full_name) db.users[idx].full_name = full_name;
  saveDB(db);
  res.json({ ok: true });
});

app.delete('/api/users/:id', (req, res) => {
  const db = loadDB();
  const id = parseInt(req.params.id);
  db.users = db.users.filter(u => u.id !== id || u.username === 'admin');
  saveDB(db);
  res.json({ ok: true });
});

// ─── UPLOAD ──────────────────────────────────────────────────────────────────
app.post('/api/upload/chi-tieu', upload.single('file'), (req, res) => {
  try {
    const db = loadDB();
    const nam = parseInt(req.body.nam);
    const thang = parseInt(req.body.thang);
    const nguon = req.body.nguon || 'sptt';

    // Xóa toàn bộ năm đó (vì parse 12 tháng cùng lúc)
    db.chi_tieu = db.chi_tieu.filter(r => !(r.nam === nam && (r.nguon || 'sptt') === nguon));

    const parseFn = nguon === 'ke_hoach' ? parseChiTieuKeHoach : parseChiTieuSPTT;
    const records = parseFn(req.file.buffer, nam, thang);
    records.forEach(r => { r.id = db.nextId.chi_tieu++; r.nguon = nguon; });
    db.chi_tieu.push(...records);

    const uploadId = db.nextId.uploads++;
    db.uploads.push({ id: uploadId, file_name: req.file.originalname, file_type: 'chi_tieu', nam, thang: 0, created_at: new Date().toISOString() });

    saveDB(db);
    res.json({ ok: true, count: records.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload/doanh-so', upload.single('file'), (req, res) => {
  try {
    const db = loadDB();
    const nam = parseInt(req.body.nam);
    const thang = parseInt(req.body.thang);

    db.doanh_so = db.doanh_so.filter(r => !(r.nam === nam && r.thang === thang));

    const records = parseDuLieu(req.file.buffer, nam, thang);
    records.forEach(r => { r.id = db.nextId.doanh_so++; });
    db.doanh_so.push(...records);

    const uploadId = db.nextId.uploads++;
    db.uploads.push({ id: uploadId, file_name: req.file.originalname, file_type: 'doanh_so', nam, thang, created_at: new Date().toISOString() });

    saveDB(db);
    res.json({ ok: true, count: records.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/uploads', (req, res) => {
  const db = loadDB();
  res.json(db.uploads.slice(-20).reverse());
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getWeekOfMonth(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + firstDay.getDay()) / 7);
}

function filterDS(db, { nam, thang, dsm, tdv, tuan }) {
  let rows = db.doanh_so.filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4));
  if (dsm) rows = rows.filter(r => r.ten_nhom_kh === dsm);
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

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
app.get('/api/dashboard/summary', (req, res) => {
  const db = loadDB();
  const dsRows = filterDS(db, req.query);
  const targets = getTargetsForLevel(db, req.query);

  const tongDS = dsRows.reduce((s, r) => s + (r.doanh_so_thuc_dat || 0), 0);
  const soDH = new Set(dsRows.map(r => r.so_chung_tu).filter(Boolean)).size;
  const soKH = new Set(dsRows.map(r => r.ten_khach_hang).filter(Boolean)).size;

  res.json({
    doanh_so_thuc_hien: tongDS,
    muc_tieu_ds: targets['Doanh số'] || 0,
    so_don_hang: soDH,
    muc_tieu_dh: targets['Số lượng đơn hàng'] || 0,
    so_khach_hang: soKH,
    muc_tieu_do_phu: targets['Số lượng độ phủ TB/THÁNG'] || 0,
    sptt_muc_tieu: targets['Sản phẩm trọng tâm'] || 0
  });
});

app.get('/api/dashboard/theo-dsm', (req, res) => {
  const db = loadDB();
  const { nam, thang } = req.query;

  // Group actual by DSM (ten_nhom_kh)
  const dsmMap = {};
  db.doanh_so
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4))
    .forEach(r => {
      const key = r.ten_nhom_kh || 'Khác';
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

app.get('/api/dashboard/theo-tdv', (req, res) => {
  const db = loadDB();
  const { nam, thang, dsm } = req.query;

  const tdvMap = {};
  db.doanh_so
    .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4) && (!dsm || r.ten_nhom_kh === dsm))
    .forEach(r => {
      const key = r.ten_nhan_vien || 'Khác';
      if (!tdvMap[key]) tdvMap[key] = { ds: 0, dh: new Set(), kh: new Set() };
      tdvMap[key].ds += r.doanh_so_thuc_dat || 0;
      if (r.so_chung_tu) tdvMap[key].dh.add(r.so_chung_tu);
      if (r.ten_khach_hang) tdvMap[key].kh.add(r.ten_khach_hang);
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
      muc_tieu_dh: t['Số lượng đơn hàng'] || 0,
      muc_tieu_do_phu: t['Số lượng độ phủ TB/THÁNG'] || 0,
      muc_tieu_sptt: t['Sản phẩm trọng tâm'] || 0
    };
  }).sort((a, b) => b.thuc_hien - a.thuc_hien);

  res.json(result);
});

app.get('/api/dashboard/trend-tuan', (req, res) => {
  const db = loadDB();
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
app.get('/api/metadata/nam-thang', (req, res) => {
  const db = loadDB();
  const periods = [...new Set(db.doanh_so.map(r => `${r.nam}-${r.thang}`))].sort().map(s => {
    const [nam, thang] = s.split('-');
    return { nam: parseInt(nam), thang: parseInt(thang) };
  });
  res.json(periods);
});

app.get('/api/metadata/dsm', (req, res) => {
  const db = loadDB();
  const { nam, thang } = req.query;
  const dsms = [...new Set(
    db.doanh_so
      .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4))
      .map(r => r.ten_nhom_kh).filter(Boolean)
  )].sort();
  res.json(dsms);
});

app.get('/api/metadata/tdv', (req, res) => {
  const db = loadDB();
  const { nam, thang, dsm } = req.query;
  const tdvs = [...new Set(
    db.doanh_so
      .filter(r => r.nam === parseInt(nam || 2026) && r.thang === parseInt(thang || 4) && (!dsm || r.ten_nhom_kh === dsm))
      .map(r => r.ten_nhan_vien).filter(Boolean)
  )].sort();
  res.json(tdvs);
});

// Chi tiết giao dịch
app.get('/api/giao-dich', (req, res) => {
  const db = loadDB();
  const { page = 1, limit = 50 } = req.query;
  let rows = filterDS(db, req.query);
  rows.sort((a, b) => (b.ngay_hach_toan || '').localeCompare(a.ngay_hach_toan || ''));
  const total = rows.length;
  const start = (parseInt(page) - 1) * parseInt(limit);
  res.json({ total, data: rows.slice(start, start + parseInt(limit)) });
});

// ─── TRANG MỤC TIÊU: pivot table ─────────────────────────────────────────────
app.get('/api/muc-tieu', (req, res) => {
  const db = loadDB();
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

const PORT = 3001;
app.listen(PORT, () => console.log(`✅ Backend: http://localhost:${PORT}`));
