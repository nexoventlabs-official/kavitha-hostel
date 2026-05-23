/**
 * WhatsApp Flow Endpoint — RSA + AES-128-GCM encrypted exchange with Meta.
 *
 * Receives INIT / data_exchange / BACK / ping actions and returns the next
 * screen with dynamic content (service list tailored to whether the contact is
 * already a registered resident).
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const flowImages = require('../services/flowImages');
const { urlToBase64 } = require('../services/imageBase64');
const { t } = require('../services/i18n');
const User = require('../models/User');

const router = express.Router();

const LOG_PATH = path.join(__dirname, '..', 'flow-debug.log');
function dbg(...args) {
  const line =
    `[${new Date().toISOString()}] ` +
    args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ') +
    '\n';
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {}
  console.log('[FlowEndpoint]', ...args);
}

/* ─── Encryption helpers ─── */
const FLOW_PRIVATE_KEY_RAW = process.env.FLOW_PRIVATE_KEY || '';
const FLOW_PRIVATE_KEY = FLOW_PRIVATE_KEY_RAW.split('\\n').join('\n');

function decryptRequest(body) {
  const { encrypted_aes_key, encrypted_flow_data, initial_vector } = body || {};
  if (!FLOW_PRIVATE_KEY) {
    return { decryptedBody: body, aesKeyBuffer: null, ivBuffer: null };
  }
  if (!encrypted_aes_key || !encrypted_flow_data || !initial_vector) {
    throw new Error('Missing encryption fields');
  }

  const privateKey = crypto.createPrivateKey({ key: FLOW_PRIVATE_KEY, format: 'pem' });
  const aesKeyBuffer = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(encrypted_aes_key, 'base64')
  );

  const ivBuffer = Buffer.from(initial_vector, 'base64');
  const flowDataBuffer = Buffer.from(encrypted_flow_data, 'base64');
  const TAG_LEN = 16;
  const authTag = flowDataBuffer.slice(-TAG_LEN);
  const ciphertext = flowDataBuffer.slice(0, -TAG_LEN);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKeyBuffer, ivBuffer);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return { decryptedBody: JSON.parse(plain.toString('utf-8')), aesKeyBuffer, ivBuffer };
}

