# Kavitha PG — Deployment Guide

This project has two parts:
- **Backend**: Node.js/Express API (deploy to Render)
- **Frontend**: React + Vite admin panel (deploy to Vercel)

---

## 1. Backend — Render

### 1.1 Create a new Web Service on Render

1. Go to https://dashboard.render.com and click **New +** → **Web Service**
2. Connect your GitHub repository: `nexoventlabs-official/kavitha-hostel`
3. Set the following:

| Field | Value |
|-------|-------|
| Name | `kavitha-pg-backend` (or any name you prefer) |
| Region | Singapore (or closest to your users) |
| Branch | `main` |
| Runtime | **Node** |
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && npm start` |
| Root Directory | `backend` |

### 1.2 Environment Variables (Render → Environment)

Copy these from your local `backend/.env` and paste into Render. **Do not use ngrok URLs in production.**

| Variable | Value (example) | Notes |
|----------|-----------------|-------|
| `NODE_ENV` | `production` | |
| `PORT` | `5000` | Render may override; keep for reference |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Your Vercel domain (after frontend deploy) |
| `MONGODB_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `ADMIN_USERNAME` | `admin` | Change this in production |
| `ADMIN_PASSWORD` | `your-secure-password` | Change this in production |
| `JWT_SECRET` | `long-random-string` | Generate a random secret |
| `BACKEND_URL` | `https://your-backend.onrender.com` | Render will give you this URL after deploy |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` | Your Vercel domain |
| `META_ACCESS_TOKEN` | `EAA...` | From Meta Developer Portal |
| `META_APP_ID` | `123456789` | From Meta Developer Portal |
| `META_APP_SECRET` | `abc123...` | From Meta Developer Portal |
| `META_PHONE_NUMBER_ID` | `123456789` | From Meta Developer Portal |
| `META_WABA_ID` | `123456789` | From Meta Developer Portal |
| `META_VERIFY_TOKEN` | `kavitha_pg_verify` | Keep this as-is |
| `META_GRAPH_VERSION` | `v22.0` | |
| `WHATSAPP_FLOW_ID` | `1481091743744553` | Your published flow ID |
| `WHATSAPP_FLOW_STATUS` | `PUBLISHED` | |
| `FLOW_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` | Full multi-line key |
| `FLOW_PUBLIC_KEY` | `-----BEGIN PUBLIC KEY-----\n...` | Full multi-line key |
| `CLOUDINARY_CLOUD_NAME` | `djwk7ltcy` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | `387192189896444` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | `640CqUlB4v49PsTR8rJ63F5_MRg` | From Cloudinary dashboard |
| `META_PAYMENT_CONFIGURATION_NAME` | `KavithaHostel` | From WhatsApp Manager → Payment configurations |
| `RAZORPAY_MID` | `acc_Slx0g0ZzvenFtY` | From Razorpay dashboard |
| `RAZORPAY_KEY_ID` | `rzp_live_...` | Optional (for Payment Link fallback) |
| `RAZORPAY_KEY_SECRET` | `...` | Optional (for Payment Link fallback) |
| `RAZORPAY_WEBHOOK_SECRET` | `...` | Optional (for Payment Link fallback) |
| `GOOGLE_SHEET_ID` | `1OHYNdoCIrf0cPbqs1RbWXVhglfiggvoww4hjIc2VLvM` | Your spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | `{"type":"service_account",...}` | Full JSON as single line, double-quoted |

### 1.3 After Deploy

1. Render will give you a URL like `https://kavitha-pg-backend.onrender.com`
2. Update `BACKEND_URL` in Render env vars to this exact URL
3. Update `ALLOWED_ORIGINS` to include your Vercel frontend domain (once deployed)
4. In Meta Developer Portal, update your **Webhook URL** to `https://your-backend.onrender.com/api/webhook/meta`
5. In Meta Developer Portal, update your **Flow endpoint** to `https://your-backend.onrender.com/api/flow-endpoint`
6. In Razorpay dashboard, update your **Webhook URL** to `https://your-backend.onrender.com/api/payment/razorpay-webhook`

---

## 2. Frontend — Vercel

### 2.1 Deploy to Vercel

1. Go to https://vercel.com and click **Add New Project**
2. Import your GitHub repository: `nexoventlabs-official/kavitha-hostel`
3. Set the following:

| Field | Value |
|-------|-------|
| Framework Preset | **Vite** |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 2.2 Environment Variables (Vercel → Settings → Environment Variables)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com/api` |

### 2.3 After Deploy

1. Vercel will give you a URL like `https://kavitha-pg-admin.vercel.app`
2. Go back to Render and update `FRONTEND_URL` to this Vercel domain
3. Update `ALLOWED_ORIGINS` in Render to include this Vercel domain (comma-separated if multiple)

---

## 3. Post-Deploy Checklist

- [ ] Backend is live on Render and `/api/health` returns `{ status: "ok" }`
- [ ] Frontend is live on Vercel and loads the admin panel
- [ ] Login to admin panel works with `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- [ ] Meta webhook is verified (green check in Meta Developer Portal)
- [ ] WhatsApp Flow endpoint is reachable
- [ ] Test WhatsApp message to your number — chatbot responds
- [ ] Test registration flow via WhatsApp
- [ ] Test rent payment via WhatsApp (Meta Native Pay or Razorpay link)
- [ ] Test Room EB Bill split in admin panel
- [ ] Verify Google Sheets sync works after marking a bill paid

---

## 4. Notes

- **Never commit `.env` files** — they are in `.gitignore`
- **Flow keys** (`FLOW_PRIVATE_KEY`, `FLOW_PUBLIC_KEY`) are multi-line strings — paste them exactly as-is in Render env vars
- **Google Service Account Key** must be a single-line JSON string with escaped newlines (`\n`) inside the quotes
- If you change `BACKEND_URL` or `FRONTEND_URL`, you must also update Meta webhook and Flow endpoint URLs
- Render provides a free SSL certificate — your backend will be HTTPS automatically
