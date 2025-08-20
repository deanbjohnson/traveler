// Build a comprehensive airports.min.json from OurAirports CSV
// Produces: public/airports.min.json with shape { IATA: { lat, lng, name } }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fetch from "node-fetch";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "public", "airports.min.json");

const CSV_SOURCES = [
  // Public mirrors (prefer GitHub raw to avoid TLS issues)
  "https://raw.githubusercontent.com/ourairports/ourairports-data/master/airports.csv",
  "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv",
  "https://ourairports.com/data/airports.csv"
];

async function main() {
  let csvText = null;
  let lastErr = null;
  for (const url of CSV_SOURCES) {
    try {
      console.log("Downloading:", url);
      const res = await fetch(url, { timeout: 60_000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      csvText = await res.text();
      break;
    } catch (e) {
      lastErr = e;
      console.warn("Failed:", e?.message || e);
    }
  }
  if (!csvText) throw lastErr || new Error("Could not download airports.csv from any source");

  console.log("Parsing CSV...");
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
  });

  // Map only airports with an IATA code
  const out = {};
  let kept = 0;
  for (const r of records) {
    const iata = (r.iata_code || "").trim();
    if (!iata) continue;
    const lat = Number(r.latitude_deg);
    const lng = Number(r.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out[iata.toUpperCase()] = {
      lat,
      lng,
      name: (r.name || iata).toString(),
    };
    kept++;
  }

  // Ensure output dir
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const bytes = Buffer.byteLength(JSON.stringify(out));
  console.log(`Wrote ${kept} airports -> ${OUT} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


