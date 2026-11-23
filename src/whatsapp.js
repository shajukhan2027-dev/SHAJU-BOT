
const makeWASocket =
  require("@whiskeysockets/baileys").default;

const {
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const path = require("path");
const fs = require("fs");
const { handleMessage } = require("./features");

const sessions = new Map();
const pending = new Map();

const sessionRoot = path.resolve(
  process.env.AUTH_DIR || path.join(__dirname, "..", "sessions")
);

function getAuthDirectory(ownerId) {
  if (!/^[a-f0-9-]{36}$/i.test(ownerId)) {
    throw new Error("Invalid session owner.");
  }

  return path.join(sessionRoot, ownerId);
}

async function connectSession(ownerId, phoneNumber) {
  const authDir = getAuthDirectory(ownerId);

  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } =
    await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["SHAJU BOT", "Chrome", "1.0.0"]
  });

  const session = {
    sock,
    status: "connecting",
    phoneNumber
  };

  sessions.set(ownerId, session);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      await handleMessage(ownerId, message, sock);
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const current = sessions.get(ownerId);

    if (!current || current.sock !== sock) return;

    if (update.connection === "open") {
      current.status = "connected";
      console.log("SHAJU BOT connected:", ownerId);
    }

    if (update.connection === "close") {
      current.status = "disconnected";

      const code =
        update.lastDisconnect?.error?.output?.statusCode;

      if (code === DisconnectReason.loggedOut) {
        sessions.delete(ownerId);

        try {
          await fs.promises.rm(authDir, {
            recursive: true,
            force: true
          });
        } catch (error) {
          console.error("Session cleanup error:", error.message);
        }

        return;
      }

      console.log("Reconnecting SHAJU BOT:", ownerId);

      setTimeout(async () => {
        if (sessions.get(ownerId) !== current) return;

        try {
          await connectSession(ownerId, phoneNumber);
        } catch (error) {
          console.error("Reconnect error:", error.message);
        }
      }, 5000);
    }
  });

  return sock;
}

async function requestPairingCode(ownerId, phoneNumber) {
  if (pending.has(ownerId)) {
    throw new Error("Pairing request already in progress.");
  }

  if (sessions.has(ownerId)) {
    throw new Error("A session already exists. Check connection status.");
  }

  pending.set(ownerId, true);

  try {
    const sock = await connectSession(ownerId, phoneNumber);
    const pairingCode = await sock.requestPairingCode(phoneNumber);

    return pairingCode;
  } catch (error) {
    const session = sessions.get(ownerId);

    if (session) {
      sessions.delete(ownerId);

      try {
        session.sock.end(undefined);
      } catch {}
    }

    throw error;
  } finally {
    pending.delete(ownerId);
  }
}

async function initializeSessions() {
  fs.mkdirSync(sessionRoot, { recursive: true });

  const folders = await fs.promises.readdir(sessionRoot, {
    withFileTypes: true
  });

  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    if (!/^[a-f0-9-]{36}$/i.test(folder.name)) continue;

    const ownerId = folder.name;
    const authDir = getAuthDirectory(ownerId);

    try {
      const { state } = await useMultiFileAuthState(authDir);

      if (!state.creds.registered) {
        console.log("Waiting for pairing:", ownerId);
        continue;
      }

      await connectSession(ownerId, null);
      console.log("Restoring session:", ownerId);

    } catch (error) {
      console.error("Session restore error:", error.message);
    }
  }
}

async function getStatus(ownerId) {
  const session = sessions.get(ownerId);

  if (!session) {
    return {
      connected: false,
      status: "not_connected"
    };
  }

  return {
    connected: session.status === "connected",
    status: session.status
  };
}

module.exports = {
  requestPairingCode,
  getStatus,
  initializeSessions
};
