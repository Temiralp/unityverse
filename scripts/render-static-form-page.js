const fs = require('fs/promises');
const path = require('path');
const { execFileSync } = require('child_process');

const cheerio = require('cheerio');
const ejs = require('ejs');

const rootDir = path.resolve(__dirname, '..');

const configs = {
  'hemen-bilgi-al-1': {
    title: 'Hemen Bilgi Al',
    eyebrow: 'Ücretsiz danışmanlık',
    activeNav: 'appointment',
    formId: 'custom_form_1',
    heroTitle: 'Eğitim hedefini birlikte netleştirelim',
    heroText: 'Eğitimlerimiz ve ders programlarımız hakkında detaylı bilgi almak için formu doldurun. Yetkililerimiz en kısa sürede sizinle iletişime geçecektir.',
    points: [
      ['fa-comments', 'Ücretsiz eğitim danışmanlığı'],
      ['fa-briefcase', 'Staj ve kariyer odaklı yol haritası'],
      ['fa-calendar-check-o', 'Online, yüz yüze veya hibrit seçenekler']
    ]
  }
};

async function renderStaticFormPage(slug) {
  const config = configs[slug];
  if (!config) throw new Error(`Unsupported slug: ${slug}`);

  const pagePath = path.join(rootDir, 'form', slug, 'index.html');
  const sourceHtml = await readSourceHtml(pagePath, slug);
  const $ = cheerio.load(sourceHtml, { decodeEntities: false });
  const sourceForm = $(`#${config.formId}`);

  if (!sourceForm.length) {
    throw new Error(`Could not find #${config.formId} in ${pagePath}`);
  }

  const fields = readFields($, sourceForm);
  const formId = sourceForm.attr('id');
  const action = sourceForm.attr('action') || 'javascript:void(0)';
  const onsubmit = sourceForm.attr('onsubmit') || 'return postForm()';
  const header = await ejs.renderFile(path.join(rootDir, 'src/views/partials/header.ejs'), {
    pageTitle: `${config.title} | Unityverse Academy`,
    activeNav: config.activeNav,
    extraStyles: ['/public/tema10/css/form.css']
  });
  const footer = await ejs.renderFile(path.join(rootDir, 'src/views/partials/footer.ejs'), {
    extraScripts: ['/public/tema10/js/form-static.js']
  });

  const rendered = [
    header.replace('<body>', '<body class="uv-form-page">'),
    '<main id="main-content">',
    '  <section class="uv-lead-hero" aria-labelledby="lead-title">',
    '    <div class="uv-shell uv-lead-layout">',
    '      <div class="uv-lead-copy">',
    `        <p class="uv-eyebrow">${escapeHtml(config.eyebrow)}</p>`,
    `        <h1 id="lead-title">${escapeHtml(config.heroTitle)}</h1>`,
    `        <p>${escapeHtml(config.heroText)}</p>`,
    '        <ul class="uv-lead-points" aria-label="Güven unsurları">',
    ...config.points.map(([icon, text]) => [
      '          <li>',
      `            <span aria-hidden="true"><i class="fa ${icon}"></i></span>`,
      `            ${escapeHtml(text)}`,
      '          </li>'
    ].join('\n')),
    '        </ul>',
    '      </div>',
    '      <div class="uv-lead-card">',
    '        <div class="uv-lead-card__header">',
    `          <h2>${escapeHtml(config.title)}</h2>`,
    `          <p>${escapeHtml(config.heroText)}</p>`,
    '        </div>',
    `        <form class="uv-lead-form" action="${escapeHtml(action)}" id="${escapeHtml(formId)}" onsubmit="${escapeHtml(onsubmit)}">`,
    ...renderFields(fields),
    '          <input class="btn-primary uv-lead-submit" type="submit" value="Gönder">',
    '          <p class="uv-lead-status" role="status" aria-live="polite" data-lead-form-status></p>',
    '        </form>',
    '      </div>',
    '    </div>',
    '  </section>',
    '</main>',
    '<script>window.site_url = "/";</script>',
    footer
  ].join('\n');

  await fs.writeFile(pagePath, rendered, 'utf8');
  console.log(`Rendered ${pagePath}`);
}

