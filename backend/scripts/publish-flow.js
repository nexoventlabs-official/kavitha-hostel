/**
 * Publish (or re-publish) the current WhatsApp Flow.
 * Reads WHATSAPP_FLOW_ID from .env.
 *
 * Usage: node scripts/publish-flow.js
 */
require('dotenv').config();
const meta = require('../services/metaCloud');
const { setKeys } = require('./_envFile');

(async () => {
  const flowId = process.env.WHATSAPP_FLOW_ID;
  if (!flowId) {
    console.error('❌ WHATSAPP_FLOW_ID missing in .env');
    process.exit(1);
  }
  try {
    const res = await meta.publishFlow(flowId);
    setKeys({ WHATSAPP_FLOW_STATUS: 'PUBLISHED' });
    console.log('✅ Flow published:', flowId, res);
  } catch (err) {
    console.error('❌ publish failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();
