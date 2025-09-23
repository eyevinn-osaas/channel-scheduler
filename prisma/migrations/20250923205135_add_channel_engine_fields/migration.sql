-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "webhook_url" TEXT,
    "schedule_start" DATETIME,
    "auto_schedule" BOOLEAN NOT NULL DEFAULT true,
    "channel_engine_instance" TEXT,
    "channel_engine_url" TEXT,
    "is_on_air" BOOLEAN NOT NULL DEFAULT false,
    "last_status_check" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "vods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "hls_url" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "preroll_url" TEXT,
    "preroll_duration_ms" INTEGER,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "vod_id" TEXT NOT NULL,
    "scheduled_start" DATETIME NOT NULL,
    "scheduled_end" DATETIME NOT NULL,
    "position" INTEGER NOT NULL,
    "repeat_pattern" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedules_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "schedules_vod_id_fkey" FOREIGN KEY ("vod_id") REFERENCES "vods" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "schedules_channel_id_scheduled_start_idx" ON "schedules"("channel_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "schedules_channel_id_position_idx" ON "schedules"("channel_id", "position");
