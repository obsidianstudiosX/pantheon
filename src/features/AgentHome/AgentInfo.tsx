'use client';

import { Avatar, Flexbox, Markdown, Skeleton, Text } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_AVATAR, DEFAULT_INBOX_AVATAR } from '@/const/meta';
import { VRMAvatar } from '@/features/VRMAvatar';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/slices/settings/selectors';

/**
 * Pantheon sub-project #5: feature-flag for VRM avatars.
 *
 * Mirrors the check in routes/(main)/agent/features/Conversation/Header/Tags
 * so enabling `NEXT_PUBLIC_VRM_AVATARS=1` toggles every injection point at
 * once. The server bakes this env var into the build (see Dockerfile) so the
 * flag never leaks the VRM runtime cost into the default production image.
 */
const VRM_AVATARS_ENABLED =
  (typeof process !== 'undefined' &&
    (process.env?.NEXT_PUBLIC_VRM_AVATARS === '1' ||
      process.env?.VITE_PUBLIC_VRM_AVATARS === '1')) ||
  false;

const AgentInfo = memo(() => {
  const { t } = useTranslation(['chat', 'welcome']);
  const isLoading = useAgentStore(agentSelectors.isAgentConfigLoading);
  const isInbox = useAgentStore(builtinAgentSelectors.isInboxAgent);
  const meta = useAgentStore(agentSelectors.currentAgentMeta, isEqual);
  const openingMessage = useAgentStore(agentSelectors.openingMessage);
  const fontSize = useUserStore(userGeneralSettingsSelectors.fontSize);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  const displayTitle = isInbox
    ? meta.title || 'Lobe AI'
    : meta.title || t('defaultSession', { ns: 'common' });

  const message = useMemo(() => {
    if (openingMessage) return openingMessage;
    return t('agentDefaultMessageWithSystemRole', {
      name: displayTitle,
    });
  }, [openingMessage, displayTitle, t]);

  if (isLoading) {
    return (
      <Flexbox gap={12}>
        <Skeleton.Avatar active shape={'square'} size={64} />
        <Skeleton.Button active style={{ height: 32, width: 200 }} />
        <Flexbox width={'min(100%, 640px)'}>
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </Flexbox>
      </Flexbox>
    );
  }

  // Pantheon #5: when the VRM flag is on and we have a real agent slug
  // (activeAgentId is set after the session resolver runs) render the VRM
  // viewer at a larger size than the chat-header chip — this is the agent
  // "welcome / select" surface per design §3. Non-inbox only; the inbox has
  // no manifest binding.
  const showVrm = VRM_AVATARS_ENABLED && !isInbox && typeof activeAgentId === 'string';

  return (
    <Flexbox gap={12}>
      {showVrm ? (
        <VRMAvatar
          idle
          agentSlug={activeAgentId as string}
          size={128}
          style={{ alignSelf: 'center' }}
        />
      ) : (
        <Avatar
          avatar={isInbox ? meta.avatar || DEFAULT_INBOX_AVATAR : meta.avatar || DEFAULT_AVATAR}
          background={meta.backgroundColor}
          shape={'square'}
          size={64}
        />
      )}
      <Text fontSize={24} weight={'bold'}>
        {displayTitle}
      </Text>
      <Flexbox width={'min(100%, 640px)'}>
        <Markdown fontSize={fontSize} variant={'chat'}>
          {message}
        </Markdown>
      </Flexbox>
    </Flexbox>
  );
});

export default AgentInfo;
