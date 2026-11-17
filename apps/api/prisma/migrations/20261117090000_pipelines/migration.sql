-- CreateEnum
CREATE TYPE "PipelineTrigger" AS ENUM ('NEW_COMMENT', 'NEW_MESSAGE', 'NEW_LEAD', 'HOT_LEAD');

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "PipelineTrigger" NOT NULL DEFAULT 'NEW_MESSAGE',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSONB NOT NULL,
    "accountId" TEXT,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "trace" JSONB NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pipeline_userId_isActive_trigger_idx" ON "Pipeline"("userId", "isActive", "trigger");

-- CreateIndex
CREATE INDEX "PipelineRun_pipelineId_createdAt_idx" ON "PipelineRun"("pipelineId", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineRun_userId_createdAt_idx" ON "PipelineRun"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
