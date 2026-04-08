import { NextRequest, NextResponse } from 'next/server';
import { updateDraftStatus } from '@/lib/supabase/queries';
import { replyInThread } from '@/lib/slack/client';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const payloadStr = formData.get('payload') as string;

  if (!payloadStr) {
    return NextResponse.json({ error: 'No payload' }, { status: 400 });
  }

  const payload = JSON.parse(payloadStr);

  // Handle block actions (button clicks)
  if (payload.type === 'block_actions') {
    for (const action of payload.actions || []) {
      const [actionType, draftId] = (action.value || '').split(':');

      if (draftId) {
        switch (actionType) {
          case 'approve':
            await updateDraftStatus(draftId, 'approved', {
              approved_by: payload.user?.id,
            });
            await replyInThread(
              payload.channel?.id,
              payload.message?.ts,
              ':white_check_mark: Approved and queued for publishing.'
            );
            break;

          case 'reject':
            await updateDraftStatus(draftId, 'rejected', {
              approved_by: payload.user?.id,
            });
            await replyInThread(
              payload.channel?.id,
              payload.message?.ts,
              ':x: Rejected.'
            );
            break;

          case 'revise':
            await updateDraftStatus(draftId, 'revision_requested');
            await replyInThread(
              payload.channel?.id,
              payload.message?.ts,
              ':pencil2: Revision requested. Reply in this thread with your notes and I will regenerate.'
            );
            break;
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
