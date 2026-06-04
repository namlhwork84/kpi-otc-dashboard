import { useState, useEffect } from 'react';
import { uploadChiTieu, uploadDoanhSo, getUploads, getDataSummary, deleteThangData } from '../api';

const MONTHS = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

function UploadBox({ title, desc, onUpload, loading, color }) {
  const [file, setFile] = useState(null);
  const [nam, setNam] = useState(2026);
  const [thang, setThang] = useState(4);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    try {
      const res = await onUpload(file, nam, thang);
      setMsg({ type: 'success', text: `✅ Upload thành công! Đã xử lý ${res.data.count} bản ghi.` });
      setFile(null);
    } catch (err) {
      setMsg({ type: 'error', text: `❌ Lỗi: ${err.response?.data?.error || err.message}` });
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: 1, minWidth: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 4, height: 28, background: color, borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>{title}</h3>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>{desc}</p>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Năm</label>
            <select value={nam} onChange={e => setNam(parseInt(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Tháng</label>
            <select value={thang} onChange={e => setThang(parseInt(e.target.value))} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
            </select>
          </div>
        </div>

        <div
          style={{ border: `2px dashed ${file ? color : '#ddd'}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', marginBottom: 16, cursor: 'pointer', transition: 'border-color 0.2s', background: file ? '#f0f8ff' : '#fafafa' }}
          onClick={() => document.getElementById('file-' + title).click()}
        >
          <input id={'file-' + title} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { setFile(e.target.files[0]); setMsg(null); }} />
          <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
          <div style={{ fontSize: 13, color: file ? '#1e3a5f' : '#999', fontWeight: file ? 600 : 400 }}>
            {file ? file.name : 'Click để chọn file .xlsx'}
          </div>
        </div>

        {msg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 12, background: msg.type === 'success' ? '#e8f5e9' : '#ffebee', color: msg.type === 'success' ? '#2e7d32' : '#c62828' }}>
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          style={{ width: '100%', padding: '11px', background: file ? color : '#ccc', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: file ? 'pointer' : 'not-allowed' }}
        >
          {loading ? 'Đang xử lý...' : 'Upload & Xử lý'}
        </button>
      </form>
    </div>
  );
}

function fmtTien(v) {
  if (!v) return '0';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' tỷ';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + ' tr';
  return v.toLocaleString('vi-VN');
}

const MONTH_NAMES = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export default function Upload() {
  const [uploads, setUploads] = useState([]);
  const [dataSummary, setDataSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const reload = () => {
    getUploads().then(r => setUploads(r.data)).catch(() => {});
    getDataSummary().then(r => setDataSummary(r.data)).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  const handleUpload = async (fn, file, nam, thang) => {
    setLoading(true);
    try {
      const res = await fn(file, nam, thang);
      reload();
      return res;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (nam, thang) => {
    if (!confirm(`Xóa toàn bộ dữ liệu doanh số ${MONTH_NAMES[thang]}/${nam}?\n\nMục tiêu KPI sẽ KHÔNG bị ảnh hưởng.`)) return;
    setDeleting(`${nam}-${thang}`);
    try {
      await deleteThangData(nam, thang);
      reload();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>Quản lý dữ liệu</h2>

      {/* Thông báo mục tiêu đã cố định */}
      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>🎯</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>Mục tiêu KPI đã được cố định</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>Chỉ tiêu kế hoạch theo từng tháng/TDV/DSM đã được thiết lập sẵn — xem tại trang <strong>Mục Tiêu KPI</strong>. Không cần upload lại.</div>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>📂 Upload dữ liệu thực hiện tháng</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        <UploadBox
          title="Sổ Chi Tiết Bán Hàng"
          desc="Upload file xuất từ phần mềm kế toán — hệ thống tự tính Doanh số, Đơn hàng, Độ phủ, SPTT và so sánh với Mục tiêu KPI"
          onUpload={(f, n, t) => handleUpload(uploadDoanhSo, f, n, t)}
          loading={loading}
          color="#2e7d32"
        />
      </div>

      {/* Dữ liệu hiện có theo tháng — sửa/xóa/upload lại */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#333' }}>📅 Dữ liệu doanh số hiện có</h3>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888' }}>
          Để <strong>sửa lại</strong> một tháng: chỉ cần upload lại file của tháng đó ở trên — hệ thống tự ghi đè.
          Để <strong>xóa</strong>: bấm nút Xóa bên dưới (Mục tiêu KPI không bị ảnh hưởng).
        </p>
        {dataSummary.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#ccc' }}>Chưa có dữ liệu doanh số nào</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                {['Kỳ', 'Số dòng', 'Số đơn hàng', 'Tổng doanh số', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Kỳ' || h === '' ? 'left' : 'right', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataSummary.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1e3a5f' }}>{MONTH_NAMES[d.thang]} / {d.nam}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#666' }}>{d.so_dong.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', color: '#666' }}>{d.so_don_hang.toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 600, color: '#2e7d32' }}>{fmtTien(d.doanh_so)}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={() => handleDelete(d.nam, d.thang)}
                      disabled={deleting === `${d.nam}-${d.thang}`}
                      style={{ padding: '6px 14px', background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: 6, fontSize: 12, color: '#c62828', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {deleting === `${d.nam}-${d.thang}` ? 'Đang xóa...' : '🗑 Xóa tháng này'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#333' }}>Lịch sử upload</h3>
        {uploads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#ccc' }}>Chưa có lịch sử upload</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                {['File', 'Loại', 'Kỳ', 'Thời gian'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploads.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '10px 14px' }}>{u.file_name}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.file_type === 'chi_tieu' ? '#e3f0fb' : '#e8f5e9', color: u.file_type === 'chi_tieu' ? '#2d6a9f' : '#2e7d32' }}>
                      {u.file_type === 'chi_tieu' ? 'Chỉ tiêu' : 'Doanh số'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>T{u.thang}/{u.nam}</td>
                  <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(u.created_at).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
