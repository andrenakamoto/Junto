-- Idées d'un Plan (brainstorming : thèmes, post-its, statut, votes)
-- CreateTable
CREATE TABLE "IdeaColumn" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "columnId" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "votes" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "taskId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdeaColumn_planId_idx" ON "IdeaColumn"("planId");

-- CreateIndex
CREATE INDEX "Idea_planId_idx" ON "Idea"("planId");

-- AddForeignKey
ALTER TABLE "IdeaColumn" ADD CONSTRAINT "IdeaColumn_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "IdeaColumn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

