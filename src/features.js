
const WARNINGS = new Map();
const SPAM_TRACKER = new Map();

const DEFAULT_SETTINGS = {
  welcome: true,
  antiLink: false,
  antiSpam: false,
  badWordFilter: false,
  autoReply: true,
  groupProtection: false,
  badWords: ["খারাপশব্দ"],
  autoReplies: {
    hi: "Hello! 👋 Welcome to SHAJU BOT.",
    hello: "হ্যালো! ❤️ কেমন আছেন?"
  }
};

const botSettings = new Map();

function getSettings(ownerId) {
  if (!botSettings.has(ownerId)) {
    botSettings.set(ownerId, {
      ...DEFAULT_SETTINGS,
      badWords: [...DEFAULT_SETTINGS.badWords],
      autoReplies: { ...DEFAULT_SETTINGS.autoReplies }
    });
  }

  return botSettings.get(ownerId);
}

function checkLink(text) {
  return /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(text);
}

function checkSpam(text, chatId, sender) {
  const key = `${chatId}:${sender}`;
  const now = Date.now();

  const history = SPAM_TRACKER.get(key) || [];
  const recent = history.filter(time => now - time < 5000);

  recent.push(now);
  SPAM_TRACKER.set(key, recent);

  return recent.length >= 5 || text.length > 1500;
}

function checkBadWords(text, settings) {
  return settings.badWords.some(word =>
    word && text.toLowerCase().includes(word.toLowerCase())
  );
}

function addWarning(key) {
  const count = (WARNINGS.get(key) || 0) + 1;
  WARNINGS.set(key, count);
  return count;
}

async function isGroupAdmin(sock, chatId, sender) {
  try {
    const metadata = await sock.groupMetadata(chatId);
    const participant = metadata.participants.find(
      item => item.id === sender
    );

    return participant?.admin === "admin" ||
           participant?.admin === "superadmin";
  } catch {
    return false;
  }
}

async function handleMessage(ownerId, message, sock) {
  try {
    if (!message.message || message.key.fromMe) return;

    const settings = getSettings(ownerId);
    const chatId = message.key.remoteJid;
    const sender = message.key.participant || chatId;

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    if (!text) return;

    const isGroup = chatId.endsWith("@g.us");

    if (isGroup) {
      const admin = await isGroupAdmin(sock, chatId, sender);

      if (settings.antiLink && checkLink(text) && !admin) {
        await sock.sendMessage(chatId, {
          text: "⚠️ লিংক পাঠানো নিষিদ্ধ!"
        });
        return;
      }

      if (settings.antiSpam &&
          checkSpam(text, chatId, sender) &&
          !admin) {
        await sock.sendMessage(chatId, {
          text: "⚠️ স্প্যাম মেসেজ পাঠাবেন না!"
        });
        return;
      }

      if (settings.badWordFilter &&
          checkBadWords(text, settings) &&
          !admin) {
        const count = addWarning(`${chatId}:${sender}`);

        await sock.sendMessage(chatId, {
          text: `⚠️ খারাপ শব্দ ব্যবহার করবেন না! Warning: ${count}/3`
        });

        if (count >= 3) {
          WARNINGS.delete(`${chatId}:${sender}`);
        }
        return;
      }
    }

    if (settings.autoReply) {
      const reply = settings.autoReplies[text.toLowerCase()];

      if (reply) {
        await sock.sendMessage(chatId, { text: reply });
      }
    }

  } catch (error) {
    console.error("Feature error:", error.message);
  }
}

module.exports = {
  getSettings,
  handleMessage
};
