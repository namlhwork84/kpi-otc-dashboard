import { useState, useEffect } from 'react';
import { uploadChiTieu, uploadDoanhSo, getUploads } from '../api';

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

export default function Upload() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUploads().then(r => setUploads(r.data)).catch(() => {});
  }, []);

  const handleUpload = async (fn, file, nam, thang) => {
    setLoading(true);
    try {
      const res = await fn(file, nam, thang);
      const ups = await getUploads();
      setUploads(ups.data);
      return res;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>Quản lý dữ liệu</h2>

      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#555' }}>📋 Chỉ tiêu mục tiêu</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 20 }}>
        <UploadBox
          title="CHỈ TIÊU SPTT"
          desc="File CHỈ TIÊU SPTT.xlsx — chứa Doanh số, Đơn hàng, Độ phủ, SPTT theo tháng cho từng TDV/DSM"
          onUpload={(f, n, t) => handleUpload((file, nam, thang) => uploadChiTieu(file, nam, thang, 'sptt'), f, n, t)}
          loading={loading}
          color="#2d6a9f"
        />
        <UploadBox
          title="CHỈ TIÊU KẾ HOẠCH"
          desc="File CHỈ TIÊU KẾ HOẠCH.xlsx — chứa Doanh số, Đơn hàng, Số KH theo tháng cho từng TDV/DSM"
          onUpload={(f, n, t) => handleUpload((file, nam, thang) => uploadChiTieu(file, nam, thang, 'ke_hoach'), f, n, t)}
          loading={loading}
          color="#6a2d9f"
        />
      </div>
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#555' }}>📈 Doanh số thực hiện</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 28 }}>
        <UploadBox
          title="Doanh số thực hiện"
          desc="File 2026.T04.DSTT.OTC.xlsx hoặc file có sheet 'Sổ Chi Tiết Bán Hàng' / 'Dữ liệu'"
          onUpload={(f, n, t) => handleUpload(uploadDoanhSo, f, n, t)}
          loading={loading}
          color="#2e7d32"
        />
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
