'use client';

import { Modal } from '@lobehub/ui';
import { App, Form, Input, Select } from 'antd';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { SnapshotRow } from './SnapshotList';

export interface CaptureFormValues {
  label: string;
  parentSnapshotId?: string | null;
}

interface CaptureModalProps {
  existingSnapshots: SnapshotRow[];
  onCancel: () => void;
  onSubmit: (values: CaptureFormValues) => Promise<void> | void;
  open: boolean;
}

const DEFAULTS: CaptureFormValues = {
  label: '',
  parentSnapshotId: null,
};

/**
 * Capture modal — freezes the selected agent's current config into a new
 * named snapshot. Optional parent pointer establishes lineage for the diff
 * UI (e.g. "this snapshot was taken after restoring snapshot X").
 */
const CaptureModal = memo<CaptureModalProps>(
  ({ open, onCancel, onSubmit, existingSnapshots }) => {
    const { t } = useTranslation('pantheon');
    const { message } = App.useApp();
    const [form] = Form.useForm<CaptureFormValues>();

    useEffect(() => {
      if (open) {
        form.setFieldsValue(DEFAULTS);
      }
    }, [open, form]);

    const handleOk = async () => {
      try {
        const values = await form.validateFields();
        await onSubmit(values);
        form.resetFields();
        onCancel();
      } catch (error) {
        if ((error as { errorFields?: unknown }).errorFields) return;
        console.error('[snapshots.modal.submit]', error);
        message.error(t('snapshots.error'));
      }
    };

    const parentOptions = existingSnapshots.map((s) => ({
      label: s.label,
      value: s.id,
    }));

    return (
      <Modal
        destroyOnHidden
        okText={t('snapshots.capture')}
        open={open}
        title={t('snapshots.modal.capture')}
        width={480}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Form autoComplete="off" form={form} initialValues={DEFAULTS} layout="vertical">
          <Form.Item
            label={t('snapshots.form.label')}
            name="label"
            rules={[{ message: t('snapshots.form.labelPlaceholder'), required: true }]}
          >
            <Input maxLength={255} placeholder={t('snapshots.form.labelPlaceholder')} />
          </Form.Item>

          <Form.Item label={t('snapshots.form.parent')} name="parentSnapshotId">
            <Select
              allowClear
              options={parentOptions}
              placeholder={t('snapshots.form.parentPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

CaptureModal.displayName = 'CaptureModal';

export default CaptureModal;
