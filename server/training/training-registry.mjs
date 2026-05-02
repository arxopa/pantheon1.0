import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { curateTrainingRecords } from './data-curate.mjs';
import { exportTrainingDataset } from './dataset-export.mjs';
import { ingestTrainingPayload } from './data-ingest.mjs';
import { redactTrainingRecords } from './data-redact.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.dirname(__dirname);
const workspaceRoot = path.dirname(serverRoot);
const defaultRegistryPath = path.join(__dirname, 'data', 'training-jobs.json');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeJobId(value) {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-');

  if (!normalized) {
    throw new Error('Training job id is required.');
  }

  return normalized;
}

function normalizePersonalityId(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    throw new Error('personalityId is required.');
  }
  return normalized;
}

function normalizeCheckMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, entryValue])
  );
}

function formatStamp(value = new Date()) {
  return value.toISOString().replace(/[.:]/g, '-');
}

function pickJobStatusBucket(status) {
  if (status === 'active') {
    return 'active';
  }
  if (status === 'rejected') {
    return 'rejected';
  }
  if (status === 'approved' || status === 'evaluated' || status === 'trained') {
    return 'ready';
  }
  return 'pending';
}

function summarizeJobs(jobs = []) {
  return jobs.reduce(
    (summary, job) => {
      summary.total += 1;
      summary[pickJobStatusBucket(job.status)] += 1;
      return summary;
    },
    { total: 0, pending: 0, ready: 0, active: 0, rejected: 0 }
  );
}

