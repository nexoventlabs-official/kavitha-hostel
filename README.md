# Kavitha PG — WhatsApp Bot + Admin Panel

Complete WhatsApp business automation for a multi-branch PG (paying-guest)
hostel. Includes:

- **WhatsApp chatbot** (Meta Cloud API) with bilingual English / Tamil flow
- **Public web registration** form with photo cropping and Aadhar upload
- **Razorpay rent payment** flow (payment link + confirmation receipt)
- **Branch-wise Google Sheets** sync for residents and monthly payments
- **React admin console** for branches, residents, PDFs, flow images, and rent bills

```
Kavitha_PG/
├─ backend/           # Node.js + Express + MongoDB + Meta Flow endpoint
│  ├─ models/         # Mongoose schemas
│  ├─ routes/         # REST + webhooks + flow endpoint
│  ├─ services/       # chatbot, metaCloud, razorpay, googleSheets, pdfGen
│  ├─ scripts/        # one-time flow setup scripts
│  ├─ public/register # static registration form served at /register
│  └─ .env
└─ frontend/          # Vite + React + Tailwind admin panel
```

## 1. Prerequisites

- Node.js 18+
- MongoDB cluster (provided URL in `backend/.env`)
- An HTTPS public URL for the backend during Flow setup (ngrok or a deployed
  HTTPS endpoint)
- WhatsApp Cloud API access (already provided in `backend/.env`)
- A Cloudinary account (already provided in `backend/.env`)
- A Razorpay account — paste `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
  `RAZORPAY_WEBHOOK_SECRET` into `backend/.env`
- A Google Spreadsheet shared with the service account email
  `kavitha-hostel@kavithahostel.iam.gserviceaccount.com` — paste its sheet
  id into `GOOGLE_SHEET_ID`

## 2. Install

```bash
# backend
cd backend
npm install

# frontend (new terminal)
cd frontend
npm install
```

## 3. Configure the WhatsApp Flow (one-time)

> ⚠️ Meta requires HTTPS. Start an HTTPS tunnel to `localhost:5000` first
> (e.g. `ngrok http 5000`) and set `BACKEND_URL=https://xxxx.ngrok.io` in
> `backend/.env` before running this step.

```bash
cd backend
# One-shot — generates keys, uploads pub key, creates + publishes the flow
node scripts/setup-all.js
```

This populates `WHATSAPP_FLOW_ID`, `WHATSAPP_FLOW_STATUS`,
`FLOW_PRIVATE_KEY`, `FLOW_PUBLIC_KEY` in `backend/.env`.

If you prefer the manual flow:

```bash
npm run flow:keys          # generate RSA keypair
# Paste the printed lines into .env, then:
npm run flow:upload-key    # upload public key to Meta
npm run flow:create        # create + publish the flow
```

## 4. Webhook subscription

In Meta App Dashboard → WhatsApp → Configuration, point the **webhook callback URL** at

```
https://<your backend>/api/webhook/meta
```

and verify token: `kavitha_pg_verify` (matches `META_VERIFY_TOKEN` in `.env`).

Subscribe the **messages** event.

## 5. Run

```bash
# backend (terminal 1)
cd backend
npm run dev

# frontend (terminal 2)
cd frontend
npm run dev
```

Visit `http://localhost:5173` for the admin panel. Default credentials are
in `backend/.env` (`admin / admin@123`).

## 6. First-time admin checklist

1. **Branches** → add at least one branch with code, name, Google review URL,
   website URL, optional sheet tab name.
2. **PDF Resources** → upload PDFs for the three slots
   (Per Month Cost / Food Timings / Hostel Rules).
3. **Flow Images** → upload chatbot & flow header images / service icons.
4. The bot is now live. From any WhatsApp number send "Hi" to the
   configured business number.

## 7. WhatsApp user journey

