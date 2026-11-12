-- [직접 추가] 고유코드 자동 채번용 시퀀스. 각 테이블 PK 기본값이 접두문자 + 5자리 번호를 만든다.
CREATE SEQUENCE "tb_dept_seq";
CREATE SEQUENCE "tb_user_seq";
CREATE SEQUENCE "tb_comm_seq";
CREATE SEQUENCE "tb_ap_position_seq";
CREATE SEQUENCE "tb_person_seq";
CREATE SEQUENCE "tb_pos_seq";
CREATE SEQUENCE "tb_appoint_seq";
CREATE SEQUENCE "tb_accessreq_seq";

-- CreateEnum
CREATE TYPE "DeptType" AS ENUM ('국소', '부서');

-- CreateEnum
CREATE TYPE "InstType" AS ENUM ('법령', '조례', '기타');

-- CreateEnum
CREATE TYPE "OpType" AS ENUM ('상설', '비상설');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('남', '여');

-- CreateEnum
CREATE TYPE "AppointType" AS ENUM ('당연직', '위촉직');

-- CreateEnum
CREATE TYPE "AppointKind" AS ENUM ('신규', '연임', '보궐', '직위변경');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('임기만료', '사임', '해촉', '직위변경', '기타');

-- CreateEnum
CREATE TYPE "ReqStatus" AS ENUM ('대기', '승인', '거절');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('생성', '수정', '삭제', '내보내기', '로그인');

-- CreateTable
CREATE TABLE "TB_Dept" (
    "dept_id" TEXT NOT NULL DEFAULT ('d'::text || lpad((nextval('tb_dept_seq'::regclass))::text, 5, '0'::text)),
    "parentdept_id" TEXT,
    "dept_name" TEXT NOT NULL,
    "dept_type" "DeptType" NOT NULL,
    "dept_activ" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Dept_pkey" PRIMARY KEY ("dept_id")
);

-- CreateTable
CREATE TABLE "TB_Auth" (
    "auth_id" TEXT NOT NULL,
    "auth_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Auth_pkey" PRIMARY KEY ("auth_id")
);

