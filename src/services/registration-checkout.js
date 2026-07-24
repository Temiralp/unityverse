const { decryptRegistrationPii } = require('./registration-pii');
const { validateRegistrationProfile } = require('./registration-profile');

function inspectRegistrationCheckoutProfile(registration) {
  const pii = decryptRegistrationPii(registration);
  return validateRegistrationProfile({
    name: registration?.name,
    surname: registration?.surname,
    email: registration?.email,
    phone: registration?.phone,
    ...pii
  });
}

module.exports = { inspectRegistrationCheckoutProfile };
