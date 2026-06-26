const ACTIVE_REGISTRATION_STATUSES = ['NEW', 'CONTACTED', 'CONFIRMED'];

async function createEnrollment(prisma, { member, product, totalAmount }) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(${member.id}::int, ${product.id}::int)
    `;

    const existingRegistration = await tx.educationRegistration.findFirst({
      where: {
        memberId: member.id,
        productId: product.id,
        status: { in: ACTIVE_REGISTRATION_STATUSES }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true
      }
    });

    if (existingRegistration) {
      return { existingRegistration };
    }

    const registration = await tx.educationRegistration.create({
      data: {
        memberId: member.id,
        productId: product.id,
        courseTitle: product.title,
        name: member.name,
        surname: member.surname || null,
        email: member.email,
        phone: member.phone,
        source: 'website-enrollment',
        status: 'NEW',
        paymentStatus: 'PENDING',
        totalAmount
      },
      select: {
        id: true,
        courseTitle: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        createdAt: true
      }
    });

    return { registration };
  });
}

module.exports = {
  ACTIVE_REGISTRATION_STATUSES,
  createEnrollment
};
