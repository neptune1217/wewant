-- AlterTable
ALTER TABLE "TB_Comm" ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by" TEXT,
ADD COLUMN     "comm_approved" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TB_Comm_comm_approved_idx" ON "TB_Comm"("comm_approved");

-- AddForeignKey
ALTER TABLE "TB_Comm" ADD CONSTRAINT "TB_Comm_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "TB_User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- [직접 추가] 이 기능 이전에 등록된 위원회는 이미 운영 중인 것으로 보고 승인 처리한다 (승인자 정보는 없음)
UPDATE "TB_Comm" SET "comm_approved" = true, "approved_at" = CURRENT_TIMESTAMP WHERE "comm_approved" = false;
