/**
 * Fathom API Client
 * Handles all communication with the Fathom.video API
 * 
 * @author Matthew Bergvinson <operations@vigilanteconsulting.com>
 * @license MIT
 */

const FATHOM_API_BASE = 'https://api.fathom.ai/external/v1';

// Types for Fathom API responses
export interface Speaker {
  display_name: string;
  matched_calendar_invitee_email?: string | null;
}

export interface TranscriptItem {
  speaker: Speaker;
  text: string;
  timestamp: string;
}

export interface MeetingSummary {
  template_name: string;
  markdown_formatted: string;
}

export interface ActionItem {
  description: string;
  user_generated: boolean;
  completed: boolean;
  recording_timestamp: string;
  recording_playback_url: string;
  assignee?: {
    name: string;
    email: string;
    team?: string;
  };
}

export interface CalendarInvitee {
  name: string;
  matched_speaker_display_name?: string;
  email: string;
  is_external: boolean;
  email_domain: string;
}

export interface FathomUser {
  name: string;
  email: string;
  team?: string;
  email_domain: string;
}

export interface CRMContact {
  name: string;
  email: string;
  record_url: string;
}

export interface CRMCompany {
  name: string;
  record_url: string;
}

export interface CRMDeal {
  name: string;
  amount: number;
  record_url: string;
}

export interface CRMMatches {
  contacts?: CRMContact[];
  companies?: CRMCompany[];
  deals?: CRMDeal[];
}

export interface Meeting {
  title: string;
  meeting_title?: string | null;
  recording_id: number;
  url: string;
  share_url: string;
  created_at: string;
  scheduled_start_time: string;
  scheduled_end_time: string;
  recording_start_time: string;
  recording_end_time: string;
  calendar_invitees_domains_type: 'only_internal' | 'one_or_more_external';
  transcript_language?: string;
  transcript?: TranscriptItem[] | null;
  default_summary?: MeetingSummary | null;
  action_items?: ActionItem[] | null;
  calendar_invitees: CalendarInvitee[];
  recorded_by: FathomUser;
  crm_matches?: CRMMatches | null;
}

export interface MeetingsResponse {
  limit?: number;
  next_cursor?: string | null;
  items: Meeting[];
}

export interface TranscriptResponse {
  transcript: TranscriptItem[];
}

export interface Team {
  name: string;
  created_at: string;
}

export interface TeamsResponse {
  limit?: number;
  next_cursor?: string | null;
  items: Team[];
}

export interface TeamMember {
  name: string;
  email: string;
  created_at: string;
}

export interface TeamMembersResponse {
  limit?: number;
  next_cursor?: string | null;
  items: TeamMember[];
}

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  created_at: string;
  include_transcript: boolean;
  include_crm_matches: boolean;
  include_summary: boolean;
  include_action_items: boolean;
  triggered_for: string[];
}

export interface ListMeetingsParams {
  include_transcript?: boolean;
  include_summary?: boolean;
  include_action_items?: boolean;
  include_crm_matches?: boolean;
  created_after?: string;
  created_before?: string;
  recorded_by?: string[];
  teams?: string[];
  calendar_invitees?: string[];
  calendar_invitees_domains?: string[];
  calendar_invitees_domains_type?: 'all' | 'only_internal' | 'one_or_more_external';
  cursor?: string;
}

export interface CreateWebhookParams {
  destination_url: string;
  include_transcript?: boolean;
  include_summary?: boolean;
  include_action_items?: boolean;
  include_crm_matches?: boolean;
  triggered_for?: ('my_recordings' | 'shared_external_recordings' | 'my_shared_with_team_recordings' | 'shared_team_recordings')[];
}

export class FathomClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${FATHOM_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fathom API error (${response.status}): ${errorText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * List meetings with optional filters
   */
  async listMeetings(params: ListMeetingsParams = {}): Promise<MeetingsResponse> {
    const searchParams = new URLSearchParams();
    
    if (params.include_transcript) searchParams.append('include_transcript', 'true');
    if (params.include_summary) searchParams.append('include_summary', 'true');
    if (params.include_action_items) searchParams.append('include_action_items', 'true');
    if (params.include_crm_matches) searchParams.append('include_crm_matches', 'true');
    if (params.created_after) searchParams.append('created_after', params.created_after);
    if (params.created_before) searchParams.append('created_before', params.created_before);
    if (params.cursor) searchParams.append('cursor', params.cursor);
    if (params.calendar_invitees_domains_type) {
      searchParams.append('calendar_invitees_domains_type', params.calendar_invitees_domains_type);
    }
    
    // Handle array params
    params.recorded_by?.forEach(email => searchParams.append('recorded_by[]', email));
    params.teams?.forEach(team => searchParams.append('teams[]', team));
    params.calendar_invitees?.forEach(email => searchParams.append('calendar_invitees[]', email));
    params.calendar_invitees_domains?.forEach(domain => searchParams.append('calendar_invitees_domains[]', domain));

    const queryString = searchParams.toString();
    const endpoint = `/meetings${queryString ? `?${queryString}` : ''}`;
    
    return this.request<MeetingsResponse>(endpoint);
  }

  /**
   * Get all meetings (handles pagination automatically)
   */
  async getAllMeetings(params: Omit<ListMeetingsParams, 'cursor'> = {}): Promise<Meeting[]> {
    const allMeetings: Meeting[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const response = await this.listMeetings({ ...params, cursor: cursor || undefined });
      allMeetings.push(...response.items);
      cursor = response.next_cursor;
    } while (cursor);

    return allMeetings;
  }

  /**
   * Get transcript for a specific recording
   */
  async getTranscript(recordingId: number): Promise<TranscriptResponse> {
    return this.request<TranscriptResponse>(`/recordings/${recordingId}/transcript`);
  }

  /**
   * List all teams
   */
  async listTeams(cursor?: string): Promise<TeamsResponse> {
    const endpoint = cursor ? `/teams?cursor=${cursor}` : '/teams';
    return this.request<TeamsResponse>(endpoint);
  }

  /**
   * Get all teams (handles pagination)
   */
  async getAllTeams(): Promise<Team[]> {
    const allTeams: Team[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const response = await this.listTeams(cursor || undefined);
      allTeams.push(...response.items);
      cursor = response.next_cursor;
    } while (cursor);

    return allTeams;
  }

  /**
   * List team members
   */
  async listTeamMembers(team?: string, cursor?: string): Promise<TeamMembersResponse> {
    const params = new URLSearchParams();
    if (team) params.append('team', team);
    if (cursor) params.append('cursor', cursor);
    
    const queryString = params.toString();
    const endpoint = `/team_members${queryString ? `?${queryString}` : ''}`;
    
    return this.request<TeamMembersResponse>(endpoint);
  }

  /**
   * Get all team members (handles pagination)
   */
  async getAllTeamMembers(team?: string): Promise<TeamMember[]> {
    const allMembers: TeamMember[] = [];
    let cursor: string | null | undefined = undefined;

    do {
      const response = await this.listTeamMembers(team, cursor || undefined);
      allMembers.push(...response.items);
      cursor = response.next_cursor;
    } while (cursor);

    return allMembers;
  }

  /**
   * Create a webhook
   */
  async createWebhook(params: CreateWebhookParams): Promise<Webhook> {
    return this.request<Webhook>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request<void>(`/webhooks/${webhookId}`, {
      method: 'DELETE',
    });
  }
}
