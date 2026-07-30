-- CreateIndex
CREATE INDEX "crm_properties_status_funnel_stage_published_at_idx" ON "crm_properties"("status", "funnel_stage", "published_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");
