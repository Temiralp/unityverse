function isLegacyHomepageRequest(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  return req.path === '/' || req.path === '/index.html';
}

function createLegacyCorporateReferences(prisma) {
  return async function loadLegacyCorporateReferences(req, res, next) {
    if (!isLegacyHomepageRequest(req)) return next();

    try {
      res.locals.legacyCorporateReferences = await prisma.corporateReference.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          logoPath: true
        }
      });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  createLegacyCorporateReferences,
  isLegacyHomepageRequest
};
