/**
 * Formatting utilities for Fathom data
 * Converts API responses to beautiful markdown
 * 
 * @author Matthew Bergvinson <operations@vigilanteconsulting.com>
 * @license MIT
 */

import type { Meeting, TranscriptItem, ActionItem, CalendarInvitee, CRMMatches } from './fathom-client.js';

/**
 * Sanitize a string for use as a filename
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .replace(/_+/g, '_')          // Collapse multiple underscores
    .replace(/^_|_$/g, '')        // Trim underscores from ends
    .substring(0, 100);           // Limit length
}

/**
 * Generate filename for a meeting transcript
 * Format: MeetingTitle_YYYY-MM-DD.md
 */
export function generateTranscriptFilename(meeting: Meeting): string {
  const title = meeting.title || meeting.meeting_title || `Meeting_${meeting.recording_id}`;
  const sanitizedTitle = sanitizeFilename(title);
  const date = new Date(meeting.recording_start_time);
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `${sanitizedTitle}_${dateStr}.md`;
}

/**
 * Format a timestamp for display (HH:MM:SS -> more readable)
 */
export function formatTimestamp(timestamp: string): string {
  return timestamp; // Keep as HH:MM:SS for clarity
}

/**
 * Format duration between two ISO timestamps
 */
export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();
  
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Format a date for display
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format transcript items to markdown
 */
export function formatTranscriptToMarkdown(transcript: TranscriptItem[]): string {
  if (!transcript || transcript.length === 0) {
    return '_No transcript available_';
  }

  const lines: string[] = [];
  let currentSpeaker = '';

  for (const item of transcript) {
    const speakerName = item.speaker.display_name || 'Unknown Speaker';
    
    // Add speaker header when speaker changes
    if (speakerName !== currentSpeaker) {
      currentSpeaker = speakerName;
      lines.push('');
      lines.push(`**${speakerName}** _[${formatTimestamp(item.timestamp)}]_`);
    }
    
    lines.push(`> ${item.text}`);
  }

  return lines.join('\n');
}

/**
 * Format participants list
 */
export function formatParticipants(invitees: CalendarInvitee[]): string {
  if (!invitees || invitees.length === 0) {
    return '_No participants listed_';
  }

  return invitees.map(inv => {
    const external = inv.is_external ? ' _(external)_' : '';
    return `- **${inv.name}** <${inv.email}>${external}`;
  }).join('\n');
}

/**
 * Format action items to markdown
 */
export function formatActionItems(actionItems: ActionItem[] | null | undefined): string {
  if (!actionItems || actionItems.length === 0) {
    return '_No action items_';
  }

  return actionItems.map(item => {
    const status = item.completed ? '[x]' : '[ ]';
    const assignee = item.assignee ? ` _(assigned to ${item.assignee.name})_` : '';
    const timestamp = item.recording_timestamp ? ` at ${item.recording_timestamp}` : '';
    return `- ${status} ${item.description}${assignee}${timestamp}`;
  }).join('\n');
}

/**
 * Format CRM matches
 */
export function formatCRMMatches(crm: CRMMatches | null | undefined): string {
  if (!crm) {
    return '_No CRM data_';
  }

  const sections: string[] = [];

  if (crm.contacts && crm.contacts.length > 0) {
    sections.push('**Contacts:**');
    crm.contacts.forEach(c => {
      sections.push(`- [${c.name}](${c.record_url}) <${c.email}>`);
    });
  }

  if (crm.companies && crm.companies.length > 0) {
    sections.push('**Companies:**');
    crm.companies.forEach(c => {
      sections.push(`- [${c.name}](${c.record_url})`);
    });
  }

  if (crm.deals && crm.deals.length > 0) {
    sections.push('**Deals:**');
    crm.deals.forEach(d => {
      sections.push(`- [${d.name}](${d.record_url}) - $${d.amount.toLocaleString()}`);
    });
  }

  return sections.length > 0 ? sections.join('\n') : '_No CRM data_';
}

/**
 * Format a complete meeting to markdown document
 */
export function formatMeetingToMarkdown(meeting: Meeting): string {
  const sections: string[] = [];

  // Header
  const title = meeting.title || meeting.meeting_title || `Meeting ${meeting.recording_id}`;
  sections.push(`# ${title}`);
  sections.push('');

  // Metadata
  sections.push('## Meeting Details');
  sections.push('');
  sections.push(`| Field | Value |`);
  sections.push(`|-------|-------|`);
  sections.push(`| **Date** | ${formatDate(meeting.recording_start_time)} |`);
  sections.push(`| **Duration** | ${formatDuration(meeting.recording_start_time, meeting.recording_end_time)} |`);
  sections.push(`| **Recorded by** | ${meeting.recorded_by.name} <${meeting.recorded_by.email}> |`);
  sections.push(`| **Recording ID** | ${meeting.recording_id} |`);
  sections.push(`| **Fathom URL** | [View Recording](${meeting.url}) |`);
  sections.push(`| **Share URL** | [Share Link](${meeting.share_url}) |`);
  sections.push('');

  // Participants
  sections.push('## Participants');
  sections.push('');
  sections.push(formatParticipants(meeting.calendar_invitees));
  sections.push('');

  // Summary (if available)
  if (meeting.default_summary) {
    sections.push('## Summary');
    sections.push('');
    sections.push(meeting.default_summary.markdown_formatted);
    sections.push('');
  }

  // Action Items (if available)
  if (meeting.action_items && meeting.action_items.length > 0) {
    sections.push('## Action Items');
    sections.push('');
    sections.push(formatActionItems(meeting.action_items));
    sections.push('');
  }

  // CRM Matches (if available)
  if (meeting.crm_matches) {
    sections.push('## CRM Matches');
    sections.push('');
    sections.push(formatCRMMatches(meeting.crm_matches));
    sections.push('');
  }

  // Transcript
  sections.push('## Transcript');
  sections.push('');
  sections.push(formatTranscriptToMarkdown(meeting.transcript || []));
  sections.push('');

  // Footer
  sections.push('---');
  sections.push(`_Exported from Fathom.video on ${new Date().toISOString()}_`);

  return sections.join('\n');
}

/**
 * Format meeting list for display
 */
export function formatMeetingList(meetings: Meeting[]): string {
  if (meetings.length === 0) {
    return 'No meetings found.';
  }

  const rows = meetings.map(m => {
    const title = m.title || m.meeting_title || `Meeting ${m.recording_id}`;
    const date = formatDate(m.recording_start_time);
    const duration = formatDuration(m.recording_start_time, m.recording_end_time);
    const recorder = m.recorded_by.name;
    const participants = m.calendar_invitees.length;
    
    return `| ${title} | ${date} | ${duration} | ${recorder} | ${participants} | ${m.recording_id} |`;
  });

  return [
    '| Title | Date | Duration | Recorded By | Participants | ID |',
    '|-------|------|----------|-------------|--------------|-----|',
    ...rows,
  ].join('\n');
}
