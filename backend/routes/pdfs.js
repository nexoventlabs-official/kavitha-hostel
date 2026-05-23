const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Pdf = require('../models/Pdf');
const { uploadRawBuffer, destroy } = require('../services/cloudinary');

const VALID_SLOTS = ['per_month_cost', 'food_timings', 'hostel_rules'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF uploads allowed'));
    cb(null, true);
  },
});

const router = express.Router();

router.get('/', auth, async (_req, res) => {
  const pdfs = await Pdf.find({}).sort({ slot: 1 }).lean();
  // Pad with empty placeholders for the slots that have not been uploaded yet
  const bySlot = new Map(pdfs.map((p) => [p.slot, p]));
  const out = VALID_SLOTS.map((slot) => bySlot.get(slot) || { slot, name: '', pdfUrl: '', active: false });
  res.json({ pdfs: out });
});

router.post('/:slot', auth, upload.single('pdf'), async (req, res) => {
  try {
    const { slot } = req.params;
    if (!VALID_SLOTS.includes(slot)) return res.status(400).json({ error: 'invalid slot' });
    const { name, description, active } = req.body;
    const file = req.file;
    if (!file && !await Pdf.findOne({ slot }))
      return res.status(400).json({ error: 'pdf file required' });

    let doc = await Pdf.findOne({ slot });
    if (doc && file) {
      if (doc.pdfPublicId) await destroy(doc.pdfPublicId, { resource_type: 'raw' }).catch(() => {});
    }

    let pdfUrl = doc?.pdfUrl;
    let pdfPublicId = doc?.pdfPublicId;
    if (file) {
      const up = await uploadRawBuffer(file.buffer, {
        folder: `kavitha-pg/pdfs/${slot}`,
        originalName: file.originalname,
      });
      pdfUrl = up.secure_url;
      pdfPublicId = up.public_id;
    }

    const payload = {
      slot,
      name: (name || slot).trim(),
      description: (description || '').trim(),
      pdfUrl,
      pdfPublicId,
      active: active === 'false' || active === false ? false : true,
    };

    doc = await Pdf.findOneAndUpdate({ slot }, { $set: payload }, { upsert: true, new: true });
    res.json({ pdf: doc });
  } catch (err) {
    console.error('[pdfs] upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:slot', auth, async (req, res) => {
  const doc = await Pdf.findOne({ slot: req.params.slot });
  if (doc?.pdfPublicId) await destroy(doc.pdfPublicId, { resource_type: 'raw' }).catch(() => {});
  await Pdf.deleteOne({ slot: req.params.slot });
  res.json({ ok: true });
});

module.exports = router;
