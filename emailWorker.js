const db = require("./db");
const { sendEmail } = require("./gmailSender");

function processEmailQueue() {
  db.get(
    `SELECT id, recipient_email, subject, body
     FROM outbound_emails
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 1`,
    [],
    async (err, row) => {
      if (err) {
        console.error("Email queue read error:", err);
        return;
      }

      if (!row) return;

      db.run(
        `UPDATE outbound_emails
         SET status = 'processing'
         WHERE id = ? AND status = 'pending'`,
        [row.id],
        async function (claimErr) {
          if (claimErr) {
            console.error("Email queue claim error:", claimErr);
            return;
          }

          if (this.changes === 0) return;

          try {
            await sendEmail({
              to: row.recipient_email,
              subject: row.subject || "I'm OK message received",
              body: row.body,
            });

            db.run(
              `UPDATE outbound_emails
               SET status = 'sent',
                   sent_at = CURRENT_TIMESTAMP,
                   error = NULL
               WHERE id = ?`,
              [row.id]
            );

            console.log(`Sent email job ${row.id} to ${row.recipient_email}`);
          } catch (sendErr) {
            console.error("Gmail send error:", sendErr);

            db.run(
              `UPDATE outbound_emails
               SET status = 'failed',
                   error = ?
               WHERE id = ?`,
              [String(sendErr.message || sendErr), row.id]
            );
          }
        }
      );
    }
  );
}

console.log("Starting Gmail email worker...");
setInterval(processEmailQueue, 2000);

