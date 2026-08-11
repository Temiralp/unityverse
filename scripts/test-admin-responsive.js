#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..');
const header = fs.readFileSync(path.join(root, 'src/views/admin/partials/header.ejs'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'admin.css'), 'utf8');
const controller = fs.readFileSync(
  path.join(root, 'public/tema10/js/admin-navigation.js'),
  'utf8'
);

assert.match(header, /data-admin-nav-toggle/);
assert.match(header, /aria-controls="admin-menu"/);
assert.match(header, /aria-expanded="false"/);
assert.match(header, /data-admin-menu/);
assert.match(header, /data-admin-brand/);
assert.match(header, /aria-current="page"/);
assert.match(header, /admin-navigation\.js\?v=20260810-1" defer/);
assert.match(header, /action="\/admin\/logout" method="post"/);
assert.match(header, /name="_csrf"/);
assert.doesNotMatch(header, /<div class="admin-menu"[^>]*hidden/);

const renderedHeader = ejs.render(header, {
  adminUser: { name: 'Test Admin', email: 'admin@example.com' },
  csrfToken: 'test-csrf-token',
  currentPath: '/admin/products'
});
assert.match(renderedHeader, /href="\/admin\/products"[\s\S]*aria-current="page"/);
assert.match(renderedHeader, /value="test-csrf-token"/);
assert.match(renderedHeader, /data-admin-nav-toggle/);

const renderedLoginHeader = ejs.render(header, {
  adminUser: null,
  csrfToken: 'test-csrf-token',
  currentPath: '/admin/login'
});
assert.doesNotMatch(renderedLoginHeader, /data-admin-nav-toggle/);

assert.match(styles, /@media \(max-width: 1180px\)/);
assert.match(styles, /\.admin-nav-toggle\s*\{[^}]*display:\s*inline-flex/s);
assert.match(styles, /\.member-filter-form,[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(styles, /@media \(max-width: 1180px\)[\s\S]*\.panel\s*\{[^}]*overflow-x:\s*auto/s);
assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.page\s*\{[^}]*padding:\s*18px 12px/s);
assert.match(styles, /\.metric-card p\s*\{[^}]*white-space:\s*normal/s);
assert.match(styles, /\.jodit-toolbar__box\s*\{[^}]*overflow-x:\s*auto/s);
assert.doesNotMatch(styles, /body\s*\{[^}]*overflow-x:\s*hidden/s);

function createElement(document, attributes = {}) {
  const values = new Map(Object.entries(attributes));
  const listeners = new Map();

  return {
    hidden: false,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    contains(element) {
      return element === this.child;
    },
    dispatch(type, event = {}) {
      const listener = listeners.get(type);
      if (listener) listener(event);
    },
    focus() {
      document.activeElement = this;
    },
    getAttribute(name) {
      return values.has(name) ? values.get(name) : null;
    },
    setAttribute(name, value) {
      values.set(name, String(value));
    }
  };
}

const documentListeners = new Map();
const mediaListeners = new Map();
const document = {
  activeElement: null,
  addEventListener(type, listener) {
    documentListeners.set(type, listener);
  },
  querySelector(selector) {
    return {
      '[data-admin-nav-toggle]': toggle,
      '[data-admin-menu]': menu,
      '[data-admin-brand]': brand
    }[selector] || null;
  }
};
const toggle = createElement(document, {
  'aria-expanded': 'false',
  'aria-label': 'Admin menüsünü aç'
});
toggle.hidden = true;
const brand = createElement(document);
const menu = createElement(document);
menu.child = createElement(document);
const compactViewport = {
  matches: true,
  addEventListener(type, listener) {
    mediaListeners.set(type, listener);
  }
};
const window = {
  matchMedia(query) {
    assert.equal(query, '(max-width: 1180px)');
    return compactViewport;
  }
};

vm.runInNewContext(controller, { document, window });

assert.equal(toggle.hidden, false);
assert.equal(menu.hidden, true);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');

toggle.dispatch('click');
assert.equal(menu.hidden, false);
assert.equal(toggle.getAttribute('aria-expanded'), 'true');
assert.equal(toggle.getAttribute('aria-label'), 'Admin menüsünü kapat');

toggle.dispatch('click');
assert.equal(menu.hidden, true);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');

toggle.dispatch('click');
documentListeners.get('keydown')({ key: 'Escape' });
assert.equal(menu.hidden, true);
assert.equal(toggle.getAttribute('aria-expanded'), 'false');
assert.equal(document.activeElement, toggle);

compactViewport.matches = false;
mediaListeners.get('change')();
assert.equal(toggle.hidden, true);
assert.equal(menu.hidden, false);
assert.equal(document.activeElement, brand);

document.activeElement = menu.child;
compactViewport.matches = true;
mediaListeners.get('change')();
assert.equal(toggle.hidden, false);
assert.equal(menu.hidden, true);
assert.equal(document.activeElement, toggle);

console.log('Admin responsive navigation and layout contract tests passed.');
