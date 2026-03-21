"use strict";

const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3579;
const isDev = !app.isPackaged;

let nextServer;
let mainWindow;

function getDbPath() {
  const dir = path.join(app.getPath("userData"), "vpfund");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "vpfund.db");
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(`http://127.0.0.1:${PORT}`, () => resolve())
        .on("error", () => {
          if (n <= 0) return reject(new Error("Next.js server failed to start"));
          setTimeout(() => attempt(n - 1), 500);
        });
    };
    attempt(retries);
  });
}

function startServer() {
  if (isDev) return Promise.resolve(); // dev: assume `next dev` is already running on 3000

  const serverJs = path.join(process.resourcesPath, "server", "server.js");

  nextServer = spawn(process.execPath, [serverJs], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DB_PATH: getDbPath(),
    },
    stdio: "pipe",
  });

  nextServer.stdout.on("data", (d) => console.log("[next]", d.toString().trim()));
  nextServer.stderr.on("data", (d) => console.error("[next]", d.toString().trim()));
  nextServer.on("exit", (code) => console.log("[next] exited with code", code));

  return waitForServer();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: "vpfund",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = isDev ? `http://localhost:3000` : `http://127.0.0.1:${PORT}`;
  mainWindow.loadURL(url);

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  startServer()
    .then(createWindow)
    .catch((err) => {
      console.error(err);
      app.quit();
    });
});

app.on("window-all-closed", () => {
  if (nextServer) nextServer.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  if (nextServer) nextServer.kill();
});
