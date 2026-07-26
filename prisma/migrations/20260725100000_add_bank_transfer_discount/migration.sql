CREATE TYPE "RegistrationPaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER');

ALTER TABLE "Product"
ADD COLUMN "bankTransferDiscountRate" DECIMAL(5,2) NOT NULL DEFAULT 10.00;

ALTER TABLE "EducationRegistration"
ADD COLUMN "paymentMethod" "RegistrationPaymentMethod",
ADD COLUMN "bankTransferDiscountRate" DECIMAL(5,2),
ADD COLUMN "bankTransferAmount" DECIMAL(10,2);
