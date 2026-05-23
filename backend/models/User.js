const mongoose = require('mongoose');

/**
 * A registered PG resident.
 * `phone` is the WhatsApp number (E.164 digits, no +). It is the unique identifier the bot uses.
 */
const UserSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },

    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    branchCode: { type: String, default: '', uppercase: true, trim: true },
    block: { type: String, default: '', trim: true },
    roomNumber: { type: String, default: '', trim: true },
    dateJoined: { type: String, default: '' }, // yyyy-mm-dd

    mobile: { type: String, default: '', trim: true }, // optional secondary number
    workAddress: { type: String, default: '', trim: true },
    age: { type: Number, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },

    // Parent details
    fatherName: { type: String, default: '', trim: true },
    fatherMobile: { type: String, default: '', trim: true },
    motherName: { type: String, default: '', trim: true },
    motherMobile: { type: String, default: '', trim: true },
    livingAddress: { type: String, default: '', trim: true },

    // Uploaded assets (Cloudinary)
    photoUrl: { type: String, default: '' },
    photoPublicId: { type: String, default: '' },
    aadharUrl: { type: String, default: '' },
    aadharPublicId: { type: String, default: '' },

    // Auto-generated registration PDF (Cloudinary, resource_type=raw)
    registrationPdfUrl: { type: String, default: '' },
    registrationPdfPublicId: { type: String, default: '' },

    // Preferred chat language
    language: { type: String, enum: ['en', 'ta'], default: 'en' },

    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
