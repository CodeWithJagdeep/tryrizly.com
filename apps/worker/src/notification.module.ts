import { Module } from "@nestjs/common";
import { AutomationRunWorkerService } from "./automation-run.worker.service";
import { EmailEventWorkerService } from "./email-event.worker.service";
import { NotificationWorkerService } from "./notification.worker.service";
import { OutboundEmailWorkerService } from "./outbound-email.worker.service";
import { SchedulerService } from "./scheduler.service";
import { SpineWorkerService } from "./spine.worker.service";
import { WatchReplyWorkerService } from "./watch-reply.worker.service";

@Module({
  providers: [
    AutomationRunWorkerService,
    EmailEventWorkerService,
    NotificationWorkerService,
    OutboundEmailWorkerService,
    SchedulerService,
    SpineWorkerService,
    WatchReplyWorkerService,
  ],
})
export class NotificationWorkerModule {}