| Step | Trigger | Bot response |
| --- | --- | --- |
| 1 | User sends `hi` / `hello` / `வணக்கம்` | Welcome image + 2 reply buttons: **English** / **தமிழ்** |
| 2 | User taps a language | "Choose Service" flow CTA (image + body) |
| 3a | Picks **Register** | CTA URL message — opens the web form, locked WhatsApp number, photo crop, Aadhar upload |
| 3b | Picks **Per Month Cost / Food Timings / Hostel Rules** | PDF (uploaded by admin) sent as a flow message header + "Choose Service" CTA |
| 3c | Picks **Contact** | Image header + body + phone number, then "Choose Service" |
| 3d | Picks **Change Language** | Re-sends the language buttons |
| 4 | After successful registration | Bot sends the generated registration PDF + welcome body + "Choose Service" |
| 5 | Registered user taps **Pay Rent** | Sends current-month bill summary in a table-style codeblock + Razorpay **Pay Now** CTA |
| 6 | Razorpay confirms payment (callback + webhook) | "Payment Successful" message + Google Sheets row updated under the branch tab |
| 7 | Registered user picks **Review & Rating** | Image + body + branch-specific Google review CTA URL |
| 8 | Registered user picks **Website** | Image + body + website CTA URL (per-branch) |

## 8. Where data goes

- **MongoDB**
  - `users` — residents (with photos, Aadhar URL, registration PDF URL, language)
  - `branches` — branches with review/website URLs, sheet tab names
  - `rentbills` — monthly bills per resident
  - `pdfs` — three PDF slots
  - `flowimages` — Cloudinary URLs for every flow / chatbot image
  - `inboundmessages` — every contact who messaged the bot
  - `registrationtokens` — short-lived tokens that back the register CTA URL

- **Cloudinary** — all images, all PDFs (under `kavitha-pg/...` folders)

- **Google Sheets** — one tab per branch
  (named after `branch.sheetTab` — defaults to `branch.code`).
  Each resident is a row. Payment columns (`May 2026 Paid`, `June 2026 Paid` …)
  are auto-appended when bills are marked paid.

## 9. Payment setup (Meta Native WhatsApp Pay)

Primary payment path is **Meta Native WhatsApp Pay** (order-details messages —
users tap "Review and Pay" *inside WhatsApp*, no external browser). Behind the
scenes the payment is processed by Razorpay through the Meta payment configuration.

### One-time setup (already done for this project)

1. WhatsApp Manager → Payment configurations → New configuration:
   - Gateway: **Razorpay**
   - Configuration name: **`KavithaHostel`**
   - MCC: **7011 — Hotels, Motels & Resorts**
   - Purpose code: **04 — Hospitality**
2. Test the configuration (the green "Active" badge must show).
3. The configuration name + Razorpay merchant id (MID) are already in `backend/.env`:
   - `META_PAYMENT_CONFIGURATION_NAME=KavithaHostel`
   - `RAZORPAY_MID=acc_Slx0g0ZzvenFtY`

### How it works

- The bot calls `meta.sendOrderDetails(...)` with the bill items + total.
- The user pays inside WhatsApp; Meta returns a `messages[].interactive` event
  with `type: payment` and the reference id (`RENT-<billId>`).
- `routes/webhook.js → handlePaymentInteractive` looks up the bill, marks it
  paid, and triggers `services/billPayments.markBillPaid` which:
  1. sets `bill.paid = true` + payment id
  2. updates the Google Sheets row (branch tab → `<Month YYYY> Paid` column)
  3. sends the "Payment Successful" image+body + Choose-Service flow CTA

### Optional fallback — Razorpay Payment Links

If `META_PAYMENT_CONFIGURATION_NAME` is unset (or the order-details API call
fails for a particular contact), the bot falls back to a Razorpay **Payment
Link** sent as a CTA URL button. To enable that fallback path, fill in:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Then in the Razorpay dashboard:
1. Webhook URL: `https://<your backend>/api/payment/razorpay-webhook` — subscribe
   to `payment_link.paid` and `payment.captured`.
2. Callback URL (browser landing): `https://<your backend>/api/payment/callback`.

## 10. Not touched

This project is fully **separate** from any existing Meta flows on the
same WhatsApp Business Account. `scripts/setup-all.js` creates a **new**
flow named "Kavitha PG Welcome" — existing flows are untouched.
