// Footer'dan istenmeyen sozlesme linkini kaldirir.
//
// Mimar karari (2026-10-01): "Kişisel Verilerin Korunması Hakkında Aydınlatma Bildirimi" linki
// footer'dan cikarilacak. Link 629 statik HTML dosyasinda bulunuyor; dosyalari tek tek duzenlemek
// yerine render aninda TEK YERDEN kaldirilir (repo deseni: enhanceLegacyHtml zinciri).
// Diger footer linklerine dokunulmaz.

const KALDIRILAN_FOOTER_YOLU = '/sayfa/kisisel-verilerin-korunmasi-hakkinda-aydinlatma-bildirimi-29/';

// Linki ve onu saran <li> ogesini birlikte kaldirir; <li> yoksa yalnizca <a> kaldirilir.
const LI_DESENI = new RegExp(
  `<li\\b[^>]*>\\s*(?:<[^>]+>\\s*)*<a\\b[^>]*href=["'][^"']*${KALDIRILAN_FOOTER_YOLU.replace(/[/-]/g, '\\$&')}["'][\\s\\S]*?<\\/li\\s*>`,
  'gi'
);
const A_DESENI = new RegExp(
  `<a\\b[^>]*href=["'][^"']*${KALDIRILAN_FOOTER_YOLU.replace(/[/-]/g, '\\$&')}["'][\\s\\S]*?<\\/a\\s*>`,
  'gi'
);

function removeLegacyFooterLink(html) {
  if (typeof html !== 'string' || !html) return html;
  if (!html.includes('kisisel-verilerin-korunmasi-hakkinda-aydinlatma-bildirimi-29')) return html;

  return html.replace(LI_DESENI, '').replace(A_DESENI, '');
}

module.exports = { KALDIRILAN_FOOTER_YOLU, removeLegacyFooterLink };
