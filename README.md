# fathom-mcp

> **MCP server for Fathom.video** — Access your AI meeting transcripts, summaries, and action items directly from Cursor IDE

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)](https://nodejs.org)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that integrates [Fathom.video](https://fathom.video) with AI coding assistants like Cursor. Query your meeting transcripts, export recordings to markdown, search by participant, and manage webhooks — all through natural language.

## Features

- **📋 List & Search Meetings** — Browse recordings with filters for date, team, participants, or external domains
- **📝 Full Transcripts** — Get speaker-labeled, timestamped transcripts formatted as markdown
- **📊 AI Summaries** — Access Fathom's AI-generated meeting summaries
- **✅ Action Items** — Pull action items from specific meetings or across recent calls
- **📁 Export to Markdown** — Save meetings as `MeetingTitle_YYYY-MM-DD.md` files
- **👥 Team Management** — List teams and team members
- **🔔 Webhooks** — Create and manage webhooks for real-time notifications

## Quick Start

### 1. Get Your Fathom API Key

1. Go to [Fathom Settings](https://fathom.video/settings)
2. Navigate to **API Access**
3. Click **Generate API Key**

### 2. Install the MCP Server

```bash
git clone https://github.com/matthewbergvinson/fathom-mcp.git
cd fathom-mcp
npm install
npm run build
```

### 3. Configure Cursor

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "fathom": {
      "command": "node",
      "args": ["/path/to/fathom-mcp/dist/index.js"],
      "env": {
        "FATHOM_API_KEY": "your-api-key-here",
        "FATHOM_OUTPUT_DIR": "/path/to/export/transcripts"
      }
    }
  }
}
```

> **Note:** Replace `/path/to/fathom-mcp` with the actual path where you cloned the repo, and add your Fathom API key.

### 4. Restart Cursor

Restart Cursor to load the MCP server. You can now use natural language to interact with your Fathom data:

- *"List my last 5 Fathom meetings"*
- *"Get the transcript from my call with John"*
- *"Export yesterday's meetings to markdown"*
- *"Show me action items from this week"*

## Available Tools

### Meeting Operations

| Tool | Description |
|------|-------------|
| `list_meetings` | List meetings with filters (date, team, external-only) |
| `get_meeting` | Get full meeting details including transcript, summary, actions |
| `get_transcript` | Get just the transcript formatted as markdown |
| `search_meetings` | Search by participant email, company domain, or team |

### Export Operations

| Tool | Description |
|------|-------------|
| `export_meeting` | Export single meeting to `MeetingTitle_YYYY-MM-DD.md` |
| `export_all_meetings` | Bulk export meetings with optional date filters |

### Action Items

| Tool | Description |
|------|-------------|
| `get_action_items` | Get action items from a specific meeting or recent calls |

### Team Management

| Tool | Description |
|------|-------------|
| `list_teams` | List all teams in your organization |
| `list_team_members` | List team members (optionally filtered by team) |

### Webhooks

| Tool | Description |
|------|-------------|
| `create_webhook` | Create webhook for new meeting notifications |
| `delete_webhook` | Delete an existing webhook |

## Tool Parameters

<details>
<summary><b>list_meetings</b></summary>

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max meetings to return (0 = all) |
| `created_after` | string | ISO 8601 timestamp filter |
| `created_before` | string | ISO 8601 timestamp filter |
| `include_external_only` | boolean | Only meetings with external participants |

</details>

<details>
<summary><b>get_meeting</b></summary>

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `recording_id` | number | Yes | The meeting's recording ID |
| `include_transcript` | boolean | No | Include transcript (default: true) |
| `include_summary` | boolean | No | Include AI summary (default: true) |
| `include_action_items` | boolean | No | Include action items (default: true) |
| `include_crm_matches` | boolean | No | Include CRM data (default: true) |

</details>

<details>
<summary><b>search_meetings</b></summary>

| Parameter | Type | Description |
|-----------|------|-------------|
| `participant_emails` | string[] | Filter by participant emails |
| `domains` | string[] | Filter by company domains (e.g., `acme.com`) |
| `teams` | string[] | Filter by team names |
| `created_after` | string | ISO 8601 timestamp |
| `created_before` | string | ISO 8601 timestamp |

</details>

<details>
<summary><b>export_meeting / export_all_meetings</b></summary>

| Parameter | Type | Description |
|-----------|------|-------------|
| `recording_id` | number | Meeting to export (export_meeting only) |
| `created_after` | string | Only export after this date |
| `created_before` | string | Only export before this date |
| `output_dir` | string | Custom output directory |

</details>

<details>
<summary><b>create_webhook</b></summary>

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `destination_url` | string | Yes | Webhook endpoint URL |
| `include_transcript` | boolean | No | Include transcript in payload |
| `include_summary` | boolean | No | Include summary in payload |
| `include_action_items` | boolean | No | Include action items |
| `include_crm_matches` | boolean | No | Include CRM data |
| `triggered_for` | string[] | No | Recording types that trigger webhook |

</details>

## Exported Transcript Format

Exported meetings are saved as markdown with:

- **Metadata table** — Date, duration, participants, Fathom links
- **AI Summary** — Fathom's generated summary
- **Action Items** — With assignees and completion status
- **Full Transcript** — Speaker-labeled with timestamps

Example filename: `Quarterly_Business_Review_2024-12-01.md`

```markdown
# Quarterly Business Review

## Meeting Details
| Field | Value |
|-------|-------|
| **Date** | Sunday, December 1, 2024 at 10:00 AM |
| **Duration** | 45m 32s |
| **Recorded by** | Jane Smith <jane@company.com> |

## Participants
- **John Doe** <john@client.com> _(external)_
- **Jane Smith** <jane@company.com>

## Summary
> Key discussion points and outcomes...

## Action Items
- [ ] Follow up on proposal _(assigned to Jane)_
- [x] Send meeting notes

## Transcript
**John Doe** _[00:00:15]_
> Thanks for joining today...
```

## Rate Limits

The Fathom API allows **60 requests per minute**. The MCP server handles this gracefully.

## Security

- API keys are stored in Cursor's MCP configuration (not in code)
- Never commit your `mcp.json` or API keys to version control
- Webhook secrets should be stored securely

## Troubleshooting

**MCP not loading?**
- Ensure you've restarted Cursor after editing `mcp.json`
- Check the path to `dist/index.js` is correct
- Verify your API key is valid

**"fetch failed" errors?**
- Ensure you're using Node.js 18 or higher
- Check your network connection
- Verify API key permissions in Fathom settings

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode for development
npm run dev
```

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

**Matthew Bergvinson**  
[Vigilante Consulting](https://vigilanteconsulting.com)

---

### Need Custom AI Tools Built Fast?

We build production-ready MCP servers, AI integrations, and automation tools for businesses.

📧 **[operations@vigilanteconsulting.com](mailto:operations@vigilanteconsulting.com)**

---

*This MCP server is not officially affiliated with Fathom Video, Inc.*
