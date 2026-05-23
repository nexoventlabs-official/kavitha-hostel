const axios = require('axios');
const FormData = require('form-data');

function cfg() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const wabaId = process.env.META_WABA_ID;
  const v = process.env.META_GRAPH_VERSION || 'v22.0';
  if (!accessToken || !phoneNumberId || !wabaId) {
    throw new Error(
      'Meta config missing — set META_ACCESS_TOKEN / META_PHONE_NUMBER_ID / META_WABA_ID'
    );
  }
  return {
    accessToken,
    phoneNumberId,
    wabaId,
    graphVersion: v,
    baseUrl: `https://graph.facebook.com/${v}/${phoneNumberId}`,
    graphRoot: `https://graph.facebook.com/${v}`,
  };
}

const api = axios.create({ timeout: 30000 });

async function sendText(to, text) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: { body: text, preview_url: false },
  };
  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

async function sendImage(to, imageUrl, caption = '') {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'image',
    image: { link: imageUrl, caption },
  };
  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

async function sendDocument(to, docUrl, opts = {}) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');
  const document = { link: docUrl };
  if (opts.filename) document.filename = opts.filename;
  if (opts.caption) document.caption = opts.caption;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'document',
    document,
  };
  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * Reply-buttons interactive message (max 3 buttons). Each button is { id, title }.
 */
async function sendButtons(to, { headerImageUrl, headerText, bodyText, footerText, buttons }) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');

  let header;
  if (headerImageUrl) header = { type: 'image', image: { link: headerImageUrl } };
  else if (headerText) header = { type: 'text', text: headerText };

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: (b.title || '').slice(0, 20) },
        })),
      },
    },
  };
  if (header) payload.interactive.header = header;
  if (footerText) payload.interactive.footer = { text: footerText };

  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * cta_url interactive — single button that opens an external URL.
 */
async function sendCtaUrl(
  to,
  { headerImageUrl, headerText, bodyText, footerText, ctaText, ctaUrl }
) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');

  let header;
  if (headerImageUrl) header = { type: 'image', image: { link: headerImageUrl } };
  else if (headerText) header = { type: 'text', text: headerText };

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        name: 'cta_url',
        parameters: { display_text: ctaText, url: ctaUrl },
      },
    },
  };
  if (header) payload.interactive.header = header;
  if (footerText) payload.interactive.footer = { text: footerText };

  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * Interactive Flow message — opens a published Flow via CTA button.
 */
async function sendFlowMessage(to, options) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');

  const {
    flowId,
    flowCta,
    headerImageUrl,
    headerDocumentUrl,
    headerDocumentFilename,
    headerText,
    bodyText,
    footerText,
    flowToken = `welcome_${phone}`,
    mode = 'published',
  } = options;

  let header;
  if (headerDocumentUrl) {
    const doc = { link: headerDocumentUrl };
    if (headerDocumentFilename) doc.filename = headerDocumentFilename;
    header = { type: 'document', document: doc };
  } else if (headerImageUrl) {
    header = { type: 'image', image: { link: headerImageUrl } };
  } else {
    header = { type: 'text', text: headerText || 'Kavitha PG' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'flow',
      header,
      body: { text: bodyText },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: flowCta,
          mode,
          flow_action: 'data_exchange',
        },
      },
    },
  };
  if (footerText) payload.interactive.footer = { text: footerText };

  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/**
 * Native WhatsApp Pay — Order Details message.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/messages/order-details-messages
 *
 * Currency amounts use { value, offset } where actual_amount = value / offset.
 * For INR with offset=100, ₹500.00 → { value: 50000, offset: 100 }.
 *
 * @param {string} to - WhatsApp number (digits only)
 * @param {object} opts
 * @param {string} opts.referenceId          - Unique id for this order/bill
 * @param {string} opts.configurationName    - Meta payment configuration name (e.g. 'KavithaHostel')
 * @param {string} opts.razorpayMid          - Razorpay merchant id (acc_...)
 * @param {string} opts.headerImageUrl       - Optional header image URL
 * @param {string} opts.headerText           - Used when no headerImageUrl
 * @param {string} opts.bodyText
 * @param {string} opts.footerText
 * @param {string} [opts.expirationTimestamp] - epoch seconds; optional
 * @param {Array<{retailerId,name,amount,quantity,saleAmount?}>} opts.items
 * @param {number} opts.subtotal             - subtotal in major units (₹)
 * @param {number} [opts.tax]                - tax in major units (₹)
 * @param {number} [opts.shipping]           - shipping in major units (₹)
 * @param {number} [opts.discount]           - discount in major units (₹)
 * @param {string} [opts.discountDescription]
 * @param {string} [opts.currency='INR']
 * @param {number} [opts.offset=100]
 * @param {string} [opts.orderType='digital-goods']  - 'physical-goods'|'digital-goods'|'services'
 * @param {object} [opts.notes]              - extra notes passed to Razorpay
 */
