'use client';

import { type AuthorizationPhase, type AuthorizationProgress } from '@lobechat/electron-client-ipc';
import { useWatchBroadcast } from '@lobechat/electron-client-ipc';
import { Alert, Button, Center, Flexbox, Icon, Input, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Server, Undo2Icon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { OFFICIAL_SITE } from '@/const/url';
import { isDesktop } from '@/const/version';
import UserInfo from '@/features/User/UserInfo';
import { useIMECompositionEvent } from '@/hooks/useIMECompositionEvent';
import { remoteServerService } from '@/services/electron/remoteServer';
import { electronSystemService } from '@/services/electron/system';
import { useElectronStore } from '@/store/electron';

import LobeMessage from '../components/LobeMessage';

// --- Pantheon rebrand -----------------------------------------------------
// LobeHub Cloud sign-in has been removed. Pantheon desktop connects only to
// a user-configured server. The default URL below points at a local dev
// server and can be overridden via the DEFAULT_PANTHEON_SERVER_URL env var
// (picked up by the renderer at build time) or by DISABLE_LOBEHUB_CLOUD_AUTH
// for belt-and-suspenders gating.
const DEFAULT_PANTHEON_SERVER_URL =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.DEFAULT_PANTHEON_SERVER_URL ?? 'http://127.0.0.1:3210';

const LEGACY_LOCAL_DB_MIGRATION_GUIDE_URL = urlJoin(
  OFFICIAL_SITE,
  '/docs/usage/migrate-from-local-database',
);

type LoginStatus = 'idle' | 'loading' | 'success' | 'error';

const authorizationPhaseI18nKeyMap: Record<AuthorizationPhase, string> = {
  browser_opened: 'screen5.auth.phase.browserOpened',
  cancelled: 'screen5.actions.cancel',
  verifying: 'screen5.auth.phase.verifying',
  waiting_for_auth: 'screen5.auth.phase.waitingForAuth',
};

interface LoginStepProps {
  onBack: () => void;
  onNext: () => void;
}

const LoginStep = memo<LoginStepProps>(({ onBack, onNext }) => {
  const { t } = useTranslation('desktop-onboarding');
  const [endpoint, setEndpoint] = useState(DEFAULT_PANTHEON_SERVER_URL);
  const [authProgress, setAuthProgress] = useState<AuthorizationProgress | null>(null);
  const [selfhostLoginStatus, setSelfhostLoginStatus] = useState<LoginStatus>('idle');
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [hasLegacyLocalDb, setHasLegacyLocalDb] = useState(false);
  const [localRemainingSeconds, setLocalRemainingSeconds] = useState<number | null>(null);
  const { compositionProps, isComposingRef } = useIMECompositionEvent();

  const [
    dataSyncConfig,
    isConnectingServer,
    remoteServerSyncError,
    useDataSyncConfig,
    connectRemoteServer,
    refreshServerConfig,
    clearRemoteServerSyncError,
    disconnectRemoteServer,
  ] = useElectronStore((s) => [
    s.dataSyncConfig,
    s.isConnectingServer,
    s.remoteServerSyncError,
    s.useDataSyncConfig,
    s.connectRemoteServer,
    s.refreshServerConfig,
    s.clearRemoteServerSyncError,
    s.disconnectRemoteServer,
  ]);

  useDataSyncConfig();

  useEffect(() => {
    if (!isDesktop) return;

    let mounted = true;
    electronSystemService
      .hasLegacyLocalDb()
      .then((value) => {
        if (mounted) setHasLegacyLocalDb(value);
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  const isSelfHostAuthed = !!dataSyncConfig?.active && dataSyncConfig.storageMode === 'selfHost';
  const isSelfHostEndpointVerified =
    isSelfHostAuthed &&
    !!endpoint.trim() &&
    endpoint.trim() === (dataSyncConfig?.remoteServerUrl ?? '');

  const canStart = () => isSelfHostEndpointVerified;

  const handleSelfhostConnect = async () => {
    if (!isDesktop) {
      setRemoteError(t('screen5.errors.desktopOnlyOidc'));
      setSelfhostLoginStatus('error');
      return;
    }

    const url = endpoint.trim();
    if (!url) return;

    setRemoteError(null);
    clearRemoteServerSyncError();
    setSelfhostLoginStatus('loading');
    await connectRemoteServer({ remoteServerUrl: url, storageMode: 'selfHost' });
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    setRemoteError(null);
    clearRemoteServerSyncError();

    try {
      await disconnectRemoteServer();
      await refreshServerConfig();
    } finally {
      setSelfhostLoginStatus('idle');
      setEndpoint(DEFAULT_PANTHEON_SERVER_URL);
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    if (isSelfHostEndpointVerified) setSelfhostLoginStatus('success');
  }, [isSelfHostEndpointVerified]);

  useEffect(() => {
    if (selfhostLoginStatus !== 'success') return;
    if (isSelfHostEndpointVerified) return;
    setSelfhostLoginStatus('idle');
  }, [isSelfHostEndpointVerified, selfhostLoginStatus]);

  useEffect(() => {
    const message = remoteServerSyncError?.message;
    if (!message) return;
    setRemoteError(message);
    if (selfhostLoginStatus === 'loading') setSelfhostLoginStatus('error');
  }, [remoteServerSyncError?.message, selfhostLoginStatus]);

  useWatchBroadcast('authorizationSuccessful', async () => {
    setRemoteError(null);
    clearRemoteServerSyncError();
    setAuthProgress(null);
    await refreshServerConfig();
  });

  useWatchBroadcast('authorizationFailed', ({ error }) => {
    setRemoteError(error);
    setAuthProgress(null);
    if (selfhostLoginStatus === 'loading') setSelfhostLoginStatus('error');
  });

  useWatchBroadcast('authorizationProgress', (progress) => {
    setAuthProgress(progress);
    if (progress.phase === 'cancelled') {
      setSelfhostLoginStatus('idle');
      setAuthProgress(null);
    }
  });

  useEffect(() => {
    if (authProgress) {
      const seconds = Math.max(
        0,
        Math.ceil((authProgress.maxPollTime - authProgress.elapsed) / 1000),
      );
      setLocalRemainingSeconds(seconds);
    } else {
      setLocalRemainingSeconds(null);
    }
  }, [authProgress]);

  useEffect(() => {
    if (localRemainingSeconds === null || localRemainingSeconds <= 0) return;

    const timer = setTimeout(() => {
      setLocalRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [localRemainingSeconds]);

  const handleCancelAuth = async () => {
    setRemoteError(null);
    clearRemoteServerSyncError();

    setSelfhostLoginStatus('idle');
    setAuthProgress(null);
    await remoteServerService.cancelAuthorization();
  };

  const renderSelfhostContent = () => {
    if (selfhostLoginStatus === 'success') {
      return (
        <Flexbox gap={16} style={{ width: '100%' }}>
          <Alert
            description={t('authResult.success.desc')}
            style={{ width: '100%' }}
            title={t('authResult.success.title')}
            type={'success'}
          />
          <UserInfo
            style={{
              background: cssVar.colorFillSecondary,
              borderRadius: 8,
            }}
          />
          <Button
            block
            disabled={isSigningOut || isConnectingServer}
            icon={Server}
            size={'large'}
            type={'default'}
            onClick={handleSignOut}
          >
            {isSigningOut ? t('screen5.actions.signingOut') : t('screen5.actions.signOut')}
          </Button>
        </Flexbox>
      );
    }

    if (selfhostLoginStatus === 'error') {
      const errorMessage = remoteError?.toLowerCase().includes('timed out')
        ? t('screen5.errors.timedOut')
        : remoteError || t('authResult.failed.desc');

      return (
        <Flexbox gap={16} style={{ width: '100%' }}>
          <Alert
            description={errorMessage}
            title={t('authResult.failed.title')}
            type={'secondary'}
          />
          <Button icon={Server} type={'primary'} onClick={() => setSelfhostLoginStatus('idle')}>
            {t('screen5.actions.tryAgain')}
          </Button>
        </Flexbox>
      );
    }

    if (selfhostLoginStatus === 'loading') {
      const phaseText = t(authorizationPhaseI18nKeyMap[authProgress?.phase ?? 'browser_opened'], {
        defaultValue: t('screen5.actions.connecting'),
      });

      return (
        <Flexbox gap={8} style={{ width: '100%' }}>
          <Button
            block
            disabled={true}
            icon={Server}
            loading={true}
            size={'large'}
            type={'primary'}
          >
            {t('screen5.actions.connecting')}
          </Button>
          <Text style={{ color: cssVar.colorTextDescription }} type={'secondary'}>
            {phaseText}
          </Text>
          <Flexbox horizontal align={'center'} justify={'space-between'}>
            {localRemainingSeconds !== null ? (
              <Text style={{ color: cssVar.colorTextDescription }} type={'secondary'}>
                {t('screen5.auth.remaining', {
                  time: localRemainingSeconds,
                })}
              </Text>
            ) : (
              <div />
            )}
            <Button size={'small'} type={'text'} onClick={handleCancelAuth}>
              {t('screen5.actions.cancel')}
            </Button>
          </Flexbox>
        </Flexbox>
      );
    }

    return (
      <Flexbox gap={16} style={{ width: '100%' }}>
        <Text color={cssVar.colorTextSecondary}>{t('screen5.methods.selfhost.description')}</Text>
        <Input
          placeholder={t('screen5.selfhost.endpointPlaceholder')}
          prefix={<Icon icon={Server} style={{ marginRight: 4 }} />}
          size={'large'}
          style={{ width: '100%' }}
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          {...compositionProps}
          onContextMenu={async (e) => {
            if (!isDesktop) return;
            e.preventDefault();
            const { electronSystemService } = await import('@/services/electron/system');
            const input = e.target as HTMLInputElement;
            const selectionText = input.value.slice(
              input.selectionStart || 0,
              input.selectionEnd || 0,
            );
            await electronSystemService.showContextMenu('editor', {
              selectionText: selectionText || undefined,
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isComposingRef.current) {
              handleSelfhostConnect();
            }
          }}
        />
        <Button
          disabled={!endpoint.trim() || isConnectingServer}
          loading={false}
          size={'large'}
          style={{ width: '100%' }}
          type={'primary'}
          onClick={handleSelfhostConnect}
        >
          {t('screen5.actions.connectToServer')}
        </Button>
      </Flexbox>
    );
  };

  return (
    <Center gap={32} style={{ height: '100%', minHeight: '100%' }}>
      <Flexbox align={'flex-start'} justify={'flex-start'} style={{ width: '100%' }}>
        <LobeMessage sentences={[t('screen5.title'), t('screen5.title2'), t('screen5.title3')]} />
        <Text as={'p'}>{t('screen5.description')}</Text>
      </Flexbox>

      <Flexbox align={'flex-start'} gap={16} style={{ width: '100%' }} width={'100%'}>
        {renderSelfhostContent()}
        <Flexbox horizontal justify={'center'} style={{ width: '100%' }}>
          {hasLegacyLocalDb && (
            <Button
              style={{ padding: 0 }}
              type={'link'}
              onClick={() =>
                electronSystemService.openExternalLink(LEGACY_LOCAL_DB_MIGRATION_GUIDE_URL)
              }
            >
              {t('screen5.legacyLocalDb.link', 'Migrate legacy local database')}
            </Button>
          )}
        </Flexbox>
      </Flexbox>
      {canStart() && (
        <Flexbox horizontal justify={'space-between'} style={{ marginTop: 32 }}>
          <Button
            icon={Undo2Icon}
            style={{ color: cssVar.colorTextDescription }}
            type={'text'}
            onClick={onBack}
          >
            {t('back')}
          </Button>
          <Button type={'primary'} onClick={onNext}>
            {t('screen5.navigation.next')}
          </Button>
        </Flexbox>
      )}
    </Center>
  );
});

LoginStep.displayName = 'LoginStep';

export default LoginStep;
