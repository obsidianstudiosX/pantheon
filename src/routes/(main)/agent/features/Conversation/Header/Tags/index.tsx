import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { VRMAvatarChip } from '@/features/VRMAvatar';
import { useAgentStore } from '@/store/agent';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useSessionStore } from '@/store/session';
import { sessionSelectors } from '@/store/session/selectors';

import FolderTag from './FolderTag';
import MemberCountTag from './MemberCountTag';

/**
 * Feature flag for per-agent VRM avatar rendering (sub-project #5).
 * Gated so the shell can ship the component tree without forcing the
 * lobe-vidol / three-vrm runtime cost until operator approves the npm deps.
 *
 * Reading both public env shapes for cross-bundler parity (Vite + Next).
 */
const VRM_AVATARS_ENABLED =
  (typeof process !== 'undefined' &&
    (process.env?.NEXT_PUBLIC_VRM_AVATARS === '1' ||
      process.env?.VITE_PUBLIC_VRM_AVATARS === '1')) ||
  false;

const TitleTags = memo(() => {
  const { t } = useTranslation('topic');
  const topicTitle = useChatStore((s) => topicSelectors.currentActiveTopic(s)?.title);
  const isGroupSession = useSessionStore(sessionSelectors.isCurrentSessionGroupSession);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  if (isGroupSession) {
    return (
      <Flexbox horizontal align={'center'} gap={12}>
        <MemberCountTag />
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align={'center'} gap={8}>
      {VRM_AVATARS_ENABLED && activeAgentId ? (
        <VRMAvatarChip agentSlug={activeAgentId} size={32} />
      ) : null}
      <span
        style={{
          color: cssVar.colorText,
          fontSize: 14,
          fontWeight: 600,
          marginLeft: 8,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {topicTitle || t('newTopic')}
      </span>
      <FolderTag />
    </Flexbox>
  );
});

export default TitleTags;