function readFields($, form) {
  const hidden = form.find('input[type="hidden"]').map((_, field) => ({
    type: 'hidden',
    name: $(field).attr('name') || '',
    value: $(field).attr('value') || ''
  })).get();

  const fields = hidden;

  fields.push({
    type: 'text',
    label: 'Adınız Soyadınız *',
    name: 'ad_soyad',
    id: 'name',
    inputType: 'text',
    placeholder: form.find('#name').attr('placeholder') || 'Ad Soyad',
    required: Boolean(form.find('#name').attr('required'))
  });
  fields.push({
    type: 'text',
    label: 'E-posta Adresiniz *',
    name: 'eposta',
    id: 'email',
    inputType: 'email',
    placeholder: form.find('#email').attr('placeholder') || 'E-posta',
    required: Boolean(form.find('#email').attr('required'))
  });
  fields.push({
    type: 'text',
    label: 'Telefon Numaranız *',
    name: 'telefon',
    id: 'gsm',
    inputType: 'tel',
    placeholder: form.find('#gsm').attr('placeholder') || '05xx xxx xx xx',
    required: Boolean(form.find('#gsm').attr('required'))
  });

  const course = form.find('#course');
  if (course.length) {
    fields.push({
      type: 'select',
      label: 'İlgilendiğiniz Eğitim *',
      name: course.attr('name') || 'egitim',
      id: course.attr('id') || 'course',
      required: Boolean(course.attr('required')),
      options: course.find('option').map((_, option) => ({
        value: $(option).attr('value') || '',
        text: $(option).text()
      })).get()
    });
  }

  fields.push({
    type: 'textarea',
    label: 'Mesajınız',
    name: 'mesaj',
    id: 'message',
    rows: form.find('#message').attr('rows') || '4',
    placeholder: form.find('#message').attr('placeholder') || 'Eklemek istedikleriniz veya sorularınız...'
  });
  fields.push({
    type: 'checkbox',
    name: 'kvkk',
    required: true,
    html: '<a href="/sayfa/kvkk-aydinlatma-metni/" target="_blank" rel="noopener">KVKK Aydınlatma Metni</a>\'ni okudum ve kabul ediyorum. *'
  });

  return fields;
}

function renderFields(fields) {
  return fields.map((field) => {
    if (field.type === 'hidden') {
      return `          <input type="hidden" name="${escapeHtml(field.name)}" value="${escapeHtml(field.value)}">`;
    }

    if (field.type === 'select') {
      return [
        '          <div class="uv-lead-field">',
        `            <label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>`,
        `            <select name="${escapeHtml(field.name)}" id="${escapeHtml(field.id)}"${field.required ? ' required' : ''}>`,
        ...field.options.map((option) => `              <option value="${escapeHtml(option.value)}">${escapeHtml(option.text)}</option>`),
        '            </select>',
        '          </div>'
      ].join('\n');
    }

    if (field.type === 'textarea') {
      return [
        '          <div class="uv-lead-field">',
        `            <label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>`,
        `            <textarea name="${escapeHtml(field.name)}" id="${escapeHtml(field.id)}" rows="${escapeHtml(field.rows)}" placeholder="${escapeHtml(field.placeholder)}"></textarea>`,
        '          </div>'
      ].join('\n');
    }

    if (field.type === 'checkbox') {
      return [
        '          <label class="uv-lead-checkbox">',
        `            <input type="checkbox" name="${escapeHtml(field.name)}"${field.required ? ' required' : ''}>`,
        `            <span>${field.html}</span>`,
        '          </label>'
      ].join('\n');
    }

    return [
      '          <div class="uv-lead-field">',
      `            <label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}</label>`,
      `            <input type="${escapeHtml(field.inputType)}" name="${escapeHtml(field.name)}" id="${escapeHtml(field.id)}" placeholder="${escapeHtml(field.placeholder)}"${field.required ? ' required' : ''}>`,
      '          </div>'
    ].join('\n');
  });
}

async function readSourceHtml(pagePath, slug) {
  const html = await fs.readFile(pagePath, 'utf8');
  if (html.includes('uv-form')) return html;

  try {
    return execFileSync('git', ['show', `HEAD:form/${slug}/index.html`], {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 8
    });
  } catch (error) {
    return html;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

renderStaticFormPage(process.argv[2]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
