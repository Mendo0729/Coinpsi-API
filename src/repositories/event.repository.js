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
    modality: row.modality,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

module.exports = {
  insertEvent,
  listAdminEvents
};
