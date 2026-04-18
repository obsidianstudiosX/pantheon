'use client';

import { Block, Button, Flexbox, Text } from '@lobehub/ui';
import { App, Select } from 'antd';
import { createStyles } from 'antd-style';
import { SendIcon } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PANTHEON_AGENTS } from '@/config/pantheon/registry';

import { highlightPhi } from './phi-highlight';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  `,
  field: css`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  footer: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
  hint: css`
    font-size: 12px;
    color: ${token.colorTextTertiary};
  `,
  label: css`
    font-size: 12px;
    font-weight: 600;
    color: ${token.colorTextSecondary};
  `,
  preview: css`
    overflow: auto;

    max-height: 160px;
    padding: 8px;
    border: 1px dashed ${token.colorBorderSecondary};
    border-radius: 6px;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.55;
    white-space: pre-wrap;

    background: ${token.colorFillQuaternary};

    mark {
      padding: 0 2px;
      border-radius: 2px;

      color: ${token.colorErrorText};

      background: ${token.colorErrorBg};
    }
  `,
  textarea: css`
    resize: vertical;

    width: 100%;
    min-height: 220px;
    padding: 8px 10px;
    border: 1px solid ${token.colorBorder};
    border-radius: 6px;

    font-family: ${token.fontFamilyCode};
    font-size: 13px;
    line-height: 1.5;

    background: ${token.colorBgContainer};

    &:focus {
      border-color: ${token.colorPrimary};
      outline: none;
    }
  `,
}));

export interface SubmitFormValues {
  agentId: string;
  userText: string;
}

interface SubmitFormProps {
  /** Currently detected PHI types (live from the text while the operator types). */
  detectedPhi: readonly string[];
  /** Disable while submit is in flight. */
  loading?: boolean;
  /** Called on submit. */
  onSubmit: (values: SubmitFormValues) => Promise<void> | void;
  /** Called on text change so the parent can run PHI detection. */
  onTextChange: (text: string) => void;
  /** Current text value (controlled by parent so detectPhi stays in sync). */
  text: string;
}

// Default clinical agent — teresse-clinical — aligns with HANDOFF §8.
const DEFAULT_AGENT_ID = 'teresse-clinical';

const SubmitForm = memo<SubmitFormProps>(
  ({ detectedPhi, loading, onSubmit, onTextChange, text }) => {
    const { t } = useTranslation('pantheon');
    const { styles } = useStyles();
    const { message } = App.useApp();
    const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);

    const agentOptions = useMemo(
      () =>
        PANTHEON_AGENTS.map((a) => ({
          label: `${a.agent_id}${a.phi_aware ? '  [phi_aware]' : ''}`,
          value: a.agent_id,
        })),
      [],
    );

    const handleSubmit = useCallback(async () => {
      if (!text.trim()) {
        message.warning(t('chartReview.submit.emptyTextWarning'));
        return;
      }
      try {
        await onSubmit({ agentId, userText: text });
      } catch (err) {
        console.error('[chartReview.submit]', err);
        message.error(t('chartReview.submit.error'));
      }
    }, [agentId, onSubmit, text, message, t]);

    const highlighted = useMemo(() => highlightPhi(text), [text]);

    return (
      <Block className={styles.container} variant={'outlined'}>
        <Flexbox gap={4}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {t('chartReview.submit.sectionTitle')}
          </h3>
          <Text className={styles.hint} type={'secondary'}>
            {t('chartReview.submit.sectionHint')}
          </Text>
        </Flexbox>

        <div className={styles.field}>
          <span className={styles.label}>{t('chartReview.submit.textLabel')}</span>
          <textarea
            className={styles.textarea}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={t('chartReview.submit.textPlaceholder')}
            spellCheck={false}
            value={text}
          />
        </div>

        {text.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>
              {t('chartReview.submit.phiPreviewLabel')}{' '}
              {detectedPhi.length > 0 && (
                <span style={{ color: 'var(--color-error-text)' }}>
                  ({detectedPhi.join(', ')})
                </span>
              )}
            </span>
            <div
              className={styles.preview}
              // highlightPhi escapes + wraps matches in <mark>.
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}>{t('chartReview.submit.agentLabel')}</span>
          <Select
            onChange={(v) => setAgentId(v)}
            options={agentOptions}
            showSearch
            style={{ width: '100%' }}
            value={agentId}
          />
        </div>

        <div className={styles.footer}>
          <Text className={styles.hint} type={'secondary'}>
            {detectedPhi.length > 0
              ? t('chartReview.submit.phiWillPend')
              : t('chartReview.submit.noPhi')}
          </Text>
          <Button
            icon={SendIcon}
            loading={loading}
            onClick={handleSubmit}
            type={'primary'}
          >
            {t('chartReview.submit.button')}
          </Button>
        </div>
      </Block>
    );
  },
);

SubmitForm.displayName = 'SubmitForm';

export default SubmitForm;
