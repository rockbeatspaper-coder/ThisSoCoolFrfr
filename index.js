import express from "express";
import fs from "fs";

const app = express();

const PORT = process.env.PORT || 3000;
const DATA_FILE = "counts.json";
const SERVER_TTL_MS = 180000;

app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Exist Count API",
    status: "online",
    endpoints: {
      update: "POST /update",
      counts: "GET /counts",
      health: "GET /health"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { latest: null, servers: {} };
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { latest: null, servers: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function cleanCounts(counts) {
  if (!counts || typeof counts !== "object") return {};

  const clean = {};

  for (const [name, info] of Object.entries(counts)) {
    clean[name] = {
      total: Number(info.total) || 0,
      mutations: info.mutations || {},
      traits: info.traits || {}
    };
  }

  return clean;
}

function removeOldServers(data) {
  const now = Date.now();

  for (const [serverId, payload] of Object.entries(data.servers)) {
    if (!payload.receivedAt || now - payload.receivedAt > SERVER_TTL_MS) {
      delete data.servers[serverId];
    }
  }
}

app.post("/update", (req, res) => {
  const data = loadData();
  const { serverId, timestamp, counts } = req.body || {};

  const payload = {
    timestamp: Number(timestamp) || Date.now(),
    receivedAt: Date.now(),
    counts: cleanCounts(counts)
  };

  data.latest = payload;

  if (serverId) {
    data.servers[String(serverId)] = payload;
  }

  removeOldServers(data);
  saveData(data);

  res.json({
    ok: true,
    mode: serverId ? "multi-server" : "latest-only",
    animals: Object.keys(payload.counts).length,
    serverCount: Object.keys(data.servers).length
  });
});

app.get("/counts", (req, res) => {
  const data = loadData();
  removeOldServers(data);
  saveData(data);

  if (Object.keys(data.servers).length > 0) {
    const merged = {};
    let ts = 0;

    for (const payload of Object.values(data.servers)) {
      ts = Math.max(ts, payload.timestamp || 0, payload.receivedAt || 0);

      for (const [name, info] of Object.entries(payload.counts || {})) {
        if (!merged[name]) {
          merged[name] = {
            total: 0,
            mutations: {},
            traits: {}
          };
        }

        merged[name].total += Number(info.total) || 0;

        for (const [mutation, value] of Object.entries(info.mutations || {})) {
          merged[name].mutations[mutation] =
            (merged[name].mutations[mutation] || 0) + (Number(value) || 0);
        }

        for (const [trait, value] of Object.entries(info.traits || {})) {
          merged[name].traits[trait] =
            (merged[name].traits[trait] || 0) + (Number(value) || 0);
        }
      }
    }

    return res.json({
      timestamp: ts || Date.now(),
      serverCount: Object.keys(data.servers).length,
      counts: merged
    });
  }

  res.json(data.latest || {
    timestamp: Date.now(),
    counts: {}
  });
});

app.use((err, req, res, next) => {
  console.error("Request error:", err.message);
  res.status(400).json({
    ok: false,
    error: "Invalid request body"
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: "Not found"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
