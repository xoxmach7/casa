-- M06 Calculation Engine: run + immutable snapshot (spec v1.4). Additive only.

-- CreateTable
CREATE TABLE "mortgage_calculation_runs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "decimal_context_version" TEXT NOT NULL,
    "inputs_json" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortgage_calculation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgage_calculation_snapshots" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "decimal_context_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "output_hash" TEXT NOT NULL,
    "results_json" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mortgage_calculation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mortgage_calculation_runs_case_id_created_at_idx" ON "mortgage_calculation_runs"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mortgage_calculation_snapshots_run_id_key" ON "mortgage_calculation_snapshots"("run_id");

-- CreateIndex
CREATE INDEX "mortgage_calculation_snapshots_case_id_created_at_idx" ON "mortgage_calculation_snapshots"("case_id", "created_at");

-- AddForeignKey
ALTER TABLE "mortgage_calculation_runs" ADD CONSTRAINT "mortgage_calculation_runs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgage_calculation_snapshots" ADD CONSTRAINT "mortgage_calculation_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "mortgage_calculation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgage_calculation_snapshots" ADD CONSTRAINT "mortgage_calculation_snapshots_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "mortgage_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
