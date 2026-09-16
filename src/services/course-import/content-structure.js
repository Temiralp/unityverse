// Blok listesinden bolum agaci kurar ve kurs tablarina (Egitime Ilk Bakis / Ders Icerikleri /
// Neden Bu Egitim) esler. Saf fonksiyonlar; durum tutmaz.
//
// Pille 1: belgede baslik stilleri var (h1/h2) -> dogrudan agac.
// Pille 2: baslik yok -> metin desenleri ("Modül 1", "3. Hafta", kisa kalin satir) ve
//          madde isaretleri ("•", "-", "1)") ile tahmin; uyari raporlanir.
// Pille 3 (insan): rapor + onizleme; ileride AI extractor ayni ara formati uretebilir.

const HEADING_PATTERNS = [
  /^(modül|modul|bölüm|bolum|ünite|unite|ay|hafta|ders|konu)\s*\d+/i,
  /^\d+[.)]\s*(hafta|modül|modul|bölüm|bolum|ay)\b/i
];
// Not: "1. Baslik" gibi yalniz numarali kisa satirlar baslik SAYILMAZ — "1) madde" ile
// ayirt edilemez; Pille 2'de bunlar liste maddesi olur (belge stil kullanirsa sorun yoktur).
const BULLET_PATTERN = /^\s*(?:[•·▪◦\-–—*]|\d+[.)])\s+/;
const SHORT_HEADING_MAX = 80;

// Tab eslestirme anahtar kelimeleri — yeni bir ifade gerekirse yalnizca buraya eklenir.
const CURRICULUM_KEYWORDS = /müfredat|mufredat|ders içerik|ders icerik|program|modül|modul|içerik|icerik/i;
const WHY_KEYWORDS = /neden|kazanım|kazanim|çıktı|cikti|hedef/i;

