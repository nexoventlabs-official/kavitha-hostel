/**
 * Generate an RSA-2048 keypair for WhatsApp Flow encryption.
 * Writes flow_keys/private.pem & flow_keys/public.pem and prints the values
 * you must paste into .env.
 *
 * Usage: npm run flow:keys
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const outDir = path.join(__dirname, '..', 'flow_keys');
fs.mkdirSync(outDir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.writeFileSync(path.join(outDir, 'private.pem'), privateKey);
fs.writeFileSync(path.join(outDir, 'public.pem'), publicKey);

const escape = (s) => s.replace(/\r?\n/g, '\\n');

console.log('\n✅ Keys generated in flow_keys/');
console.log('\n────── Paste into backend/.env ──────\n');
console.log(`FLOW_PRIVATE_KEY="${escape(privateKey.trim())}"`);
console.log(`FLOW_PUBLIC_KEY="${escape(publicKey.trim())}"`);
console.log('\nThen run:  npm run flow:upload-key');
