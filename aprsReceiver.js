function parseAprsDirectedMessage(line) {
  const match = line.match(/([A-Z0-9-]+)>([A-Z0-9]+)::([A-Z0-9 -]{9}):(.+)/i);
  if (!match) return null;

  const source = match[1].trim();
  const tocall = match[2].trim();
  const destination = match[3].trim();
  let payload = match[4].trim();

  let aprsMsgNo = null;
  const msgNoMatch = payload.match(/\{(.+)$/);
  if (msgNoMatch) {
    aprsMsgNo = msgNoMatch[1];
    payload = payload.replace(/\{.+$/, "").trim();
  }

  return {
    source_callsign: source,
    tocall,
    destination_callsign: destination,
    aprs_msg_no: aprsMsgNo,
    payload,
  };
}

function parsePayloadFields(payload) {
  const fields = {};
  const parts = payload.split("|");

  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1);
    fields[key] = value;
  }

  let partNo = null;
  let partTotal = null;

  if (fields.PART) {
    const m = fields.PART.match(/^(\d+)\/(\d+)$/);
    if (m) {
      partNo = parseInt(m[1], 10);
      partTotal = parseInt(m[2], 10);
    }
  }

  return {
    queue_id: fields.ID || null,
    part_no: partNo,
    part_total: partTotal,
    recipient_email: fields.TO || null,
    message_text: fields.MSG || null,
    raw_payload: payload,
  };
}

function parseReceivedLine(line) {
  const directed = parseAprsDirectedMessage(line);
  if (!directed) return null;

  const fields = parsePayloadFields(directed.payload);

  return {
    source_callsign: directed.source_callsign,
    destination_callsign: directed.destination_callsign,
    aprs_msg_no: directed.aprs_msg_no,
    ...fields,
  };
}

module.exports = { parseReceivedLine };

