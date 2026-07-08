import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import MucTieu from './pages/MucTieu';
import KpiThucDat from './pages/KpiThucDat';
import Users from './pages/Users';
import Login from './pages/Login';
import Logo from './components/Logo';
import { useAuth } from './AuthContext';

const NAV = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'kpi-thuc-dat', label: '📈 KPI Thực Đạt' },
  { id: 'muc-tieu', label: '🎯 Mục Tiêu KPI' },
  { id: 'upload', label: '📂 Dữ liệu', adminOnly: true },
  { id: 'users', label: '👥 Quản lý tài khoản', adminOnly: true },
];

const ROLE_LABEL = { admin: 'Admin', saleadmin: 'Sale Admin', dsm: 'DSM', tdv: 'TDV', ctv: 'CTV' };

export default function App() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return <Login />;

  const isAdmin = user.role === 'admin';
  const nav = NAV.filter(n => !n.adminOnly || isAdmin);
  const activePage = nav.some(n => n.id === page) ? page : 'dashboard';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f2f6fb', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      <div className={`app-sidebar${collapsed ? ' is-collapsed' : ''}`} style={{ width: 220, background: '#01377d', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <button className="sidebar-toggle" onClick={() => setCollapsed(c => !c)}>{collapsed ? '>' : '<'}</button>
        <div className="sidebar-brand" style={{ padding: '24px 16px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="app-logo-box" style={{ width: 252, padding: 12, borderRadius: 8, background: '#fff' }}>
            <Logo width={184} />
          </div>
          <div className="sidebar-subtitle" style={{ fontSize: 11, color: 'rgba(255,255,255,0.68)', marginTop: 10, fontWeight: 600 }}>KPI OTC Dashboard 2026</div>
        </div>
        <nav className="sidebar-nav" style={{ padding: '16px 10px', flex: 1 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 4, background: activePage === n.id ? 'rgba(255,255,255,0.15)' : 'transparent', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: activePage === n.id ? 600 : 400, color: activePage === n.id ? '#fff' : 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-brand" style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{user.full_name || user.username}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{ROLE_LABEL[user.role] || user.role}</div>
          <button onClick={logout} style={{ marginTop: 8, width: '100%', padding: '7px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, fontSize: 12, color: '#fff', cursor: 'pointer' }}>
            Đăng xuất
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activePage === 'dashboard' && <Dashboard />}
        {activePage === 'kpi-thuc-dat' && <KpiThucDat />}
        {activePage === 'muc-tieu' && <MucTieu />}
        {activePage === 'upload' && isAdmin && <Upload />}
        {activePage === 'users' && isAdmin && <Users />}
      </div>
    </div>
  );
}
