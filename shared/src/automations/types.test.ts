import { describe, expect, it } from "vitest";
import {
  auditEventForAutomationStepResult,
  snapshotAutomationRunPlan,
  type AutomationStep,
} from "./types";

const steps: AutomationStep[] = [
  {
    id: "trigger",
    kind: "trigger",
    app: "gmail",
    title: "New Email Matching Search",
    label: "Fetch invoice",
    subtitle: "Gmail",
    config: {
      query: "subject:invoice",
      account: "private-account-id",
    },
  },
  {
    id: "pay",
    kind: "action",
    app: "stripe",
    title: "Create Customer",
    config: {
      account: "secret-connector-id",
      email: "{{from}}",
    },
  },
];

describe("automation run audit contract", () => {
  it("captures the original plan without copying configuration or secrets", () => {
    expect(snapshotAutomationRunPlan(steps)).toEqual([
      {
        id: "trigger",
        kind: "trigger",
        app: "gmail",
        title: "New Email Matching Search",
        label: "Fetch invoice",
      },
      {
        id: "pay",
        kind: "action",
        app: "stripe",
        title: "Create Customer",
      },
    ]);
  });

  it("retains successful-step evidence in the ordered audit event", () => {
    const evidence = {
      kind: "provider_ack" as const,
      provider: "stripe",
      acknowledged: true as const,
      resourceId: "cus_123",
    };

    expect(
      auditEventForAutomationStepResult({
        runId: "run_1",
        result: {
          stepId: "pay",
          app: "stripe",
          status: "success",
          evidence,
        },
        at: "2026-07-24T00:00:01.000Z",
        revision: 2,
        sequence: 4,
      }),
    ).toEqual({
      id: "run_1:4",
      at: "2026-07-24T00:00:01.000Z",
      revision: 2,
      type: "step_succeeded",
      stepId: "pay",
      evidence,
    });
  });

  it("fails closed when a worker claims success without evidence", () => {
    expect(
      auditEventForAutomationStepResult({
        runId: "run_1",
        result: {
          stepId: "pay",
          app: "stripe",
          status: "success",
        },
        at: "2026-07-24T00:00:01.000Z",
        revision: 1,
        sequence: 2,
      }),
    ).toMatchObject({
      type: "step_failed",
      stepId: "pay",
      code: "missing_evidence",
    });
  });
});
