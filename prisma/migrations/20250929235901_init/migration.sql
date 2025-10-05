-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "targetModel" TEXT NOT NULL,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "topP" REAL,
    "frequencyPenalty" REAL,
    "presencePenalty" REAL,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "categoryId" TEXT,
    CONSTRAINT "prompts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "prompt_tags_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "prompt_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    CONSTRAINT "ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ratings_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "targetModel" TEXT NOT NULL,
    "temperature" REAL,
    "maxTokens" INTEGER,
    "topP" REAL,
    "frequencyPenalty" REAL,
    "presencePenalty" REAL,
    "notes" TEXT,
    "versionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalPromptId" TEXT NOT NULL,
    CONSTRAINT "prompt_versions_originalPromptId_fkey" FOREIGN KEY ("originalPromptId") REFERENCES "prompts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_tags_promptId_tagId_key" ON "prompt_tags"("promptId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_userId_promptId_key" ON "ratings"("userId", "promptId");
