-- Add an optional client-supplied idempotency key for payment creation.
ALTER TABLE "payments" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
