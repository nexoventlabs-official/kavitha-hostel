/**
 * Bilingual copy (English + Tamil) for all bot-facing messages.
 *
 * Keep keys short and meaningful. Use {placeholders} where dynamic values are
 * inserted via the small `t()` helper.
 */

const STRINGS = {
  welcome_body: {
    en: 'Welcome to *Kavitha PG* 🏠\n\nPlease choose your language to continue.',
    ta: 'வணக்கம்! *கவிதா PG*-க்கு உங்களை வரவேற்கிறோம் 🏠\n\nதொடர மொழியை தேர்வு செய்யவும்.',
  },
  welcome_footer: { en: 'Kavitha PG', ta: 'கவிதா PG' },
  lang_button_en: { en: 'English', ta: 'English' },
  lang_button_ta: { en: 'தமிழ்', ta: 'தமிழ்' },

  lang_set: {
    en: '✅ Language set to *English*.',
    ta: '✅ மொழி *தமிழ்* ஆக அமைக்கப்பட்டது.',
  },

  choose_service_body: {
    en: 'How can we help today?\n\nTap *Choose Service* below to see all options.',
    ta: 'எவ்வாறு உதவலாம்?\n\nகீழே *சேவையை தேர்வுசெய்க* என்பதை அழுத்தவும்.',
  },
  choose_service_cta: { en: 'Choose Service', ta: 'சேவையை தேர்வுசெய்' },
  choose_service_footer: { en: 'Kavitha PG', ta: 'கவிதா PG' },

  // Service screen heading shown inside the flow
  flow_heading_unregistered: { en: 'Welcome to Kavitha PG', ta: 'கவிதா PG-க்கு வரவேற்கிறோம்' },
  flow_subheading_unregistered: {
    en: 'Pick a service below.',
    ta: 'கீழே ஒரு சேவையை தேர்வு செய்யவும்.',
  },
  flow_heading_registered: { en: 'Hi {name} 👋', ta: 'வணக்கம் {name} 👋' },
  flow_subheading_registered: { en: 'How can we help?', ta: 'எவ்வாறு உதவலாம்?' },

  // Service titles / descriptions
  svc_register: { en: 'Register', ta: 'பதிவு செய்' },
  svc_register_desc: { en: 'Join Kavitha PG', ta: 'கவிதா PG-இல் சேர' },
  svc_per_month_cost: { en: 'Per Month Cost', ta: 'மாத கட்டணம்' },
  svc_per_month_cost_desc: { en: 'View pricing PDF', ta: 'விலை PDF காண்' },
  svc_food_timings: { en: 'Food Timings', ta: 'உணவு நேரம்' },
  svc_food_timings_desc: { en: 'Meal schedule', ta: 'உணவு அட்டவணை' },
  svc_hostel_rules: { en: 'Hostel Rules', ta: 'விடுதி விதிகள்' },
  svc_hostel_rules_desc: { en: 'House rules PDF', ta: 'விதிமுறை PDF' },
  svc_change_language: { en: 'Change Language', ta: 'மொழியை மாற்று' },
  svc_change_language_desc: { en: 'English / Tamil', ta: 'ஆங்கிலம் / தமிழ்' },
  svc_contact: { en: 'Contact', ta: 'தொடர்பு' },
  svc_contact_desc: { en: 'Talk to our team', ta: 'எங்களை தொடர்பு கொள்ள' },

  svc_pay_rent: { en: 'Pay Rent', ta: 'வாடகை செலுத்து' },
  svc_pay_rent_desc: { en: 'Pay this month bill', ta: 'இம்மாத பில் செலுத்த' },
  svc_website: { en: 'Website', ta: 'வலைதளம்' },
  svc_website_desc: { en: 'Visit our website', ta: 'எங்கள் வலைதளம்' },
  svc_review: { en: 'Review & Rating', ta: 'மதிப்பீடு & கருத்து' },
  svc_review_desc: { en: 'Rate us on Google', ta: 'கூகுள் மதிப்பீடு' },

  // Register CTA
  register_body: {
    en:
      '📝 *Resident Registration*\n\n' +
      'Tap below to fill the registration form. Your WhatsApp number will be pre-filled.\n\n' +
      '_The link is personal and expires in 24 hours._',
    ta:
      '📝 *பதிவு படிவம்*\n\n' +
      'கீழே உள்ள பொத்தானை அழுத்தி படிவத்தை நிரப்பவும். உங்கள் வாட்ஸ்அப் எண் தானாகவே நிரப்பப்படும்.\n\n' +
      '_இந்த இணைப்பு உங்களுக்கு மட்டுமே, 24 மணி நேரத்தில் முடிவடையும்._',
  },
  register_cta: { en: 'Register Now', ta: 'இப்போதே பதிவு செய்' },

  // PDF message body
  pdf_body: {
    en: '*{name}*\n\n{description}',
    ta: '*{name}*\n\n{description}',
  },

  // Contact / website / review
  contact_body: {
    en:
      '📞 *Contact Us*\n\n' +
      'Reach our team any time:\n\n' +
      '*Phone:* {phone}\n' +
      '*Address:* {address}\n\n' +
      'You can also tap the number above to call directly.',
    ta:
      '📞 *எங்களை தொடர்பு கொள்ள*\n\n' +
      'எப்போது வேண்டுமானாலும் தொடர்பு கொள்ளலாம்:\n\n' +
      '*தொலைபேசி:* {phone}\n' +
      '*முகவரி:* {address}\n\n' +
      'மேலே உள்ள எண்ணை அழுத்தி நேரடியாக அழைக்கலாம்.',
  },

  website_body: {
    en: '🌐 *Kavitha PG*\n\nTap below to visit our website and learn more about our branches, food, and pricing.',
    ta: '🌐 *கவிதா PG*\n\nஎங்கள் விடுதிகள், உணவு, விலை குறித்து மேலும் அறிய கீழே உள்ள பொத்தானை அழுத்தவும்.',
  },
  website_cta: { en: 'Open Website', ta: 'வலைதளம் திற' },

  review_body: {
    en:
      '⭐ *Rate your stay*\n\n' +
      'We would love to hear how your experience at *{branch}* has been.\n\n' +
      'Tap below to leave a Google review — it takes less than a minute. Thank you 🙏',
    ta:
      '⭐ *உங்கள் தங்குதலை மதிப்பீடு செய்க*\n\n' +
      '*{branch}*-இல் உங்கள் அனுபவம் எப்படி இருந்தது என்பதை அறிய ஆவலாக உள்ளோம்.\n\n' +
      'கீழே உள்ள பொத்தானை அழுத்தி கூகுளில் மதிப்பீடு அளிக்கவும். நன்றி 🙏',
  },
  review_cta: { en: 'Write a Review', ta: 'கருத்து எழுதவும்' },

  // Pay rent — bill summary message
  rent_caption: {
    en:
      '🧾 *Rent Bill — {month}*\n\n' +
      '*Name:* {name}\n' +
      '*Room:* {room}\n' +
      '*Branch:* {branch}\n\n' +
      '```\n' +
      'Rent       ₹{rent}\n' +
      'EB Bill    ₹{eb}\n' +
      '{otherLine}' +
      '---------------------\n' +
      'Total      ₹{total}\n' +
      '```\n\n' +
      'Tap *Pay Now* below to complete the payment securely.',
    ta:
      '🧾 *வாடகை பில் — {month}*\n\n' +
      '*பெயர்:* {name}\n' +
      '*அறை:* {room}\n' +
      '*கிளை:* {branch}\n\n' +
      '```\n' +
      'வாடகை      ₹{rent}\n' +
      'மின் கட்டணம் ₹{eb}\n' +
      '{otherLine}' +
      '---------------------\n' +
      'மொத்தம்     ₹{total}\n' +
      '```\n\n' +
      'பாதுகாப்பாக செலுத்த கீழே *Pay Now* அழுத்தவும்.',
  },
  pay_now_cta: { en: 'Pay Now', ta: 'இப்போது செலுத்து' },

  no_bill_body: {
    en:
      '👌 You have no pending rent bill at the moment.\n\n' +
      'Our admin will share your next month bill here as soon as it is ready.',
    ta:
      '👌 தற்போது நிலுவை வாடகை எதுவும் இல்லை.\n\n' +
      'அடுத்த மாத பில் தயாரானவுடன் இங்கு பகிரப்படும்.',
  },
  bill_already_paid: {
    en: '✅ Your *{month}* rent is already marked as paid. Thank you!',
    ta: '✅ உங்கள் *{month}* வாடகை ஏற்கனவே செலுத்தப்பட்டுள்ளது. நன்றி!',
  },

  payment_success_body: {
    en:
      '✅ *Payment Successful!*\n\n' +
      '*Amount:* ₹{amount}\n' +
      '*Month:* {month}\n' +
      '*Reference:* {ref}\n\n' +
      'Thank you for staying with Kavitha PG 🙏',
    ta:
      '✅ *பணம் வெற்றிகரமாக செலுத்தப்பட்டது!*\n\n' +
      '*தொகை:* ₹{amount}\n' +
      '*மாதம்:* {month}\n' +
      '*குறிப்பு எண்:* {ref}\n\n' +
      'கவிதா PG-உடன் தங்கியதற்கு நன்றி 🙏',
  },

  register_done_body: {
    en:
      '🎉 *Registration successful!*\n\n' +
      'Welcome to *Kavitha PG*, {name}!\n\n' +
      'Your registration form is attached above. You can now access *Pay Rent*, *Review & Rating* and more from the menu.',
    ta:
      '🎉 *பதிவு வெற்றி!*\n\n' +
      '*கவிதா PG*-க்கு உங்களை வரவேற்கிறோம், {name}!\n\n' +
      'உங்கள் பதிவு படிவம் மேலே இணைக்கப்பட்டுள்ளது. இனி *வாடகை செலுத்து*, *மதிப்பீடு* போன்ற சேவைகளை மெனுவில் பெறலாம்.',
  },

  fallback_prompt: {
    en: 'Type *hi* to open the menu.',
    ta: '*hi* என தட்டச்சு செய்து மெனுவை திறக்கவும்.',
  },

  not_registered_for_rent: {
    en:
      'You are not registered yet. Please tap *Register* in the menu to create your profile first.',
    ta:
      'நீங்கள் இன்னும் பதிவு செய்யவில்லை. முதலில் மெனுவில் *பதிவு செய்* என்பதை அழுத்தி பதிவை முடிக்கவும்.',
  },
};

function t(key, lang = 'en', vars = {}) {
  const entry = STRINGS[key];
  if (!entry) return key;
  const raw = entry[lang] || entry.en || '';
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

module.exports = { t, STRINGS };