-- CreateTable
CREATE TABLE "TB_User" (
    "user_id" TEXT NOT NULL DEFAULT ('u'::text || lpad((nextval('tb_user_seq'::regclass))::text, 5, '0'::text)),
    "login_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "phone" VARCHAR(4) NOT NULL,
    "auth_id" TEXT NOT NULL,
    "user_activ" BOOLEAN NOT NULL DEFAULT true,
    "must_change_pw" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "TB_Comm" (
    "comm_id" TEXT NOT NULL DEFAULT ('c'::text || lpad((nextval('tb_comm_seq'::regclass))::text, 5, '0'::text)),
    "comm_name" TEXT NOT NULL,
    "dept_id" TEXT NOT NULL,
    "mng_user_id" TEXT NOT NULL,
    "inst_type" "InstType" NOT NULL,
    "legal_1" TEXT,
    "legal_2" TEXT,
    "op_type" "OpType" NOT NULL,
    "member_cap" INTEGER NOT NULL,
    "term_yr" INTEGER NOT NULL,
    "reappoint_num" INTEGER NOT NULL,
    "comm_activ" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Comm_pkey" PRIMARY KEY ("comm_id")
);

-- CreateTable
CREATE TABLE "TB_Ap_Position" (
    "appos_id" TEXT NOT NULL DEFAULT ('s'::text || lpad((nextval('tb_ap_position_seq'::regclass))::text, 5, '0'::text)),
    "appos_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Ap_Position_pkey" PRIMARY KEY ("appos_id")
);

-- CreateTable
CREATE TABLE "TB_Person" (
    "person_id" TEXT NOT NULL DEFAULT ('p'::text || lpad((nextval('tb_person_seq'::regclass))::text, 5, '0'::text)),
    "person_name" TEXT NOT NULL,
    "person_gender" "Gender" NOT NULL,
    "birth_date" DATE NOT NULL,
    "is_public" BOOLEAN NOT NULL,
    "person_activ" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Person_pkey" PRIMARY KEY ("person_id")
);

-- CreateTable
CREATE TABLE "TB_Pos" (
    "pos_id" TEXT NOT NULL DEFAULT ('a'::text || lpad((nextval('tb_pos_seq'::regclass))::text, 5, '0'::text)),
    "person_id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "pos_name" TEXT NOT NULL,
    "pos_activ" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Pos_pkey" PRIMARY KEY ("pos_id")
);

-- CreateTable
CREATE TABLE "TB_Appoint" (
    "appoint_id" TEXT NOT NULL DEFAULT ('t'::text || lpad((nextval('tb_appoint_seq'::regclass))::text, 5, '0'::text)),
    "comm_id" TEXT NOT NULL,
    "pos_id" TEXT NOT NULL,
    "appos_id" TEXT NOT NULL,
    "appoint_type" "AppointType" NOT NULL,
    "appoint_kind" "AppointKind" NOT NULL,
    "appoint_start" DATE NOT NULL,
    "expire_due" DATE,
    "appoint_end" DATE,
    "end_reason" "EndReason",
    "appoint_activ" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_Appoint_pkey" PRIMARY KEY ("appoint_id")
);

-- CreateTable
CREATE TABLE "TB_AccessReq" (
    "req_id" TEXT NOT NULL DEFAULT ('q'::text || lpad((nextval('tb_accessreq_seq'::regclass))::text, 5, '0'::text)),
    "comm_id" TEXT NOT NULL,
    "req_user_id" TEXT NOT NULL,
    "req_reason" TEXT NOT NULL,
    "req_status" "ReqStatus" NOT NULL DEFAULT '대기',
    "req_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "view_days" INTEGER,
    "view_until" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_AccessReq_pkey" PRIMARY KEY ("req_id")
);

-- CreateTable
CREATE TABLE "TB_AuditLog" (
    "log_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "target_table" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "logged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TB_AuditLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE INDEX "TB_Dept_parentdept_id_idx" ON "TB_Dept"("parentdept_id");

-- CreateIndex
CREATE UNIQUE INDEX "TB_User_login_id_key" ON "TB_User"("login_id");

-- CreateIndex
CREATE INDEX "TB_User_dept_id_idx" ON "TB_User"("dept_id");

-- CreateIndex
CREATE INDEX "TB_User_auth_id_idx" ON "TB_User"("auth_id");

-- CreateIndex
CREATE INDEX "TB_Comm_dept_id_idx" ON "TB_Comm"("dept_id");

-- CreateIndex
CREATE INDEX "TB_Comm_mng_user_id_idx" ON "TB_Comm"("mng_user_id");

-- CreateIndex
CREATE INDEX "TB_Person_person_name_birth_date_idx" ON "TB_Person"("person_name", "birth_date");

-- CreateIndex
CREATE UNIQUE INDEX "TB_Pos_person_id_org_name_pos_name_key" ON "TB_Pos"("person_id", "org_name", "pos_name");

-- CreateIndex
CREATE INDEX "TB_Appoint_comm_id_idx" ON "TB_Appoint"("comm_id");

-- CreateIndex
CREATE INDEX "TB_Appoint_pos_id_idx" ON "TB_Appoint"("pos_id");

-- CreateIndex
CREATE INDEX "TB_Appoint_appos_id_idx" ON "TB_Appoint"("appos_id");

-- CreateIndex
CREATE INDEX "TB_AccessReq_comm_id_idx" ON "TB_AccessReq"("comm_id");

-- CreateIndex
CREATE INDEX "TB_AccessReq_req_user_id_idx" ON "TB_AccessReq"("req_user_id");

-- CreateIndex
CREATE INDEX "TB_AccessReq_decided_by_idx" ON "TB_AccessReq"("decided_by");

-- CreateIndex
CREATE INDEX "TB_AuditLog_user_id_idx" ON "TB_AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "TB_AuditLog_target_table_target_id_idx" ON "TB_AuditLog"("target_table", "target_id");

-- CreateIndex
CREATE INDEX "TB_AuditLog_logged_at_idx" ON "TB_AuditLog"("logged_at");

-- AddForeignKey
ALTER TABLE "TB_Dept" ADD CONSTRAINT "TB_Dept_parentdept_id_fkey" FOREIGN KEY ("parentdept_id") REFERENCES "TB_Dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_User" ADD CONSTRAINT "TB_User_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "TB_Dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_User" ADD CONSTRAINT "TB_User_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "TB_Auth"("auth_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Comm" ADD CONSTRAINT "TB_Comm_dept_id_fkey" FOREIGN KEY ("dept_id") REFERENCES "TB_Dept"("dept_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Comm" ADD CONSTRAINT "TB_Comm_mng_user_id_fkey" FOREIGN KEY ("mng_user_id") REFERENCES "TB_User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Pos" ADD CONSTRAINT "TB_Pos_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "TB_Person"("person_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Appoint" ADD CONSTRAINT "TB_Appoint_comm_id_fkey" FOREIGN KEY ("comm_id") REFERENCES "TB_Comm"("comm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Appoint" ADD CONSTRAINT "TB_Appoint_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "TB_Pos"("pos_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_Appoint" ADD CONSTRAINT "TB_Appoint_appos_id_fkey" FOREIGN KEY ("appos_id") REFERENCES "TB_Ap_Position"("appos_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_AccessReq" ADD CONSTRAINT "TB_AccessReq_comm_id_fkey" FOREIGN KEY ("comm_id") REFERENCES "TB_Comm"("comm_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_AccessReq" ADD CONSTRAINT "TB_AccessReq_req_user_id_fkey" FOREIGN KEY ("req_user_id") REFERENCES "TB_User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_AccessReq" ADD CONSTRAINT "TB_AccessReq_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "TB_User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TB_AuditLog" ADD CONSTRAINT "TB_AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "TB_User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- [직접 추가] 시퀀스를 PK 컬럼에 소속시켜 테이블과 함께 관리되게 한다.
ALTER SEQUENCE "tb_dept_seq" OWNED BY "TB_Dept"."dept_id";
ALTER SEQUENCE "tb_user_seq" OWNED BY "TB_User"."user_id";
ALTER SEQUENCE "tb_comm_seq" OWNED BY "TB_Comm"."comm_id";
ALTER SEQUENCE "tb_ap_position_seq" OWNED BY "TB_Ap_Position"."appos_id";
ALTER SEQUENCE "tb_person_seq" OWNED BY "TB_Person"."person_id";
ALTER SEQUENCE "tb_pos_seq" OWNED BY "TB_Pos"."pos_id";
ALTER SEQUENCE "tb_appoint_seq" OWNED BY "TB_Appoint"."appoint_id";
ALTER SEQUENCE "tb_accessreq_seq" OWNED BY "TB_AccessReq"."req_id";
