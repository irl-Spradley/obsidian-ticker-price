"use strict";

/*
  Ticker Price — Obsidian Plugin
  Author: Alejandro Spradley (https://github.com/irl-Spradley)
  Fetches stock prices for $TICKER symbols via Yahoo Finance (no API key needed).
  
  Features:
  - Auto-fetch on Space/Enter after typing $MSFT
  - Snapshot mode (price frozen at time of writing)
  - Live mode (price refreshed on note open)
  - Display formats: price / price+change / price+change+%
  - Manual commands: fetch all, refresh all
  - Escape with \$MSFT to skip lookup
*/

var obsidian = require("obsidian");

// ─────────────────────────────────────────────
// Default settings
// ─────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  priceMode: "snapshot",   // "snapshot" | "live"
  displayFormat: "price",  // "price" | "price_change" | "price_change_percent"
  autoTrigger: true,
  refreshOnOpen: false,
};

// ─────────────────────────────────────────────
// Yahoo Finance fetch (no API key required)
// ─────────────────────────────────────────────

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  
  let resp;
  try {
    resp = await obsidian.requestUrl({ url });
  } catch (e) {
    throw new Error(`Network error fetching ${symbol}: ${e.message}`);
  }

  const json = resp.json;
  const meta = json?.chart?.result?.[0]?.meta;

  if (!meta) {
    throw new Error(`No data returned for symbol: ${symbol}`);
  }

  const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
  const prevClose = meta.previousClose ?? price;
  const change = price - prevClose;
  const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

  return { symbol: symbol.toUpperCase(), price, change, changePercent, currency: meta.currency ?? "USD" };
}

// ─────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────

function formatQuote(quote, format) {
  const p = quote.price.toFixed(2);
  const sign = quote.change >= 0 ? "+" : "";
  const c = `${sign}${quote.change.toFixed(2)}`;
  const pct = `${sign}${quote.changePercent.toFixed(2)}%`;

  switch (format) {
    case "price":                 return `$${p}`;
    case "price_change":          return `$${p} ${c}`;
    case "price_change_percent":  return `$${p} ${c} (${pct})`;
    default:                      return `$${p}`;
  }
}

// ─────────────────────────────────────────────
// Settings Tab
// ─────────────────────────────────────────────

class TickerPriceSettingTab extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Ticker Price" });
    containerEl.createEl("p", {
      text: "Type $MSFT (or any ticker) in your notes to get stock prices inline.",
      cls: "setting-item-description",
    });

    // Price Mode
    new obsidian.Setting(containerEl)
      .setName("Price mode")
      .setDesc(
        "Snapshot: price is fetched once and permanently written into your note. " +
        "Live: the annotation is re-fetched when you open the note (if 'Refresh on open' is enabled)."
      )
      .addDropdown((drop) =>
        drop
          .addOption("snapshot", "📌 Snapshot — price at time of writing")
          .addOption("live", "📡 Live — refresh on note open")
          .setValue(this.plugin.settings.priceMode)
          .onChange(async (value) => {
            this.plugin.settings.priceMode = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // Refresh on open (live mode only)
    if (this.plugin.settings.priceMode === "live") {
      new obsidian.Setting(containerEl)
        .setName("Refresh prices when opening a note")
        .setDesc("Automatically re-fetch all $TICKER prices every time you open the note.")
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.refreshOnOpen)
            .onChange(async (value) => {
              this.plugin.settings.refreshOnOpen = value;
              await this.plugin.saveSettings();
            })
        );
    }

    // Display Format
    new obsidian.Setting(containerEl)
      .setName("Display format")
      .setDesc("Controls what appears inside the parentheses next to each ticker.")
      .addDropdown((drop) =>
        drop
          .addOption("price", "Price only  →  $MSFT ($415.23)")
          .addOption("price_change", "Price + change  →  $MSFT ($415.23 +1.45)")
          .addOption("price_change_percent", "Price + change + %  →  $MSFT ($415.23 +1.45 (+0.35%))")
          .setValue(this.plugin.settings.displayFormat)
          .onChange(async (value) => {
            this.plugin.settings.displayFormat = value;
            await this.plugin.saveSettings();
          })
      );

    // Auto-trigger
    new obsidian.Setting(containerEl)
      .setName("Auto-fetch on Space / Enter")
      .setDesc(
        "Fetch the price automatically when you press Space or Enter right after typing a $TICKER. " +
        "Turn this off if you only want to use the manual commands."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoTrigger)
          .onChange(async (value) => {
            this.plugin.settings.autoTrigger = value;
            await this.plugin.saveSettings();
          })
      );

    // How to use
    containerEl.createEl("hr");
    containerEl.createEl("h3", { text: "Usage" });
    const ul = containerEl.createEl("ul");
    [
      "Type $AAPL in a note, then press Space or Enter — the price appears automatically.",
      'Run command "Ticker Price: Fetch all" to annotate every $TICKER in the current note.',
      'Run command "Ticker Price: Refresh all" to re-fetch even already-annotated tickers.',
      "Use \\$MSFT (with a backslash) to write a ticker without triggering a price lookup.",
      "Works with stocks, ETFs, and crypto (e.g. $BTC-USD, $ETH-USD) via Yahoo Finance.",
    ].forEach((text) => ul.createEl("li", { text }));
  }
}

// ─────────────────────────────────────────────
// Main Plugin
// ─────────────────────────────────────────────

