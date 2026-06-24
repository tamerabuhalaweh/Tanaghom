import { describe, expect, it } from 'vitest';
import { resumeIdeaSelectionWorkflow, startIdeaSelectionWorkflow, type PostIdea } from './workflow';

const ideas: PostIdea[] = [
  {
    id: 'idea-a',
    title: 'Show the approval-first social operating model',
    hook: 'AI can move faster when the human gate is designed into the workflow.',
    platform: 'linkedin',
    format: 'carousel',
    hashtags: ['#socialmedia', '#marketing', '#ai'],
    estimatedReach: 'high',
    rationale: 'Business audience can understand value and safety quickly.',
  },
  {
    id: 'idea-b',
    title: 'Turn qualified engagement into CRM-ready leads',
    hook: 'The best social workflow does not stop at likes.',
    platform: 'instagram',
    format: 'short_video',
    hashtags: ['#leadgeneration', '#growth', '#crm'],
    estimatedReach: 'medium',
    rationale: 'Connects social output to commercial outcomes.',
  },
];

describe('post idea LangGraph workflow', () => {
  it('pauses for human selection and resumes with the selected idea', async () => {
    const threadId = 'test-post-idea-selection';

    const started = await startIdeaSelectionWorkflow({
      threadId,
      goal: 'Generate leads from the Commercial Social product',
      audience: 'CEOs and marketing directors',
      ideas,
    });

    expect(started.status).toBe('awaiting_human_selection');
    expect(started.interrupt).toMatchObject({
      action: 'select_post_idea',
      safety: {
        externalExecution: 'Blocked',
        m5: 'Disabled',
      },
    });

    const resumed = await resumeIdeaSelectionWorkflow({
      threadId,
      action: 'select',
      ideaId: 'idea-b',
      notes: 'Best for CRM handoff proof.',
    });

    expect(resumed.status).toBe('selected');
    expect(resumed.selectedIdeaId).toBe('idea-b');
    expect(resumed.reviewerNotes).toBe('Best for CRM handoff proof.');
  });

  it('can reject generated ideas without creating a selected idea', async () => {
    const threadId = 'test-post-idea-rejection';

    await startIdeaSelectionWorkflow({
      threadId,
      goal: 'Validate a rejected post idea path',
      audience: 'Marketing operators',
      ideas,
    });

    const resumed = await resumeIdeaSelectionWorkflow({
      threadId,
      action: 'reject',
      notes: 'Needs a better commercial angle.',
    });

    expect(resumed.status).toBe('rejected');
    expect(resumed.selectedIdeaId).toBeUndefined();
    expect(resumed.reviewerNotes).toBe('Needs a better commercial angle.');
  });
});
