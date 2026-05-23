/**
 * Google Sheets sync for Kavitha PG.
 *
 * One sheet tab per branch (named after `branch.tabName` — defaults to `branch.code`).
 * Each row is a registered resident. Payment columns (Jan-XXXX … Dec-XXXX) are appended
 * dynamically when a rent bill for that month is marked paid.
 */
const { google } = require('googleapis');

const STATIC_HEADERS = [
  'Phone',
  'Name',
  'Block',
  'Room',
  'Date Joined',
  'Age',
  'Gender',
  'Mobile',
  'Work Address',
  "Father's Name",
  "Father's Mobile",
  "Mother's Name",
  "Mother's Mobile",
  'Living Address',
  'Photo URL',
  'Aadhar URL',
  'Registration PDF',
  'Registered At',
];

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch (err) {
    console.error('[googleSheets] invalid GOOGLE_SERVICE_ACCOUNT_KEY:', err.message);
    return null;
  }
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  const auth = getAuth();
  if (!auth) return null;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return null;
  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId };
}

/** Ensure a tab named `tabName` exists. Creates it (with header row) when missing. */
async function ensureTab(tabName) {
  const ctx = getSheets();
  if (!ctx) return null;
  const { sheets, spreadsheetId } = ctx;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (meta.data.sheets || []).map((s) => s.properties.title);
  if (existing.includes(tabName)) return tabName;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          addSheet: {
            properties: {
              title: tabName,
              tabColor: { red: 0.16, green: 0.5, blue: 0.73 },
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    resource: { values: [STATIC_HEADERS] },
  });

  return tabName;
}

async function _findRow(sheets, spreadsheetId, tabName, phone) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:A`,
  });
  const rows = resp.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === phone) return i + 1; // 1-based
  }
  return null;
}

async function _readHeaderRow(sheets, spreadsheetId, tabName) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!1:1`,
  });
  return (resp.data.values && resp.data.values[0]) || [];
}

async function _ensureColumn(sheets, spreadsheetId, tabName, columnName) {
  const headers = await _readHeaderRow(sheets, spreadsheetId, tabName);
  const idx = headers.indexOf(columnName);
  if (idx >= 0) return idx + 1; // 1-based col index
  headers.push(columnName);
  // Update full header row
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!1:1`,
    valueInputOption: 'RAW',
    resource: { values: [headers] },
  });
  return headers.length;
}

function _colLetter(col) {
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

/** Upsert a resident row in their branch tab. */
async function upsertUser(user, branch) {
  const ctx = getSheets();
  if (!ctx) return false;
  const { sheets, spreadsheetId } = ctx;
  const tabName = (branch?.sheetTab || branch?.code || 'UNASSIGNED').toString();
  await ensureTab(tabName);

  const phone = user.phone;
  const row = [
    phone,
    user.name || '',
    user.block || '',
    user.roomNumber || '',
    user.dateJoined || '',
    user.age ?? '',
    user.gender || '',
    user.mobile || '',
    user.workAddress || '',
    user.fatherName || '',
    user.fatherMobile || '',
    user.motherName || '',
    user.motherMobile || '',
    user.livingAddress || '',
    user.photoUrl || '',
    user.aadharUrl || '',
    user.registrationPdfUrl || '',
    (user.registeredAt || new Date()).toString(),
  ];

  const existing = await _findRow(sheets, spreadsheetId, tabName, phone);
  if (existing) {
    const endCol = _colLetter(STATIC_HEADERS.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${existing}:${endCol}${existing}`,
      valueInputOption: 'RAW',
      resource: { values: [row] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [row] },
    });
  }
  return true;
}

/** Mark a monthly rent payment in the resident's row. */
async function recordPayment({ user, branch, monthLabel, amount, paidAt, paymentId }) {
  const ctx = getSheets();
  if (!ctx) return false;
  const { sheets, spreadsheetId } = ctx;
  const tabName = (branch?.sheetTab || branch?.code || 'UNASSIGNED').toString();
  await ensureTab(tabName);

  const phone = user.phone;
  let row = await _findRow(sheets, spreadsheetId, tabName, phone);
  if (!row) {
    // Add the user row first
    await upsertUser(user, branch);
    row = await _findRow(sheets, spreadsheetId, tabName, phone);
    if (!row) return false;
  }

  const colName = `${monthLabel} Paid`;
  const colIdx = await _ensureColumn(sheets, spreadsheetId, tabName, colName);
  const colLetter = _colLetter(colIdx);
  const value = `₹${amount} on ${paidAt.toISOString().slice(0, 10)} (${paymentId || ''})`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!${colLetter}${row}`,
    valueInputOption: 'RAW',
    resource: { values: [[value]] },
  });
  return true;
}

module.exports = { ensureTab, upsertUser, recordPayment };
