"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import api from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Types ──

type Step = "upload" | "mapping" | "preview" | "results";
type TargetModel = "seller" | "client";

interface UploadResponse {
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  detectedType: "contacts" | "deals";
  allRows: Record<string, string>[];
}

interface PreviewRow {
  rowNumber: number;
  data: Record<string, string>;
  status: "valid" | "duplicate" | "duplicate_in_file" | "error";
  error?: string;
}

interface PreviewStats {
  total: number;
  valid: number;
  duplicates: number;
  duplicatesInFile: number;
  errors: number;
}

interface ImportDetail {
  rowNumber: number;
  status: "created" | "skipped" | "error";
  reason?: string;
  recordId?: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: number;
  duration: number;
  details: ImportDetail[];
}

const SELLER_FIELDS: Record<string, string> = {
  fullName: "Имя (ФИО)",
  phone: "Телефон",
  email: "Email",
  city: "Город",
  source: "Источник",
  funnelStage: "Этап воронки",
  managerComment: "Комментарий менеджера",
};

const CLIENT_FIELDS: Record<string, string> = {
  fullName: "Имя (ФИО)",
  phone: "Телефон",
  email: "Email",
  city: "Город",
  iin: "ИИН",
  status: "Статус",
  notes: "Примечания",
  budget: "Бюджет",
};

const SELLER_STAGES = [
  { value: "CONTACT", label: "Контакт" },
  { value: "INTERVIEW", label: "Интервью" },
  { value: "STRATEGY", label: "Стратегия" },
  { value: "CONTRACT_SIGNING", label: "Подписание договора" },
  { value: "CANCELLED", label: "Отменён" },
];

const CLIENT_STAGES = [
  { value: "NEW", label: "Новый" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "COMPLETED", label: "Завершён" },
  { value: "CANCELLED", label: "Отменён" },
];

const ROWS_PER_PAGE = 50;

