/**
 * Push the latest flow JSON (services/flowJson.js) to Meta and re-publish.
 * Reads WHATSAPP_FLOW_ID from .env.
 *
 * Usage: node scripts/update-flow-json.js
 */
require('dotenv').config();
const meta = require('../services/metaCloud');
const { buildFlowJSON } = require('../services/flowJson');
const { setKeys } = require('./_envFile');

(async () => {
  const flowId = process.env.WHATSAPP_FLOW_ID;
  if (!flowId) {
    console.error('❌ WHATSAPP_FLOW_ID missing in .env — run setup-all.js first');
    process.exit(1);
  }
  try {
    await meta.updateFlowJSON(flowId, buildFlowJSON());
    console.log('✅ Flow JSON updated for flow', flowId);
    try {
      await meta.publishFlow(flowId);
      setKeys({ WHATSAPP_FLOW_STATUS: 'PUBLISHED' });
      console.log('✅ Flow re-published');
    } catch (err) {
      console.warn('⚠️  publish failed (may already be published):', err.response?.data?.error?.message || err.message);
    }
  } catch (err) {
    console.error('❌ updateFlowJSON failed:', err.response?.data || err.message);
    process.exit(1);
  }
})();
