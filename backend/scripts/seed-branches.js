require('dotenv').config();
const mongoose = require('mongoose');
const Branch = require('../models/Branch');

const SAMPLE_BRANCHES = [
  {
    code: 'MAIN',
    name: 'Kavitha PG — Main Branch',
    address: 'Tamil Nadu',
    reviewUrl: 'https://g.page/r/CXxxxxxxxxxx/review',
    websiteUrl: 'https://kavithapg.example.com',
    contactPhone: '+91-9999999999',
    sheetTab: 'MAIN',
  },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const b of SAMPLE_BRANCHES) {
    await Branch.findOneAndUpdate(
      { code: b.code },
      { $set: b },
      { upsert: true, new: true }
    );
    console.log('✅ branch:', b.code);
  }
  await mongoose.disconnect();
})();
