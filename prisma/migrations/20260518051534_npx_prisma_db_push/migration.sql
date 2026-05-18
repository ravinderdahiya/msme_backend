-- CreateTable
CREATE TABLE "ApiUrl" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataService" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL DEFAULT 'REST API',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiUrl_key_key" ON "ApiUrl"("key");

-- CreateIndex
CREATE INDEX "ApiUrl_category_idx" ON "ApiUrl"("category");

-- CreateIndex
CREATE INDEX "ApiUrl_isActive_idx" ON "ApiUrl"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DataService_key_key" ON "DataService"("key");

-- CreateIndex
CREATE INDEX "DataService_serviceType_idx" ON "DataService"("serviceType");

-- CreateIndex
CREATE INDEX "DataService_isActive_idx" ON "DataService"("isActive");
