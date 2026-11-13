-- AlterTable
ALTER TABLE "OrganisationMember" ADD COLUMN     "cockpitDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cockpitDigestSentAt" TIMESTAMP(3);