class TickerPricePlugin extends obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new TickerPriceSettingTab(this.app, this));

    // ── Command: fetch all tickers in note ──
    this.addCommand({
      id: "ticker-price-fetch-all",
      name: "Fetch all — annotate every $TICKER in note",
      editorCallback: async (editor) => {
        await this.processAllTickers(editor, false);
      },
    });

    // ── Command: refresh (force re-fetch) ──
    this.addCommand({
      id: "ticker-price-refresh-all",
      name: "Refresh all — re-fetch every $TICKER price in note",
      editorCallback: async (editor) => {
        await this.processAllTickers(editor, true);
      },
    });

    // ── Auto-trigger on Space / Enter ──
    this.registerDomEvent(document, "keydown", (evt) => {
      if (!this.settings.autoTrigger) return;
      if (evt.key !== " " && evt.key !== "Enter") return;

      const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
      if (!view?.editor) return;

      const editor = view.editor;
      const cursor = editor.getCursor();
      const line = editor.getLine(cursor.line);

      // Capture the text BEFORE this keypress is inserted into the editor
      const textBefore = line.slice(0, cursor.ch);

      // Check if a bare $TICKER sits right at the end of what's typed so far
      const match = textBefore.match(/(?<!\\)\$([A-Z]{1,5})$/);
      if (!match) return;

      const symbol = match[1];

      // Position right after the $TICKER (before the space/enter being typed)
      const tickerEndCh = cursor.ch;
      const tickerLine = cursor.line;

      // Delay so the space/enter keystroke finishes inserting, then annotate
      setTimeout(() => this.handleAutoTrigger(editor, symbol, tickerLine, tickerEndCh), 80);
    });

    // ── Refresh on file open (live mode) ──
    this.registerEvent(
      this.app.workspace.on("file-open", async () => {
        if (this.settings.priceMode !== "live") return;
        if (!this.settings.refreshOnOpen) return;
        // Wait for editor to fully load
        setTimeout(async () => {
          const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
          if (view?.editor) {
            await this.processAllTickers(view.editor, true);
          }
        }, 500);
      })
    );
  }

  // ── Auto-trigger: insert annotation right after the ticker ───────────────
  // symbol, tickerLine, tickerEndCh are captured BEFORE the space/enter keystroke

  async handleAutoTrigger(editor, symbol, tickerLine, tickerEndCh) {
    // Double-check the ticker is still there and not already annotated
    const line = editor.getLine(tickerLine);
    const expectedTicker = `$${symbol}`;

    // Confirm $SYMBOL is still at the expected position
    const sliceAtTicker = line.slice(tickerEndCh - expectedTicker.length, tickerEndCh);
    if (sliceAtTicker !== expectedTicker) return;

    // Don't re-annotate if already has a parenthesised price right after
    const charAfterTicker = line.slice(tickerEndCh).trimStart();
    if (charAfterTicker.startsWith("(")) return;

    try {
      const quote = await fetchQuote(symbol);
      const annotation = ` (${formatQuote(quote, this.settings.displayFormat)})`;

      // Insert RIGHT after $TICKER (before the space/newline the user just typed)
      const insertPos = { line: tickerLine, ch: tickerEndCh };
      editor.replaceRange(annotation, insertPos, insertPos);
    } catch (e) {
      console.warn(`[Ticker Price] Auto-fetch failed for $${symbol}:`, e.message);
      // Silent fail on auto-trigger — user can always run manual command
    }
  }

  // ── Process entire note ────────────────────────────────────────────────

  async processAllTickers(editor, forceRefresh) {
    const content = editor.getValue();

    // Collect unique symbols from the note
    const symbols = new Set();
    const scanRe = /(?<!\\)\$([A-Z]{1,5})(?:\s*\([^)]*\))?/g;
    let m;
    while ((m = scanRe.exec(content)) !== null) {
      symbols.add(m[1]);
    }

    if (symbols.size === 0) {
      new obsidian.Notice("No $TICKER symbols found in this note.");
      return;
    }

    new obsidian.Notice(`⏳ Fetching prices for ${symbols.size} ticker(s)…`);

    // Fetch all in parallel
    const quotes = new Map();
    const errors = [];
    await Promise.all(
      Array.from(symbols).map(async (sym) => {
        try {
          const q = await fetchQuote(sym);
          quotes.set(sym, q);
        } catch (e) {
          errors.push(sym);
          console.warn(`[Ticker Price] Failed to fetch $${sym}:`, e.message);
        }
      })
    );

    if (quotes.size === 0) {
      new obsidian.Notice("❌ Could not fetch any prices. Check your internet connection.");
      return;
    }

    // Replace line by line
    const lines = content.split("\n");
    const replaceRe = /(?<!\\)\$([A-Z]{1,5})(?:\s*\(([^)]*)\))?/g;

    const newLines = lines.map((line) => {
      return line.replace(replaceRe, (fullMatch, sym, existingAnnotation) => {
        const quote = quotes.get(sym);
        if (!quote) return fullMatch; // fetch failed, leave as-is

        // Snapshot mode: don't overwrite existing annotation unless forceRefresh
        if (this.settings.priceMode === "snapshot" && existingAnnotation && !forceRefresh) {
          return fullMatch;
        }

        return `$${sym} (${formatQuote(quote, this.settings.displayFormat)})`;
      });
    });

    // Preserve cursor position
    const cursor = editor.getCursor();
    editor.setValue(newLines.join("\n"));
    editor.setCursor(cursor);

    const errMsg = errors.length > 0 ? ` (⚠️ failed: ${errors.map(s => "$" + s).join(", ")})` : "";
    new obsidian.Notice(`✅ Updated ${quotes.size} ticker(s).${errMsg}`);
  }

  // ── Settings ───────────────────────────────────────────────────────────

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

module.exports = TickerPricePlugin;
