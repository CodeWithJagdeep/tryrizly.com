import { Injectable } from "@nestjs/common";
import type { TwilioConnectorSecret } from "./connector.types";

@Injectable()
export class TwilioService {
  async sendSms(secret: TwilioConnectorSecret, to: string, body: string): Promise<{ sid: string }> {
    const auth = Buffer.from(`${secret.accountSid}:${secret.authToken}`).toString("base64");
    const params = new URLSearchParams({ To: to, From: secret.fromNumber, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${secret.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${auth}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (res.status === 401) throw new Error("twilio_invalid_credentials");
    if (!res.ok) throw new Error(`twilio_api_${res.status}`);
    const data = (await res.json()) as { sid: string };
    return { sid: data.sid };
  }
}
