/**
 * Batch translate programme activities into site-level task titles via
 * Claude Sonnet 4.6 (per CLAUDE.md §2).
 *
 * Single API call per window generation, structured output via
 * output_config.format with a JSON schema. System prompt is cached —
 * subsequent generations in the same project/session hit the cache.
 */
import Anthropic from '@anthropic-ai/sdk';
import { FEW_SHOT_EXAMPLES, TRANSLATION_SYSTEM_PROMPT } from './prompts';
import type { SelectedActivity } from './select-activities';

export type Translation = { activityId: string; taskTitle: string };

function compactActivity(a: SelectedActivity): Record<string, unknown> {
  return {
    activity_id: a.externalId ?? a.id,
    name: a.name,
    start: a.startDate,
    finish: a.finishDate,
    remaining: a.remainingDurationDays,
    is_milestone: a.activityType === 'milestone',
    by_others: a.byOthers,
  };
}

export async function translateActivitiesToTasks(
  activitiesIn: SelectedActivity[],
): Promise<Translation[]> {
  if (activitiesIn.length === 0) return [];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const client = new Anthropic({ apiKey });

  const user = [
    'Translate each of the activities below.',
    '',
    'Respond with ONLY a JSON object of the shape:',
    '{ "translations": [{"activityId": "...", "taskTitle": "..."}, ...] }',
    '',
    'The activityId in each output must match the activity_id in the input. No prose, no markdown fences.',
    '',
    'Activities:',
    JSON.stringify(
      activitiesIn.map((a) => compactActivity(a)),
      null,
      2,
    ),
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: TRANSLATION_SYSTEM_PROMPT + '\n\n' + FEW_SHOT_EXAMPLES,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: user }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude response contained no text block');
  }

  // Claude may wrap JSON in ```json fences despite the instruction; strip them.
  const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  let parsed: { translations: Translation[] };
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Claude returned non-JSON: ${(e as Error).message}. Raw: ${textBlock.text.slice(0, 300)}`,
    );
  }

  // Build a map from Claude's activityId (which equals the input activity_id
  // = externalId or uuid) back to the real activity UUID.
  const idLookup = new Map<string, string>();
  for (const a of activitiesIn) {
    idLookup.set(a.externalId ?? a.id, a.id);
  }

  const out: Translation[] = [];
  for (const t of parsed.translations) {
    const realId = idLookup.get(t.activityId);
    if (!realId) continue; // hallucinated id — drop
    out.push({ activityId: realId, taskTitle: t.taskTitle.trim() });
  }
  return out;
}
