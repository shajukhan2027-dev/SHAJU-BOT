
require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { requestPairingCode, getStatus } = require("./whatsapp");
const { getSettings } = require("./features");

const app = express();

if (!process.env.COOKIE_SECRET ||
    process.env.COOKIE_SECRET.length < 32) {
  throw new Error("COOKIE_SECRET must be at least 32 characters.");
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use((req, res, next) => {
  let owner = req.signedCookies.shaju_owner;

  if (typeof owner !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(owner)) {
    owner = crypto.randomUUID();

    res.cookie("shaju_owner", owner, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      signed: true,
      maxAge: 180 * 24 * 60 * 60 * 1000
    });
  }

  req.ownerId = owner;
  next();
});

const pairLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

app.post("/api/pair", pairLimiter, async (req, res) => {
  try {
    const number = String(req.body?.number || "")
      .replace(/\D/g, "");

    if (!/^8801[3-9]\d{8}$/.test(number)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid Bangladesh number."
      });
    }

    const pairingCode = await requestPairingCode(
      req.ownerId,
      number
    );

    return res.json({
      success: true,
      pairingCode
    });

  } catch (error) {
    console.error("Pairing error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Pairing failed. Please try again."
    });
  }
});

app.get("/api/status", async (req, res) => {
  try {
    const status = await getStatus(req.ownerId);
    res.json(status);
  } catch (error) {
    res.status(500).json({
      connected: false,
      status: "error"
    });
  }
});

app.get("/api/settings", (req, res) => {
  res.json({
    success: true,
    settings: getSettings(req.ownerId)
  });
});

app.post("/api/settings", (req, res) => {
  const settings = getSettings(req.ownerId);
  const body = req.body || {};

  const switches = [
    "welcome",
    "antiLink",
    "antiSpam",
    "badWordFilter",
    "autoReply",
    "groupProtection"
  ];

  for (const key of switches) {
    if (typeof body[key] === "boolean") {
      settings[key] = body[key];
    }
  }

  if (Array.isArray(body.badWords)) {
    settings.badWords = body.badWords
      .filter(word => typeof word === "string")
      .map(word => word.trim().slice(0, 50))
      .filter(Boolean)
      .slice(0, 100);
  }

  if (body.autoReplies &&
      typeof body.autoReplies === "object" &&
      !Array.isArray(body.autoReplies)) {
    const replies = {};

    for (const [key, value] of Object.entries(body.autoReplies)) {
      if (typeof value === "string") {
        replies[key.toLowerCase().slice(0, 50)] =
          value.slice(0, 500);
      }

      if (Object.keys(replies).length >= 50) break;
    }

    settings.autoReplies = replies;
  }

  res.json({
    success: true,
    message: "Settings updated.",
    settings
  });
});

const publicPath = path.join(__dirname, "..", "public");

app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 SHAJU BOT running on port ${PORT}`);
});
