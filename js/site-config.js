// Single source of truth for social links and the Google rating shown on
// reviews.html and in the shared footer (js/site-footer.js). Must be
// included before both. Rating/count are left as clearly-marked
// placeholders — the business owner fills in the real numbers.
window.SOCIAL_LINKS = {
  telegram: 'https://t.me/Digital_Pc',
  instagram: 'https://www.instagram.com/digital_pc_dnipro',
  tiktok: 'https://www.tiktok.com/@digital_pc_dnipro_',
  prom: 'https://digitalpcdnipro.prom.ua/',
  olx: 'https://www.olx.ua/list/user/10oQVa/',
  googleMaps: 'https://maps.app.goo.gl/3UGbwDkkfadHymnSA?g_st=com.google.maps.preview.copy'
};

window.GOOGLE_MAPS_URL = window.SOCIAL_LINKS.googleMaps;
window.TELEGRAM_URL = window.TELEGRAM_URL || window.SOCIAL_LINKS.telegram;

// TODO: replace with the real values from the Google Business listing.
window.googleRating = typeof window.googleRating === 'number' ? window.googleRating : 5.0;
window.googleReviewCount = typeof window.googleReviewCount === 'number' ? window.googleReviewCount : 54;
