const WHATSAPP_BUTTON_CLASS = 'legacy-whatsapp-appointment';

const whatsappButtonStyle = `<style data-legacy-whatsapp-style>
a.${WHATSAPP_BUTTON_CLASS}{position:fixed;display:flex;align-items:center;justify-content:center;gap:10px;height:45px;bottom:75px;right:24px;left:auto;background-color:#25d366;color:#fff!important;border-radius:40px;text-align:center;box-shadow:0 8px 24px rgba(37,211,102,.35);z-index:9999;padding:0 22px;font-size:16px;font-weight:600;line-height:1;text-decoration:none!important;-webkit-transition:all 200ms ease 0s;transition:all 200ms ease 0s;}
a.${WHATSAPP_BUTTON_CLASS} svg{width:24px;height:24px;flex:0 0 auto;fill:currentColor;}
a.${WHATSAPP_BUTTON_CLASS}:hover,a.${WHATSAPP_BUTTON_CLASS}:focus{background-color:#1ebe5d;color:#fff!important;text-decoration:none!important;}
@media (max-width:767px){a.${WHATSAPP_BUTTON_CLASS}{right:15px;bottom:78px;height:42px;padding:0 16px;font-size:14px;}a.${WHATSAPP_BUTTON_CLASS} svg{width:22px;height:22px;}}
</style>`;

const whatsappButton = `<a class="${WHATSAPP_BUTTON_CLASS}" href="https://api.whatsapp.com/send?phone=905454228887&amp;text=Merhaba%2C%20e%C4%9Fitimler%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum" aria-label="WhatsApp ile iletişime geç" target="_blank" rel="noreferrer noopener"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16.75 13.96c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.13.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.11-.23-.17-.48-.29M12.04 21.5h-.01a9.84 9.84 0 0 1-5.01-1.37l-.36-.21-3.73.98 1-3.63-.23-.37a9.86 9.86 0 1 1 8.34 4.6m8.38-18.42A11.82 11.82 0 0 0 12.05 0C5.53 0 .22 5.31.22 11.84c0 2.09.55 4.13 1.6 5.93L.12 24l6.38-1.67a11.86 11.86 0 0 0 5.54 1.41h.01c6.52 0 11.83-5.31 11.83-11.84 0-3.16-1.23-6.13-3.46-8.37"/></svg><span>Bir uzman ile görüşün</span></a>`;

function ensureLegacyWhatsappButton(html) {
  if (typeof html !== 'string' || !/<\/body\s*>/i.test(html)) return html;
  if (html.includes(WHATSAPP_BUTTON_CLASS)) return html;

  const withStyle = /<\/head\s*>/i.test(html)
    ? html.replace(/<\/head\s*>/i, `${whatsappButtonStyle}\n</head>`)
    : html;

  return withStyle.replace(/<\/body\s*>/i, `${whatsappButton}\n</body>`);
}

module.exports = {
  WHATSAPP_BUTTON_CLASS,
  ensureLegacyWhatsappButton
};
