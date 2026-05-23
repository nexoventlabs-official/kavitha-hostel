/**
 * Public registration flow:
 *   GET  /api/register/init?t=<token>   → validate token, return branches + locked phone
 *   POST /api/register/submit           → multipart form with photo + aadhar files
 *
 * On successful submission we:
 *   1. Upload the cropped photo + aadhar to Cloudinary
 *   2. Save the User record
 *   3. Generate the registration PDF, upload to Cloudinary
 *   4. Send the PDF + Choose-Service CTA to the user's WhatsApp
 *   5. Sync the resident row to Google Sheets (branch-wise tab)
 */
const express = require('express');
const multer = require('multer');

const RegistrationToken = require('../models/RegistrationToken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Pdf = require('../models/Pdf');

const { uploadBuffer, uploadRawBuffer } = require('../services/cloudinary');
const { buildRegistrationPdf } = require('../services/pdfGen');
const meta = require('../services/metaCloud');
const chatbot = require('../services/chatbot');
const { t } = require('../services/i18n');
const googleSheets = require('../services/googleSheets');
const flowImages = require('../services/flowImages');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = express.Router();

router.get('/init', async (req, res) => {
  try {
    const token = (req.query.t || '').trim();
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const reg = await RegistrationToken.findOne({ token });
    if (!reg) return res.status(404).json({ error: 'Invalid or expired link' });
    if (reg.usedAt) return res.status(410).json({ error: 'This link has already been used' });
    if (reg.expiresAt < new Date())
      return res.status(410).json({ error: 'This link has expired. Please request a new one from WhatsApp.' });

    const branches = await Branch.find({ active: true })
      .sort({ name: 1 })
      .select('code name blocks')
      .lean();

    const existing = await User.findOne({ phone: reg.phone }).lean();

    res.json({
      phone: reg.phone,
      branches,
      alreadyRegistered: !!existing,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const fields = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'aadhar', maxCount: 1 },
]);

router.post('/submit', fields, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token' });
    const reg = await RegistrationToken.findOne({ token });
    if (!reg) return res.status(404).json({ error: 'Invalid token' });
    if (reg.usedAt) return res.status(410).json({ error: 'This link has already been used' });
    if (reg.expiresAt < new Date()) return res.status(410).json({ error: 'This link has expired' });

    const required = ['name', 'branchId', 'block', 'dateJoined', 'roomNumber', 'age', 'gender'];
    for (const k of required) {
      if (!req.body[k]) return res.status(400).json({ error: `Field "${k}" is required` });
    }

    const branch = await Branch.findById(req.body.branchId);
    if (!branch) return res.status(400).json({ error: 'Invalid branch' });

    const photoFile = req.files?.photo?.[0];
    const aadharFile = req.files?.aadhar?.[0];
    if (!photoFile) return res.status(400).json({ error: 'Passport photo is required' });
    if (!aadharFile) return res.status(400).json({ error: 'Aadhar proof is required' });

    // Upload images
    const [photoUp, aadharUp] = await Promise.all([
      uploadBuffer(photoFile.buffer, { folder: `kavitha-pg/residents/${reg.phone}/photo` }),
      uploadBuffer(aadharFile.buffer, { folder: `kavitha-pg/residents/${reg.phone}/aadhar` }),
    ]);

    const userPayload = {
      phone: reg.phone,
      name: req.body.name.trim(),
      branch: branch._id,
      branchCode: branch.code,
      block: req.body.block.trim(),
      roomNumber: req.body.roomNumber.trim(),
      dateJoined: req.body.dateJoined,
      mobile: (req.body.mobile || '').trim(),
      workAddress: (req.body.workAddress || '').trim(),
      age: Number(req.body.age) || null,
      gender: (req.body.gender || '').toLowerCase(),
      fatherName: (req.body.fatherName || '').trim(),
      fatherMobile: (req.body.fatherMobile || '').trim(),
      motherName: (req.body.motherName || '').trim(),
      motherMobile: (req.body.motherMobile || '').trim(),
      livingAddress: (req.body.livingAddress || '').trim(),
      photoUrl: photoUp.secure_url,
      photoPublicId: photoUp.public_id,
      aadharUrl: aadharUp.secure_url,
      aadharPublicId: aadharUp.public_id,
      registeredAt: new Date(),
    };

    const user = await User.findOneAndUpdate(
      { phone: reg.phone },
      { $set: userPayload },
      { upsert: true, new: true }
    );

    // Generate registration PDF
    let pdfUrl = '';
    try {
      const pdfBuffer = await buildRegistrationPdf({
        user: user.toObject(),
        branch: branch.toObject(),
      });
      const pdfUp = await uploadRawBuffer(pdfBuffer, {
        folder: `kavitha-pg/residents/${reg.phone}/registration`,
        originalName: `${user.name.replace(/[^\w]+/g, '_')}_Registration.pdf`,
      });
      pdfUrl = pdfUp.secure_url;
      user.registrationPdfUrl = pdfUrl;
      user.registrationPdfPublicId = pdfUp.public_id;
      await user.save();
    } catch (err) {
      console.error('[register] PDF gen failed:', err.message);
    }

    // Mark token used
    reg.usedAt = new Date();
    await reg.save();

    // Google Sheets sync (non-blocking)
    googleSheets
      .upsertUser(user.toObject(), branch.toObject())
      .catch((err) => console.warn('[register] sheets sync failed:', err.message));

    // Send the registration PDF + Choose-Service CTA on WhatsApp (non-blocking)
    (async () => {
      try {
        const lang = await chatbot.getLanguage(reg.phone);
        const flowId = process.env.WHATSAPP_FLOW_ID;
        const mode =
          String(process.env.WHATSAPP_FLOW_STATUS || '').toUpperCase() === 'PUBLISHED'
            ? 'published'
            : 'draft';

        const fileName = `${user.name.replace(/[^\w]+/g, '_')}_Registration.pdf`;
        const bodyText = t('register_done_body', lang, { name: user.name });

        if (pdfUrl && flowId) {
          await meta.sendFlowMessage(reg.phone, {
            flowId,
            flowCta: t('choose_service_cta', lang),
            headerDocumentUrl: pdfUrl,
            headerDocumentFilename: fileName,
            bodyText,
            footerText: 'Kavitha PG',
            flowToken: `welcome_${reg.phone}_${lang}`,
            mode,
          });
        } else if (pdfUrl) {
          await meta.sendDocument(reg.phone, pdfUrl, { filename: fileName, caption: bodyText });
        } else {
          await meta.sendText(reg.phone, bodyText);
        }
      } catch (err) {
        console.error('[register] WhatsApp delivery failed:', err.response?.data || err.message);
      }
    })();

    res.json({
      ok: true,
      pdfUrl,
      user: { id: user._id, name: user.name, phone: user.phone },
    });
  } catch (err) {
    console.error('[register] submit error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
