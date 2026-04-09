# opencode-quota-gremlin

Tiny quota gremlin for the OpenCode session sidebar.

Shows a compact sidebar panel with quota/usage data for:

- Anthropic (Claude)
- OpenAI / ChatGPT
- GitHub Copilot

Includes a manual refresh tool and a debug diagnostic tool.

## Install

### From npm

```bash
npm i opencode-quota-gremlin
```

`opencode.json` (server plugin + optional slash command):

```json
{
  "plugin": ["opencode-quota-gremlin"],
  "command": {
    "qgremlin": {
      "description": "Refresh quota gremlin now",
      "template": "Call tool quota_gremlin_refresh and return the result as-is."
    }
  }
}
```

`tui.json` (sidebar):

```json
{
  "plugin": ["opencode-quota-gremlin"]
}
```

### From local clone

```bash
git clone https://github.com/Kagameow/opencode-quota-gremlin.git
cd opencode-quota-gremlin
pnpm install
pnpm build
```

`opencode.json`:

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/opencode-quota-gremlin"]
}
```

`tui.json`:

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/opencode-quota-gremlin"]
}
```

Replace `ABSOLUTE/PATH` with the actual path to your clone.

## What it does

- Renders a sidebar panel with quota bars and reset countdowns
- Refreshes on session/message activity
- Throttles remote fetches with a 2-minute in-memory cache
- `quota_gremlin_refresh` tool for manual refresh
- `quota_gremlin_debug` tool for diagnostics (version, auth, provider health)

## Provider endpoints

| Provider  | Endpoint                                          |
|-----------|---------------------------------------------------|
| Anthropic | `https://api.anthropic.com/api/oauth/usage`       |
| OpenAI    | `https://chatgpt.com/backend-api/wham/usage`      |
| Copilot   | `https://api.github.com/copilot_internal/user`    |

Auth tokens are read from `~/.local/share/opencode/auth.json` (managed by OpenCode).

## Development

```bash
pnpm install
pnpm build       # emit dist/ (server plugin only)
pnpm typecheck   # check all source including .tsx
pnpm test        # vitest
pnpm lint        # eslint
```

## Plugin architecture note

The TUI plugin (`src/tui.tsx`) is loaded as **raw source** by OpenCode's Bun runtime with a Solid JSX transform. All solid-js reactive code that participates in host rendering **must** live in `.tsx` files — `.ts` files get a different solid-js instance due to how the runtime plugin loader works. This is why `useQuotaSnapshot` is inlined in `tui.tsx` rather than in a separate `.ts` module.
