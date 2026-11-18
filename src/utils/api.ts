import { ORIGINAL_SCRIPT_URL, SCRIPT_URL } from "./constants";

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const originalFetch = window.fetch;
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";

  // Route all requests strictly to local Express Backend (/api) in dummy mode
  let primaryUrl = url;
  if (!url.startsWith("http")) {
    if (url.startsWith("?")) {
      primaryUrl = SCRIPT_URL + url;
    } else if (!url.startsWith(SCRIPT_URL)) {
      primaryUrl = SCRIPT_URL + (url.startsWith("/") ? "" : "/") + url;
    } else {
      primaryUrl = url;
    }
  } else if (url.includes(ORIGINAL_SCRIPT_URL)) {
    primaryUrl = url.replace(ORIGINAL_SCRIPT_URL, SCRIPT_URL);
  }

  return originalFetch(primaryUrl, init);
};