async function sendOrderDetails(to, opts) {
  const { baseUrl, accessToken } = cfg();
  const phone = String(to).replace(/\D/g, '');

  const {
    referenceId,
    configurationName,
    razorpayMid,
    headerImageUrl,
    headerText,
    bodyText,
    footerText,
    expirationTimestamp,
    items,
    subtotal,
    tax,
    shipping,
    discount,
    discountDescription,
    currency = 'INR',
    offset = 100,
    orderType = 'digital-goods',
    notes,
  } = opts;

  if (!referenceId) throw new Error('sendOrderDetails: referenceId required');
  if (!configurationName) throw new Error('sendOrderDetails: configurationName required');
  if (!Array.isArray(items) || items.length === 0)
    throw new Error('sendOrderDetails: items required');

  const toMoney = (amt) => ({ value: Math.round(Number(amt || 0) * offset), offset });

  let header;
  if (headerImageUrl) header = { type: 'image', image: { link: headerImageUrl } };
  else if (headerText) header = { type: 'text', text: headerText };

  const totalValue = items.reduce((s, it) => {
    const each = toMoney(it.saleAmount ?? it.amount).value;
    return s + each * (it.quantity || 1);
  }, 0);
  const totalAmount =
    typeof opts.totalAmount === 'number'
      ? toMoney(opts.totalAmount)
      : { value: totalValue, offset };

  const orderItems = items.map((it) => {
    const o = {
      retailer_id: it.retailerId,
      name: it.name,
      amount: toMoney(it.amount),
      quantity: it.quantity || 1,
    };
    if (it.saleAmount !== undefined) o.sale_amount = toMoney(it.saleAmount);
    return o;
  });

  const orderBlock = {
    status: 'pending',
    items: orderItems,
    subtotal: toMoney(subtotal),
  };
  if (tax !== undefined) orderBlock.tax = { value: toMoney(tax) };
  if (shipping !== undefined) orderBlock.shipping = { value: toMoney(shipping) };
  if (discount !== undefined)
    orderBlock.discount = {
      value: toMoney(discount),
      description: discountDescription || 'Discount',
    };

  const paymentSetting = {
    type: 'payment_gateway',
    payment_gateway: {
      type: 'razorpay',
      configuration_name: configurationName,
      razorpay: {
        receipt: `kpg_${String(referenceId).slice(-12)}`,
        notes: { reference_id: String(referenceId), ...(notes || {}) },
      },
    },
  };
  if (razorpayMid) paymentSetting.payment_gateway.razorpay.account_id = razorpayMid;

  const action = {
    name: 'review_and_pay',
    parameters: {
      reference_id: String(referenceId),
      type: orderType,
      currency,
      total_amount: totalAmount,
      order: orderBlock,
      payment_settings: [paymentSetting],
    },
  };
  if (expirationTimestamp) {
    action.parameters.expiration = {
      timestamp: String(expirationTimestamp),
      description: 'Bill expires',
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'order_details',
      body: { text: bodyText },
      action,
    },
  };
  if (header) payload.interactive.header = header;
  if (footerText) payload.interactive.footer = { text: footerText };

  const { data } = await api.post(`${baseUrl}/messages`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/* ─────── Flow management (used by setup scripts) ─────── */

async function createFlow(name, categories = ['OTHER'], { endpointUri } = {}) {
  const { graphRoot, accessToken, wabaId } = cfg();
  const body = { name, categories };
  if (endpointUri) body.endpoint_uri = endpointUri;
  const { data } = await api.post(`${graphRoot}/${wabaId}/flows`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

async function updateFlowJSON(flowId, flowJsonObj) {
  const { graphRoot, accessToken } = cfg();
  const fd = new FormData();
  fd.append('file', Buffer.from(JSON.stringify(flowJsonObj)), {
    filename: 'flow.json',
    contentType: 'application/json',
  });
  fd.append('name', 'flow.json');
  fd.append('asset_type', 'FLOW_JSON');
  const { data } = await api.post(`${graphRoot}/${flowId}/assets`, fd, {
    headers: { Authorization: `Bearer ${accessToken}`, ...fd.getHeaders() },
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
  });
  return data;
}

async function publishFlow(flowId) {
  const { graphRoot, accessToken } = cfg();
  const { data } = await api.post(
    `${graphRoot}/${flowId}/publish`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

async function setFlowEndpoint(flowId, endpointUri, { autoPublish = true } = {}) {
  const { graphRoot, accessToken } = cfg();
  const { data } = await api.post(
    `${graphRoot}/${flowId}`,
    { endpoint_uri: endpointUri },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (autoPublish) {
    try {
      await publishFlow(flowId);
    } catch (err) {
      console.warn(
        '[metaCloud.setFlowEndpoint] re-publish failed:',
        err.response?.data || err.message
      );
    }
  }
  return data;
}

async function uploadBusinessPublicKey(publicKeyPem) {
  const { phoneNumberId, accessToken, graphVersion } = cfg();
  const url = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/whatsapp_business_encryption`;
  const fd = new URLSearchParams();
  fd.append('business_public_key', publicKeyPem);
  const { data } = await api.post(url, fd.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return data;
}

module.exports = {
  cfg,
  sendText,
  sendImage,
  sendDocument,
  sendButtons,
  sendCtaUrl,
  sendFlowMessage,
  sendOrderDetails,
  createFlow,
  updateFlowJSON,
  publishFlow,
  setFlowEndpoint,
  uploadBusinessPublicKey,
};
