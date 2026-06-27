import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AiCoreModule } from "../ai-core.module";
import { AiCoreService } from "../ai-core.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AiCoreModule, {
    logger: false,
  });
  const core = app.get(AiCoreService);

  const health = core.healthCheck();
  const schedule = await core.chat({ message: "what's my schedule today?" });
  const triage = await core.chat({ message: "check my inbox" });
  const brief = await core.proactiveBrief({});
  const sync = await core.proactiveSync({});

  console.log(
    "BOOT_OK",
    JSON.stringify({ health, schedule, triage, brief, sync }, null, 2),
  );
  await app.close();
}

main().catch((error) => {
  console.error("BOOT_FAIL", error);
  process.exit(1);
});
