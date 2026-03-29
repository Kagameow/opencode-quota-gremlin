# opencode-quota-gremlin

Tiny quota gremlin for the OpenCode session sidebar.

It shows a compact `sidebar_content` block for:

- Anthropic
- OpenAI / ChatGPT
- GitHub Copilot

And it includes a manual refresh tool so you can force a fresh fetch when the widget feels stale.

## Install

Add the package to both OpenCode configs:

`opencode.json`

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/opencode-quota-gremlin/dist/index.js"],
  "command": {
    "qgremlin": {
      "description": "Refresh quota gremlin now",
      "template": "Call tool quota_gremlin_refresh and return the result as-is."
    }
  }
}
```

`tui.json`

```json
{
  "plugin": ["file:///ABSOLUTE/PATH/opencode-quota-gremlin/dist/tui.js"]
}
```

If you publish it to npm later, swap the `file:///...` paths for the package name.

## What it does

- renders a dedicated `sidebar_content` panel
- refreshes on session/message activity
- throttles remote quota fetches with a small in-memory cache
- adds `quota_gremlin_refresh` for manual refresh

## Notes

- Anthropic quota uses `https://api.anthropic.com/api/oauth/usage`
- OpenAI quota uses `https://chatgpt.com/backend-api/wham/usage`
- Copilot quota uses `https://api.github.com/copilot_internal/user`
- the plugin reads OpenCode auth from `~/.local/share/opencode/auth.json`

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
```
