const db = require("./db");

function tryReassemble(queueId, callback) {
  db.all(
    `SELECT *
     FROM inbound_messages
     WHERE queue_id = ?
     ORDER BY part_no ASC`,
    [queueId],
    (err, rows) => {
      if (err) {
        console.error("Reassembly query error:", err);
        if (callback) callback(err);
        return;
      }

      if (!rows || rows.length === 0) {
        if (callback) callback(null, false);
        return;
      }

      const totalParts = rows[0].part_total || 1;

      if (rows.length < totalParts) {
        console.log(`Queue ${queueId}: only ${rows.length}/${totalParts} parts received so far`);
        if (callback) callback(null, false);
        return;
      }

      const seenParts = new Set(rows.map((r) => r.part_no));
      for (let i = 1; i <= totalParts; i++) {
        if (!seenParts.has(i)) {
          console.log(`Queue ${queueId}: missing part ${i}`);
          if (callback) callback(null, false);
          return;
        }
      }

      const sourceCallsign = rows[0].source_callsign;
      const destinationCallsign = rows[0].destination_callsign;
      const recipientEmail = rows[0].recipient_email;

      const fullMessage = rows
        .sort((a, b) => a.part_no - b.part_no)
        .map((r) => r.message_text || "")
        .join("");

      db.get(
        `SELECT id FROM reassembled_messages WHERE queue_id = ?`,
        [queueId],
        (checkErr, existing) => {
          if (checkErr) {
            console.error("Reassembly existence check error:", checkErr);
            if (callback) callback(checkErr);
            return;
          }

          if (existing) {
            console.log(`Queue ${queueId}: already reassembled`);
            if (callback) callback(null, true);
            return;
          }

          db.run(
            `INSERT INTO reassembled_messages
             (source_callsign, destination_callsign, queue_id, recipient_email, full_message, total_parts, status, error)
             VALUES (?, ?, ?, ?, ?, ?, 'ready_for_email', NULL)`,
            [
              sourceCallsign,
              destinationCallsign,
              queueId,
              recipientEmail,
              fullMessage,
              totalParts,
            ],
            function (insertErr) {
              if (insertErr) {
                console.error("Reassembly insert error:", insertErr);
                if (callback) callback(insertErr);
                return;
              }

              const reassembledId = this.lastID;

              db.run(
                `INSERT INTO outbound_emails
                 (reassembled_id, recipient_email, subject, body, status)
                 VALUES (?, ?, ?, ?, 'pending')`,
                [
                  reassembledId,
                  recipientEmail,
                  "I'm OK message received",
                  fullMessage,
                ],
                (emailErr) => {
                  if (emailErr) {
                    console.error("Outbound email queue insert error:", emailErr);
                    if (callback) callback(emailErr);
                    return;
                  }

                  console.log(`Queue ${queueId}: successfully reassembled into one message`);
                  console.log(`Queued email for ${recipientEmail}`);

                  if (callback) callback(null, true);
                }
              );
            }
          );
        }
      );
    }
  );
}

module.exports = { tryReassemble };

