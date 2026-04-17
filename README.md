# Ticker Price — Obsidian Plugin

Automatically fetches and displays stock prices for `$TICKER` symbols in your notes. No API key required, uses Yahoo Finance.

## Features

- **Auto-fetch**: Type `$MSFT` and press Space or Enter → price appears instantly
- **Snapshot mode**: Price is fetched once and permanently written into your note (great for journals/logs)
- **Live mode**: Price is re-fetched every time you open the note
- **Display formats**: Price only / Price + change / Price + change + %
- **Bulk commands**: Annotate or refresh every ticker in the whole note at once
- **Escape hatch**: Prefix with `\$MSFT` to write a ticker without triggering a lookup
- Works with **stocks, ETFs, and crypto** (e.g. `$BTC-USD`, `$ETH-USD`)

## Examples

```
Bought some $MSFT ($415.23) and $AAPL ($172.45 +1.23 (+0.72%)) today.
Watching $BTC-USD ($67,432.10) closely.
```

## Installation

### Manual (recommended for now)

1. In your vault, navigate to `.obsidian/plugins/`
2. Create a new folder called `obsidian-ticker-price`
3. Copy these three files into that folder:
   - `main.js`
   - `manifest.json`
   - `styles.css` (optional)
4. Open Obsidian → Settings → Community Plugins
5. Disable Safe Mode if prompted
6. Find **Ticker Price** in the list and enable it

### From the Community Plugin Browser (future)
Search for "Ticker Price" once submitted to the Obsidian community plugins list.

## Usage

| Action | How |
|--------|-----|
| Auto-annotate a ticker | Type `$AAPL` then press **Space** or **Enter** |
| Annotate all tickers in note | Command: **Ticker Price: Fetch all** |
| Refresh all tickers in note | Command: **Ticker Price: Refresh all** |
| Write ticker without lookup | Use `\$AAPL` (backslash prefix) |

## Settings

| Setting | Description |
|---------|-------------|
| **Price mode** | `Snapshot` freezes price in note. `Live` re-fetches on open. |
| **Refresh on open** | (Live mode only) Re-fetch all tickers when the note is opened |
| **Display format** | Choose between price-only, price+change, or price+change+% |
| **Auto-fetch on Space/Enter** | Toggle the auto-trigger behavior |

## Data Source

Prices are fetched from the **Yahoo Finance API** (no API key required). Data may be delayed 15–20 minutes for some exchanges. Works with any symbol Yahoo Finance supports: US stocks, ETFs, indices, and crypto pairs like `$BTC-USD`.

## Author

**Alejandro Spradley** — [github.com/irl-Spradley](https://github.com/irl-Spradley)

- This plugin requires an internet connection to fetch prices.
- Snapshot prices are stored as plain text in your notes and will never change unless you run "Refresh all".
- For crypto: use Yahoo Finance format, e.g. `$BTC-USD`, `$ETH-USD`.
