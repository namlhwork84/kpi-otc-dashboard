const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');
const CT_FILE = path.join(__dirname, 'chi_tieu.json'); // File riêng, bảo vệ mục tiêu

// ─── Chi tiêu (bảng mục tiêu) — lưu riêng, không bao giờ xóa nhầm ──────────
function loadChiTieu() {
  if (!fs.existsSync(CT_FILE)) return { records: [], nextId: 1 };
  try { return JSON.parse(fs.readFileSync(CT_FILE, 'utf-8')); }
  catch { return { records: [], nextId: 1 }; }
}

function saveChiTieu(data) {
  fs.writeFileSync(CT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Doanh số + Uploads — lưu trong data.json ────────────────────────────────
function loadDB() {
  const ct = loadChiTieu();
  let main = { doanh_so: [], uploads: [], nextId: { doanh_so: 1, uploads: 1 } };

  if (fs.existsSync(DB_FILE)) {
    try { main = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
    catch {}
  }

  // Gộp chi_tieu vào để các endpoint dùng chung cấu trúc cũ
  return {
    chi_tieu: ct.records || [],
    doanh_so: main.doanh_so || [],
    uploads: main.uploads || [],
    nextId: {
      chi_tieu: ct.nextId || 1,
      doanh_so: main.nextId?.doanh_so || 1,
      uploads: main.nextId?.uploads || 1,
    },
    users: main.users || getDefaultUsers()
  };
}

function saveDB(data) {
  // Lưu chi_tieu vào file riêng
  saveChiTieu({ records: data.chi_tieu || [], nextId: data.nextId?.chi_tieu || 1 });

  // Lưu phần còn lại vào data.json (không có chi_tieu)
  const main = {
    doanh_so: data.doanh_so || [],
    uploads: data.uploads || [],
    nextId: { doanh_so: data.nextId?.doanh_so || 1, uploads: data.nextId?.uploads || 1 },
    users: data.users || getDefaultUsers()
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(main, null, 2), 'utf-8');
}

function getDefaultUsers() {
  return [
    { id: 1, username: 'admin', password: 'admin123', role: 'admin', dsm: null, full_name: 'Administrator' },
    { id: 2, username: 'dsm01', password: 'dsm01', role: 'dsm', dsm: 'DSM1', full_name: 'DSM 01' }
  ];
}

// Khởi tạo nếu chưa có
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ doanh_so: [], uploads: [], nextId: { doanh_so: 1, uploads: 1 }, users: getDefaultUsers() }, null, 2), 'utf-8');
}

module.exports = { loadDB, saveDB };
