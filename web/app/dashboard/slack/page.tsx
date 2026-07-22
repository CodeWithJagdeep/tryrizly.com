import { SlackClient } from "./slack-client";

export const metadata = {
  title: "Slack",
};

export default function SlackPage() {
  return <SlackClient />;
}
