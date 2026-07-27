-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('BUYER', 'SELLER', 'NEW_BUILDING');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('UNDER_CONSTRUCTION', 'COMPLETED', 'READY_TO_MOVE');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('IN_PROGRESS', 'CERTIFIED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SYSTEM', 'CURATOR', 'DEAL', 'BONUS', 'TRAINING');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "apartments" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "budget" DECIMAL(15,2),
ADD COLUMN     "client_type" "ClientType" NOT NULL DEFAULT 'BUYER';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "bonus" TEXT,
ADD COLUMN     "building_status" "BuildingStatus" NOT NULL DEFAULT 'UNDER_CONSTRUCTION',
ADD COLUMN     "developer_name" TEXT,
ADD COLUMN     "developer_phone" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "casa_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "certification_status" "CertificationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "city" TEXT,
ADD COLUMN     "curator_id" TEXT;

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "id" TEXT NOT NULL,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_programs" (
    "id" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "program_name" TEXT NOT NULL,
    "interest_rate" DECIMAL(5,2) NOT NULL,
    "min_down_payment" DECIMAL(5,2) NOT NULL,
    "max_term" INTEGER NOT NULL,
    "property_type" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortgage_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "commission" DECIMAL(15,2) NOT NULL,
    "casa_fee" DECIMAL(15,2) NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "object_type" TEXT NOT NULL,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "broker_id" TEXT NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_progress_user_id_idx" ON "course_progress"("user_id");

-- CreateIndex
CREATE INDEX "course_progress_course_id_idx" ON "course_progress"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_user_id_course_id_key" ON "course_progress"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "mortgage_programs_bank_name_idx" ON "mortgage_programs"("bank_name");

-- CreateIndex
CREATE INDEX "mortgage_programs_property_type_idx" ON "mortgage_programs"("property_type");

-- CreateIndex
CREATE INDEX "deals_broker_id_idx" ON "deals"("broker_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "deals_completed_at_idx" ON "deals"("completed_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_idx" ON "tasks"("user_id");

-- CreateIndex
CREATE INDEX "tasks_is_completed_idx" ON "tasks"("is_completed");

-- CreateIndex
CREATE INDEX "apartments_rooms_idx" ON "apartments"("rooms");

-- CreateIndex
CREATE INDEX "clients_client_type_idx" ON "clients"("client_type");

-- CreateIndex
CREATE INDEX "projects_district_idx" ON "projects"("district");

-- CreateIndex
CREATE INDEX "projects_building_status_idx" ON "projects"("building_status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_curator_id_fkey" FOREIGN KEY ("curator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
