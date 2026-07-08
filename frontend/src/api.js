import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('kpi_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/login')) {
      localStorage.removeItem('kpi_user');
      localStorage.removeItem('kpi_token');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

export const login = (username, password) => api.post('/login', { username, password });
export const logout = () => api.post('/logout');
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const uploadChiTieu = (file, nam, thang, nguon = 'sptt') => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nam', nam);
  fd.append('thang', thang);
  fd.append('nguon', nguon);
  return api.post('/upload/chi-tieu', fd);
};

export const getMucTieu = (params) => api.get('/muc-tieu', { params });
export const getKpiThucDat = (params) => api.get('/kpi-thuc-dat', { params });

export const uploadDoanhSo = (file, nam, thang) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nam', nam);
  fd.append('thang', thang);
  return api.post('/upload/doanh-so', fd);
};

export const uploadTienVe = (file, nam, thang) => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nam', nam);
  fd.append('thang', thang);
  return api.post('/upload/tien-ve', fd);
};

export const getUploads = () => api.get('/uploads');
export const getDataSummary = () => api.get('/data-summary');
export const deleteThangData = (nam, thang) => api.delete(`/data/doanh-so/${nam}/${thang}`);
export const deleteTienVeThangData = (nam, thang) => api.delete(`/data/tien-ve/${nam}/${thang}`);
export const getSummary = (params) => api.get('/dashboard/summary', { params });
export const getTheoDSM = (params) => api.get('/dashboard/theo-dsm', { params });
export const getTheoTDV = (params) => api.get('/dashboard/theo-tdv', { params });
export const getTrendTuan = (params) => api.get('/dashboard/trend-tuan', { params });
export const getMetaDSM = (params) => api.get('/metadata/dsm', { params });
export const getMetaTDV = (params) => api.get('/metadata/tdv', { params });
export const getMetaNamThang = () => api.get('/metadata/nam-thang');
export const getGiaoDich = (params) => api.get('/giao-dich', { params });
