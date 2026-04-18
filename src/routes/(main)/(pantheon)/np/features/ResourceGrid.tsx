'use client';

import { ActionIcon, Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { App, Dropdown } from 'antd';
import { createStyles } from 'antd-style';
import { EllipsisIcon, ExternalLinkIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    cursor: default;

    display: flex;
    flex-direction: column;
    gap: 10px;

    min-height: 140px;
    padding: 16px;
    border-radius: 8px;

    background: ${token.colorBgElevated};
  `,
  description: css`
    font-size: 12px;
    color: ${token.colorTextDescription};
  `,
  empty: css`
    padding: 48px;
    color: ${token.colorTextTertiary};
    text-align: center;
  `,
  grid: css`
    display: grid;
    grid-gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));

    width: 100%;
    padding: 16px;
  `,
  link: css`
    overflow: hidden;

    font-size: 13px;
    color: ${token.colorLink};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  title: css`
    font-size: 14px;
    font-weight: 600;
  `,
}));

export interface NPResource {
  createdBy?: string | null;
  description?: string | null;
  id: string;
  sortOrder?: number | null;
  tags?: string[];
  title: string;
  url: string;
}

interface ResourceGridProps {
  onDelete: (res: NPResource) => void | Promise<void>;
  onEdit: (res: NPResource) => void;
  rows: NPResource[];
}

const openExternal = (url: string) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('[np.resources.open]', err);
  }
};

const ResourceGrid = memo<ResourceGridProps>(({ onDelete, onEdit, rows }) => {
  const { t } = useTranslation('pantheon');
  const { styles } = useStyles();
  const { modal } = App.useApp();

  const confirmDelete = (res: NPResource) => {
    modal.confirm({
      content: res.title,
      okButtonProps: { danger: true },
      okText: t('np.resources.rowActions.delete'),
      onOk: () => onDelete(res),
      title: t('np.resources.rowActions.delete'),
    });
  };

  if (rows.length === 0) {
    return (
      <Block className={styles.empty} variant={'filled'}>
        {t('np.resources.empty')}
      </Block>
    );
  }

  return (
    <div className={styles.grid}>
      {rows.map((res) => (
        <Block className={styles.card} key={res.id} variant={'outlined'}>
          <Flexbox horizontal align={'flex-start'} gap={8} justify={'space-between'}>
            <span className={styles.title}>{res.title}</span>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'open',
                    label: t('np.resources.rowActions.open'),
                    onClick: () => openExternal(res.url),
                  },
                  {
                    key: 'edit',
                    label: t('np.resources.rowActions.edit'),
                    onClick: () => onEdit(res),
                  },
                  {
                    danger: true,
                    key: 'delete',
                    label: t('np.resources.rowActions.delete'),
                    onClick: () => confirmDelete(res),
                  },
                ],
              }}
            >
              <ActionIcon icon={EllipsisIcon} size={'small'} />
            </Dropdown>
          </Flexbox>
          <a
            className={styles.link}
            href={res.url}
            rel={'noopener noreferrer'}
            target={'_blank'}
            title={res.url}
            onClick={(e) => {
              e.preventDefault();
              openExternal(res.url);
            }}
          >
            <Flexbox horizontal align={'center'} gap={4}>
              <ExternalLinkIcon size={12} />
              <span>{res.url}</span>
            </Flexbox>
          </a>
          {res.description && (
            <Text className={styles.description} ellipsis={{ rows: 3 }}>
              {res.description}
            </Text>
          )}
          {Array.isArray(res.tags) && res.tags.length > 0 && (
            <Flexbox horizontal gap={4} wrap={'wrap'}>
              {res.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Flexbox>
          )}
        </Block>
      ))}
    </div>
  );
});

ResourceGrid.displayName = 'ResourceGrid';

export default ResourceGrid;
