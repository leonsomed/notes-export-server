import express from "express";
import fs from "fs";
import path from "path";
import cors from 'cors'

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors())
app.use(express.json({ limit: "500mb" }));

app.get("/api/notes/export/node-names", (req, res) => {
  try {
    const exportsDir = path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportsDir)) {
      return res.json({ names: [] });
    }

    const files = fs.readdirSync(exportsDir);
    const names = new Set();
    const exportPattern = /^notes-export-(.+)-(\d{4}-\d{2}-\d{2}T.*)\.json$/;

    for (const file of files) {
      const match = exportPattern.exec(file);
      if (match) {
        names.add(match[1]);
      }
    }

    return res.json({ names: Array.from(names).sort() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/notes/export", (req, res) => {
  try {
    const payload = req.body;
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.version !== "number" ||
      typeof payload.salt !== "string" ||
      typeof payload.iv !== "string" ||
      typeof payload.ciphertext !== "string" ||
      typeof payload.nodeName !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload." });
    }

    const exportsDir = path.join(process.cwd(), "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `notes-export-${payload.nodeName}-${timestamp}.json`;
    const filePath = path.join(exportsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    cleanupExports(exportsDir);

    return res.status(201).json({
      ok: true,
      file: filename,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error." });
  }
});

const cleanupExports = (exportsDir) => {
  const today = new Date().toISOString().slice(0, 10);
  const files = fs.readdirSync(exportsDir);
  const exportsByDay = new Map();

  for (const file of files) {
    const match = /^notes-export-(\d{4}-\d{2}-\d{2})T/.exec(file);
    if (!match) {
      continue;
    }

    const day = match[1];
    if (day === today) {
      continue;
    }

    if (day < today) {
      const dayFiles = exportsByDay.get(day) ?? [];
      dayFiles.push(file);
      exportsByDay.set(day, dayFiles);
    }
  }

  for (const dayFiles of exportsByDay.values()) {
    dayFiles.sort();
    const toDelete = dayFiles.slice(0, -1);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(exportsDir, file));
    }
  }
};

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});