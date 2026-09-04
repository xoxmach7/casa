/**
 * Удаление ипотечного расчёта целиком.
 *
 * Просто `delete` по кейсу не проходит: вокруг него намеренно построена
 * доказательная цепочка M03/M04, где почти все связи стоят на Restrict —
 * документ, его ревизии, проверки полей и верифицированный снимок нельзя
 * потерять «за компанию» с чем-то другим. Плюс два узла, которые обычным
 * порядком не развязываются:
 *
 *  - документ хранит ссылку на текущую ревизию, а ревизия — на документ:
 *    круг рвётся обнулением current_revision_id;
 *  - проверка поля может ссылаться на предыдущую проверку (supersedes) тоже
 *    через Restrict, и одиночный DELETE по набору упал бы на своей же строке:
 *    сначала обнуляем ссылку, потом удаляем.
 *
 * Всё остальное (профиль с деньгами, стороны, прогоны расчёта, аудит, проверки
 * по реестрам) висит на кейсе через Cascade и уходит вместе с ним.
 *
 * Клиента НЕ трогаем: он живёт своей жизнью в CRM и может быть в других сделках.
 */

import { prisma } from '../prisma';

export interface CaseDeletionSummary {
  documents: number;
  revisions: number;
  fieldReviews: number;
  verifiedSnapshots: number;
}

export async function deleteMortgageCase(caseId: string): Promise<CaseDeletionSummary> {
  return prisma.$transaction(async (tx) => {
    const documents = await tx.mortgageDocument.findMany({
      where: { caseId },
      select: { id: true },
    });
    const documentIds = documents.map((d) => d.id);

    const revisions = documentIds.length
      ? await tx.mortgageDocumentRevision.findMany({
          where: { documentId: { in: documentIds } },
          select: { id: true },
        })
      : [];
    const revisionIds = revisions.map((r) => r.id);

    const snapshots = await tx.mortgageVerifiedSnapshot.findMany({
      where: { caseId },
      select: { id: true },
    });
    const snapshotIds = snapshots.map((s) => s.id);

    if (snapshotIds.length) {
      await tx.mortgageSnapshotDocumentSource.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
      await tx.mortgageSnapshotReviewSource.deleteMany({ where: { snapshotId: { in: snapshotIds } } });
      await tx.mortgageVerifiedSnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
    }

    let fieldReviews = 0;
    if (revisionIds.length) {
      // Разрываем цепочку supersedes до удаления, иначе Restrict сработает
      // на строке, которая ссылается на соседнюю в том же наборе.
      await tx.mortgageFieldReview.updateMany({
        where: { documentRevisionId: { in: revisionIds } },
        data: { supersedesReviewId: null },
      });
      const removed = await tx.mortgageFieldReview.deleteMany({
        where: { documentRevisionId: { in: revisionIds } },
      });
      fieldReviews = removed.count;
    }

    if (documentIds.length) {
      // Документ ↔ ревизия ссылаются друг на друга; рвём со стороны документа.
      await tx.mortgageDocument.updateMany({
        where: { id: { in: documentIds } },
        data: { currentRevisionId: null },
      });
      await tx.mortgageDocumentRevision.deleteMany({ where: { documentId: { in: documentIds } } });
      await tx.mortgageDocument.deleteMany({ where: { id: { in: documentIds } } });
    }

    await tx.mortgageCase.delete({ where: { id: caseId } });

    return {
      documents: documentIds.length,
      revisions: revisionIds.length,
      fieldReviews,
      verifiedSnapshots: snapshotIds.length,
    };
  });
}
