const fs = require('fs');

const roots = ['tum-urunler', 'kategori'];
const markerStart = '<!-- legacy-static-filter-fallback:start -->';
const markerEnd = '<!-- legacy-static-filter-fallback:end -->';

const categories = [
  ['Oyun Geliştirme Eğitimleri', 23, '/kategori/oyun-gelistirme-egitimleri-244/'],
  ['Yazılım Eğitimleri', 76, '/kategori/yazilim-egitimleri-245/'],
  ['Grafik - Tasarım Eğitimleri', 39, '/kategori/grafik-tasarim-egitimleri-246/'],
  ['3D Modelleme Eğitimleri', 25, '/kategori/3d-modelleme-egitimleri-247/'],
  ['Animasyon Eğitimleri', 8, '/kategori/animasyon-egitimleri-248/'],
  ['Ses Tasarım Eğitimleri', 6, '/kategori/ses-tasarim-egitimleri-251/'],
  ['Senaryo, Sinema ve Yönetmenlik Eğitimleri', 6, '/kategori/senaryo-sinema-ve-yonetmenlik-egitimleri-252/'],
  ['Endüstriyel Ürün Tasarım Eğitimleri', 6, '/kategori/endustriyel-urun-tasarim-egitimleri-253/'],
  ['Dil Eğitimleri', 2, '/kategori/dil-egitimleri-257/'],
  ['Dijital Pazarlama Eğitimleri', 3, '/kategori/dijital-pazarlama-egitimleri-255/'],
  ['Özel Dersler', 50, '/kategori/ozel-dersler-256/'],
  ['Muhasebe ve Ofis Eğitimleri', 5, '/kategori/muhasebe-ve-ofis-egitimleri-258/'],
  ['Mimarlık Eğitimleri', 22, '/kategori/mimarlik-egitimleri-259/']
];

const prices = [
  [0, 4999, 3],
  [5000, 9999, 6],
  [10000, 19999, 46],
  [20000, 39999, 55],
  [40000, 100000, 134]
];

const featureGroups = [
  ['Eğitim Süresi', [
    ['3 ay', 1]
  ]],
  ['Eğitim Seviyesi', [
    ['Başlangıç Seviyesi', 12],
    ['Senior Seviye', 1]
  ]],
  ['Eğitim Türü', [
    ['Canlı Online Eğitim', 10],
    ['Yüz Yüze Sınıf Eğitimi', 7]
  ]],
  ['Sertifika Durumu', [
    ['Sertifika Var', 17]
  ]],
  ['Ders Güncel mi?', [
    ['Evet', 17]
  ]],
  ['Sertifika', [
    ['E devlette sorgulanabilir', 123]
  ]]
];

function walk(directory, callback) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(entryPath, callback);
      continue;
    }

    if (entry.isFile() && entry.name === 'index.html') {
      callback(entryPath);
    }
  }
}

function fallbackHtml() {
  const categoryItems = categories
    .map(([name, count, url]) => `                                            <li><a href="${url}" onclick="return getresults(0, '${url}')">${name} (${count})</a></li>`)
    .join('\n');
  const priceItems = prices
    .map(([min, max, count], index) => `                                                        <li><input type="checkbox" class="filterchanged" id="price_${index}" value="${min}-${max}"> <label for="price_${index}">${min} - ${max} (${count})</label></li>`)
    .join('\n');
  let featureIndex = 1;
  const featureHtml = featureGroups
    .map(([legend, rows]) => {
      const items = rows
        .map(([label, count]) => {
          const id = featureIndex;
          featureIndex += 1;
          return `                                                        <li><input type="checkbox" class="filterchanged" id="feature_${id}" value="${id}"> <label for="feature_${id}">${label} (${count})</label></li>`;
        })
        .join('\n');

      return `                                            <div class="table_cell">
                                                <fieldset>
                                                    <legend>${legend}</legend>
                                                    <ul class="pbl-scroll checkboxes_list">
${items}
                                                    </ul>
                                                </fieldset>
                                            </div>`;
    })
    .join('\n');

  return `
                    ${markerStart}
                    <div class="legacy-static-filter-fallback">
                        <div class="module menu-category titleLine display-block">
                            <h3 class="modtitle">Eğitim Grupları</h3>
                            <div class="modcontent">
                                <div class="box-category">
                                    <ul class="list-group">
${categoryItems}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div class="module latest-product titleLine filters display-block">
                            <h3 class="modtitle">FİLTRE </h3>
                            <div class="modcontent">
                                <form class="type_2">
                                    <div class="table_layout filter-shopby">
                                        <div class="table_row">
                                            <div class="table_cell">
                                                <fieldset>
                                                    <legend>Markalar</legend>
                                                    <ul class="pbl-scroll checkboxes_list">
                                                        <li><input type="checkbox" class="filterchanged" id="brand_1" value="1"> <label for="brand_1">Unityverse Academy (245)</label></li>
                                                    </ul>
                                                </fieldset>
                                            </div>
                                            <div class="table_cell">
                                                <fieldset>
                                                    <legend>Özel Filtreler</legend>
                                                    <ul class="pbl-scroll checkboxes_list">
                                                        <li><input type="checkbox" class="filterchanged" id="special_new"> <label for="special_new">Yeni Ürünler (3)</label></li>
                                                        <li><input type="checkbox" class="filterchanged" id="special_bestseller"> <label for="special_bestseller">Çok Satan Ürünler (7)</label></li>
                                                    </ul>
                                                </fieldset>
                                            </div>
${featureHtml}
                                            <div class="table_cell legacy-price-filter">
                                                <fieldset>
                                                    <legend>Fiyat Aralığı</legend>
                                                    <ul class="pbl-scroll checkboxes_list">
${priceItems}
                                                    </ul>
                                                </fieldset>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                    ${markerEnd}
`;
}

const fallback = fallbackHtml();
const markerPattern = new RegExp(`\\n\\s*${markerStart}[\\s\\S]*?${markerEnd}\\n?`, 'g');
let changed = 0;

for (const root of roots) {
  if (!fs.existsSync(root)) continue;

  walk(root, (filePath) => {
    let html = fs.readFileSync(filePath, 'utf8');
    const before = html;

    html = html.replace(markerPattern, '\n');
    html = html.replace(/(<aside class="col-sm-4 col-md-3 category-filter" id="column-left">)/, `$1${fallback}`);
    html = html.replace(/pobol\.css\?v=5\.4\.(99|100|101|102|103)/g, 'pobol.css?v=5.4.104');

    if (html !== before) {
      fs.writeFileSync(filePath, html);
      changed += 1;
    }
  });
}

console.log(JSON.stringify({ changed }));
