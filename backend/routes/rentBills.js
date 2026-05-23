const express = require('express');
const auth = require('../middleware/auth');
const RentBill = require('../models/RentBill');
const User = require('../models/User');
const Branch = require('../models/Branch');

const router = express.Router();

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthLabelFromKey(monthKey) {
  const [y, m] = String(monthKey || '').split('-').map(Number);
  if (!y || !m) return '';
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

router.get('/', auth, async (req, res) => {
  try {
    const { branch, monthKey, paid, q } = req.query;
    const filter = {};
    if (branch) filter.branch = branch;
    if (monthKey) filter.monthKey = monthKey;
    if (paid === 'true') filter.paid = true;
    if (paid === 'false') filter.paid = false;

    let bills = await RentBill.find(filter)
      .populate('user', 'name phone roomNumber block branchCode')
      .populate('branch', 'code name')
      .sort({ createdAt: -1 })
      .lean();

    if (q) {
      const re = new RegExp(q, 'i');
      bills = bills.filter(
        (b) =>
          (b.user?.name && re.test(b.user.name)) ||
          (b.user?.phone && re.test(b.user.phone)) ||
          (b.user?.roomNumber && re.test(b.user.roomNumber))
      );
    }
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { userId, monthKey, rentAmount, ebAmount, otherAmount, notes } = req.body;
    if (!userId || !monthKey)
      return res.status(400).json({ error: 'userId and monthKey required' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.branch) return res.status(400).json({ error: 'User has no branch assigned' });

    const bill = await RentBill.findOneAndUpdate(
      { user: user._id, monthKey },
      {
        $set: {
          user: user._id,
          branch: user.branch,
          monthKey,
          monthLabel: monthLabelFromKey(monthKey),
          roomNumber: user.roomNumber,
          rentAmount: Number(rentAmount) || 0,
          ebAmount: Number(ebAmount) || 0,
          otherAmount: Number(otherAmount) || 0,
          notes: (notes || '').trim(),
        },
      },
      { upsert: true, new: true }
    );
    // Trigger pre-save total recompute
    bill.totalAmount =
      (bill.rentAmount || 0) + (bill.ebAmount || 0) + (bill.otherAmount || 0);
    await bill.save();
    res.json({ bill });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Split a room's monthly electricity bill equally among all residents of that room.
 *
 * Body: { branch, roomNumber, monthKey, ebAmount, block? }
 *
 * - Finds every User in the given branch + roomNumber (+ block if supplied).
 * - Divides ebAmount by the number of residents (whole rupees; rounding
 *   remainder goes to the last resident so the totals always reconcile).
 * - Upserts each resident's RentBill for that monthKey, setting only the
 *   `ebAmount` field. Rent + Other on existing bills are preserved.
 */
router.post('/room-eb', auth, async (req, res) => {
  try {
    const { branch, roomNumber, monthKey, ebAmount, block } = req.body;
    if (!branch || !roomNumber || !monthKey)
      return res.status(400).json({ error: 'branch, roomNumber and monthKey are required' });
    const total = Number(ebAmount);
    if (!Number.isFinite(total) || total < 0)
      return res.status(400).json({ error: 'ebAmount must be a non-negative number' });

    const userFilter = { branch, roomNumber: String(roomNumber).trim() };
    if (block) userFilter.block = String(block).trim();

    const users = await User.find(userFilter).sort({ name: 1 });
    if (users.length === 0)
      return res.status(404).json({ error: 'No residents found in that room' });

    const n = users.length;
    const baseShare = Math.floor(total / n);
    const remainder = total - baseShare * n; // tacked onto the last person

    const results = [];
    for (let i = 0; i < n; i++) {
      const u = users[i];
      const share = baseShare + (i === n - 1 ? remainder : 0);

      const bill = await RentBill.findOneAndUpdate(
        { user: u._id, monthKey },
        {
          $set: {
            user: u._id,
            branch: u.branch,
            monthKey,
            monthLabel: monthLabelFromKey(monthKey),
            roomNumber: u.roomNumber,
            ebAmount: share,
          },
          $setOnInsert: { rentAmount: 0, otherAmount: 0 },
        },
        { upsert: true, new: true }
      );
      // Recompute total (pre-save hook also covers this but be explicit)
      bill.totalAmount =
        (bill.rentAmount || 0) + (bill.ebAmount || 0) + (bill.otherAmount || 0);
      await bill.save();

      results.push({
        userId: u._id,
        name: u.name,
        phone: u.phone,
        share,
        billId: bill._id,
        total: bill.totalAmount,
      });
    }

    res.json({
      branch,
      roomNumber,
      block: block || '',
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      totalEb: total,
      perPersonBase: baseShare,
      residents: n,
      results,
    });
  } catch (err) {
    console.error('[rentBills] room-eb failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const bill = await RentBill.findById(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Not found' });
    const fields = ['rentAmount', 'ebAmount', 'otherAmount', 'notes', 'paid', 'monthKey'];
    for (const k of fields) {
      if (req.body[k] !== undefined) bill[k] = req.body[k];
    }
    if (req.body.monthKey) bill.monthLabel = monthLabelFromKey(req.body.monthKey);
    if (req.body.paid === true && !bill.paidAt) bill.paidAt = new Date();
    if (req.body.paid === false) {
      bill.paidAt = null;
      bill.paymentId = '';
    }
    await bill.save();
    res.json({ bill });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  await RentBill.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
