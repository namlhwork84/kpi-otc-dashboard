import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api';

const ROLES = { admin: 'Quản trị', dsm: 'DSM', tdv: 'TDV', ctv: 'CTV' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'tdv', dsm: '', full_name: '' });
  const [msg, setMsg] = useState(null);

  const load = () => getUsers().then(r => setUsers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await createUser(form);
      setMsg({ type: 'success', text: 'Tạo tài khoản thành công!' });
      setForm({ username: '', password: '', role: 'tdv', dsm: '', full_name: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Lỗi' });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Xóa tài khoản này?')) return;
    await deleteUser(id);
    load();
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e3a5f' }}>Quản lý tài khoản</h2>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {showForm ? 'Hủy' : '+ Thêm tài khoản'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Tạo tài khoản mới</h3>
          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[['full_name', 'Họ tên', 'text'], ['username', 'Tài khoản', 'text'], ['password', 'Mật khẩu', 'text']].map(([k, l, t]) => (
                <div key={k} style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>{l}</label>
                  <input required type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13 }}>
                  {Object.entries(ROLES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>DSM</label>
                <input value={form.dsm} onChange={e => setForm(f => ({ ...f, dsm: e.target.value }))} placeholder="VD: DSM1" style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>
            {msg && <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 8, fontSize: 13, background: msg.type === 'success' ? '#e8f5e9' : '#ffebee', color: msg.type === 'success' ? '#2e7d32' : '#c62828' }}>{msg.text}</div>}
            <button type="submit" style={{ marginTop: 16, padding: '10px 24px', background: '#2d6a9f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Lưu</button>
          </form>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              {['Họ tên', 'Tài khoản', 'Role', 'DSM', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #eee' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '11px 16px', fontWeight: 600 }}>{u.full_name}</td>
                <td style={{ padding: '11px 16px', color: '#555' }}>{u.username}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: u.role === 'admin' ? '#fce4ec' : u.role === 'dsm' ? '#e3f0fb' : '#e8f5e9', color: u.role === 'admin' ? '#c62828' : u.role === 'dsm' ? '#2d6a9f' : '#2e7d32' }}>
                    {ROLES[u.role] || u.role}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', color: '#888' }}>{u.dsm || '-'}</td>
                <td style={{ padding: '11px 16px' }}>
                  {u.username !== 'admin' && (
                    <button onClick={() => handleDelete(u.id)} style={{ padding: '5px 12px', background: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: 6, fontSize: 12, color: '#c62828', cursor: 'pointer' }}>Xóa</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
