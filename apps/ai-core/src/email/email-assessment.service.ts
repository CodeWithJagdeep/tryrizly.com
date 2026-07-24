import { Inject, Injectable } from "@nestjs/common";
import { logger } from "@heyriz/shared/logger";
import { LlmRouterService } from "../llm/llm-router.service";
import type { PriorityClassification } from "../llm/llm.types";
import {
  EmailAssessmentRepository,
  type EmailAssessmentEvidenceLevel,
  type EmailAssessmentOrigin,
  type StoredEmailAssessment,
} from "./email-assessment.repository";

export const EMAIL_ASSESSMENT_POLICY_VERSION = "importance-v2";
const ASSESSMENT_RETENTION_MS = 30 * 86_400_000;
const DEFAULT_BATCH_CONCURRENCY = 4;

export type AssessEmailInput = {
  userId: string;
  messageId?: string;
  from?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  origin: EmailAssessmentOrigin;
};

export type CanonicalEmailAssessment = PriorityClassification & {
  cacheStatus: "hit" | "miss";
  evidenceLevel: EmailAssessmentEvidenceLevel;
  assessedAt: string;
  policyVersion: string;
};

/**
 * The one canonical importance entry point for both attended and unattended
 * email flows. It joins live Gmail IDs against the durable assessment cache,
 * computes only misses/stale metadata, and never changes Gmail label/read state.
 */
@Injectable()
export class EmailAssessmentService {
  constructor(
    @Inject(EmailAssessmentRepository)
    private readonly repository: EmailAssessmentRepository,
    @Inject(LlmRouterService)
    private readonly llm: LlmRouterService,
  ) {}

  async assess(input: AssessEmailInput): Promise<CanonicalEmailAssessment> {
    const cached = input.messageId
      ? await this.repository
          .getMany(
            input.userId,
            [input.messageId],
            EMAIL_ASSESSMENT_POLICY_VERSION,
          )
          .then((items) => items.get(input.messageId!))
          .catch((error: unknown) => {
            this.logCacheFailure("read", error);
            return undefined;
          })
      : undefined;

    return this.assessWithCached(input, cached);
  }

  async assessBatch(
    inputs: AssessEmailInput[],
    concurrency = DEFAULT_BATCH_CONCURRENCY,
  ): Promise<CanonicalEmailAssessment[]> {
    if (inputs.length === 0) return [];
    const first = inputs[0]!;
    if (inputs.some((input) => input.userId !== first.userId)) {
      throw new Error("email_assessment_batch_mixed_users");
    }

    const messageIds = inputs
      .map((input) => input.messageId)
      .filter((messageId): messageId is string => Boolean(messageId));
    const cached = await this.repository
      .getMany(first.userId, messageIds, EMAIL_ASSESSMENT_POLICY_VERSION)
      .catch((error: unknown) => {
        this.logCacheFailure("batch_read", error);
        return new Map<string, StoredEmailAssessment>();
      });

    return mapWithConcurrency(inputs, concurrency, (input) =>
      this.assessWithCached(
        input,
        input.messageId ? cached.get(input.messageId) : undefined,
      ),
    );
  }

  private async assessWithCached(
    input: AssessEmailInput,
    cached?: StoredEmailAssessment,
  ): Promise<CanonicalEmailAssessment> {
    const requestedEvidence = evidenceLevel(input);
    if (cached && canReuse(cached, requestedEvidence)) {
      return cachedResult(cached);
    }

    if (input.messageId) {
      return this.repository.withMessageLock(
        input.userId,
        input.messageId,
        async () => {
          const refreshed = await this.repository
            .getMany(
              input.userId,
              [input.messageId!],
              EMAIL_ASSESSMENT_POLICY_VERSION,
            )
            .then((items) => items.get(input.messageId!))
            .catch((error: unknown) => {
              this.logCacheFailure("locked_read", error);
              return undefined;
            });
          if (refreshed && canReuse(refreshed, requestedEvidence)) {
            return cachedResult(refreshed);
          }
          return this.computeAndStore(input, requestedEvidence);
        },
      );
    }
    return this.computeAndStore(input, requestedEvidence);
  }

  private async computeAndStore(
    input: AssessEmailInput,
    requestedEvidence: EmailAssessmentEvidenceLevel,
  ): Promise<CanonicalEmailAssessment> {
    const classification = await this.llm.classifyPriority({
      subject: input.subject,
      from: input.from,
      snippet: input.snippet,
      body: input.body,
      userId: input.userId,
    });
    const assessedAt = new Date().toISOString();
    const result: CanonicalEmailAssessment = {
      ...classification,
      cacheStatus: "miss",
      evidenceLevel: requestedEvidence,
      assessedAt,
      policyVersion: EMAIL_ASSESSMENT_POLICY_VERSION,
    };

    if (input.messageId) {
      await this.repository
        .put({
          userId: input.userId,
          messageId: input.messageId,
          policyVersion: EMAIL_ASSESSMENT_POLICY_VERSION,
          classification,
          evidenceLevel: requestedEvidence,
          origin: input.origin,
          assessedAt,
          expiresAt: new Date(
            Date.now() + ASSESSMENT_RETENTION_MS,
          ).toISOString(),
        })
        .catch((error: unknown) => this.logCacheFailure("write", error));
    }

    return result;
  }

  private logCacheFailure(operation: string, error: unknown): void {
    logger.warn("email assessment cache failed; continuing uncached", {
      operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function cachedResult(cached: StoredEmailAssessment): CanonicalEmailAssessment {
  return {
    ...cached.classification,
    cacheStatus: "hit",
    evidenceLevel: cached.evidenceLevel,
    assessedAt: cached.assessedAt,
    policyVersion: cached.policyVersion,
  };
}

function evidenceLevel(input: AssessEmailInput): EmailAssessmentEvidenceLevel {
  return input.body === undefined ? "metadata" : "body";
}

function canReuse(
  cached: StoredEmailAssessment,
  requested: EmailAssessmentEvidenceLevel,
): boolean {
  return requested === "metadata" || cached.evidenceLevel === "body";
}

async function mapWithConcurrency<TInput, TOutput>(
  input: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const output = new Array<TOutput>(input.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < input.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(input[index]!);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), input.length) },
      () => worker(),
    ),
  );
  return output;
}