function encryptResponse(obj, aesKeyBuffer, ivBuffer) {
  if (!aesKeyBuffer || !ivBuffer) return obj;
  const flipped = Buffer.alloc(ivBuffer.length);
  for (let i = 0; i < ivBuffer.length; i++) flipped[i] = ~ivBuffer[i] & 0xff;
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flipped);
  const out = Buffer.concat([
    cipher.update(JSON.stringify(obj), 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return out.toString('base64');
}

/* ─── Image cache ─── */
let imgCache = { data: null, ts: 0 };
const IMG_TTL = 10 * 60 * 1000;

function clearImageCache() {
  imgCache = { data: null, ts: 0 };
}

async function loadImagesB64() {
  if (imgCache.data && Date.now() - imgCache.ts < IMG_TTL) return imgCache.data;

  const keys = [
    'flow_welcome_banner',
    'icon_register',
    'icon_per_month_cost',
    'icon_food_timings',
    'icon_hostel_rules',
    'icon_change_language',
    'icon_contact',
    'icon_pay_rent',
    'icon_website',
    'icon_review',
  ];
  const map = await flowImages.getMap(keys);
  const entries = await Promise.all(
    keys.map(async (k) => {
      const url = map[k];
      if (!url) return [k, ''];
      const isBanner = k.startsWith('flow_');
      const opts = isBanner
        ? { width: 1000, height: 125, crop: 'fill', quality: 70, format: 'jpg' }
        : { width: 200, height: 200, crop: 'fill', quality: 75, format: 'jpg' };
      const b64 = await urlToBase64(url, opts);
      return [k, b64];
    })
  );
  imgCache = { data: Object.fromEntries(entries), ts: Date.now() };
  return imgCache.data;
}

/* ─── Helpers ─── */
function withImage(item, b64) {
  if (b64) item.image = b64;
  return item;
}

function phoneFromToken(token) {
  if (!token) return '';
  // `welcome_<phone>_<lang>` OR legacy `welcome_<phone>`
  const m = String(token).match(/^welcome_(\d+)(?:_(\w+))?$/);
  return m ? m[1] : String(token).replace(/\D/g, '');
}

function langFromToken(token) {
  const m = String(token || '').match(/^welcome_\d+_(\w+)$/);
  return m && (m[1] === 'ta' || m[1] === 'en') ? m[1] : '';
}

async function buildServiceList(images, lang, isRegistered) {
  if (isRegistered) {
    return [
      withImage(
        {
          id: 'pay_rent',
          title: t('svc_pay_rent', lang),
          description: t('svc_pay_rent_desc', lang),
        },
        images.icon_pay_rent
      ),
      withImage(
        {
          id: 'contact',
          title: t('svc_contact', lang),
          description: t('svc_contact_desc', lang),
        },
        images.icon_contact
      ),
      withImage(
        {
          id: 'website',
          title: t('svc_website', lang),
          description: t('svc_website_desc', lang),
        },
        images.icon_website
      ),
      withImage(
        {
          id: 'review',
          title: t('svc_review', lang),
          description: t('svc_review_desc', lang),
        },
        images.icon_review
      ),
      withImage(
        {
          id: 'change_language',
          title: t('svc_change_language', lang),
          description: t('svc_change_language_desc', lang),
        },
        images.icon_change_language
      ),
    ];
  }

  return [
    withImage(
      {
        id: 'register',
        title: t('svc_register', lang),
        description: t('svc_register_desc', lang),
      },
      images.icon_register
    ),
    withImage(
      {
        id: 'per_month_cost',
        title: t('svc_per_month_cost', lang),
        description: t('svc_per_month_cost_desc', lang),
      },
      images.icon_per_month_cost
    ),
    withImage(
      {
        id: 'food_timings',
        title: t('svc_food_timings', lang),
        description: t('svc_food_timings_desc', lang),
      },
      images.icon_food_timings
    ),
    withImage(
      {
        id: 'hostel_rules',
        title: t('svc_hostel_rules', lang),
        description: t('svc_hostel_rules_desc', lang),
      },
      images.icon_hostel_rules
    ),
    withImage(
      {
        id: 'change_language',
        title: t('svc_change_language', lang),
        description: t('svc_change_language_desc', lang),
      },
      images.icon_change_language
    ),
    withImage(
      {
        id: 'contact',
        title: t('svc_contact', lang),
        description: t('svc_contact_desc', lang),
      },
      images.icon_contact
    ),
  ];
}

/* ─── Handler ─── */
router.post('/', async (req, res) => {
  let aesKeyBuffer, ivBuffer, decryptedBody;
  try {
    ({ decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body));
  } catch (err) {
    console.error('[FlowEndpoint] decrypt failed:', err.message);
    return res.status(421).send();
  }

  const { action, screen, data, flow_token, version } = decryptedBody || {};
  dbg('REQUEST', { action, screen, flow_token, version, data });

  if (action === 'ping') {
    return sendResponse(res, { data: { status: 'active' } }, aesKeyBuffer, ivBuffer);
  }
  if (data?.error) {
    dbg('CLIENT_ERROR', data);
    return sendResponse(res, { data: { acknowledged: true } }, aesKeyBuffer, ivBuffer);
  }

  try {
    const response = await handleInit(flow_token);
    dbg('RESPONSE', { screen: response.screen });
    return sendResponse(res, response, aesKeyBuffer, ivBuffer);
  } catch (err) {
    dbg('HANDLER_ERROR', { message: err.message, stack: err.stack });
    return sendResponse(
      res,
      {
        screen: 'SERVICE_SELECT',
        data: {
          welcome_banner: '',
          has_welcome_banner: false,
          heading: 'Choose Service',
          subheading: 'Please try again.',
          services: [],
        },
      },
      aesKeyBuffer,
      ivBuffer
    );
  }
});

function sendResponse(res, obj, aesKeyBuffer, ivBuffer) {
  const payload = { version: '3.0', ...obj };
  const out = encryptResponse(payload, aesKeyBuffer, ivBuffer);
  if (typeof out === 'string') {
    res.set('Content-Type', 'text/plain');
    return res.send(out);
  }
  return res.json(out);
}

async function handleInit(flow_token) {
  const phone = phoneFromToken(flow_token);
  const lang = langFromToken(flow_token) || 'en';
  const images = await loadImagesB64();
  const user = phone ? await User.findOne({ phone }).lean() : null;
  const isRegistered = !!user;
  const services = await buildServiceList(images, lang, isRegistered);

  return {
    screen: 'SERVICE_SELECT',
    data: {
      welcome_banner: images.flow_welcome_banner || '',
      has_welcome_banner: !!images.flow_welcome_banner,
      heading: isRegistered
        ? t('flow_heading_registered', lang, { name: user.name?.split(' ')[0] || '' })
        : t('flow_heading_unregistered', lang),
      subheading: isRegistered
        ? t('flow_subheading_registered', lang)
        : t('flow_subheading_unregistered', lang),
      services,
    },
  };
}

module.exports = router;
module.exports.clearImageCache = clearImageCache;
