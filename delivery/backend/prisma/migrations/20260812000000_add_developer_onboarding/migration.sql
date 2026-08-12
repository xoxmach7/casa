-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "company_name" TEXT,
ADD COLUMN     "bin" TEXT,
ADD COLUMN     "company_phone" TEXT,
ADD COLUMN     "company_logo" TEXT,
ADD COLUMN     "company_website" TEXT,
ADD COLUMN     "company_description" TEXT;
