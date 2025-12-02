import express from "express";
import { spawn } from "node:child_process";
import { parseStringPromise } from "xml2js";

const app = express();
app.use(express.json());

const validHost = h => typeof h === "string" && h.trim().length > 0;
const normalizePorts = p => {
  if (Array.isArray(p)) p = p.join(",");
  if (typeof p === "number") p = String(p);
  p = String(p ?? "").trim().replace(/\s+/g, "");
  return /^[TUS]?:?\d+(-\d+)?(,[TUS]?:?\d+(-\d+)?)*$/.test(p) ? p : null;
};
const normalizeFlags = f => Array.isArray(f) ? f.filter(Boolean)
  : typeof f === "string" ? f.split(/\s+/).filter(Boolean)
  : ["-T4"];

app.post("/v1/scan", async (req, res) => {
  const { host, ports, flags = "-T4" } = req.body ?? {};
  if (!validHost(host)) return res.status(400).json({ error: "host required" });
  const normPorts = normalizePorts(ports);
  if (!normPorts) return res.status(400).json({ error: "invalid ports", example: "1-1024 or 22,80,443" });

  const args = [...normalizeFlags(flags)];
  if (!args.some(a => a === "-p" || a.startsWith("-p"))) args.push("-p", normPorts);
  args.push("-oX", "-", host);

  let out = "", err = "";
  await new Promise((resolve) => {
    const ps = spawn("nmap", args, { stdio: ["ignore", "pipe", "pipe"] });
    ps.stdout.on("data", d => out += d.toString());
    ps.stderr.on("data", d => err += d.toString());
    ps.on("close", () => resolve());
  });

  if (!out.trim()) return res.status(500).json({ error: "nmap failed", details: err || "no output" });

  // Parse XML -> JSON (minimaal nodig)
  const xml = await parseStringPromise(out, { explicitArray: false, attrkey: "$" }).catch(e =>
    res.status(500).json({ error: "xml-parse-failed", details: String(e?.message || e) })
  );
  if (!xml) return; // response already sent

  const hostNode = xml?.nmaprun?.host || {};
  const addr = hostNode?.address?.$.addr || (Array.isArray(hostNode?.address) ? hostNode.address[0]?.$.addr : host);
  let portsArr = hostNode?.ports?.port || [];
  if (!Array.isArray(portsArr)) portsArr = [portsArr].filter(Boolean);

  const openPorts = portsArr
    .filter(p => p?.state?.$.state === "open")
    .map(p => ({
      host: addr || host,
      port: Number(p.$?.portid),
      proto: p.$?.protocol,
      service: p?.service?.$.name
    }));

  res.json({ host: addr || host, count: openPorts.length, openPorts, raw: xml?.nmaprun || null });
});

app.get("/v1/health", (_req, res) => res.json({ ok: true }));
