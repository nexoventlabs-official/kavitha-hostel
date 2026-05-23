const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Branch = require('../models/Branch');
const RentBill = require('../models/RentBill');
const InboundMessage = require('../models/InboundMessage');

const router = express.Router();

router.get('/stats', auth, async (_req, res) => {
  try {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [registered, branches, contacts, pendingBills, paidBills] = await Promise.all([
      User.countDocuments(),
      Branch.countDocuments({ active: true }),
      InboundMessage.countDocuments(),
      RentBill.countDocuments({ monthKey, paid: false }),
      RentBill.countDocuments({ monthKey, paid: true }),
    ]);

    const collectedAgg = await RentBill.aggregate([
      { $match: { monthKey, paid: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const pendingAgg = await RentBill.aggregate([
      { $match: { monthKey, paid: false } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('branch', 'code name')
      .lean();

    res.json({
      stats: {
        registeredUsers: registered,
        nonRegisteredUsers: Math.max(contacts - registered, 0),
        branches,
        pendingBills,
        paidBills,
        collectedThisMonth: collectedAgg[0]?.total || 0,
        pendingThisMonth: pendingAgg[0]?.total || 0,
      },
      recentUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
