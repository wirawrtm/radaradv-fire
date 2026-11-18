import { handleGetUserProfile } from "./employeeUtils";

const APPS_SCRIPT_URL =
  process.env.GOOGLE_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbxUUPKhsEo-LencnYjex3gOhVl7w2tS154VCICVbqGfFSBLAwzv0P7XOu9oMTE1jTUg1g/exec";

export async function proxyToAppsScript(req: any, res: any): Promise<boolean> {
  const urlObj = new URL(APPS_SCRIPT_URL);

  if (req.query) {
    for (const key of Object.keys(req.query)) {
      urlObj.searchParams.append(key, String(req.query[key]));
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const init: any = {
    method: req.method,
    headers,
    signal: AbortSignal.timeout(6000),
  };

  if (req.method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    console.log(`[API Proxy] Forwarding to Apps Script: ${urlObj.toString()} with method ${req.method}`);
    const response = await fetch(urlObj.toString(), init);

    if (!response.ok) {
      console.log(`[API Proxy] Apps Script response status: ${response.status} (bypassed to local DB)`);
      return false;
    }

    const text = await response.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      console.log("[API Proxy] Response is not valid JSON:", text.substring(0, 500));
      return false;
    }

    if (
      json.status !== "success" &&
      (req.query.action === "getUserProfile" || req.body?.action === "getUserProfile")
    ) {
      const u = String(req.query.user || req.body?.user || "");
      if (u.toLowerCase().startsWith("l")) {
        const altU = "i" + u.slice(1);
        const altUrl = new URL(urlObj.toString());
        altUrl.searchParams.set("user", altU);
        try {
          const altResp = await fetch(altUrl.toString(), init);
          if (altResp.ok) {
            const altJson = JSON.parse(await altResp.text());
            if (altJson.status === "success") {
              res.json(altJson);
              return true;
            }
          }
        } catch {
          // ignore
        }
      }

      const localProfile = await handleGetUserProfile(u);
      if (localProfile.status === "success") {
        res.json(localProfile);
        return true;
      }
    }

    res.json(json);
    return true;
  } catch (error) {
    console.log("[API Proxy] Request forwarding to Apps Script deferred:", error instanceof Error ? error.message : error);
    return false;
  }
}
