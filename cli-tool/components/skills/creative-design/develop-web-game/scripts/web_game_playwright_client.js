import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: null,
    iterations: 3,
    pauseMs: 250,
    headless: true,
    screenshotDir: "output/web-game",
    actionsFile: null,
    actionsJson: null,
    click: null,
    clickSelector: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--url" && next) {
      args.url = next;
      i++;
    } else if (arg === "--iterations" && next) {
      args.iterations = parseInt(next, 10);
      i++;
    } else if (arg === "--pause-ms" && next) {
      args.pauseMs = parseInt(next, 10);
      i++;
    } else if (arg === "--headless" && next) {
      args.headless = next !== "0" && next !== "false";
      i++;
    } else if (arg === "--screenshot-dir" && next) {
      args.screenshotDir = next;
      i++;
    } else if (arg === "--actions-file" && next) {
      args.actionsFile = next;
      i++;
    } else if (arg === "--actions-json" && next) {
      args.actionsJson = next;
      i++;
    } else if (arg === "--click" && next) {
      const parts = next.split(",").map((v) => parseFloat(v.trim()));
      if (parts.length === 2 && parts.every((v) => Number.isFinite(v))) {
        args.click = { x: parts[0], y: parts[1] };
      }
      i++;
    } else if (arg === "--click-selector" && next) {
      args.clickSelector = next;
      i++;
    }
  }
  if (!args.url) {
    throw new Error("--url is required");
  }
  return args;
}

const buttonNameToKey = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  enter: "Enter",
  space: "Space",
  a: "KeyA",
  b: "KeyB",
};

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function makeVirtualTimeShim() {
  return `(() => {
    const pending = new Set();
    const origSetTimeout = window.setTimeout.bind(window);
    const origSetInterval = window.setInterval.bind(window);
    const origRequestAnimationFrame = window.requestAnimationFrame.bind(window);

    window.__vt_pending = pending;

    window.setTimeout = (fn, t, ...rest) => {
      const task = {};
      pending.add(task);
      return origSetTimeout(() => {
        pending.delete(task);
        fn(...rest);
      }, t);
    };

    window.setInterval = (fn, t, ...rest) => {
      const task = {};
      pending.add(task);
      return origSetInterval(() => {
        fn(...rest);
      }, t);
    };

    window.requestAnimationFrame = (fn) => {
      const task = {};
      pending.add(task);
      return origRequestAnimationFrame((ts) => {
        pending.delete(task);
        fn(ts);
      });
    };

    window.advanceTime = (ms) => {
      return new Promise((resolve) => {
        const start = performance.now();
        function step(now) {
          if (now - start >= ms) return resolve();
          origRequestAnimationFrame(step);
        }
        origRequestAnimationFrame(step);
      });
    };

    window.__drainVirtualTimePending = () => pending.size;
  })();`;
}

async function getCanvasHandle(page) {
  const handle = await page.evaluateHandle(() => {
    let best = null;
    let bestArea = 0;
    for (const canvas of document.querySelectorAll("canvas")) {
      const area = (canvas.width || canvas.clientWidth || 0) * (canvas.height || canvas.clientHeight || 0);
      if (area > bestArea) {
        bestArea = area;
        best = canvas;
      }
    }
    return best;
  });
  return handle.asElement();
}

async function captureCanvasPngBase64(canvas) {
  return canvas.evaluate((c) => {
    if (!c || typeof c.toDataURL !== "function") return "";
    const data = c.toDataURL("image/png");
    const idx = data.indexOf(",");
    return idx === -1 ? "" : data.slice(idx + 1);
  });
}

async function isCanvasTransparent(canvas) {
  if (!canvas) return true;
  return canvas.evaluate((c) => {
    try {
      const w = c.width || c.clientWidth || 0;
      const h = c.height || c.clientHeight || 0;
      if (!w || !h) return true;
      const size = Math.max(1, Math.min(16, w, h));
      const probe = document.createElement("canvas");
      probe.width = size;
      probe.height = size;
      const ctx = probe.getContext("2d");
      if (!ctx) return true;
      ctx.drawImage(c, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false;
      }
      return true;
    } catch {
      return false;
    }
  });
}

