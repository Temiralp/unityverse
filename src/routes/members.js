const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../db');
const { isLikelyBot, silentSuccess } = require('../middleware/form-protection');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const {
  clearLoginFailures,
  createIpRateLimiter,
  isLoginBlocked,
  recordLoginFailure
} = require('../middleware/rate-limit');

const router = express.Router();
const MEMBER_LOGIN_SCOPE = 'member-signin';
const MEMBER_LOGIN_LIMIT = 5;
const MEMBER_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const registerRateLimiter = createIpRateLimiter({
  scope: 'member-register',
  limit: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Çok kısa sürede çok fazla üyelik denemesi yaptınız. Lütfen daha sonra tekrar deneyin.'
});

router.use(requirePublicCsrf);

function asText(value) {
  return String(value || '').trim();
}

function asBoolean(value) {
  return value === 1 || value === '1' || value === true || value === 'true' || value === 'on';
}

function memberCallbackUrl(value) {
  const redirect = asText(value);

  if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect.includes('\\')) {
    return '/';
  }

  return redirect;
}

function sessionMember(member) {
  return {
    id: member.id,
    name: member.name,
    surname: member.surname,
    email: member.email
  };
}

function recordMemberLoginFailure(res, identifier) {
  return recordLoginFailure({
    res,
    scope: MEMBER_LOGIN_SCOPE,
    identifier,
    limit: MEMBER_LOGIN_LIMIT,
    windowMs: MEMBER_LOGIN_WINDOW_MS
  });
}

function memberBotGuard(req, res, next) {
  if (isLikelyBot(req.body || {}, 'member')) {
    return silentSuccess('member', res);
  }

  return next();
}

