const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {}),
    },
  });
}

function error(message, status = 400) {
  return json({ error: message }, { status });
}

function normalizeBirthday(input) {
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const date = typeof input?.date === "string" ? input.date.trim() : "";
  const calendar = input?.calendar === "lunar" ? "lunar" : "solar";
  const year =
    input?.year === undefined || input?.year === null || input?.year === ""
      ? null
      : Number(input.year);

  if (!name) {
    throw new Error("Name is required");
  }

  if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(date)) {
    throw new Error("Date must use MM-DD format");
  }

  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 9999)) {
    throw new Error("Year must be a valid integer");
  }

  return { name, date, year, calendar };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

async function listBirthdays(env) {
  const db = env.birthday_calendar;
  const { results } = await db.prepare(
    `SELECT id, name, date, year, calendar, created_at, updated_at
     FROM birthdays
     ORDER BY date ASC, name COLLATE NOCASE ASC`
  ).all();

  return json(results);
}

async function createBirthday(request, env) {
  const input = normalizeBirthday(await readJson(request));
  const id = crypto.randomUUID();
  const db = env.birthday_calendar;

  await db.prepare(
    `INSERT INTO birthdays (id, name, date, year, calendar)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, input.name, input.date, input.year, input.calendar)
    .run();

  return json({ id, ...input }, { status: 201 });
}

async function updateBirthday(request, env, id) {
  if (!id) {
    return error("Birthday id is required");
  }

  const input = normalizeBirthday(await readJson(request));
  const db = env.birthday_calendar;
  const result = await db.prepare(
    `UPDATE birthdays
     SET name = ?, date = ?, year = ?, calendar = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(input.name, input.date, input.year, input.calendar, id)
    .run();

  if (result.meta.changes === 0) {
    return error("Birthday not found", 404);
  }

  return json({ id, ...input });
}

async function deleteBirthday(env, id) {
  if (!id) {
    return error("Birthday id is required");
  }

  const db = env.birthday_calendar;
  const result = await db.prepare("DELETE FROM birthdays WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return error("Birthday not found", 404);
  }

  return json({ ok: true });
}

async function handleApi(request, env) {
  if (!env.birthday_calendar) {
    return error("D1 binding birthday_calendar is not configured", 500);
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const resource = parts[1];
  const id = parts[2] ? decodeURIComponent(parts[2]) : "";

  if (resource !== "birthdays" || parts.length > 3) {
    return error("Not found", 404);
  }

  if (request.method === "GET" && !id) {
    return listBirthdays(env);
  }

  if (request.method === "POST" && !id) {
    return createBirthday(request, env);
  }

  if ((request.method === "PUT" || request.method === "PATCH") && id) {
    return updateBirthday(request, env, id);
  }

  if (request.method === "DELETE" && id) {
    return deleteBirthday(env, id);
  }

  return error("Method not allowed", 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch (err) {
        return error(err instanceof Error ? err.message : "Unexpected error", 400);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
