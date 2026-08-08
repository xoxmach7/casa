'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  HAPPY_PATH_STEP_LABELS,
  stepForStatus,
  nextHappyStatus,
  nextActionLabel,
  statusLabel,
  type FixationStatus,
} from '@/lib/fixation-status';
import { generateFixationSheetPdf } from '@/lib/fixation-pdf';

interface FixationStatusCardProps {
  fixationId: string;
}

export function FixationStatusCard({ fixationId }: FixationStatusCardProps) {
  const queryClient = useQueryClient();

  const { data: fixation, isLoading } = useQuery({
    queryKey: ['fixation', fixationId],
    queryFn: async () => {
      const res = await api.get(`/fixations/${fixationId}`);
      return res.data;
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async (status: FixationStatus) => {
      return api.patch(`/fixations/${fixationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixation', fixationId] });
      toast.success('Статус обновлён');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка обновления статуса');
    },
  });

  if (isLoading || !fixation) {
    return null;
  }

  const status = fixation.status as FixationStatus;
  const step = stepForStatus(status);
  const next = nextHappyStatus(status);
  const nextLabel = nextActionLabel(status);

  const handleDownload = () => {
    generateFixationSheetPdf({
      fixationId: fixation.id,
      statusLabel: statusLabel(status),
      createdAt: fixation.createdAt,
      expiresAt: fixation.expiresAt,
      brokerName: `${fixation.broker?.firstName ?? ''} ${fixation.broker?.lastName ?? ''}`.trim(),
      brokerPhone: fixation.broker?.phone ?? '',
      clientName: `${fixation.client?.firstName ?? ''} ${fixation.client?.lastName ?? ''}`.trim(),
      clientPhone: fixation.client?.phone ?? '',
      projectName: fixation.project?.name ?? '',
      apartmentNumber: fixation.apartment?.number ?? '',
      paymentMethodLabel:
        fixation.paymentMethod === 'FULL' ? '100%' : fixation.paymentMethod === 'MORTGAGE' ? 'Ипотека' : fixation.paymentMethod === 'INSTALLMENT' ? 'Рассрочка' : '—',
      dealAmount: Number(fixation.dealAmount ?? 0),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Фиксация №{fixation.id.slice(-6).toUpperCase()}</CardTitle>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Скачать PDF
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {fixation.expiresAt && (
          <p className="text-xs text-muted-foreground">
            Действительна до {new Date(fixation.expiresAt).toLocaleString('ru-RU')}
          </p>
        )}

        {step >= 0 ? (
          <div className="flex gap-1 text-xs">
            {HAPPY_PATH_STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`flex-1 rounded p-1.5 text-center ${
                  i <= step ? 'bg-primary/10 font-medium text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium text-destructive">{statusLabel(status)}</p>
        )}

        {next && nextLabel && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => advanceMutation.mutate(next)}
            disabled={advanceMutation.isPending}
          >
            {nextLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
