export const ORIGINAL_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxUUPKhsEo-LencnYjex3gOhVl7w2tS154VCICVbqGfFSBLAwzv0P7XOu9oMTE1jTUg1g/exec";

export const SCRIPT_URL = "/api";

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const originalFetch = window.fetch;
  const url =
    typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : "";

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
