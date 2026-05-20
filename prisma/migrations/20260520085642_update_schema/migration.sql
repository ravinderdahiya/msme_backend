/*
  Warnings:

  - The primary key for the `ApiUrl` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `DataService` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Otp` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SessionLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[mobile]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "SessionLog" DROP CONSTRAINT "SessionLog_userId_fkey";

-- AlterTable
ALTER TABLE "ApiUrl" DROP CONSTRAINT "ApiUrl_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "ApiUrl_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "ApiUrl_id_seq";

-- AlterTable
ALTER TABLE "DataService" DROP CONSTRAINT "DataService_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "DataService_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "DataService_id_seq";

-- AlterTable
ALTER TABLE "Otp" DROP CONSTRAINT "Otp_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Otp_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Otp_id_seq";

-- AlterTable
ALTER TABLE "SessionLog" DROP CONSTRAINT "SessionLog_pkey",
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "SessionLog_id_seq";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateIndex
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
