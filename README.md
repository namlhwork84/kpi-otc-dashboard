# KPI OTC Dashboard

Web dashboard theo dõi KPI Kênh OTC — so sánh chỉ tiêu mục tiêu với doanh số thực hiện theo cấp Kênh / DSM / TDV / CTV.

## Tính năng
- 📊 Dashboard KPI với 4 thẻ chỉ số (Doanh số, Đơn hàng, Độ phủ, SPTT)
- 🎯 Bảng mục tiêu tích hợp — pivot theo từng TDV/DSM
- 📂 Upload file Excel (CHỈ TIÊU SPTT + KẾ HOẠCH + Doanh số thực hiện)
- 🔍 Bộ lọc: Năm / Quý / Tháng / Tuần / DSM / TDV
- 📈 Biểu đồ xu hướng theo tuần, so sánh thực hiện vs mục tiêu

## Cài đặt

### Yêu cầu
- Node.js >= 18

### Chạy lần đầu

```bash
# Backend (Terminal 1)
cd backend
npm install
node server.js

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

Mở trình duyệt: **http://localhost:5173**

## Sử dụng

1. Vào **Dữ liệu** → upload file Excel theo thứ tự:
   - `CHỈ TIÊU SPTT.xlsx` (loại: CHỈ TIÊU SPTT)
   - `2026.T04.DSTT.OTC.xlsx` (loại: Doanh số thực hiện)
2. Xem **Dashboard** → lọc theo DSM/TDV/Tháng/Tuần
3. Xem **Mục Tiêu KPI** → bảng tổng hợp tất cả chỉ tiêu

## Stack
- Frontend: React 18 + Vite + Recharts
- Backend: Node.js + Express
- Storage: JSON file (không cần DB)

## Tài liệu
Xem file `HANDOFF.docx` để biết chi tiết cấu trúc, API và logic nghiệp vụ.
