'use client';

import { Modal, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

const useStyles = createStyles(({ css, token }) => ({
  changed: css`
    padding: 8px 12px;
    border-inline-start: 3px solid ${token.colorWarning};
    border-radius: 4px;

    background: ${token.colorWarningBg};
  `,
  codeBlock: css`
    overflow-x: auto;

    margin: 4px 0 0;
    padding: 6px 8px;
    border-radius: 4px;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    white-space: pre-wrap;

    background: ${token.colorFillQuaternary};
  `,
  empty: css`
    padding: 24px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  error: css`
    padding: 16px;
    color: ${token.colorErrorText};
    text-align: center;
  `,
  section: css`
    margin-bottom: 16px;

    h4 {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
    }
  `,
}));

interface DiffModalProps {
  aId: string;
  bId: string;
  onClose: () => void;
  open: boolean;
}

interface DiffResult {
  added: string[];
  changed: Array<{ after: unknown; before: unknown; field: string }>;
  removed: string[];
}

const renderValue = (v: unknown) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
};

const DiffModal = memo<DiffModalProps>(({ open, onClose, aId, bId }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();

  const { data, error, isLoading } = useSWR<DiffResult>(
    open ? ['pantheon-snapshot-diff', aId, bId] : null,
    async () => {
      return await lambdaClient.pantheon.snapshots.diff.query({ aId, bId });
    },
    { revalidateOnFocus: true },
  );

  const isEmpty =
    data &&
    data.added.length === 0 &&
    data.removed.length === 0 &&
    data.changed.length === 0;

  return (
    <Modal
      destroyOnHidden
      footer={null}
      onCancel={onClose}
      open={open}
      title={t('snapshots.modal.diff')}
      width={720}
    >
      {isLoading && <div className={styles.empty}>{t('snapshots.diffLoading')}</div>}
      {error && <div className={styles.error}>{t('snapshots.error')}</div>}
      {data && isEmpty && <div className={styles.empty}>{t('snapshots.diffNoChanges')}</div>}
      {data && !isEmpty && (
        <div>
          {data.added.length > 0 && (
            <section className={styles.section}>
              <h4>
                <Tag color={'green'}>+</Tag> {t('snapshots.diff.added', { count: data.added.length })}
              </h4>
              {data.added.map((k) => (
                <div key={k}>
                  <Text>{k}</Text>
                </div>
              ))}
            </section>
          )}
          {data.removed.length > 0 && (
            <section className={styles.section}>
              <h4>
                <Tag color={'red'}>-</Tag>{' '}
                {t('snapshots.diff.removed', { count: data.removed.length })}
              </h4>
              {data.removed.map((k) => (
                <div key={k}>
                  <Text>{k}</Text>
                </div>
              ))}
            </section>
          )}
          {data.changed.length > 0 && (
            <section className={styles.section}>
              <h4>
                <Tag color={'orange'}>~</Tag>{' '}
                {t('snapshots.diff.changed', { count: data.changed.length })}
              </h4>
              {data.changed.map((c) => (
                <div className={styles.changed} key={c.field} style={{ marginBottom: 8 }}>
                  <Text strong>{c.field}</Text>
                  <pre className={styles.codeBlock}>- {renderValue(c.before)}</pre>
                  <pre className={styles.codeBlock}>+ {renderValue(c.after)}</pre>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
});

DiffModal.displayName = 'DiffModal';

export default DiffModal;
