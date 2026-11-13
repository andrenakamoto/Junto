-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "quoteId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
