const fs = require("fs");
const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const TOKEN_PATH = path.join(__dirname, "token.json");

function createOAuthClient() {
  const keys = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const key = keys.installed || keys.web;

  return new google.auth.OAuth2(
    key.client_id,
    key.client_secret,
    key.redirect_uris[0]
  );
}

async function loadSavedClient() {
  if (!fs.existsSync(TOKEN_PATH)) return null;

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
  const client = createOAuthClient();
  client.setCredentials(token);
  return client;
}

async function saveClient(client) {
  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(client.credentials, null, 2)
  );
}

async function authorize() {
  let client = await loadSavedClient();
  if (client) return client;

  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveClient(client);
  }

  return client;
}

function makeRawMessage({ to, subject, body }) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendEmail({ to, subject, body }) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  const raw = makeRawMessage({ to, subject, body });

  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return result.data;
}

module.exports = { sendEmail };