function createDefaultRegistry(paths) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    paths,
    activeArtifacts: {},
    jobs: [],
    logs: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class TrainingRegistry {
  constructor(options = {}) {
    this.personalityManager = options.personalityManager ?? null;
    this.registryPath =
      options.registryPath ??
      process.env.TRAINING_REGISTRY_PATH ??
      defaultRegistryPath;
    this.dataRoot =
      options.dataRoot ??
      process.env.TRAINING_DATA_ROOT ??
      path.join(workspaceRoot, 'data');
    this.rawRoot = path.join(this.dataRoot, 'raw');
    this.curatedRoot = path.join(this.dataRoot, 'curated');
    this.datasetRoot = path.join(this.dataRoot, 'datasets');
    this.exportRoot = path.join(this.dataRoot, 'exports');
    this.baseModelRef =
      normalizeText(
        options.baseModelRef ?? process.env.TRAINING_BASE_MODEL_REF
      ) || 'pantheon-base-stub';
    this.registry = createDefaultRegistry(this.getPaths());
  }

  getPaths() {
    return {
      registryPath: this.registryPath,
      rawRoot: this.rawRoot,
      curatedRoot: this.curatedRoot,
      datasetRoot: this.datasetRoot,
      exportRoot: this.exportRoot,
    };
  }

  async init() {
    await mkdir(path.dirname(this.registryPath), { recursive: true });
    await mkdir(this.rawRoot, { recursive: true });
    await mkdir(this.curatedRoot, { recursive: true });
    await mkdir(this.datasetRoot, { recursive: true });
    await mkdir(this.exportRoot, { recursive: true });

    try {
      const raw = await readFile(this.registryPath, 'utf8');
      const payload = JSON.parse(raw);
      this.registry = {
        ...createDefaultRegistry(this.getPaths()),
        ...payload,
        paths: this.getPaths(),
        jobs: Array.isArray(payload.jobs) ? payload.jobs : [],
        logs: Array.isArray(payload.logs) ? payload.logs.slice(-200) : [],
        activeArtifacts:
          payload.activeArtifacts && typeof payload.activeArtifacts === 'object'
            ? payload.activeArtifacts
            : {},
      };
    } catch (error) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
      ) {
        throw error;
      }

      await this.flush();
    }
  }

  async flush() {
    this.registry.updatedAt = new Date().toISOString();
    await writeFile(
      this.registryPath,
      `${JSON.stringify(this.registry, null, 2)}\n`,
      'utf8'
    );
  }

  async log(event) {
    this.registry.logs = [
      ...this.registry.logs.slice(-199),
      {
        id: event.id ?? `training-log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...event,
      },
    ];
    await this.flush();
  }

  resolvePersonality(personalityId) {
    const normalizedId = normalizePersonalityId(personalityId);
    if (!this.personalityManager) {
      return { id: normalizedId, displayName: normalizedId };
    }
    return this.personalityManager.getPersonality(normalizedId);
  }

  findJob(jobId) {
    const normalizedId = normalizeJobId(jobId);
    const job = this.registry.jobs.find((entry) => entry.id === normalizedId);
    if (!job) {
      throw new Error(`Unknown training job: ${normalizedId}`);
    }
    return job;
  }

  async updateJob(jobId, updater) {
    const normalizedId = normalizeJobId(jobId);
    const index = this.registry.jobs.findIndex(
      (entry) => entry.id === normalizedId
    );
    if (index === -1) {
      throw new Error(`Unknown training job: ${normalizedId}`);
    }

    const next = {
      ...this.registry.jobs[index],
      ...(typeof updater === 'function'
        ? updater(clone(this.registry.jobs[index]))
        : updater),
      updatedAt: new Date().toISOString(),
    };
    this.registry.jobs[index] = next;
    await this.flush();
    return next;
  }

  getStatus(options = {}) {
    const personalityId = normalizeText(options.personalityId)
      ? normalizePersonalityId(options.personalityId)
      : null;
    const limit = Math.max(1, Number(options.limit ?? 20));
    const jobs = this.registry.jobs
      .filter(
        (entry) => !personalityId || entry.personalityId === personalityId
      )
      .slice()
      .sort((left, right) =>
        String(right.updatedAt ?? '').localeCompare(
          String(left.updatedAt ?? '')
        )
      )
      .slice(0, limit);

    return {
      paths: this.getPaths(),
      baseModelRef: this.baseModelRef,
      summary: summarizeJobs(this.registry.jobs),
      activeArtifacts: this.registry.activeArtifacts,
      jobs,
      logs: this.registry.logs.slice(-20),
    };
  }

  async prepareDataset(payload = {}) {
    const personality = this.resolvePersonality(
      payload.personalityId ?? 'default'
    );
    const datasetVersion =
      normalizeText(payload.datasetVersion) || `dataset-${formatStamp()}`;
    const rawRecords = await ingestTrainingPayload(payload, { personality });
    const redactedRecords = redactTrainingRecords(rawRecords);
    const curated = curateTrainingRecords(
      redactedRecords,
      payload.curation ?? {}
    );
    const rawFilePath = await exportTrainingDataset(redactedRecords, {
      baseDir: this.rawRoot,
      personalityId: personality.id,
      datasetVersion,
    });
    const curatedFilePath = await exportTrainingDataset(curated.kept, {
      baseDir: this.curatedRoot,
      personalityId: personality.id,
      datasetVersion,
    });
    const datasetFilePath = await exportTrainingDataset(curated.kept, {
      baseDir: this.datasetRoot,
      personalityId: personality.id,
      datasetVersion,
    });

    const job = {
      id: normalizeJobId(`training-${personality.id}-${formatStamp()}`),
      personalityId: personality.id,
      personalityDisplayName: personality.displayName ?? personality.id,
      datasetVersion,
      status: 'prepared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paths: {
        rawFilePath,
        curatedFilePath,
        datasetFilePath,
      },
      dataset: {
        totalRecords: redactedRecords.length,
        curatedRecords: curated.kept.length,
        rejectedRecords: curated.rejected.length,
        averageCurationScore: curated.summary.averageCurationScore,
      },
      model: {
        baseModelRef: normalizeText(payload.baseModelRef) || this.baseModelRef,
        adapterArtifactPath: null,
      },
      approval: {
        status: 'pending',
        approvedAt: null,
        approvedBy: null,
        rejectedAt: null,
        rejectedBy: null,
        reason: null,
      },
      evaluation: null,
      activation: {
        status: 'inactive',
        activatedAt: null,
        activatedBy: null,
      },
      worker: {
        mode: 'offline-registry-stub',
        state: 'idle',
        startedAt: null,
        completedAt: null,
      },
      operatorNote: normalizeText(payload.operatorNote) || null,
    };

    this.registry.jobs.push(job);
    await this.flush();
    await this.log({
      type: 'training.prepare',
      jobId: job.id,
      personalityId: personality.id,
      datasetVersion,
      curatedRecords: job.dataset.curatedRecords,
    });

    return {
      job,
      status: this.getStatus({ personalityId: personality.id }),
    };
  }

  async startJob(payload = {}) {
    const jobId = normalizeText(payload.jobId);
    const targetJobId = jobId || (await this.prepareDataset(payload)).job.id;
    let job = await this.updateJob(targetJobId, (current) => ({
      ...current,
      status: 'training',
      worker: {
        ...current.worker,
        state: 'running',
        startedAt: new Date().toISOString(),
      },
    }));

    const adapterDir = path.join(this.exportRoot, job.personalityId);
    await mkdir(adapterDir, { recursive: true });
    const adapterArtifactPath = path.join(adapterDir, `${job.id}-adapter.json`);
    const adapterManifest = {
      jobId: job.id,
      personalityId: job.personalityId,
      baseModelRef: job.model.baseModelRef,
      datasetVersion: job.datasetVersion,
      generatedAt: new Date().toISOString(),
      executionMode: 'offline-registry-stub',
      dataset: job.dataset,
    };
    await writeFile(
      adapterArtifactPath,
      `${JSON.stringify(adapterManifest, null, 2)}\n`,
      'utf8'
    );

    job = await this.updateJob(targetJobId, (current) => ({
      ...current,
      status: 'trained',
      model: {
        ...current.model,
        adapterArtifactPath,
      },
      worker: {
        ...current.worker,
        state: 'completed',
        completedAt: new Date().toISOString(),
      },
      evaluation: current.evaluation ?? {
        status: 'pending',
        recommended: current.dataset.curatedRecords > 0,
        summary: 'Offline adapter artifact registered and awaiting evaluation.',
      },
    }));

    await this.log({
      type: 'training.start',
      jobId: job.id,
      personalityId: job.personalityId,
      adapterArtifactPath,
    });

    return {
      job,
      status: this.getStatus({ personalityId: job.personalityId }),
    };
  }

  async evaluateJob(payload = {}) {
    const jobId = normalizeText(payload.jobId);
    if (!jobId) {
      throw new Error('jobId is required to evaluate a training job.');
    }

    const job = await this.updateJob(jobId, (current) => {
      const automaticChecks = {
        curatedRecords: current.dataset.curatedRecords,
        averageCurationScore: current.dataset.averageCurationScore,
        adapterRegistered: Boolean(current.model.adapterArtifactPath),
      };
      const manualChecks = normalizeCheckMap(payload.checks);
      const automaticRecommendation =
        current.dataset.curatedRecords > 0 &&
        Number(current.dataset.averageCurationScore ?? 0) >= 0.45 &&
        Boolean(current.model.adapterArtifactPath);
      const failedManualCheck = Object.values(manualChecks).some((value) => {
        if (typeof value === 'boolean') {
          return value === false;
        }

        return value && typeof value === 'object' && 'passed' in value
          ? value.passed === false
          : false;
      });
      const recommended =
        typeof payload.recommended === 'boolean'
          ? payload.recommended
          : automaticRecommendation && !failedManualCheck;
      const summary =
        normalizeText(payload.summary) ||
        (recommended
          ? 'Dataset curation and evaluation gates passed the minimum activation bar.'
          : 'Evaluation blocked activation because either the curated dataset is too weak or one of the manual gates failed.');

      return {
        ...current,
        status: 'evaluated',
        evaluation: {
          status: 'completed',
          recommended,
          completedAt: new Date().toISOString(),
          reviewedBy: normalizeText(payload.reviewedBy) || null,
          summary,
          checks: {
            ...automaticChecks,
            ...manualChecks,
          },
        },
      };
    });

    await this.log({
      type: 'training.evaluate',
      jobId: job.id,
      personalityId: job.personalityId,
      recommended: job.evaluation?.recommended ?? false,
    });

    return {
      job,
      status: this.getStatus({ personalityId: job.personalityId }),
    };
  }

  async approveJob(payload = {}) {
    const approver = normalizeText(payload.approvedBy ?? payload.authority);
    if (!approver) {
      throw new Error(
        'approvedBy or authority is required for training approval.'
      );
    }

    const jobId = normalizeText(payload.jobId);
    if (!jobId) {
      throw new Error('jobId is required to approve a training job.');
    }

    const job = await this.updateJob(jobId, (current) => ({
      ...current,
      status: 'approved',
      approval: {
        ...current.approval,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: approver,
        reason:
          normalizeText(payload.reason) ||
          'Approved for controlled activation.',
      },
    }));

    await this.log({
      type: 'training.approve',
      jobId: job.id,
      personalityId: job.personalityId,
      approvedBy: approver,
    });

    return {
      job,
      status: this.getStatus({ personalityId: job.personalityId }),
    };
  }

  async rejectJob(payload = {}) {
    const reviewer = normalizeText(payload.rejectedBy ?? payload.authority);
    if (!reviewer) {
      throw new Error(
        'rejectedBy or authority is required for training rejection.'
      );
    }

    const jobId = normalizeText(payload.jobId);
    if (!jobId) {
      throw new Error('jobId is required to reject a training job.');
    }

    const job = await this.updateJob(jobId, (current) => ({
      ...current,
      status: 'rejected',
      approval: {
        ...current.approval,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: reviewer,
        reason:
          normalizeText(payload.reason) || 'Rejected during manual review.',
      },
    }));

    await this.log({
      type: 'training.reject',
      jobId: job.id,
      personalityId: job.personalityId,
      rejectedBy: reviewer,
    });

    return {
      job,
      status: this.getStatus({ personalityId: job.personalityId }),
    };
  }

  async activateJob(payload = {}) {
    const activator = normalizeText(payload.activatedBy ?? payload.authority);
    if (!activator) {
      throw new Error('activatedBy or authority is required for activation.');
    }

    const jobId = normalizeText(payload.jobId);
    if (!jobId) {
      throw new Error('jobId is required to activate a training job.');
    }

    const current = this.findJob(jobId);
    if (current.approval?.status !== 'approved') {
      throw new Error('Training job must be approved before activation.');
    }

    if (!current.model?.adapterArtifactPath) {
      throw new Error('Training job has no adapter artifact to activate.');
    }

    this.registry.activeArtifacts[current.personalityId] = {
      jobId: current.id,
      adapterArtifactPath: current.model.adapterArtifactPath,
      activatedAt: new Date().toISOString(),
      activatedBy: activator,
      datasetVersion: current.datasetVersion,
    };

    const job = await this.updateJob(jobId, (entry) => ({
      ...entry,
      status: 'active',
      activation: {
        status: 'active',
        activatedAt: new Date().toISOString(),
        activatedBy: activator,
      },
    }));

    await this.log({
      type: 'training.activate',
      jobId: job.id,
      personalityId: job.personalityId,
      activatedBy: activator,
    });

    return {
      job,
      status: this.getStatus({ personalityId: job.personalityId }),
    };
  }
}
