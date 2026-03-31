const fs = require("fs");
const path = require("path");
const readline = require("readline");
const db = require("./db");
const { parseReceivedLine } = require("./aprsReceiver");
const { tryReassemble } = require("./reassembler");

const MY_CALLSIGN = (process.env.MY_CALLSIGN || "KF8EZE-10").toUpperCase();
const LOGFILE = process.env.DIREWOLF_LOG || path.join(__dirname, "direwolf.log");

function saveInbound(msg) {
  db.run(
    `INSERT INTO inbound_messages
     (source_callsign, destination_callsign, aprs_msg_no, queue_id, part_no, part_total,
      recipient_email, message_text, raw_payload, status, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', NULL)`,
    [
      msg.source_callsign,
      msg.destination_callsign,
      msg.aprs_msg_no,
      msg.queue_id,
      msg.part_no,
      msg.part_total,
      msg.recipient_email,
      msg.message_text,
      msg.raw_payload,
    ],
    (err) => {
      if (err) {
        console.error("DB insert error:", err);
      } else {
        console.log("Saved inbound message part for", msg.recipient_email);

        if (msg.queue_id) {
          tryReassemble(msg.queue_id, (reassemblyErr, completed) => {
            if (reassemblyErr) {
              console.error("Reassembly error:", reassemblyErr);
            } else if (completed) {
              console.log(`Queue ${msg.queue_id}: message fully reassembled`);
            }
          });
        }
      }
    }
  );
}

function handleLine(line) {
  const parsed = parseReceivedLine(line);
  if (!parsed) return;

  if (parsed.destination_callsign.toUpperCase() !== MY_CALLSIGN) return;

  console.log("Parsed inbound:", parsed);
  saveInbound(parsed);
}

function tailFile(filePath) {
  let position = 0;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "");
  }

  position = fs.statSync(filePath).size;

  console.log(`Tailing ${filePath} for destination ${MY_CALLSIGN}`);

  fs.watchFile(filePath, { interval: 500 }, () => {
    const stats = fs.statSync(filePath);
    if (stats.size < position) {
      position = 0;
    }
    if (stats.size === position) return;

    const stream = fs.createReadStream(filePath, {
      start: position,
      end: stats.size,
      encoding: "utf8",
    });

    let buffer = "";

    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        handleLine(line);
      }
    });

    stream.on("end", () => {
      position = stats.size;
    });
  });
}

tailFile(LOGFILE);

