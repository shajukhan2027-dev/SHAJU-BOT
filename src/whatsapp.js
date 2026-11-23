
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

const sessionRoot = path.join(__dirname, "..", "sessions");

async function requestPairingCode(ownerId, phoneNumber) {
  if (pending.has(ownerId)) {
    throw new Error("Pairing request already in progress.");
  }

  pending.set(ownerId, true);

  try {
    const authDir = path.join(sessionRoot, ownerId);

    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["SHAJU BOT", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    const session = {
      sock,
      status: "connecting",
      phoneNumber
    };

    sessions.set(ownerId, session);

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const message of messages) {
        await handleMessage(ownerId, message, sock);
      }
    });

    sock.ev.on("connection.update", (update) => {
      const current = sessions.get(ownerId);
      if (!current) return;

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
        }
      }
    });

    const pairingCode =
      await sock.requestPairingCode(phoneNumber);

    return pairingCode;

  } catch (error) {
    sessions.delete(ownerId);
    throw error;

  } finally {
    pending.delete(ownerId);
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
  getStatus
};
