function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' tr';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' k';
  return n?.toLocaleString('vi-VN') || '0';
}

function pctColor(pct) {
  if (pct >= 100) return '#2e7d32';
  if (pct >= 80) return '#f57c00';
  return '#c62828';
}

export default function KPICard({ title, actual, target, icon, unit = '' }) {
  const pct = target > 0 ? Math.round((actual / target) * 1000) / 10 : 0;
  const color = pctColor(pct);
  const barWidth = Math.min(pct, 100);

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', flex: 1, minWidth: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>
        {fmt(actual)}{unit}
      </div>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
        Mục tiêu: <span style={{ color: '#555', fontWeight: 600 }}>{fmt(target)}{unit}</span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>
        {target > 0 ? `${pct}%` : 'Chưa có mục tiêu'}
        {pct >= 100 && ' ✓'}
      </div>
    </div>
  );
}