async function captureScreenshot(page, canvas, outPath) {
  let buffer = null;
  let base64 = canvas ? await captureCanvasPngBase64(canvas) : "";
  if (base64) {
    buffer = Buffer.from(base64, "base64");
    const transparent = canvas ? await isCanvasTransparent(canvas) : false;
    if (transparent) buffer = null;
  }
  if (!buffer && canvas) {
    try {
      buffer = await canvas.screenshot({ type: "png" });
    } catch {
      buffer = null;
    }
  }
  if (!buffer) {
    const bbox = canvas ? await canvas.boundingBox() : null;
    if (bbox) {
      buffer = await page.screenshot({
        type: "png",
        omitBackground: false,
        clip: bbox,
      });
    } else {
      buffer = await page.screenshot({ type: "png", omitBackground: false });
    }
  }
  fs.writeFileSync(outPath, buffer);
}

class ConsoleErrorTracker {
  constructor() {
    this._seen = new Set();
    this._errors = [];
  }

  ingest(err) {
    const key = JSON.stringify(err);
    if (this._seen.has(key)) return;
    this._seen.add(key);
    this._errors.push(err);
  }

  drain() {
    const next = [...this._errors];
    this._errors = [];
    return next;
  }
}

async function doChoreography(page, canvas, steps) {
  for (const step of steps) {
    const buttons = new Set(step.buttons || []);
    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        const bbox = canvas ? await canvas.boundingBox() : null;
        if (!bbox) continue;
        const x = typeof step.mouse_x === "number" ? step.mouse_x : bbox.width / 2;
        const y = typeof step.mouse_y === "number" ? step.mouse_y : bbox.height / 2;
        await page.mouse.move(bbox.x + x, bbox.y + y);
        await page.mouse.down({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.down(buttonNameToKey[button]);
      }
    }

    const frames = step.frames || 1;
    for (let i = 0; i < frames; i++) {
      await page.evaluate(async () => {
        if (typeof window.advanceTime === "function") {
          await window.advanceTime(1000 / 60);
        }
      });
    }

    for (const button of buttons) {
      if (button === "left_mouse_button" || button === "right_mouse_button") {
        await page.mouse.up({ button: button === "left_mouse_button" ? "left" : "right" });
      } else if (buttonNameToKey[button]) {
        await page.keyboard.up(buttonNameToKey[button]);
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  ensureDir(args.screenshotDir);

  const browser = await chromium.launch({
    headless: args.headless,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage();
  const consoleErrors = new ConsoleErrorTracker();

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    consoleErrors.ingest({ type: "console.error", text: msg.text() });
  });
  page.on("pageerror", (err) => {
    consoleErrors.ingest({ type: "pageerror", text: String(err) });
  });

  await page.addInitScript({ content: makeVirtualTimeShim() });
  await page.goto(args.url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
  });

  let canvas = await getCanvasHandle(page);

  if (args.clickSelector) {
    try {
      await page.click(args.clickSelector, { timeout: 5000 });
      await page.waitForTimeout(250);
    } catch (err) {
      console.warn("Failed to click selector", args.clickSelector, err);
    }
  }
  let steps = null;
  if (args.actionsFile) {
    const raw = fs.readFileSync(args.actionsFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) steps = parsed;
    if (parsed && Array.isArray(parsed.steps)) steps = parsed.steps;
  } else if (args.actionsJson) {
    const parsed = JSON.parse(args.actionsJson);
    if (Array.isArray(parsed)) steps = parsed;
    if (parsed && Array.isArray(parsed.steps)) steps = parsed.steps;
  } else if (args.click) {
    steps = [
      {
        buttons: ["left_mouse_button"],
        frames: 2,
        mouse_x: args.click.x,
        mouse_y: args.click.y,
      },
    ];
  }
  if (!steps) {
    throw new Error("Actions are required. Use --actions-file, --actions-json, or --click.");
  }

  for (let i = 0; i < args.iterations; i++) {
    if (!canvas) canvas = await getCanvasHandle(page);
    await doChoreography(page, canvas, steps);
    await sleep(args.pauseMs);

    const shotPath = path.join(args.screenshotDir, `shot-${i}.png`);
    await captureScreenshot(page, canvas, shotPath);

    const text = await page.evaluate(() => {
      if (typeof window.render_game_to_text === "function") {
        return window.render_game_to_text();
      }
      return null;
    });
    if (text) {
      fs.writeFileSync(path.join(args.screenshotDir, `state-${i}.json`), text);
    }

    const freshErrors = consoleErrors.drain();
    if (freshErrors.length) {
      fs.writeFileSync(
        path.join(args.screenshotDir, `errors-${i}.json`),
        JSON.stringify(freshErrors, null, 2)
      );
      break;
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
