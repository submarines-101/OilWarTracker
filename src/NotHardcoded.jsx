import { useEffect, useState } from "react";
import Papa from "papaparse";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQZiLId8TyIU9e-E_77m1FP98GaR2ArWQ7yIhDhQ6IAKFV1GsBsW3zV47dtrzkL-5n7CWZ02Zgipv-d/pub?gid=0&single=true&output=csv";

export default function NotHardcoded() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(CSV_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);

        const csvText = await res.text();

        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        });

        if (parsed.errors?.length) {
          throw new Error(parsed.errors[0].message);
        }

        const normalized = parsed.data.map((row) => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  date: row.date,
  country: row.country,
  facility_name: row.facility_name,
  facility_type: row.facility_type,
  weapon_type: row.weapon_type,
  hydrocarbon_type: row.hydrocarbon_type,
  damage_assessment: row.dammage_assessment, // using your current spelling
  capacity_bpd: row.capacity_bpd ? Number(row.capacity_bpd) : null,
  capacity_mmscfd: row.capacity_mmscfd ? Number(row.capacity_mmscfd) : null,
  lat: row.lat ? Number(row.lat) : null,
  lon: row.lon ? Number(row.lon) : null,
  article_url: row.article_url || null,
  categories: row.categories
    ? row.categories.split(",").map((c) => c.trim())
    : [],
  sources: row.sources
    ? row.sources.split(";").map((s) => s.trim())
    : [],
}));

setEvents(normalized);
      } catch (e) {
        setError(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) return <div style={{ padding: 16 }}>Loading events…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>Error: {error}</div>;

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1>OilWarTracker (Spreadsheet-driven)</h1>
      <p>Loaded {events.length} events.</p>

      <ul>
        {events.map((e) => (
          <li key={e.id || `${e.title}-${e.date}`}>
            <strong>{e.title || "(no title)"}</strong>{" "}
            — {e.date || "(no date)"} — {e.country || "(no country)"}
          </li>
        ))}
      </ul>
    </div>
  );
}