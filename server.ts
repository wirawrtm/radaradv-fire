import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import {
  initLocalDb,
} from "./server/sheetsDb";
import { handleGetEmployees, handleGetUserProfile } from "./server/employeeUtils";
import {
  handleGetAccessRules,
  handleGetChannels,
  handleGetDrSalesData,
  handleGetInitialData,
  handleGetLotInfo,
  handleGetWorkingData,
} from "./server/handlers/readHandlers";
import {
  handleAddPartner,
  handleBackfillEmptyCategories,
  handleBatchActivity,
  handleConsolidateDatabase,
  handleDeleteEmployee,
  handleDeletePartner,
  handleSaveAccessRules,
  handleUpdateEmployee,
  handleUpdatePartner,
  handleUpdateWorkingRowMonth,
} from "./server/handlers/writeHandlers";

dotenv.config();

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.text({ type: "text/plain", limit: "50mb" }));
app.use((req, _res, next) => {
  if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // keep raw body if invalid JSON
    }
  }
  next();
});

app.all("/api", async (req, res) => {
  const action = (req.query.action || req.body?.action) as string;
  const user = (req.query.user || req.body?.user) as string;
  const lot = (req.query.lot || req.body?.lot) as string;

  try {
    let result: any = null;

    if (req.method === "GET") {
      if (action === "getWorkingData") result = await handleGetWorkingData(user);
      else if (action === "getDrSalesData") result = await handleGetDrSalesData(user);
      else if (action === "getChannels") result = await handleGetChannels(user);
      else if (action === "getLotInfo") result = await handleGetLotInfo(lot, req.query.kiosk as string);
      else if (action === "getUserProfile") result = await handleGetUserProfile(user);
      else if (action === "getEmployees") result = await handleGetEmployees();
      else if (action === "getInitialData") result = await handleGetInitialData(user);
      else if (action === "getAccessRules") result = await handleGetAccessRules();
      else return res.status(400).json({ status: "error", message: "Unknown action" });
    } else if (req.method === "POST") {
      if (action === "batchActivity") result = await handleBatchActivity(req.body);
      else if (action === "consolidateDatabase") result = await handleConsolidateDatabase(req.body);
      else if (action === "addPartner") result = await handleAddPartner(req.body);
      else if (action === "updatePartner") result = await handleUpdatePartner(req.body);
      else if (action === "deletePartner") result = await handleDeletePartner(req.body);
      else if (action === "updateEmployee") result = await handleUpdateEmployee(req.body);
      else if (action === "deleteEmployee") result = await handleDeleteEmployee(req.body);
      else if (action === "saveAccessRules") result = await handleSaveAccessRules(req.body);
      else if (action === "backfillEmptyCategories") result = await handleBackfillEmptyCategories(req.body);
      else if (action === "updateWorkingRowMonth") result = await handleUpdateWorkingRowMonth(req.body);
      else return res.status(400).json({ status: "error", message: "Unknown action" });
    } else {
      return res.status(405).json({ status: "error", message: "Method not allowed" });
    }

    return res.json(result);
  } catch (error: any) {
    const errorStr = error.toString();
    if (errorStr.includes("fallback to AppScript") || errorStr.includes("API not configured")) {
      console.log(`[API Proxy Fallback] Action: ${action}, Status: ${errorStr}`);
      return res.status(503).json({ status: "error", message: "API not configured, fallback to Apps Script" });
    }
    console.log(`[API Result] Action: ${action}, Status: ${errorStr}`);
    return res.json({ status: "error", message: error.message || errorStr });
  }
});

async function startServer() {
  initLocalDb();
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
    });
    app.get("/@vite/client", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(`
const sheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (typeof document === "undefined") return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (typeof document === "undefined") return;
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
export class ErrorOverlay {}
`);
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
