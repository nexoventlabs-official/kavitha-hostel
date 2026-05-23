const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Branch = require('../models/Branch');
const InboundMessage = require('../models/InboundMessage');

const router = express.Router();

router.get('/registered', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const branchId = req.query.branch || '';
    const filter = {};
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { phone: new RegExp(q, 'i') },
        { roomNumber: new RegExp(q, 'i') },
      ];
    }
    if (branchId) filter.branch = branchId;
    const users = await User.find(filter)
      .populate('branch', 'code name')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/non-registered', auth, async (_req, res) => {
  try {
    const registered = await User.find({}, { phone: 1 }).lean();
    const set = new Set(registered.map((u) => u.phone));
    const inb = await InboundMessage.find({}).sort({ lastSeenAt: -1 }).lean();
    res.json({ users: inb.filter((m) => !set.has(m.phone)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  const u = await User.findById(req.params.id).populate('branch').lean();
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ user: u });
});

router.delete('/:id', auth, async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
