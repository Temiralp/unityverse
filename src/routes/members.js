const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../db');
const { isLikelyBot, silentSuccess } = require('../middleware/form-protection');
const { requirePublicCsrf } = require('../middleware/public-csrf');
const {
  clearLoginFailures,
  createIpRateLimiter,
  isIpBlocked,
  isLoginBlocked,
  recordIpFailure,
  recordLoginFailure
} = require('../middleware/rate-limit');

const router = express.Router();
const MEMBER_LOGIN_SCOPE = 'member-signin';
const MEMBER_LOGIN_LIMIT = 5;
const MEMBER_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MEMBER_LOGIN_IP_SCOPE = 'member-signin-ip';
const MEMBER_LOGIN_IP_LIMIT = 30;
const MEMBER_LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;
const registrationStatusLabels = {
  NEW: 'Yeni kayıt',
  CONTACTED: 'İletişimde',
  CONFIRMED: 'Onaylandı',
  CANCELLED: 'İptal edildi'
};
const paymentStatusLabels = {
  PENDING: 'Bekliyor',
  PARTIAL: 'Kısmi ödendi',
  PAID: 'Ödendi',
  REFUNDED: 'İade'
};
const invoiceStatusLabels = {
  NOT_ISSUED: 'Fatura kesilmedi',
  ISSUED: 'Fatura kesildi',
  CANCELLED: 'Fatura iptal'
};
const installmentStatusLabels = {
  PENDING: 'Bekliyor',
  PAID: 'Ödendi',
  OVERDUE: 'Gecikti',
  CANCELLED: 'İptal'
};
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

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return number.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function isoDate(value) {
  return value instanceof Date ? value.toISOString() : null;
}

function stripHtml(value) {
  return asText(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitCourseText(value) {
  return stripHtml(value)
    .split(/[.\n\r•]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function productContent(product) {
  if (!product) {
    return {
      summary: '',
      lessons: [],
      outcomes: [],
      tabs: []
    };
  }

  const outcomes = (product.learningOutcomes || [])
    .map((item) => asText(item.text))
    .filter(Boolean)
    .slice(0, 8);
  const tabLessons = (product.tabs || [])
    .flatMap((tab) => splitCourseText(tab.content))
    .slice(0, 8);
  const lessons = tabLessons.length ? tabLessons : splitCourseText(product.content || product.summary);

  return {
    summary: stripHtml(product.summary),
    lessons,
    outcomes,
    tabs: (product.tabs || []).map((tab) => ({
      title: tab.title,
      content: stripHtml(tab.content)
    })).filter((tab) => tab.title || tab.content)
  };
}

function financeSummary(registration) {
  const totalAmount = registration.totalAmount == null ? 0 : Number(registration.totalAmount);
  const paidAmount = (registration.payments || []).reduce((sum, payment) => {
    return sum + Number(payment.amount || 0);
  }, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const installments = registration.installments || [];
  const unpaidInstallments = installments.filter((item) => item.status !== 'PAID' && item.status !== 'CANCELLED');

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    totalAmountText: formatMoney(totalAmount),
    paidAmountText: formatMoney(paidAmount),
    remainingAmountText: formatMoney(remainingAmount),
    installmentCount: installments.length,
    remainingInstallmentCount: unpaidInstallments.length
  };
}

function serializeRegistration(registration) {
  const finance = financeSummary(registration);
  const content = productContent(registration.product);

  return {
    id: registration.id,
    courseTitle: registration.courseTitle,
    status: registration.status,
    statusLabel: registrationStatusLabels[registration.status] || registration.status,
    paymentStatus: registration.paymentStatus,
    paymentStatusLabel: paymentStatusLabels[registration.paymentStatus] || registration.paymentStatus,
    invoiceStatus: registration.invoiceStatus,
    invoiceStatusLabel: invoiceStatusLabels[registration.invoiceStatus] || registration.invoiceStatus,
    startsAt: isoDate(registration.startsAt),
    createdAt: isoDate(registration.createdAt),
    product: registration.product ? {
      id: registration.product.id,
      title: registration.product.title,
      slug: registration.product.slug,
      image: registration.product.image,
      duration: registration.product.duration,
      lessonType: registration.product.lessonType,
      certificate: registration.product.certificate
    } : null,
    finance,
    payments: (registration.payments || []).map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount || 0),
      amountText: formatMoney(payment.amount),
      method: payment.method,
      paidAt: isoDate(payment.paidAt),
      note: payment.note
    })),
    installments: (registration.installments || []).map((installment) => ({
      id: installment.id,
      title: installment.title || 'Taksit',
      amount: Number(installment.amount || 0),
      amountText: formatMoney(installment.amount),
      dueDate: isoDate(installment.dueDate),
      status: installment.status,
      statusLabel: installmentStatusLabels[installment.status] || installment.status,
      note: installment.note
    })),
    content
  };
}

