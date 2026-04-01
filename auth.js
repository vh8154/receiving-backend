import fs from "fs";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

const auth = await authenticate({
  keyfilePath: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/gmail.send"],
});

fs.writeFileSync("token.json", JSON.stringify(auth.credentials));

console.log("Token saved to token.json");

const gmail = google.gmail({ version: "v1", auth });
console.log("Authenticated");
