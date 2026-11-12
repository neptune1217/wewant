-- AlterTable
ALTER TABLE "TB_Ap_Position" ADD COLUMN     "appos_activ" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "TB_Ap_Position_appos_name_key" ON "TB_Ap_Position"("appos_name");

