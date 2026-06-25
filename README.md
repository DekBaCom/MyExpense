# MyExpense — บันทึกค่าใช้จ่ายในบ้าน

ระบบบันทึกค่าใช้จ่ายสำหรับครอบครัว พร้อม Dashboard วิเคราะห์การใช้จ่าย

## Stack

| Layer    | Technology                    |
|----------|-------------------------------|
| Frontend | React 18 + Tailwind CSS + Vite |
| Backend  | Cloudflare Workers + Hono     |
| Database | Cloudflare D1 (SQLite)        |
| Cache    | Cloudflare KV                 |
| Auth     | Google OAuth 2.0              |
| Hosting  | Cloudflare Pages + Workers    |

## Features

- **บันทึกรายจ่าย** — พร้อมหมวดหมู่ 9 หมวด, 24 หมวดย่อย
- **Dashboard** — Donut chart, Bar chart แนวโน้ม 6 เดือน
- **งบประมาณ** — ตั้งงบแต่ละหมวด, แสดง % ที่ใช้ไป
- **สมาชิก** — รองรับหลายคนในบ้าน พร้อม emoji & สี
- **Google Login** — เข้าสู่ระบบด้วย Google Account
- **ใบเสร็จ (R2)** — อัปโหลดรูปใบเสร็จ/สลิป เก็บใน Cloudflare R2
- **LINE Notification** — แจ้งเตือนทุกรายการบันทึก + แจ้งเมื่อเกินงบ

## Project Structure

```
MyExpense/
├── frontend/          # React + Tailwind → Cloudflare Pages
│   ├── src/
│   │   ├── api/       # API client
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── types/
│   └── package.json
│
└── worker/            # Cloudflare Workers API
    ├── src/
    │   ├── routes/    # auth, expenses, categories, budgets, members, dashboard
    │   ├── middleware/
    │   └── types.ts
    ├── migrations/    # D1 schema + seed
    └── wrangler.toml
```

## Setup & Deploy

### 1. สร้าง Google OAuth Credentials

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง OAuth 2.0 Client ID
3. เพิ่ม Authorized redirect URI: `https://myexpense-worker.YOUR_SUBDOMAIN.workers.dev/api/auth/callback`

### 2. ตั้งค่า Cloudflare

```bash
# Install wrangler
npm install -g wrangler
wrangler login

# สร้าง D1 Database
wrangler d1 create myexpense-db
# → คัดลอก database_id ใส่ใน wrangler.toml

# สร้าง KV Namespace
wrangler kv:namespace create SESSIONS
# → คัดลอก id ใส่ใน wrangler.toml

# ตั้ง Secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET   # random string ยาวๆ
```

### 3. Deploy Worker

```bash
cd worker
npm install

# Run migrations + seed
npm run db:migrate:remote
npm run db:seed:remote

# Deploy
npm run deploy
```

### 4. Deploy Frontend

```bash
cd frontend
npm install
npm run build

# Deploy to Cloudflare Pages (หรือผ่าน Git integration)
wrangler pages deploy dist --project-name myexpense
```

### 5. อัปเดต FRONTEND_URL ใน wrangler.toml

```toml
[vars]
FRONTEND_URL = "https://myexpense.pages.dev"
```

## Development

```bash
# Worker (dev server port 8787)
cd worker && npm run dev

# Frontend (dev server port 5173, proxy /api → :8787)
cd frontend && npm run dev
```

## API Endpoints

| Method | Path                    | Description         |
|--------|-------------------------|---------------------|
| GET    | /api/auth/login         | Redirect to Google  |
| GET    | /api/auth/callback      | OAuth callback      |
| GET    | /api/auth/me            | Current user        |
| POST   | /api/auth/logout        | Logout              |
| GET    | /api/expenses           | List expenses       |
| POST   | /api/expenses           | Create expense      |
| PUT    | /api/expenses/:id       | Update expense      |
| DELETE | /api/expenses/:id       | Delete expense      |
| GET    | /api/categories         | Category tree       |
| GET    | /api/members            | List members        |
| POST   | /api/members            | Add member          |
| GET    | /api/budgets/:month     | Get budgets         |
| PUT    | /api/budgets/:month     | Save budgets        |
| GET    | /api/dashboard          | Dashboard data      |
| PUT    | /api/receipts/:id       | Upload receipt (R2) |
| GET    | /api/receipts/:id/image | Serve receipt image |
| DELETE | /api/receipts/:id       | Delete receipt      |
| GET    | /api/settings/line      | Get LINE settings   |
| PUT    | /api/settings/line      | Save LINE settings  |
| POST   | /api/settings/line/test | Test LINE message   |