// Blok "text" tasimiyorsa (ornegin yalnizca html veren bir extractor) etiketler soyularak turetilir.
function blockText(block) {
  if (typeof block.text === 'string') return block.text;
  return String(block.html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isPatternHeading(block) {
  const text = blockText(block);
  return text.length <= SHORT_HEADING_MAX && HEADING_PATTERNS.some((pattern) => pattern.test(text));
}

function isBoldHeading(block) {
  const text = blockText(block);
  return Boolean(block.bold) && text.length <= SHORT_HEADING_MAX && !/[.!?]$/.test(text);
}

function stripBullet(html) {
  return String(html || '').replace(BULLET_PATTERN, '').trim();
}

// Pille 2: paragraf bloklarini sentetik baslik/list bloklarina cevirir.
function inferBlocksFromPatterns(blocks) {
  const inferred = [];
  let unclassified = 0;
  let seenHeading = false;

  blocks.forEach((block) => {
    if (block.type !== 'paragraph') {
      inferred.push(block);
      return;
    }
    if (isPatternHeading(block)) {
      inferred.push({ type: 'heading', level: 2, text: blockText(block), inferred: true });
      seenHeading = true;
      return;
    }
    if (isBoldHeading(block)) {
      inferred.push({ type: 'heading', level: 1, text: blockText(block), inferred: true });
      seenHeading = true;
      return;
    }
    if (BULLET_PATTERN.test(blockText(block))) {
      const previous = inferred[inferred.length - 1];
      const item = stripBullet(block.html);
      if (previous && previous.type === 'list' && previous.inferred) previous.items.push(item);
      else inferred.push({ type: 'list', ordered: false, items: [item], inferred: true });
      return;
    }
    if (!seenHeading) unclassified += 1;
    inferred.push(block);
  });

  return { blocks: inferred, unclassified };
}

function newSection(level, title) {
  return { level, title, blocks: [], children: [] };
}

// Basliklardan iki seviyeli agac: level 1 -> sections, level 2 -> children; level 3+ blok olarak kalir.
function buildTree(blocks) {
  const preamble = [];
  const sections = [];
  let current = null;
  let currentChild = null;

  blocks.forEach((block) => {
    if (block.type === 'heading' && block.level <= 2) {
      if (block.level === 1 || !current) {
        current = newSection(block.level, block.text);
        sections.push(current);
        currentChild = null;
      } else {
        currentChild = newSection(2, block.text);
        current.children.push(currentChild);
      }
      return;
    }
    const target = currentChild || current;
    if (!target) preamble.push(block);
    else target.blocks.push(block);
  });

  return { preamble, sections };
}

function buildContentStructure(blocks) {
  const source = Array.isArray(blocks) ? blocks : [];
  const hasStyledHeadings = source.some((block) => block.type === 'heading');
  const warnings = [];
  let working = source;
  let unclassified = 0;
  let tier = 1;

  if (!hasStyledHeadings && source.length > 0) {
    tier = 2;
    const inferred = inferBlocksFromPatterns(source);
    working = inferred.blocks;
    unclassified = inferred.unclassified;
    warnings.push('Belgede başlık stili bulunamadı; bölümler metin desenlerinden tahmin edildi. Önizlemeyi kontrol edin.');
    if (unclassified > 0) warnings.push(`${unclassified} paragraf hiçbir bölüme bağlanamadı.`);
  }

  const { preamble, sections } = buildTree(working);
  const headings = working.filter((block) => block.type === 'heading').length;

  return {
    preamble,
    sections,
    detection: { tier, headings, unclassified, warnings }
  };
}

function sectionToPanel(section) {
  return { title: section.title, blocks: section.blocks };
}

function resolveCurriculum(structure) {
  const { sections, detection } = structure;
  const keywordIndex = sections.findIndex((section) => CURRICULUM_KEYWORDS.test(section.title) && section.children.length > 0);
  if (keywordIndex !== -1) {
    const section = sections[keywordIndex];
    return { index: keywordIndex, intro: section.blocks, panels: section.children.map(sectionToPanel), source: 'section-keyword' };
  }

  const withChildren = sections.filter((section) => section.children.length > 0);
  if (withChildren.length > 0) {
    return {
      index: sections.indexOf(withChildren[0]),
      intro: [],
      panels: withChildren.flatMap((section) => section.children.map(sectionToPanel)),
      source: detection.tier === 2 ? 'pattern-headings' : 'heading-levels'
    };
  }

  if (sections.length > 0) {
    return { index: 0, intro: [], panels: sections.map(sectionToPanel), source: detection.tier === 2 ? 'pattern-headings' : 'top-level-headings' };
  }

  return { index: -1, intro: [], panels: [], source: 'none' };
}

function mapToCourseTabs(structure) {
  const { preamble, sections, detection } = structure;
  const curriculum = resolveCurriculum(structure);
  const remaining = sections.filter((section, index) => index !== curriculum.index);
  const why = remaining.filter((section) => WHY_KEYWORDS.test(section.title));
  const overview = remaining.filter((section, index) => !why.includes(section) && sections.indexOf(section) < curriculum.index);
  const extra = remaining.filter((section) => !why.includes(section) && !overview.includes(section));

  const report = [
    `Pille ${detection.tier}`,
    `${sections.length} bölüm`,
    `${curriculum.panels.length} modül paneli (${curriculum.source})`,
    `genel bakış ${overview.length}`,
    `neden ${why.length}`,
    `eşleşmeyen ${extra.length}`,
    `sınıflanmayan ${detection.unclassified}`
  ].join(' · ');

  return {
    overview: { preamble, sections: overview },
    curriculum: { intro: curriculum.intro, panels: curriculum.panels, source: curriculum.source },
    why: { sections: why },
    extra: { sections: extra },
    detection,
    report
  };
}

module.exports = {
  CURRICULUM_KEYWORDS,
  WHY_KEYWORDS,
  buildContentStructure,
  inferBlocksFromPatterns,
  mapToCourseTabs
};
