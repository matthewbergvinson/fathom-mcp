#!/usr/bin/env node
/**
 * Fathom MCP Server
 * 
 * A Model Context Protocol server for Fathom.video
 * Provides tools to access meetings, transcripts, summaries, action items, and more
 * 
 * @author Matthew Bergvinson <operations@vigilanteconsulting.com>
 * @license MIT
 * @see https://github.com/matthewbergvinson/fathom-mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { FathomClient } from './fathom-client.js';
import {
  formatMeetingToMarkdown,
  formatMeetingList,
  formatTranscriptToMarkdown,
  formatActionItems,
  generateTranscriptFilename,
  formatDate,
} from './formatters.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Get configuration from environment
const API_KEY = process.env.FATHOM_API_KEY;
const OUTPUT_DIR = process.env.FATHOM_OUTPUT_DIR 
  ? `${process.env.FATHOM_OUTPUT_DIR}/transcripts`
  : `${process.cwd()}/transcripts`;

// Validate API key on startup
if (!API_KEY) {
  console.error('Error: FATHOM_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize Fathom client
const fathom = new FathomClient(API_KEY);

// Create MCP server using McpServer class (same as postmark-mcp)
const server = new McpServer({
  name: 'fathom-mcp',
  version: '1.0.0',
});

console.error('Initializing Fathom MCP server...');

// ============================================================================
// TOOL: list_meetings
// ============================================================================
server.tool(
  'list_meetings',
  {
    limit: z.number().optional().describe('Maximum number of meetings to return (default: 10, use 0 for all)'),
    created_after: z.string().optional().describe('ISO 8601 timestamp - only return meetings after this date'),
    created_before: z.string().optional().describe('ISO 8601 timestamp - only return meetings before this date'),
    include_external_only: z.boolean().optional().describe('Only include meetings with external participants'),
  },
  async ({ limit, created_after, created_before, include_external_only }) => {
    console.error('Fetching meetings...');
    
    const response = await fathom.listMeetings({
      created_after,
      created_before,
      calendar_invitees_domains_type: include_external_only ? 'one_or_more_external' : undefined,
    });

    let meetings = response.items;
    if (limit && limit > 0) {
      meetings = meetings.slice(0, limit);
    }

    console.error(`Found ${meetings.length} meetings`);
    const markdown = formatMeetingList(meetings);
    
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

// ============================================================================
// TOOL: get_meeting
// ============================================================================
server.tool(
  'get_meeting',
  {
    recording_id: z.number().describe('The recording ID of the meeting to retrieve'),
    include_transcript: z.boolean().optional().describe('Include the full transcript (default: true)'),
    include_summary: z.boolean().optional().describe('Include the AI summary (default: true)'),
    include_action_items: z.boolean().optional().describe('Include action items (default: true)'),
    include_crm_matches: z.boolean().optional().describe('Include CRM matches (default: true)'),
  },
  async ({ recording_id, include_transcript, include_summary, include_action_items, include_crm_matches }) => {
    console.error(`Fetching meeting ${recording_id}...`);
    
    const response = await fathom.listMeetings({
      include_transcript: include_transcript !== false,
      include_summary: include_summary !== false,
      include_action_items: include_action_items !== false,
      include_crm_matches: include_crm_matches !== false,
    });

    const meeting = response.items.find(m => m.recording_id === recording_id);
    if (!meeting) {
      return {
        content: [{ type: 'text', text: `Meeting with recording ID ${recording_id} not found.` }],
        isError: true,
      };
    }

    console.error(`Found meeting: ${meeting.title}`);
    const markdown = formatMeetingToMarkdown(meeting);
    
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

// ============================================================================
// TOOL: get_transcript
// ============================================================================
server.tool(
  'get_transcript',
  {
    recording_id: z.number().describe('The recording ID of the meeting'),
  },
  async ({ recording_id }) => {
    console.error(`Fetching transcript for ${recording_id}...`);
    
    const response = await fathom.getTranscript(recording_id);
    const markdown = formatTranscriptToMarkdown(response.transcript);
    
    console.error('Transcript retrieved');
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

// ============================================================================
// TOOL: export_meeting
// ============================================================================
server.tool(
  'export_meeting',
  {
    recording_id: z.number().describe('The recording ID of the meeting to export'),
    output_dir: z.string().optional().describe('Directory to save the file (defaults to workspace/transcripts)'),
  },
  async ({ recording_id, output_dir }) => {
    const targetDir = output_dir || OUTPUT_DIR;
    console.error(`Exporting meeting ${recording_id} to ${targetDir}...`);
    
    const response = await fathom.listMeetings({
      include_transcript: true,
      include_summary: true,
      include_action_items: true,
      include_crm_matches: true,
    });

    const meeting = response.items.find(m => m.recording_id === recording_id);
    if (!meeting) {
      return {
        content: [{ type: 'text', text: `Meeting with recording ID ${recording_id} not found.` }],
        isError: true,
      };
    }

    const markdown = formatMeetingToMarkdown(meeting);
    const filename = generateTranscriptFilename(meeting);
    const filepath = path.join(targetDir, filename);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(filepath, markdown, 'utf-8');

    console.error(`Exported: ${filename}`);
    return {
      content: [{ type: 'text', text: `Exported meeting to: ${filepath}` }],
    };
  }
);

// ============================================================================
// TOOL: export_all_meetings
// ============================================================================
server.tool(
  'export_all_meetings',
  {
    created_after: z.string().optional().describe('ISO 8601 timestamp - only export meetings after this date'),
    created_before: z.string().optional().describe('ISO 8601 timestamp - only export meetings before this date'),
    output_dir: z.string().optional().describe('Directory to save files (defaults to workspace/transcripts)'),
  },
  async ({ created_after, created_before, output_dir }) => {
    const targetDir = output_dir || OUTPUT_DIR;
    console.error(`Exporting all meetings to ${targetDir}...`);
    
    const meetings = await fathom.getAllMeetings({
      include_transcript: true,
      include_summary: true,
      include_action_items: true,
      include_crm_matches: true,
      created_after,
      created_before,
    });

    await fs.mkdir(targetDir, { recursive: true });

    const exported: string[] = [];
    for (const meeting of meetings) {
      const markdown = formatMeetingToMarkdown(meeting);
      const filename = generateTranscriptFilename(meeting);
      const filepath = path.join(targetDir, filename);
      await fs.writeFile(filepath, markdown, 'utf-8');
      exported.push(filename);
      console.error(`Exported: ${filename}`);
    }

    return {
      content: [{
        type: 'text',
        text: `Exported ${exported.length} meetings to ${targetDir}:\n${exported.map(f => `- ${f}`).join('\n')}`,
      }],
    };
  }
);

// ============================================================================
// TOOL: search_meetings
// ============================================================================
server.tool(
  'search_meetings',
  {
    participant_emails: z.array(z.string()).optional().describe('Email addresses of participants to search for'),
    domains: z.array(z.string()).optional().describe('Company domains to search for (e.g., acme.com)'),
    teams: z.array(z.string()).optional().describe('Team names to filter by'),
    created_after: z.string().optional().describe('ISO 8601 timestamp'),
    created_before: z.string().optional().describe('ISO 8601 timestamp'),
  },
  async ({ participant_emails, domains, teams, created_after, created_before }) => {
    console.error('Searching meetings...');
    
    const response = await fathom.listMeetings({
      calendar_invitees: participant_emails,
      calendar_invitees_domains: domains,
      teams,
      created_after,
      created_before,
    });

    console.error(`Found ${response.items.length} meetings`);
    const markdown = formatMeetingList(response.items);
    
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

// ============================================================================
// TOOL: get_action_items
// ============================================================================
server.tool(
  'get_action_items',
  {
    recording_id: z.number().optional().describe('Get action items from a specific meeting'),
    include_completed: z.boolean().optional().describe('Include completed action items (default: true)'),
    limit: z.number().optional().describe('Number of recent meetings to check if no recording_id (default: 10)'),
  },
  async ({ recording_id, include_completed, limit }) => {
    const meetingLimit = limit || 10;
    console.error(recording_id ? `Getting action items for ${recording_id}...` : `Getting action items from recent meetings...`);

    if (recording_id) {
      const response = await fathom.listMeetings({ include_action_items: true });
      const meeting = response.items.find(m => m.recording_id === recording_id);

      if (!meeting) {
        return {
          content: [{ type: 'text', text: `Meeting with recording ID ${recording_id} not found.` }],
          isError: true,
        };
      }

      let items = meeting.action_items || [];
      if (include_completed === false) {
        items = items.filter(i => !i.completed);
      }

      const title = meeting.title || meeting.meeting_title || `Meeting ${meeting.recording_id}`;
      const markdown = `## Action Items from: ${title}\n\n${formatActionItems(items)}`;
      
      return {
        content: [{ type: 'text', text: markdown }],
      };
    } else {
      const response = await fathom.listMeetings({ include_action_items: true });
      const meetings = response.items.slice(0, meetingLimit);

      const sections: string[] = [];
      for (const meeting of meetings) {
        let items = meeting.action_items || [];
        if (items.length === 0) continue;

        if (include_completed === false) {
          items = items.filter(i => !i.completed);
        }
        if (items.length === 0) continue;

        const title = meeting.title || meeting.meeting_title || `Meeting ${meeting.recording_id}`;
        const date = formatDate(meeting.recording_start_time);
        sections.push(`### ${title}\n_${date}_\n\n${formatActionItems(items)}`);
      }

      const markdown = sections.length > 0
        ? `# Action Items from Recent Meetings\n\n${sections.join('\n\n')}`
        : 'No action items found in recent meetings.';

      return {
        content: [{ type: 'text', text: markdown }],
      };
    }
  }
);

// ============================================================================
// TOOL: list_teams
// ============================================================================
server.tool(
  'list_teams',
  {},
  async () => {
    console.error('Fetching teams...');
    const teams = await fathom.getAllTeams();

    if (teams.length === 0) {
      return {
        content: [{ type: 'text', text: 'No teams found.' }],
      };
    }

    const markdown = teams.map(t => {
      const created = formatDate(t.created_at);
      return `- **${t.name}** (created: ${created})`;
    }).join('\n');

    console.error(`Found ${teams.length} teams`);
    return {
      content: [{ type: 'text', text: `# Teams\n\n${markdown}` }],
    };
  }
);

// ============================================================================
// TOOL: list_team_members
// ============================================================================
server.tool(
  'list_team_members',
  {
    team: z.string().optional().describe('Filter by team name'),
  },
  async ({ team }) => {
    console.error(team ? `Fetching members for team: ${team}...` : 'Fetching all team members...');
    const members = await fathom.getAllTeamMembers(team);

    if (members.length === 0) {
      return {
        content: [{ type: 'text', text: team ? `No members found in team "${team}".` : 'No team members found.' }],
      };
    }

    const markdown = members.map(m => `- **${m.name}** <${m.email}>`).join('\n');
    const title = team ? `Team Members: ${team}` : 'All Team Members';

    console.error(`Found ${members.length} members`);
    return {
      content: [{ type: 'text', text: `# ${title}\n\n${markdown}` }],
    };
  }
);

// ============================================================================
// TOOL: create_webhook
// ============================================================================
server.tool(
  'create_webhook',
  {
    destination_url: z.string().describe('URL to receive webhook events'),
    include_transcript: z.boolean().optional().describe('Include transcript in webhook payload'),
    include_summary: z.boolean().optional().describe('Include summary in webhook payload'),
    include_action_items: z.boolean().optional().describe('Include action items in webhook payload'),
    include_crm_matches: z.boolean().optional().describe('Include CRM matches in webhook payload'),
    triggered_for: z.array(z.enum(['my_recordings', 'shared_external_recordings', 'my_shared_with_team_recordings', 'shared_team_recordings'])).optional().describe('Which recordings trigger the webhook'),
  },
  async ({ destination_url, include_transcript, include_summary, include_action_items, include_crm_matches, triggered_for }) => {
    console.error(`Creating webhook for ${destination_url}...`);
    
    const webhook = await fathom.createWebhook({
      destination_url,
      include_transcript,
      include_summary,
      include_action_items,
      include_crm_matches,
      triggered_for,
    });

    const markdown = `# Webhook Created Successfully\n\n| Field | Value |\n|-------|-------|\n| **ID** | ${webhook.id} |\n| **URL** | ${webhook.url} |\n| **Secret** | \`${webhook.secret}\` |\n| **Include Transcript** | ${webhook.include_transcript} |\n| **Include Summary** | ${webhook.include_summary} |\n| **Include Action Items** | ${webhook.include_action_items} |\n| **Include CRM Matches** | ${webhook.include_crm_matches} |\n| **Triggered For** | ${webhook.triggered_for.join(', ')} |\n\n**Important:** Save the webhook secret securely - you'll need it to verify incoming webhooks.`;

    console.error(`Webhook created: ${webhook.id}`);
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

// ============================================================================
// TOOL: delete_webhook
// ============================================================================
server.tool(
  'delete_webhook',
  {
    webhook_id: z.string().describe('The ID of the webhook to delete'),
  },
  async ({ webhook_id }) => {
    console.error(`Deleting webhook ${webhook_id}...`);
    await fathom.deleteWebhook(webhook_id);
    
    console.error('Webhook deleted');
    return {
      content: [{ type: 'text', text: `Webhook ${webhook_id} deleted successfully.` }],
    };
  }
);

// ============================================================================
// START SERVER
// ============================================================================
async function main() {
  console.error('Connecting to MCP transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Fathom MCP server is running and ready!');
}

// Global error handlers (same as postmark-mcp)
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason instanceof Error ? reason.message : reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('Server initialization failed:', error.message);
  process.exit(1);
});