export default function ImportPage() {
  // ── State ──
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);

  // Mapping state
  const [targetModel, setTargetModel] = useState<TargetModel>("seller");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [stageMapping, setStageMapping] = useState<Record<string, string>>({});

  // Preview state
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewStats, setPreviewStats] = useState<PreviewStats | null>(null);
  const [previewPage, setPreviewPage] = useState(1);

  // Results state
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ── File Upload ──
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post<UploadResponse>("/import/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadData(res.data);

      // Auto-suggest column mapping
      const suggested: Record<string, string> = {};
      const fields = targetModel === "seller" ? SELLER_FIELDS : CLIENT_FIELDS;
      const fieldKeys = Object.keys(fields);

      const knownMappings: Record<string, string> = {
        "имя": "fullName",
        "телефон": "phone",
        "email": "email",
        "город": "city",
        "примечания": targetModel === "seller" ? "managerComment" : "notes",
        "источник": "source",
        "этап": targetModel === "seller" ? "funnelStage" : "status",
        "бюджет": "budget",
        "теги": targetModel === "seller" ? "managerComment" : "notes",
      };

      for (const col of res.data.columns) {
        const lower = col.toLowerCase();
        if (knownMappings[lower] && fieldKeys.includes(knownMappings[lower])) {
          suggested[col] = knownMappings[lower];
        }
      }

      setColumnMapping(suggested);
      setStep("mapping");
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Ошибка загрузки файла";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [targetModel]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (rejection?.errors?.[0]?.code === "file-too-large") {
        setError("Файл слишком большой. Максимальный размер — 10 МБ");
      } else {
        setError("Неподдерживаемый формат файла. Загрузите файл XLS, XLSX или CSV");
      }
    },
  });

  // ── Mapping helpers ──
  const availableFields = targetModel === "seller" ? SELLER_FIELDS : CLIENT_FIELDS;
  const stages = targetModel === "seller" ? SELLER_STAGES : CLIENT_STAGES;

  const handleColumnMappingChange = (column: string, value: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (value === "__skip__") {
        delete next[column];
      } else {
        next[column] = value;
      }
      return next;
    });
  };

  const handleTargetModelChange = (value: TargetModel) => {
    setTargetModel(value);
    setColumnMapping({});
    setStageMapping({});
  };

  // Get unique stage values from data
  const getUniqueStages = (): string[] => {
    if (!uploadData) return [];
    const stageCol = Object.keys(columnMapping).find(
      (k) => columnMapping[k] === "funnelStage" || columnMapping[k] === "status"
    );
    if (!stageCol) return [];
    const values = new Set<string>();
    for (const row of uploadData.allRows) {
      const val = (row[stageCol] ?? "").trim();
      if (val) values.add(val);
    }
    return Array.from(values);
  };

  const uniqueStages = getUniqueStages();

  // Check required fields mapped
  const requiredFields = targetModel === "seller" ? ["phone"] : ["phone"];
  const missingRequired = requiredFields.filter(
    (f) => !Object.values(columnMapping).includes(f)
  );
  const canProceed = missingRequired.length === 0;

  // ── Preview ──
  const handlePreview = async () => {
    if (!uploadData) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/import/preview", {
        rows: uploadData.allRows,
        columnMapping,
        targetModel,
        stageMapping,
      });

      setPreviewRows(res.data.rows);
      setPreviewStats(res.data.stats);
      setPreviewPage(1);
      setStep("preview");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Ошибка валидации данных");
    } finally {
      setLoading(false);
    }
  };

  // ── Execute Import ──
  const handleImport = async () => {
    if (!uploadData) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<ImportResult>("/import/execute", {
        rows: uploadData.allRows,
        columnMapping,
        targetModel,
        stageMapping,
      });

      setImportResult(res.data);
      setStep("results");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Ошибка выполнения импорта");
    } finally {
      setLoading(false);
    }
  };

  // ── CSV Download ──
  const downloadReport = () => {
    if (!importResult) return;

    const header = "Строка;Статус;Причина;ID записи\n";
    const rows = importResult.details
      .map(
        (d) =>
          `${d.rowNumber};${d.status};${d.reason || ""};${d.recordId || ""}`
      )
      .join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Reset ──
  const handleReset = () => {
    setStep("upload");
    setError(null);
    setFileName(null);
    setUploadData(null);
    setColumnMapping({});
    setStageMapping({});
    setPreviewRows([]);
    setPreviewStats(null);
    setImportResult(null);
    setPreviewPage(1);
  };

  // ── Pagination ──
  const totalPages = Math.ceil(previewRows.length / ROWS_PER_PAGE);
  const paginatedRows = previewRows.slice(
    (previewPage - 1) * ROWS_PER_PAGE,
    previewPage * ROWS_PER_PAGE
  );

  // ── Render ──
  const stepLabels: { key: Step; label: string }[] = [
    { key: "upload", label: "1. Загрузка файла" },
    { key: "mapping", label: "2. Маппинг колонок" },
    { key: "preview", label: "3. Предпросмотр" },
    { key: "results", label: "4. Результаты" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Импорт данных из amoCRM</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {stepLabels.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span
              className={
                step === s.key
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Загрузка файла</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-primary font-medium">Отпустите файл для загрузки</p>
              ) : (
                <>
                  <p className="font-medium">
                    Перетащите файл сюда или нажмите для выбора
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Поддерживаемые форматы: XLS, XLSX, CSV. Максимум 10 МБ
                  </p>
                </>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка и парсинг файла...
              </div>
            )}

            {fileName && !loading && !uploadData && (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Mapping ── */}
      {step === "mapping" && uploadData && (
        <div className="space-y-6">
          {/* Target model selector */}
          <Card>
            <CardHeader>
              <CardTitle>Целевая модель</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select
                  value={targetModel}
                  onValueChange={(v) => handleTargetModelChange(v as TargetModel)}
                >
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Продавец (Seller)</SelectItem>
                    <SelectItem value="client">Клиент (Client)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  Обнаружено строк: {uploadData.totalRows} | Тип данных:{" "}
                  {uploadData.detectedType === "deals" ? "Сделки" : "Контакты"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Column mapping */}
          <Card>
            <CardHeader>
              <CardTitle>Маппинг колонок</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadData.columns.map((col) => (
                  <div key={col} className="flex items-center gap-4">
                    <span className="w-48 text-sm font-medium truncate" title={col}>
                      {col}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <Select
                      value={columnMapping[col] || "__skip__"}
                      onValueChange={(v) => handleColumnMappingChange(col, v)}
                    >
                      <SelectTrigger className="w-[260px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">Не импортировать</SelectItem>
                        {Object.entries(availableFields).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {missingRequired.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Не задан маппинг для обязательных полей:{" "}
                  {missingRequired
                    .map((f) => availableFields[f] || f)
                    .join(", ")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stage mapping */}
          {uniqueStages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Маппинг этапов воронки</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Этап amoCRM</TableHead>
                      <TableHead>Этап Casa Pro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uniqueStages.map((stage) => (
                      <TableRow key={stage}>
                        <TableCell className="font-medium">{stage}</TableCell>
                        <TableCell>
                          <Select
                            value={stageMapping[stage] || ""}
                            onValueChange={(v) =>
                              setStageMapping((prev) => ({ ...prev, [stage]: v }))
                            }
                          >
                            <SelectTrigger className="w-[240px]">
                              <SelectValue placeholder="По умолчанию" />
                            </SelectTrigger>
                            <SelectContent>
                              {stages.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Preview data table (first 5 rows) */}
          {uploadData.previewRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Предпросмотр данных (первые 5 строк)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        {uploadData.columns.map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadData.previewRows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          {uploadData.columns.map((col) => (
                            <TableCell key={col}>{row[col] || ""}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReset}>
              Назад
            </Button>
            <Button onClick={handlePreview} disabled={!canProceed || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Проверить данные
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === "preview" && previewStats && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold">{previewStats.total}</div>
                <div className="text-xs text-muted-foreground">Всего строк</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {previewStats.valid}
                </div>
                <div className="text-xs text-muted-foreground">Валидных</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {previewStats.duplicates}
                </div>
                <div className="text-xs text-muted-foreground">Дубликаты (БД)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {previewStats.duplicatesInFile}
                </div>
                <div className="text-xs text-muted-foreground">Дубликаты (файл)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {previewStats.errors}
                </div>
                <div className="text-xs text-muted-foreground">Ошибки</div>
              </CardContent>
            </Card>
          </div>

          {/* Preview table */}
          <Card>
            <CardHeader>
              <CardTitle>Предпросмотр данных</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Строка</TableHead>
                      <TableHead>Статус</TableHead>
                      {uploadData?.columns.map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.map((row) => (
                      <TableRow
                        key={row.rowNumber}
                        className={
                          row.status === "error"
                            ? "bg-red-50 dark:bg-red-950/20"
                            : row.status === "duplicate" || row.status === "duplicate_in_file"
                            ? "bg-yellow-50 dark:bg-yellow-950/20"
                            : ""
                        }
                      >
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.status === "valid" && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Валидна
                            </Badge>
                          )}
                          {row.status === "duplicate" && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              Дубликат
                            </Badge>
                          )}
                          {row.status === "duplicate_in_file" && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              Дубликат в файле
                            </Badge>
                          )}
                          {row.status === "error" && (
                            <Badge variant="destructive">{row.error || "Ошибка"}</Badge>
                          )}
                        </TableCell>
                        {uploadData?.columns.map((col) => (
                          <TableCell key={col}>{row.data[col] || ""}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    Страница {previewPage} из {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      disabled={previewPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      disabled={previewPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep("mapping")}>
              Назад к маппингу
            </Button>
            <Button
              onClick={handleImport}
              disabled={loading || previewStats.valid === 0}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Импортировать ({previewStats.valid} записей)
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === "results" && importResult && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-2xl font-bold text-green-600">
                  {importResult.created}
                </div>
                <div className="text-xs text-muted-foreground">Создано</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
                <div className="text-2xl font-bold text-yellow-600">
                  {importResult.skipped}
                </div>
                <div className="text-xs text-muted-foreground">
                  Пропущено (дубликаты)
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
                <div className="text-2xl font-bold text-red-600">
                  {importResult.errors}
                </div>
                <div className="text-xs text-muted-foreground">Ошибки</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold">
                  {(importResult.duration / 1000).toFixed(1)}с
                </div>
                <div className="text-xs text-muted-foreground">
                  Время выполнения
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error list */}
          {importResult.errors > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Ошибки (первые {Math.min(20, importResult.details.filter((d) => d.status === "error").length)})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {importResult.details
                    .filter((d) => d.status === "error")
                    .slice(0, 20)
                    .map((d) => (
                      <div
                        key={d.rowNumber}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Badge variant="destructive" className="shrink-0">
                          Строка {d.rowNumber}
                        </Badge>
                        <span className="text-muted-foreground">
                          {d.reason || "Неизвестная ошибка"}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Скачать отчёт CSV
            </Button>
            <Button onClick={handleReset}>Новый импорт</Button>
          </div>
        </div>
      )}
    </div>
  );
}