function recordMemberLoginFailure(res, identifier, ipIdentifier) {
  return Promise.all([
    recordLoginFailure({
      res,
      scope: MEMBER_LOGIN_SCOPE,
      identifier,
      limit: MEMBER_LOGIN_LIMIT,
      windowMs: MEMBER_LOGIN_WINDOW_MS
    }),
    recordIpFailure({
      scope: MEMBER_LOGIN_IP_SCOPE,
      identifier: ipIdentifier,
      windowMs: MEMBER_LOGIN_IP_WINDOW_MS
    })
  ]);
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
    const ipAttempt = await isIpBlocked({
      req,
      res,
      scope: MEMBER_LOGIN_IP_SCOPE,
      limit: MEMBER_LOGIN_IP_LIMIT
    });

    if (ipAttempt.blocked) {
      return res.status(429).json({
        status: 'failure',
        message: 'Çok fazla hatalı giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.'
      });
    }

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
      await recordMemberLoginFailure(res, loginAttempt.identifier, ipAttempt.identifier);
      return res.status(400).json({
        status: 'failure',
        message: 'E-posta ve şifre zorunludur.'
      });
    }

    const member = await prisma.member.findUnique({ where: { email } });
    if (!member || !member.passwordHash) {
      await recordMemberLoginFailure(res, loginAttempt.identifier, ipAttempt.identifier);
      return res.status(401).json({
        status: 'failure',
        message: 'E-posta veya şifre hatalı.'
      });
    }

    if (member.status !== 'ACTIVE') {
      await recordMemberLoginFailure(res, loginAttempt.identifier, ipAttempt.identifier);
      return res.status(403).json({
        status: 'failure',
        message: 'Üyeliğiniz aktif değildir.'
      });
    }

    const passwordMatches = await bcrypt.compare(password, member.passwordHash);
    if (!passwordMatches) {
      await recordMemberLoginFailure(res, loginAttempt.identifier, ipAttempt.identifier);
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
        createdAt: true,
        educationRegistrations: {
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              include: {
                tabs: { orderBy: { sortOrder: 'asc' } },
                learningOutcomes: { orderBy: { sortOrder: 'asc' } }
              }
            },
            payments: { orderBy: { paidAt: 'desc' } },
            installments: { orderBy: { dueDate: 'asc' } }
          }
        }
      }
    });

    if (!member || member.status !== 'ACTIVE') {
      delete req.session.member;
      return res.json({ status: 'success', authenticated: false, member: null });
    }

    res.json({
      status: 'success',
      authenticated: true,
      member: {
        id: member.id,
        name: member.name,
        surname: member.surname,
        email: member.email,
        phone: member.phone,
        mailList: member.mailList,
        smsList: member.smsList,
        status: member.status,
        createdAt: member.createdAt
      },
      registrations: member.educationRegistrations.map(serializeRegistration)
    });
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
    const phoneDigits = phone.replace(/\D/g, '');

    if (!name || !surname || !phone) {
      return res.status(400).json({
        status: 'failure',
        message: 'Ad, soyad ve telefon zorunludur.'
      });
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({
        status: 'failure',
        message: 'Geçerli bir telefon numarası giriniz.'
      });
    }

    const profileData = { name, surname, phone };
    if (Object.prototype.hasOwnProperty.call(req.body, 'maillist')) {
      profileData.mailList = asBoolean(req.body.maillist);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'smslist')) {
      profileData.smsList = asBoolean(req.body.smslist);
    }

    const member = await prisma.member.update({
      where: { id: Number(req.session.member.id) },
      data: profileData,
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
