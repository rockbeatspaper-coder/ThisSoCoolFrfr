import express from "express";
import fs from "fs";

const app = express();
app.use(express.json());

const DATA_FILE = "counts.json";

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { latest: null, servers: {} };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post("/update", (req, res) => {
  const data = loadData();
  const { serverId, timestamp, counts } = req.body;

  const payload = {
    timestamp: timestamp || Date.now(),
    receivedAt: Date.now(),
    counts: counts || {}
  };

  data.latest = payload;

  if (serverId) {
    data.servers[serverId] = payload;
  }

  saveData(data);

  res.json({ ok: true });
});

app.get("/counts", (req, res) => {
  const data = loadData();

  if (Object.keys(data.servers).length > 0) {
    const merged = {};
    let ts = 0;

    for (const payload of Object.values(data.servers)) {
      ts = Math.max(ts, payload.timestamp, payload.receivedAt);

      for (const [name, info] of Object.entries(payload.counts)) {
        if (!merged[name]) merged[name] = { total: 0, mutations: {}, traits: {} };

        merged[name].total += info.total || 0;

        for (const [m, v] of Object.entries(info.mutations || {})) {
          merged[name].mutations[m] = (merged[name].mutations[m] || 0) + v;
        }

        for (const [t, v] of Object.entries(info.traits || {})) {
          merged[name].traits[t] = (merged[name].traits[t] || 0) + v;
        }
      }
    }

    return res.json({ timestamp: ts, counts: merged });
  }

  res.json(data.latest || { timestamp: Date.now(), counts: {} });
});

app.listen(3000, () => console.log("Server running on port 3000"));
