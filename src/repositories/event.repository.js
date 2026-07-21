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
  modality
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
    modality: DATABASE_TO_API_MODALITY[row.modality] || row.modality
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
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      event.status
    ]
  );

  return mapEvent(result.rows[0]);
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
  listPublishedEvents
};
