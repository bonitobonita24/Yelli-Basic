import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';

import type { Job } from 'bullmq';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { assertSystemJob, log } from './_validate';
import { QUEUE_NAMES, type BackupJobData } from '../queues';

/**
 * backup worker — whole-DB pg_dump → offsite S3 (LOCKED: Database Backup, Step 7).
 *
 * Cron daily 02:00 UTC. Whole-DB `pg_dump --format=custom --compress=9` streamed to
 * `s3://<BACKUP_S3_BUCKET>/postgres/YYYY-MM-DD.dump`. The 30-day retention +
 * Glacier-IR-after-7-days lifecycle is a BUCKET-level configuration (deployment
 * concern), NOT a per-object runtime concern — the worker only writes the dump
 * object; the bucket lifecycle policy ages/transitions it (W5b precedent: the
 * lifecycle bucket is a deployment-routing concern, not wired in the worker).
 *
 * NOT tenant-scoped — operates on the ENTIRE database, so it carries the platform
 * system identity and is validated by the stricter `assertSystemJob`
 * (LOCKED exception: tenantId '_pwbt' + userId 'system').
 *
 * RUNTIME-DEFERRED (this session, W5e). The dedicated offsite backup bucket is NOT
 * provisioned yet. The 5 `BACKUP_S3_*` env vars below are a separate credential
 * namespace from `@yelli/storage`'s `STORAGE_*` MinIO branding creds — they are
 * placeholders in `.env.example` only. Until they are filled, this worker emits a
 * structured warn and throws a clear "runtime deferred" error at the TOP of the
 * processor (never at module load), so importing this module is side-effect-free
 * and the queue host boots cleanly. It NEVER fabricates a credential.
 */

interface BackupS3Config {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Resolve the offsite backup S3 credentials, or throw the LOCKED "runtime deferred"
 * error if ANY of the 5 vars is missing. Read at call time (not module load) so the
 * worker host can register this processor without the backup bucket provisioned.
 */
function resolveBackupS3(jobId: string | undefined): BackupS3Config {
  const bucket = process.env['BACKUP_S3_BUCKET'];
  const region = process.env['BACKUP_S3_REGION'];
  const endpoint = process.env['BACKUP_S3_ENDPOINT'];
  const accessKeyId = process.env['BACKUP_S3_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['BACKUP_S3_SECRET_ACCESS_KEY'];

  if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) {
    // Structured-JSON warn (operations.observability.format — LOCKED). NEVER log
    // any credential value; report only WHICH keys are present, as booleans.
    log('warn', 'backup worker invoked but BACKUP_S3 is not configured — deferring', {
      queue: QUEUE_NAMES.backup,
      jobId,
      configured: {
        BACKUP_S3_BUCKET: Boolean(bucket),
        BACKUP_S3_REGION: Boolean(region),
        BACKUP_S3_ENDPOINT: Boolean(endpoint),
        BACKUP_S3_ACCESS_KEY_ID: Boolean(accessKeyId),
        BACKUP_S3_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
      },
    });
    throw new Error('BACKUP_S3 not configured — backup runtime deferred');
  }

  return { bucket, region, endpoint, accessKeyId, secretAccessKey };
}

/** UTC `YYYY-MM-DD` for the LOCKED daily key `postgres/YYYY-MM-DD.dump`. */
function utcDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function processBackup(job: Job<BackupJobData>): Promise<void> {
  // Payload guard FIRST (LOCKED worker convention) — system identity only.
  assertSystemJob(job.data);

  // Deferral gate — throws the LOCKED message if creds are absent. Above any work.
  const s3 = resolveBackupS3(job.id);

  // pg_dump needs the DIRECT Postgres connection (session-level features); use
  // DATABASE_URL (the direct URL), NOT the PgBouncer transaction-pooling URL.
  // BACKUP_DATABASE_URL wins if an operator wants a dedicated read endpoint.
  const databaseUrl = process.env['BACKUP_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!databaseUrl) {
    log('error', 'backup worker has BACKUP_S3 but no DATABASE_URL', {
      queue: QUEUE_NAMES.backup,
      jobId: job.id,
    });
    throw new Error('backup worker: DATABASE_URL (or BACKUP_DATABASE_URL) is required for pg_dump');
  }

  const key = `postgres/${utcDateStamp()}.dump`;
  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    // S3-compatible / MinIO-style endpoints require path-style addressing; harmless
    // against AWS S3 with a regional endpoint.
    forcePathStyle: true,
  });

  // Whole-DB custom-format dump, max compression. Connection string passed via
  // --dbname so it is NEVER part of argv as a positional and is never logged.
  const dump = spawn(
    'pg_dump',
    ['--format=custom', '--compress=9', '--no-password', '--dbname', databaseUrl],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  // Capture a bounded slice of stderr for diagnostics (never the dump bytes).
  let stderrTail = '';
  dump.stderr.on('data', (chunk: Buffer) => {
    if (stderrTail.length < 4096) stderrTail += chunk.toString('utf8');
  });

  // Stream pg_dump stdout straight to S3 — NEVER buffer a whole-DB dump in memory.
  // lib-storage handles multipart for arbitrarily large dumps.
  const upload = new Upload({
    client,
    params: {
      Bucket: s3.bucket,
      Key: key,
      Body: dump.stdout as Readable,
      ContentType: 'application/octet-stream',
    },
  });

  let uploadedBytes = 0;
  upload.on('httpUploadProgress', (progress) => {
    if (typeof progress.loaded === 'number') uploadedBytes = progress.loaded;
  });

  // Resolve only when pg_dump exits 0; reject on spawn error (e.g. binary missing)
  // or non-zero exit (with the stderr tail for the operator).
  const dumpExit = new Promise<void>((resolve, reject) => {
    dump.on('error', (err) => reject(err));
    dump.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}: ${stderrTail.trim()}`));
    });
  });

  try {
    await Promise.all([dumpExit, upload.done()]);
    log('info', 'backup complete', {
      queue: QUEUE_NAMES.backup,
      jobId: job.id,
      bucket: s3.bucket,
      key,
      bytes: uploadedBytes,
    });
  } catch (err) {
    // Best-effort cleanup so a failed run leaves no half-written object or orphaned
    // child process, then rethrow → BullMQ attempts:3 + exponential backoff → DLQ.
    try {
      await upload.abort();
    } catch {
      /* abort is best-effort */
    }
    if (!dump.killed) dump.kill('SIGTERM');
    log('error', 'backup failed', {
      queue: QUEUE_NAMES.backup,
      jobId: job.id,
      bucket: s3.bucket,
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    client.destroy();
  }
}
