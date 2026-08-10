#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const { validateMemberAdminForm } = require('../src/services/member-admin');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/routes/admin.js'), 'utf8');
const indexView = fs.readFileSync(path.join(root, 'src/views/admin/members/index.ejs'), 'utf8');
const showView = fs.readFileSync(path.join(root, 'src/views/admin/members/show.ejs'), 'utf8');
const formView = fs.readFileSync(path.join(root, 'src/views/admin/members/form.ejs'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');

const valid = validateMemberAdminForm({
  name: '  Test ',
  surname: ' Üye ',
  email: 'TEST@EXAMPLE.COM ',
  phone: '+90 555 111 22 33',
  mailList: 'on',
  status: 'ACTIVE'
});
assert.equal(valid.error, null);
assert.deepStrictEqual(valid.data, {
  name: 'Test',
  surname: 'Üye',
  email: 'test@example.com',
  phone: '+90 555 111 22 33',
  mailList: true,
  smsList: false,
  status: 'ACTIVE'
});
assert.match(validateMemberAdminForm({ status: 'ACTIVE' }).error, /Ad alanı/);
assert.match(validateMemberAdminForm({ name: 'A', email: 'hatalı', status: 'ACTIVE' }).error, /e-posta/);
assert.match(validateMemberAdminForm({
  name: 'A', email: 'a@example.com', phone: '123', status: 'ACTIVE'
}).error, /Telefon/);
assert.match(validateMemberAdminForm({
  name: 'A', email: 'a@example.com', status: 'UNKNOWN'
}).error, /üye durumu/);

assert.match(routes, /router\.get\('\/members\/:id\/edit', requireAdmin/);
assert.match(routes, /router\.get\('\/members\/new', requireAdmin/);
assert.match(routes, /router\.post\('\/members', requireAdmin/);
assert.match(routes, /router\.post\('\/members\/:id', requireAdmin/);
assert.match(routes, /router\.post\('\/members\/:id\/delete', requireAdmin/);
assert.match(routes, /validateMemberAdminForm\(req\.body\)/);
assert.match(routes, /error\.code === 'P2002'/);
assert(routes.indexOf("router.get('/members/new'") < routes.indexOf("router.get('/members/:id/edit'"));
assert.match(indexView, /href="\/admin\/members\/new">Yeni Üye Ekle/);

[indexView, showView].forEach((view) => {
  assert.match(view, /\/admin\/members\/<%= member\.id %>\/edit/);
  assert.match(view, /\/admin\/members\/<%= member\.id %>\/delete/);
  assert.match(view, /name="_csrf"/);
  assert.match(view, /confirm\('/);
});
assert.match(formView, /name="_csrf"/);
assert.match(formView, /name="email" type="email"/);
assert.match(formView, /name="mailList"/);
assert.match(formView, /name="smsList"/);
assert.match(formView, /name="status"/);
assert.match(formView, /action="<%= action %>"/);
assert.match(formView, /<%= submitLabel %>/);

assert.match(schema, /member\s+Member\?\s+@relation\(fields: \[memberId\], references: \[id\], onDelete: SetNull\)/);
assert.match(schema, /member\s+Member\s+@relation\(fields: \[memberId\], references: \[id\], onDelete: Cascade\)/);

console.log('Admin member edit and delete contract tests passed.');
