-- AlterTable
-- [직접 수정] 기존 사용자가 있으므로 email은 빈 칸 허용으로 추가 → 내부용 주소 채움 → 필수로 변경
ALTER TABLE "TB_User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT;

UPDATE "TB_User" SET "email" = "login_id" || '@wewant.local' WHERE "email" IS NULL;
ALTER TABLE "TB_User" ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "TB_Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TB_Account" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TB_Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TB_Session_token_key" ON "TB_Session"("token");

-- CreateIndex
CREATE INDEX "TB_Session_user_id_idx" ON "TB_Session"("user_id");

-- CreateIndex
CREATE INDEX "TB_Account_user_id_idx" ON "TB_Account"("user_id");

-- CreateIndex
CREATE INDEX "TB_Verification_identifier_idx" ON "TB_Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "TB_User_email_key" ON "TB_User"("email");

-- AddForeignKey
ALTER TABLE "TB_Session" ADD CONSTRAINT "TB_Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "TB_User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Account" ADD CONSTRAINT "TB_Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "TB_User"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

