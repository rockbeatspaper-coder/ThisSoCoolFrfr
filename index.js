import express from "express";
import fs from "fs";

const app = express();

const PORT = process.env.PORT || 3000;
const DATA_FILE = "counts.json";

app.use(express.json({ limit: "2mb" }));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { latest: null };
  }

  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return { latest: data.latest || null };
  } catch {
    return { latest: null };
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

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Exist Count API",
    mode: "latest-global-snapshot",
    endpoints: {
      update: "POST /update",
      counts: "GET /counts"
    }
  });
});

app.post("/update", (req, res) => {
  const { timestamp, counts, serverId } = req.body || {};

  const payload = {
    timestamp: Number(timestamp) || Date.now(),
    receivedAt: Date.now(),
    sourceServerId: serverId || null,
    counts: cleanCounts(counts)
  };

  saveData({ latest: payload });

  res.json({
    ok: true,
    mode: "latest-only",
    animals: Object.keys(payload.counts).length,
    receivedAt: payload.receivedAt
  });
});

app.get("/counts", (req, res) => {
  const data = loadData();

  res.json(
    data.latest || {
      timestamp: Date.now(),
      counts: {}
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
