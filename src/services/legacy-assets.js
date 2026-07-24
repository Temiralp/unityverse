const LEGACY_HOME_CSS_VERSION = '5.4.100';
const LEGACY_POBOL_CSS_VERSION = '5.4.104';
const LEGACY_SCRIPTS_VERSION = '5.4.110';

const homeCssPattern = /((?:href)=["'][^"']*public\/tema10\/css\/home2\.css\?v=)[^"'&]+/gi;
const pobolCssPattern = /((?:href)=["'][^"']*public\/tema10\/css\/pobol\.css\?v=)[^"'&]+/gi;
const scriptsPattern = /((?:src)=["'][^"']*public\/tema10\/js\/scripts\.js\?v=)[^"'&]+/gi;

function ensureLegacyAssetVersions(html) {
  if (typeof html !== 'string') return html;

  return html
    .replace(homeCssPattern, `$1${LEGACY_HOME_CSS_VERSION}`)
    .replace(pobolCssPattern, `$1${LEGACY_POBOL_CSS_VERSION}`)
    .replace(scriptsPattern, `$1${LEGACY_SCRIPTS_VERSION}`);
}

module.exports = {
  LEGACY_HOME_CSS_VERSION,
  LEGACY_POBOL_CSS_VERSION,
  LEGACY_SCRIPTS_VERSION,
  ensureLegacyAssetVersions
};
