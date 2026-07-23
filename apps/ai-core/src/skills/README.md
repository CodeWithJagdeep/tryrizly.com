# Agent capability architecture

The operator agent is assembled from three trust layers:

1. `kernel.prompt.ts` is permanent policy. Approval, evidence, privacy,
   prompt-injection, and financial guardrails must stay here or in server code.
2. `AgentSkillRegistryService` contains versioned capability instructions,
   tool grants, and context scopes. Skills are registered in code and selected
   deterministically; they are never retrieved from user-controlled content.
3. `ContextService` loads only the live data selected by the trusted router.
   Connector content remains untrusted evidence and never becomes policy.

`SkillRouterService` applies over-inclusive rules first and uses the cheap model
only for ambiguous contextual follow-ups. The model can request another
registered capability with `action: "load_skill"`. The runtime stops that model
turn, validates the skill id, rebuilds the system prompt, and resumes on the
next loop step. A model cannot supply arbitrary prompt text or grant itself an
unregistered tool.

Tool execution is also checked against the active skill allowlist. Two repeated
capability misses enable a bounded `general` recovery skill; the normal route
never pays for the 40-tool prompt.

## Adding or changing a capability

- Put invariant safety policy in the kernel or server-side enforcement—not in a
  domain skill.
- Add domain behavior, tool names, and context scopes to one registered skill.
- Add deterministic routing language and a combined-intent regression test.
- Keep external writes behind the existing server approval gate.
- Add evidence-based tool tests; prompt instructions are not execution proof.
- The startup catalog check must pass. It fails when a skill names a missing
  tool or a runtime tool has no non-fallback domain owner.

Routing quality and cost are observable through `activeSkills`, `promptChars`,
tool-call count, and dynamic-skill-load count in the agent completion log.
