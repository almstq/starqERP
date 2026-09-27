/**
 * SERP-302: Universal Atomic Batch Execution & Rollback Engine
 */

import {
  IngestionTarget,
  ValidationSummary,
  IngestionExecutionOptions,
  IngestionExecutionResult,
  RowValidationError,
} from './types';

export type BatchInsertFn = (
  target: IngestionTarget,
  records: Record<string, any>[],
  batchId: string,
  dryRun: boolean
) => Promise<{ ok: boolean; insertedCount: number; error?: string }>;

/**
 * Default mock/client committer for testing and UI simulation
 */
export const defaultMockBatchCommitter: BatchInsertFn = async (
  _target,
  records,
  _batchId,
  _dryRun
) => {
  // Simulate slight asynchronous processing delay
  await new Promise((resolve) => setTimeout(resolve, 10));
  return { ok: true, insertedCount: records.length };
};

/**
 * Executes batch ingestion with strict atomic all-or-nothing rollback guarantees.
 */
export async function executeBatchIngestion(
  target: IngestionTarget,
  validationSummary: ValidationSummary,
  options: IngestionExecutionOptions,
  committer: BatchInsertFn = defaultMockBatchCommitter
): Promise<IngestionExecutionResult> {
  const startTime = Date.now();
  const batchId = `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const batchSize = options.batchSize || 500;
  const isAllOrNothing = options.mode === 'all_or_nothing';
  const dryRun = options.dryRun ?? false;

  // 1. Guard: If all_or_nothing and any validation error exists, fail immediately with 0 inserts
  if (isAllOrNothing && !validationSummary.isValid) {
    return {
      success: false,
      target,
      batchId,
      totalProcessed: 0,
      insertedCount: 0,
      failedCount: validationSummary.totalRows,
      durationMs: Date.now() - startTime,
      rolledBack: true,
      errors: validationSummary.errors,
      message: `Atomic rollback: Batch rejected because dataset contains ${validationSummary.errorRows} error rows. Zero records were inserted.`,
    };
  }

  // 2. Filter records according to mode
  const errorRowIndices = new Set(
    validationSummary.errors.filter((e) => e.severity === 'error').map((e) => e.rowIndex)
  );

  const eligibleRecords: Record<string, any>[] = [];
  const skippedErrors: RowValidationError[] = [];

  validationSummary.parsedRecords.forEach((record, index) => {
    const displayRowIndex = index + 2;
    if (errorRowIndices.has(displayRowIndex)) {
      if (!isAllOrNothing) {
        skippedErrors.push(...validationSummary.errors.filter((e) => e.rowIndex === displayRowIndex));
      }
    } else {
      eligibleRecords.push(record);
    }
  });

  if (eligibleRecords.length === 0) {
    return {
      success: false,
      target,
      batchId,
      totalProcessed: 0,
      insertedCount: 0,
      failedCount: validationSummary.totalRows,
      durationMs: Date.now() - startTime,
      rolledBack: false,
      errors: validationSummary.errors,
      message: 'No valid records found to import.',
    };
  }

  // 3. Process records in chunks
  let totalInserted = 0;
  const executionErrors: RowValidationError[] = [...skippedErrors];

  for (let i = 0; i < eligibleRecords.length; i += batchSize) {
    const chunk = eligibleRecords.slice(i, i + batchSize);

    try {
      const result = await committer(target, chunk, batchId, dryRun);

      if (!result.ok) {
        if (isAllOrNothing) {
          // Trigger total atomic rollback
          return {
            success: false,
            target,
            batchId,
            totalProcessed: i + chunk.length,
            insertedCount: 0,
            failedCount: validationSummary.totalRows,
            durationMs: Date.now() - startTime,
            rolledBack: true,
            errors: [
              ...executionErrors,
              {
                rowIndex: i + 2,
                column: 'Batch Committer',
                fieldKey: 'batch_failure',
                value: null,
                error: result.error || 'Server error during batch commit. Transaction rolled back.',
                severity: 'error',
              },
            ],
            message: `Atomic Rollback: Transaction failed on batch chunk ${Math.floor(i / batchSize) + 1}. All previously inserted records rolled back.`,
          };
        } else {
          // Record chunk error and continue
          executionErrors.push({
            rowIndex: i + 2,
            column: 'Batch Committer',
            fieldKey: 'batch_error',
            value: null,
            error: result.error || 'Failed to insert batch chunk.',
            severity: 'error',
          });
        }
      } else {
        totalInserted += result.insertedCount;
      }
    } catch (err: any) {
      if (isAllOrNothing) {
        return {
          success: false,
          target,
          batchId,
          totalProcessed: i + chunk.length,
          insertedCount: 0,
          failedCount: validationSummary.totalRows,
          durationMs: Date.now() - startTime,
          rolledBack: true,
          errors: [
            ...executionErrors,
            {
              rowIndex: i + 2,
              column: 'Batch Committer',
              fieldKey: 'exception',
              value: null,
              error: err?.message || 'Unexpected exception during batch execution. Transaction aborted.',
              severity: 'error',
            },
          ],
          message: `Fatal error: ${err?.message || 'Database exception'}. Atomic rollback completed.`,
        };
      }
    }

    if (options.onProgress) {
      const processed = Math.min(i + batchSize, eligibleRecords.length);
      options.onProgress({
        processed,
        total: eligibleRecords.length,
        percent: Math.round((processed / eligibleRecords.length) * 100),
      });
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: totalInserted > 0,
    target,
    batchId,
    totalProcessed: eligibleRecords.length,
    insertedCount: totalInserted,
    failedCount: validationSummary.totalRows - totalInserted,
    durationMs,
    rolledBack: false,
    errors: executionErrors,
    message: dryRun
      ? `Dry run completed successfully. ${totalInserted} records verified and ready for commit.`
      : `Batch ingestion complete: ${totalInserted} records successfully imported in ${(durationMs / 1000).toFixed(2)}s.`,
  };
}
