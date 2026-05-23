/**
 * Update Meta flow endpoint and webhook to production URLs.
 *
 * This script updates:
 * 1. Flow endpoint URI to BACKEND_URL + /api/flow-endpoint
 * 2. Webhook URL to BACKEND_URL + /api/webhook/meta
 *
 * Usage: node scripts/update-production-urls.js
 */
require('dotenv').config();
const axios = require('axios');
const meta = require('../services/metaCloud');

const BACKEND_URL = process.env.BACKEND_URL;
const FLOW_ID = process.env.WHATSAPP_FLOW_ID;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';

if (!BACKEND_URL) {
  console.error('❌ BACKEND_URL missing in .env');
  process.exit(1);
}
if (!FLOW_ID) {
  console.error('❌ WHATSAPP_FLOW_ID missing in .env');
  process.exit(1);
}
if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error('❌ META_PHONE_NUMBER_ID or META_ACCESS_TOKEN missing in .env');
  process.exit(1);
}

const flowEndpoint = `${BACKEND_URL}/api/flow-endpoint`;
const webhookUrl = `${BACKEND_URL}/api/webhook/meta`;

console.log('🔧 Updating Meta configuration to production URLs:');
console.log('   Flow endpoint:', flowEndpoint);
console.log('   Webhook URL:', webhookUrl);
console.log('   Flow ID:', FLOW_ID);
console.log('');

(async () => {
  try {
    // 1. Update flow endpoint
    console.log('📡 Updating flow endpoint...');
    await meta.setFlowEndpoint(FLOW_ID, flowEndpoint, { autoPublish: true });
    console.log('✅ Flow endpoint updated and re-published');
  } catch (err) {
    console.error('❌ Failed to update flow endpoint:', err.response?.data || err.message);
    process.exit(1);
  }

  try {
    // 2. Update webhook
    console.log('📡 Updating webhook URL...');
    const webhookPayload = {
      url: webhookUrl,
      verify_token: process.env.META_VERIFY_TOKEN || 'kavitha_pg_verify',
      fields: ['messages'],
    };
    const webhookRes = await axios.post(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/subscriptions`,
      webhookPayload,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { access_token: ACCESS_TOKEN },
      }
    );
    console.log('✅ Webhook updated:', webhookRes.data);
  } catch (err) {
    console.error('❌ Failed to update webhook:', err.response?.data || err.message);
    console.log('   You may need to update the webhook manually in Meta Developer Portal');
  }

  console.log('');
  console.log('✅ Production URL update complete!');
  console.log('   Flow endpoint:', flowEndpoint);
  console.log('   Webhook URL:', webhookUrl);
})();
