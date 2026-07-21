const pool = require("../config/database");

const EVENT_FIELDS = `
  id,
  title,
  slug,
  description,
  event_type,
  start_at,
  end_at,
  location,
  modality,
  whatsapp_number,
  whatsapp_message,
  status,
  created_at,
  updated_at
`;

const PUBLIC_EVENT_FIELDS = `
  id,
  title,
  slug,
  description,
  event_type,
  start_at,
  end_at,
  location,
  modality,
  whatsapp_number,
  whatsapp_message
`;

const DATABASE_TO_API_MODALITY = {
  presencial: "in_person",
  virtual: "virtual",
  hibrido: "hybrid"
};

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    eventType: row.event_type,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    modality: DATABASE_TO_API_MODALITY[row.modality] || row.modality,
    whatsappNumber: row.whatsapp_number,
    whatsappMessage: row.whatsapp_message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicEvent(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    eventType: row.event_type,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location,
    modality: DATABASE_TO_API_MODALITY[row.modality] || row.modality,
    whatsappNumber: row.whatsapp_number,
    whatsappMessage: row.whatsapp_message
  };
}

async function listAdminEvents() {
  const result = await pool.query(`
    SELECT ${EVENT_FIELDS}
    FROM coinpsi.events
    ORDER BY start_at ASC, created_at DESC
  `);

  return result.rows.map(mapEvent);
}

async function listPublishedEvents() {
  const result = await pool.query(`
    SELECT ${PUBLIC_EVENT_FIELDS}
    FROM coinpsi.events
    WHERE status = 'published'
    ORDER BY start_at ASC, id ASC
  `);

  return result.rows.map(mapPublicEvent);
}

async function insertEvent(event) {
  const result = await pool.query(
    `
      INSERT INTO coinpsi.events (
        title,
        slug,
        description,
        event_type,
        start_at,
        end_at,
        location,
        modality,
        whatsapp_number,
        whatsapp_message,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING ${EVENT_FIELDS}
    `,
    [
      event.title,
      event.slug,
      event.description,
      event.eventType,
      event.startAt,
      event.endAt,
      event.location,
      event.modality,
      event.whatsappNumber,
      event.whatsappMessage,
      event.status
    ]
  );

  return mapEvent(result.rows[0]);
}

async function updateEventById(id, event) {
  const result = await pool.query(
    `
      UPDATE coinpsi.events
      SET
        title = $2,
        description = $3,
        event_type = $4,
        start_at = $5,
        end_at = $6,
        location = $7,
        modality = $8,
        whatsapp_number = $9,
        whatsapp_message = $10,
        status = $11,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${EVENT_FIELDS}
    `,
    [
      id,
      event.title,
      event.description,
      event.eventType,
      event.startAt,
      event.endAt,
      event.location,
      event.modality,
      event.whatsappNumber,
      event.whatsappMessage,
      event.status
    ]
  );

  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

async function cancelEventById(id) {
  const result = await pool.query(
    `
      UPDATE coinpsi.events
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${EVENT_FIELDS}
    `,
    [id]
  );

  return result.rows[0] ? mapEvent(result.rows[0]) : null;
}

async function deleteEventById(id) {
  const result = await pool.query(
    `
      DELETE FROM coinpsi.events
      WHERE id = $1
      RETURNING id
    `,
    [id]
  );

  return result.rows[0]?.id ?? null;
}

module.exports = {
  cancelEventById,
  deleteEventById,
  insertEvent,
  listAdminEvents,
  listPublishedEvents,
  updateEventById
};
