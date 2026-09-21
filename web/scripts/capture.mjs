import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA = path.resolve(__dirname, "../../docs/media");
const BASE = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[2];

async function screenshots(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(BASE); await sleep(2500);
  await p.screenshot({ path: `${MEDIA}/shot_home.png` });
  await p.goto(`${BASE}/watch/uncanny-hollow`); await sleep(1200);
  await p.evaluate(() => { const v = document.querySelector("video"); if (v) { v.currentTime = 5.2; v.pause(); } });
  await sleep(1800);
  await p.screenshot({ path: `${MEDIA}/shot_watch.png` });
  await p.goto(`${BASE}/studio`); await sleep(2500);
  await p.screenshot({ path: `${MEDIA}/shot_studio.png`, fullPage: true });
  await ctx.close();
  console.log("screenshots done");
}

async function walkthrough(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${MEDIA}/video`, size: { width: 1280, height: 800 } },
  });
  const p = await ctx.newPage();

  // Home — browse
  await p.goto(BASE);
  await sleep(2500);
  await p.mouse.wheel(0, 260); await sleep(1400);
  await p.mouse.wheel(0, -260); await sleep(800);

  // Play the featured title
  await p.getByRole("link", { name: "▶ Play" }).first().click();
  await sleep(1500);
  const play = () => p.evaluate(() => document.querySelector("video")?.play());
  const pause = () => p.evaluate(() => document.querySelector("video")?.pause());
  await play();                          // start playback
  await sleep(1500);

  // Skip intro
  const skip = p.getByRole("button", { name: /Skip Intro/ });
  if (await skip.isVisible().catch(() => false)) { await skip.click(); await sleep(500); }
  await play();
  await sleep(2600);                     // watch X-Ray track the face

  // Pause to reveal X-Ray panel
  await pause();
  await sleep(2600);

  // Jump to another cast member (this also resumes playback)
  const dorian = p.getByRole("button", { name: /Dorian Vale/ });
  if (await dorian.isVisible().catch(() => false)) { await dorian.click(); await sleep(3600); }
  await pause(); await sleep(1400);

  // Studio — the engine
  await p.getByRole("link", { name: "SceneIQ Studio" }).click();
  await sleep(2500);
  for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 90); await sleep(80); }
  await sleep(2500);

  await ctx.close();
  console.log("walkthrough done");
}

const browser = await chromium.launch();
if (only !== "video") await screenshots(browser);
if (only !== "shots") await walkthrough(browser);
await browser.close();
console.log("ALL CAPTURE DONE");
