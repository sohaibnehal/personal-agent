import type { Source } from '../types.js';
import type { NewRawItem } from '../../db/schema.js';
import { getCursor } from '../../db/cursors.js';

interface AsanaCursor {
  lastRunAt: string;
}

const BASE_URL = 'https://app.asana.com/api/1.0';
const OPT_FIELDS =
  'name,notes,permalink_url,modified_at,created_at,completed,assignee.name,assignee.email,projects.name';

function pat(): string {
  const p = process.env.ASANA_PAT;
  if (!p) throw new Error('ASANA_PAT missing');
  return p;
}

function workspaceGid(): string {
  const w = process.env.ASANA_WORKSPACE_GID;
  if (!w) throw new Error('ASANA_WORKSPACE_GID missing');
  return w;
}

async function asanaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${pat()}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`Asana ${res.status} ${res.statusText}: ${text}`), {
      status: res.status,
    });
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  permalink_url: string;
  modified_at: string;
  created_at: string;
  completed: boolean;
  assignee?: { name?: string; email?: string } | null;
  projects?: { name?: string }[];
}

function toRawItem(
  task: AsanaTask,
  kind: 'asana_assigned' | 'asana_following',
): Omit<NewRawItem, 'source' | 'account'> {
  return {
    externalId: task.gid,
    kind,
    title: task.name,
    snippet: (task.notes ?? '').slice(0, 280),
    url: task.permalink_url || `https://app.asana.com/0/0/${task.gid}/f`,
    occurredAt: new Date(task.modified_at),
    payload: {
      assignee: task.assignee?.name ?? 'unassigned',
      projects: (task.projects ?? [])
        .map((p) => p.name ?? '')
        .filter(Boolean)
        .join(', '),
      created_at: task.created_at,
      completed: task.completed,
    },
  };
}

export const asanaSource: Source = {
  name: 'asana',

  accounts() {
    return process.env.ASANA_PAT ? ['me'] : [];
  },

  async fetch(account) {
    const wsGid = workspaceGid();
    const prev = await getCursor<AsanaCursor>('asana', account);

    const since = prev?.lastRunAt
      ? prev.lastRunAt
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const me = await asanaGet<{ gid: string }>('/users/me');
    const meGid = me.gid;

    // Tasks assigned to me, modified since last run.
    const assignedParams = new URLSearchParams({
      assignee: meGid,
      workspace: wsGid,
      modified_since: since,
      completed_since: 'now',
      opt_fields: OPT_FIELDS,
    });
    const assigned = await asanaGet<AsanaTask[]>(`/tasks?${assignedParams}`);

    // Tasks I'm following (Asana's @mention proxy). Requires Premium — 402 on free tier.
    let following: AsanaTask[] = [];
    try {
      const searchParams = new URLSearchParams({
        'followers.any': meGid,
        'modified_at.after': since,
        completed: 'false',
        opt_fields: OPT_FIELDS,
      });
      following = await asanaGet<AsanaTask[]>(
        `/workspaces/${wsGid}/tasks/search?${searchParams}`,
      );
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if (status === 402) {
        console.warn('[asana] tasks/search requires Premium — skipping following tasks');
      } else {
        console.warn('[asana] tasks/search failed:', e instanceof Error ? e.message : e);
      }
    }

    // Dedupe across both sets by task gid; assigned wins on conflict.
    const seen = new Set<string>();
    const items: Omit<NewRawItem, 'source' | 'account'>[] = [];

    for (const task of assigned) {
      if (!seen.has(task.gid)) {
        seen.add(task.gid);
        items.push(toRawItem(task, 'asana_assigned'));
      }
    }
    for (const task of following) {
      if (!seen.has(task.gid)) {
        seen.add(task.gid);
        items.push(toRawItem(task, 'asana_following'));
      }
    }

    return {
      items,
      nextCursor: { lastRunAt: new Date().toISOString() } satisfies AsanaCursor,
    };
  },
};
