const express = require('express');
const auth = require('../middleware/auth');
const Branch = require('../models/Branch');

const router = express.Router();

router.get('/', async (_req, res) => {
  // Public list (registration form needs it)
  const branches = await Branch.find({ active: true }).sort({ name: 1 }).lean();
  res.json({ branches });
});

router.get('/all', auth, async (_req, res) => {
  const branches = await Branch.find({}).sort({ name: 1 }).lean();
  res.json({ branches });
});

router.post('/', auth, async (req, res) => {
  try {
    const { code, name, address, reviewUrl, websiteUrl, contactPhone, sheetTab, active } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name required' });
    const doc = await Branch.create({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      address: address || '',
      reviewUrl: reviewUrl || '',
      websiteUrl: websiteUrl || '',
      contactPhone: contactPhone || '',
      sheetTab: sheetTab || '',
      active: active === false ? false : true,
    });
    res.json({ branch: doc });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: 'Branch code already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const allowed = ['name', 'address', 'reviewUrl', 'websiteUrl', 'contactPhone', 'sheetTab', 'active'];
    const update = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    const doc = await Branch.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ branch: doc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  await Branch.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
