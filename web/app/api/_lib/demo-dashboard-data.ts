export const DEMO_USER_ID = "demo@rizly.local";

export function isDemoUser(userId: string) {
  return userId === DEMO_USER_ID;
}

function atHour(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function demoEmails() {
  return [
    {
      id: "demo-email-1",
      summary:
        "Email from Elena Torres (Seed round data room): Elena from Meridian Ventures asked for the latest revenue snapshot, security notes, and a short founder update before Friday.",
      category: "investor_update",
      tab: "business" as const,
      person: "Elena Torres",
      dueDate: atHour(1, 17),
      createdAt: atHour(0, 9, 12),
      messageId: "demo-msg-001",
      sample: true,
    },
    {
      id: "demo-email-2",
      summary:
        "Email from Jordan Lee (Move onboarding call): Jordan from Acme Ops wants to move tomorrow's onboarding call to 3:30 PM and asked whether the same invite can be updated.",
      category: "meeting_request",
      tab: "business" as const,
      person: "Jordan Lee",
      dueDate: atHour(1, 15, 30),
      createdAt: atHour(0, 8, 48),
      messageId: "demo-msg-002",
      sample: true,
    },
    {
      id: "demo-email-3",
      summary:
        "Email from Priya Shah (Invoice approval needed): Priya sent a 4,800 dollar vendor invoice and needs approval before finance closes this week.",
      category: "payment_due",
      tab: "business" as const,
      person: "Priya Shah",
      dueDate: atHour(2, 12),
      createdAt: atHour(0, 8, 5),
      messageId: "demo-msg-003",
      sample: true,
    },
    {
      id: "demo-email-4",
      summary:
        "Email from Marcus Reed (Customer expansion follow-up): Marcus asked for the revised rollout timeline and wants a concise reply before his internal review.",
      category: "follow_up_needed",
      tab: "business" as const,
      person: "Marcus Reed",
      dueDate: atHour(1, 11),
      createdAt: atHour(-1, 18, 35),
      messageId: "demo-msg-004",
      sample: true,
    },
    {
      id: "demo-email-5",
      summary:
        "Email from Linear (Workspace security alert): Linear flagged a new admin login and recommends reviewing workspace access settings.",
      category: "account_alert",
      tab: "updates" as const,
      person: "Linear",
      dueDate: "",
      createdAt: atHour(-1, 15, 10),
      messageId: "demo-msg-005",
      sample: true,
    },
  ];
}

export function demoEmailTasks() {
  return [
    {
      id: "demo-task-email-1",
      summary: "Follow up with Marcus Reed about rollout timeline",
      source: "email",
      status: "active",
      createdAt: atHour(0, 10, 20),
    },
    {
      id: "demo-task-email-2",
      summary: "Review Priya Shah invoice before finance close",
      source: "gmail",
      status: "active",
      createdAt: atHour(0, 9, 40),
    },
  ];
}

export function demoPeople() {
  return [
    {
      id: "demo-person-elena",
      type: "person" as const,
      canonicalName: "Elena Torres",
      createdAt: atHour(-2, 14),
      emails: ["elena@meridian.ventures"],
      phones: [],
      urls: ["meridian.ventures"],
      sample: true,
    },
    {
      id: "demo-person-jordan",
      type: "person" as const,
      canonicalName: "Jordan Lee",
      createdAt: atHour(-1, 16),
      emails: ["jordan@acmeops.co"],
      phones: ["+1 415 555 0198"],
      urls: ["acmeops.co"],
      sample: true,
    },
    {
      id: "demo-person-priya",
      type: "person" as const,
      canonicalName: "Priya Shah",
      createdAt: atHour(-3, 11),
      emails: ["priya@northlane.finance"],
      phones: [],
      urls: ["northlane.finance"],
      sample: true,
    },
    {
      id: "demo-person-marcus",
      type: "person" as const,
      canonicalName: "Marcus Reed",
      createdAt: atHour(-4, 10),
      emails: ["marcus@brightdesk.ai"],
      phones: ["+1 646 555 0134"],
      urls: ["brightdesk.ai"],
      sample: true,
    },
  ];
}

export function demoMeetings() {
  return [
    {
      id: "demo-meeting-standup",
      title: "Founder ops standup",
      start: atHour(0, 10, 30),
      end: atHour(0, 11),
      allDay: false,
      location: "Google Meet",
      meetingUrl: "https://meet.google.com/demo-ops",
      attendees: ["Elena Torres", "Jordan Lee"],
      source: "google" as const,
      status: "confirmed",
    },
    {
      id: "demo-meeting-customer",
      title: "BrightDesk expansion review",
      start: atHour(0, 14),
      end: atHour(0, 14, 45),
      allDay: false,
      location: "Zoom",
      meetingUrl: "https://cal.com/demo/brightdesk",
      attendees: ["Marcus Reed"],
      source: "calcom" as const,
      status: "accepted",
    },
    {
      id: "demo-meeting-investor",
      title: "Meridian Ventures partner sync",
      start: atHour(1, 11),
      end: atHour(1, 11, 45),
      allDay: false,
      location: "Google Meet",
      meetingUrl: "https://meet.google.com/demo-meridian",
      attendees: ["Elena Torres"],
      source: "google" as const,
      status: "confirmed",
    },
    {
      id: "demo-meeting-finance",
      title: "Invoice approval review",
      start: atHour(2, 15),
      end: atHour(2, 15, 30),
      allDay: false,
      location: "Google Meet",
      attendees: ["Priya Shah"],
      source: "google" as const,
      status: "confirmed",
    },
  ];
}

export function demoReminders() {
  return [
    {
      id: "demo-reminder-1",
      message: "Send Elena the updated founder brief",
      recurring: false,
      state: "upcoming" as const,
      runAt: atHour(0, 16, 30),
    },
    {
      id: "demo-reminder-2",
      message: "Check whether Marcus replied to rollout timeline",
      recurring: false,
      state: "upcoming" as const,
      runAt: atHour(1, 10),
    },
  ];
}
