import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.resolve(__dirname, "../../docs/media");
const BASE = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();

await p.goto(BASE);
await sleep(2500);
await p.screenshot({ path: `${MEDIA}/shot_home.png` });

// watch page — pause on a face for X-Ray
await p.goto(`${BASE}/watch/uncanny-hollow`);
await sleep(1500);
await p.evaluate(() => { const v = document.querySelector("video"); if (v) { v.currentTime = 5.2; v.pause(); } });
await sleep(2000);
await p.screenshot({ path: `${MEDIA}/shot_watch.png` });

// studio
await p.goto(`${BASE}/studio`);
await sleep(2500);
await p.screenshot({ path: `${MEDIA}/shot_studio.png`, fullPage: true });

await b.close();
console.log("shots done");
