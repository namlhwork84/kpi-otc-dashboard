const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return getDefaultDB();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return getDefaultDB();
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getDefaultDB() {
  return {
    users: [
      { id: 1, username: 'admin', password: 'admin123', role: 'admin', dsm: null, full_name: 'Administrator' },
      { id: 2, username: 'dsm01', password: 'dsm01', role: 'dsm', dsm: 'DSM1', full_name: 'DSM 01' }
    ],
    chi_tieu: [],
    doanh_so: [],
    uploads: [],
    nextId: { users: 3, chi_tieu: 1, doanh_so: 1, uploads: 1 }
  };
}

// Initialize DB file if not exists
if (!fs.existsSync(DB_FILE)) {
  saveDB(getDefaultDB());
}

module.exports = { loadDB, saveDB };
