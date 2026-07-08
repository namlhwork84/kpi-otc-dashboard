import { useEffect, useState } from 'react';
import { getMetaNamThang } from './api';

// Trả về kỳ (năm/tháng) gần nhất có dữ liệu doanh số, dùng làm mặc định khi vào trang.
export default function useLatestPeriod() {
  const [period, setPeriod] = useState(null);

  useEffect(() => {
    getMetaNamThang()
      .then(r => {
        const periods = r.data || [];
        if (periods.length === 0) {
          const now = new Date();
          setPeriod({ nam: now.getFullYear(), thang: now.getMonth() + 1 });
          return;
        }
        const latest = periods.reduce((max, p) => (p.nam * 100 + p.thang > max.nam * 100 + max.thang ? p : max));
        setPeriod({ nam: latest.nam, thang: latest.thang });
      })
      .catch(() => {
        const now = new Date();
        setPeriod({ nam: now.getFullYear(), thang: now.getMonth() + 1 });
      });
  }, []);

  return period;
}
