
# 🔥 SHAJU BOT

A WhatsApp Multi-User Pairing Bot Platform.

## Features

- WhatsApp Pairing Code
- Multi-user Pairing Architecture
- Live Connection Status
- Welcome Message
- Anti-Link
- Anti-Spam
- Bad Word Filter
- Warning System
- Group Protection
- Auto Reply
- Admin Control
- Responsive Dashboard

## Requirements

- Node.js 20+
- npm
- GitHub Account
- Render Account

## Installation

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Set these variables in your hosting provider:

- PORT
- NODE_ENV
- COOKIE_SECRET

COOKIE_SECRET must be a strong random secret of at least 32 characters.

## Deployment

1. Upload project files to GitHub.
2. Connect the repository to Render.
3. Select Node Web Service.
4. Build command: npm install
5. Start command: npm start
6. Configure environment variables.

## Security

Never upload `.env` or WhatsApp session files.

Never share WhatsApp pairing codes.

## Development Status

This project is a starter scaffold. WhatsApp session recovery, reconnection, complete multi-user management and bot features still require implementation and testing before public deployment.