router.post('/register', memberBotGuard, registerRateLimiter, async (req, res, next) => {
  try {
    const data = req.body || {};
    const name = asText(data.name);
    const surname = asText(data.surname);
    const email = asText(data.email).toLowerCase();
    const password = asText(data.pass || data.password);
    const passwordConfirm = asText(data.password_confirm || data.passwordConfirm);
    const phone = asText(data.gsm || data.phone);
    const gender = asText(data.sex || data.gender);

    if (!name || !surname || !email || !phone || !password) {
      return res.status(400).json({
        status: 'failure',
        message: 'Ad, soyad, e-posta, telefon ve şifre zorunludur.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        status: 'failure',
        message: 'Geçerli bir e-posta adresi giriniz.'
      });
    }

    if (password.length < 7) {
      return res.status(400).json({
        status: 'failure',
        message: 'Şifre en az 7 karakterden oluşmalıdır.'
      });
    }

    if (passwordConfirm && password !== passwordConfirm) {
      return res.status(400).json({
        status: 'failure',
        message: 'Şifreler eşleşmiyor.'
      });
    }

    if (!asBoolean(data.member_contrat)) {
      return res.status(400).json({
        status: 'failure',
        message: 'Üyelik Sözleşmesini kabul etmelisiniz.'
      });
    }

    if (!asBoolean(data.kvkk_contrat)) {
      return res.status(400).json({
        status: 'failure',
        message: 'Kişisel Verilerin Korunması Metnini kabul etmelisiniz.'
      });
    }

    const exists = await prisma.member.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({
        status: 'failure',
        message: 'Bu e-posta adresi ile kayıtlı bir üye var.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const member = await prisma.member.create({
      data: {
        name,
        surname,
        email,
        phone,
        gender: gender || null,
        passwordHash,
        mailList: asBoolean(data.maillist),
        smsList: asBoolean(data.smslist)
      }
    });

    req.session.member = sessionMember(member);

    res.json({
      status: 'success',
      message: 'Üyelik kaydınız başarıyla oluşturuldu.',
      param: {
        login_callback_url: memberCallbackUrl(data.redirect)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/signin', memberBotGuard, async (req, res, next) => {
  try {
    const data = req.body || {};
    const email = asText(data.email).toLowerCase();
    const password = asText(data.pass || data.password);
    const loginAttempt = await isLoginBlocked({
      req,
      res,
      scope: MEMBER_LOGIN_SCOPE,
      email,
      limit: MEMBER_LOGIN_LIMIT
    });

    if (loginAttempt.blocked) {
      return res.status(429).json({
        status: 'failure',
        message: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
      });
    }

    if (!email || !password) {
      await recordMemberLoginFailure(res, loginAttempt.identifier);
      return res.status(400).json({
        status: 'failure',
        message: 'E-posta ve şifre zorunludur.'
      });
    }

    const member = await prisma.member.findUnique({ where: { email } });
    if (!member || !member.passwordHash) {
      await recordMemberLoginFailure(res, loginAttempt.identifier);
      return res.status(401).json({
        status: 'failure',
        message: 'E-posta veya şifre hatalı.'
      });
    }

    if (member.status !== 'ACTIVE') {
      await recordMemberLoginFailure(res, loginAttempt.identifier);
      return res.status(403).json({
        status: 'failure',
        message: 'Üyeliğiniz aktif değildir.'
      });
    }

    const passwordMatches = await bcrypt.compare(password, member.passwordHash);
    if (!passwordMatches) {
      await recordMemberLoginFailure(res, loginAttempt.identifier);
      return res.status(401).json({
        status: 'failure',
        message: 'E-posta veya şifre hatalı.'
      });
    }

    await clearLoginFailures(MEMBER_LOGIN_SCOPE, loginAttempt.identifier);
    req.session.member = sessionMember(member);

    res.json({
      status: 'success',
      message: 'Giriş başarılı.',
      param: {
        login_callback_url: memberCallbackUrl(data.redirect)
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.json({ status: 'success', authenticated: false, member: null });
    }

    const member = await prisma.member.findUnique({
      where: { id: Number(req.session.member.id) },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        mailList: true,
        smsList: true,
        status: true,
        createdAt: true
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      delete req.session.member;
      return res.json({ status: 'success', authenticated: false, member: null });
    }

    res.json({ status: 'success', authenticated: true, member });
  } catch (error) {
    next(error);
  }
});

router.post('/profile', async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.status(401).json({ status: 'failure', message: 'Önce giriş yapmalısınız.' });
    }

    const name = asText(req.body.name);
    const surname = asText(req.body.surname);
    const phone = asText(req.body.phone || req.body.gsm);

    if (!name || !surname || !phone) {
      return res.status(400).json({
        status: 'failure',
        message: 'Ad, soyad ve telefon zorunludur.'
      });
    }

    const member = await prisma.member.update({
      where: { id: Number(req.session.member.id) },
      data: {
        name,
        surname,
        phone,
        mailList: asBoolean(req.body.maillist),
        smsList: asBoolean(req.body.smslist)
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        mailList: true,
        smsList: true,
        status: true,
        createdAt: true
      }
    });

    req.session.member = sessionMember(member);

    res.json({
      status: 'success',
      message: 'Profil bilgileriniz güncellendi.',
      member
    });
  } catch (error) {
    next(error);
  }
});

router.post('/password', async (req, res, next) => {
  try {
    if (!req.session.member) {
      return res.status(401).json({ status: 'failure', message: 'Önce giriş yapmalısınız.' });
    }

    const currentPassword = asText(req.body.currentPassword || req.body.current_password);
    const newPassword = asText(req.body.newPassword || req.body.new_password);
    const newPasswordConfirm = asText(req.body.newPasswordConfirm || req.body.new_password_confirm);

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ status: 'failure', message: 'Mevcut şifre ve yeni şifre zorunludur.' });
    }

    if (newPassword.length < 7) {
      return res.status(400).json({ status: 'failure', message: 'Yeni şifre en az 7 karakterden oluşmalıdır.' });
    }

    if (newPasswordConfirm && newPassword !== newPasswordConfirm) {
      return res.status(400).json({ status: 'failure', message: 'Yeni şifreler eşleşmiyor.' });
    }

    const member = await prisma.member.findUnique({ where: { id: Number(req.session.member.id) } });
    if (!member || !(await bcrypt.compare(currentPassword, member.passwordHash || ''))) {
      return res.status(401).json({ status: 'failure', message: 'Mevcut şifre hatalı.' });
    }

    await prisma.member.update({
      where: { id: member.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) }
    });

    res.json({ status: 'success', message: 'Şifreniz güncellendi.' });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  delete req.session.member;
  req.session.save(() => {
    res.json({
      status: 'success',
      message: 'Çıkış yapıldı.',
      param: {
        login_callback_url: '/'
      }
    });
  });
});

module.exports = router;
