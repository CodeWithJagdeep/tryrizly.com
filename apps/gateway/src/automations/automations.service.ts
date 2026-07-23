import { Inject, Injectable } from "@nestjs/common";
import { isFlowRunnable } from "@heyriz/shared/automations/types";
import type { AutomationFlow, AutomationStep } from "@heyriz/shared/automations/types";
import { AutomationRepository } from "./automation.repository";

export type SaveFlowInput = {
  id?: string;
  name: string;
  steps: AutomationStep[];
};

@Injectable()
export class AutomationsService {
  constructor(
    @Inject(AutomationRepository)
    private readonly repo: AutomationRepository,
  ) {}

  list(userId: string) {
    return this.repo.listFlows(userId);
  }

  get(userId: string, id: string) {
    return this.repo.getFlow(userId, id);
  }

  save(userId: string, input: SaveFlowInput) {
    const steps = (input.steps ?? []).map((step) => ({ ...step, config: step.config ?? {} }));
    return this.repo.upsertFlow(userId, { id: input.id, name: input.name, steps });
  }

  async remove(userId: string, id: string) {
    return this.repo.deleteFlow(userId, id);
  }

  /**
   * Activation requires a genuinely runnable flow — a live trigger plus at
   * least one live action — otherwise the poller would silently do nothing
   * and the user would believe an automation is running when it isn't.
   */
  async activate(userId: string, id: string): Promise<{ ok: true; flow: AutomationFlow } | { ok: false; error: string }> {
    const flow = await this.repo.getFlow(userId, id);
    if (!flow) return { ok: false, error: "not_found" };
    if (!isFlowRunnable(flow.steps)) {
      return { ok: false, error: "flow_not_runnable" };
    }
    const updated = await this.repo.setStatus(userId, id, "active");
    return updated ? { ok: true, flow: updated } : { ok: false, error: "not_found" };
  }

  async pause(userId: string, id: string) {
    const updated = await this.repo.setStatus(userId, id, "paused");
    return updated ? { ok: true as const, flow: updated } : { ok: false as const, error: "not_found" };
  }

  runs(userId: string, flowId: string, limit?: number) {
    return this.repo.listRuns(userId, flowId, limit);
  }
}
