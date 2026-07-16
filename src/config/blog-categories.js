const BLOG_CATEGORIES = Object.freeze([
  { legacyId: 1, name: 'Unityverse Academy Blog', sortOrder: 1 },
  { legacyId: 2, name: 'Popüler Yazılar', sortOrder: 2 },
  { legacyId: 3, name: 'Sektörde Merak Edilenler', sortOrder: 3 },
  { legacyId: 4, name: 'Sektörden Tasarım Haberleri', sortOrder: 4 },
  { legacyId: 5, name: 'Dijital Oyun Haberleri', sortOrder: 5 },
  { legacyId: 6, name: 'Yazılım Alanında En Güncel Yazılar', sortOrder: 6 },
  { legacyId: 7, name: "Dünya'dan Haberler", sortOrder: 7 },
  { legacyId: 8, name: "Dünya'dan Kültür Sanat Haberleri", sortOrder: 8 },
  { legacyId: 9, name: 'Sektörde Merak Edilenler', sortOrder: 9 },
  {
    legacyId: 10,
    name: 'ÇALIŞMA HAYATINA ATILAN MEZUNLARIMIZIN BAŞARI HİKAYELERİ',
    sortOrder: 10
  },
  { legacyId: 11, name: 'Grafik Tasarım', sortOrder: 11 },
  { legacyId: 12, name: 'Mimarlık Eğitimleri', sortOrder: 12 }
].map(Object.freeze));

const BLOG_CATEGORY_BY_LEGACY_ID = new Map(
  BLOG_CATEGORIES.map((category) => [category.legacyId, category])
);

function blogCategoryByLegacyId(value) {
  const legacyId = Number(value);
  return Number.isInteger(legacyId) ? BLOG_CATEGORY_BY_LEGACY_ID.get(legacyId) || null : null;
}

module.exports = {
  BLOG_CATEGORIES,
  blogCategoryByLegacyId
};
