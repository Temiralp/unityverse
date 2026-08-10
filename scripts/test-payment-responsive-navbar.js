const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const navbarSource = fs.readFileSync(
  path.resolve(__dirname, '../public/tema10/js/navbar.js'),
  'utf8'
);

function createClassList() {
  const values = new Set();

  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      const enabled = typeof force === 'boolean' ? force : !values.has(name);
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    }
  };
}

function createElement(document, initialAttributes = {}) {
  const attributes = new Map(Object.entries(initialAttributes));
  const listeners = new Map();

  return {
    classList: createClassList(),
    dataset: {},
    inert: false,
    offsetParent: {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      const listener = listeners.get(type);
      if (listener) listener(event);
    },
    focus() {
      document.activeElement = this;
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };
}

function runControllerTest() {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const document = {
    activeElement: null,
    body: { classList: createClassList() },
    addEventListener(type, listener) {
      documentListeners.set(type, listener);
    },
    querySelectorAll() {
      return [];
    }
  };
  const toggle = createElement(document, {
    'aria-expanded': 'false',
    'aria-label': 'Menüyü aç'
  });
  const closeButton = createElement(document);
  const drawerLink = createElement(document);
  const backdrop = createElement(document);
  const nativeDetails = { open: false };
  const drawer = createElement(document);
  const navbar = createElement(document, {
    'data-navbar-mobile-query': '(max-width: 1199.98px)',
    'data-navbar-focus-drawer': '',
    'data-navbar-trap-drawer': '',
    'data-navbar-lock-scroll': '',
    'data-navbar-manage-drawer': '',
    'data-navbar-open-details': ''
  });
  const mobileQuery = {
    matches: true,
    addEventListener(type, listener) {
      windowListeners.set(`media-${type}`, listener);
    }
  };

  drawer.querySelectorAll = (selector) => (
    selector === 'details' ? [nativeDetails] : [closeButton, drawerLink]
  );
  navbar.querySelector = (selector) => ({
    '[data-navbar-toggle]': toggle,
    '[data-navbar-drawer]': drawer,
    '[data-navbar-backdrop]': backdrop
  }[selector] || null);
  navbar.querySelectorAll = (selector) => (
    selector === '[data-navbar-close]' ? [closeButton] : []
  );
  document.querySelectorAll = (selector) => (
    selector === '[data-navbar]' ? [navbar] : []
  );
  document.activeElement = toggle;

  const window = {
    scrollY: 0,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    matchMedia(query) {
      if (query === '(max-width: 1199.98px)') return mobileQuery;

      assert.equal(query, '(min-width: 992px)');
      return {
        matches: false,
        addEventListener() {}
      };
    },
    requestAnimationFrame(callback) {
      callback();
    }
  };

  vm.runInNewContext(navbarSource, { document, window });
  documentListeners.get('DOMContentLoaded')();

  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(drawer.inert, true);

  toggle.dispatch('click');
  assert.equal(navbar.classList.contains('uv-navbar--open'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(drawer.getAttribute('aria-hidden'), 'false');
  assert.equal(drawer.inert, false);
  assert.equal(nativeDetails.open, true);
  assert.equal(document.body.classList.contains('uv-navbar-scroll-lock'), true);
  assert.equal(document.activeElement, closeButton);

  let tabPrevented = false;
  document.activeElement = drawerLink;
  documentListeners.get('keydown')({
    key: 'Tab',
    shiftKey: false,
    preventDefault() {
      tabPrevented = true;
    }
  });
  assert.equal(tabPrevented, true);
  assert.equal(document.activeElement, closeButton);

  documentListeners.get('keydown')({ key: 'Escape' });
  assert.equal(navbar.classList.contains('uv-navbar--open'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(drawer.getAttribute('aria-hidden'), 'true');
  assert.equal(nativeDetails.open, false);
  assert.equal(document.body.classList.contains('uv-navbar-scroll-lock'), false);
  assert.equal(document.activeElement, toggle);

  toggle.dispatch('click');
  backdrop.dispatch('click');
  assert.equal(navbar.classList.contains('uv-navbar--open'), false);

  toggle.dispatch('click');
  closeButton.dispatch('click');
  assert.equal(navbar.classList.contains('uv-navbar--open'), false);

  toggle.dispatch('click');
  drawer.dispatch('click', { target: { closest: () => ({}) } });
  assert.equal(navbar.classList.contains('uv-navbar--open'), false);
}

runControllerTest();
console.log('Payment responsive navbar controller tests passed.');
