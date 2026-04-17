'use client';

import { Modal } from '@lobehub/ui';
import { App, Form, Input, InputNumber, Select } from 'antd';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface KanbanCardFormValues {
  description?: string | null;
  priority?: number;
  status?: 'backlog' | 'in-progress' | 'done';
  title: string;
}

interface CreateCardModalProps {
  initialValues?: Partial<KanbanCardFormValues> & { id?: string };
  onCancel: () => void;
  onSubmit: (values: KanbanCardFormValues, cardId?: string) => Promise<void> | void;
  open: boolean;
}

const DEFAULTS: KanbanCardFormValues = {
  description: '',
  priority: 0,
  status: 'backlog',
  title: '',
};

/**
 * Create/edit modal for a Work Rail kanban card. Shared for both flows —
 * when `initialValues.id` is present it renders as "Edit", otherwise "Create".
 */
const CreateCardModal = memo<CreateCardModalProps>(
  ({ open, onCancel, onSubmit, initialValues }) => {
    const { t } = useTranslation('pantheon');
    const { message } = App.useApp();
    const [form] = Form.useForm<KanbanCardFormValues>();

    const isEdit = Boolean(initialValues?.id);

    useEffect(() => {
      if (open) {
        form.setFieldsValue({ ...DEFAULTS, ...initialValues });
      }
    }, [open, initialValues, form]);

    const handleOk = async () => {
      try {
        const values = await form.validateFields();
        await onSubmit(values, initialValues?.id);
        form.resetFields();
        onCancel();
      } catch (error) {
        if ((error as { errorFields?: unknown }).errorFields) return;
        console.error('[kanban.modal.submit]', error);
        message.error(t('kanban.error'));
      }
    };

    return (
      <Modal
        destroyOnHidden
        okText={isEdit ? t('kanban.rowActions.edit') : t('kanban.addCard')}
        open={open}
        title={isEdit ? t('kanban.modal.edit') : t('kanban.modal.create')}
        width={480}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Form autoComplete="off" form={form} initialValues={DEFAULTS} layout="vertical">
          <Form.Item
            label={t('kanban.form.title')}
            name="title"
            rules={[{ message: t('kanban.form.titlePlaceholder'), required: true }]}
          >
            <Input maxLength={255} placeholder={t('kanban.form.titlePlaceholder')} />
          </Form.Item>

          <Form.Item label={t('kanban.form.description')} name="description">
            <Input.TextArea
              autoSize={{ maxRows: 8, minRows: 3 }}
              placeholder={t('kanban.form.descriptionPlaceholder')}
            />
          </Form.Item>

          <Form.Item label={t('kanban.form.status')} name="status">
            <Select
              options={[
                { label: t('kanban.columns.backlog'), value: 'backlog' },
                { label: t('kanban.columns.inProgress'), value: 'in-progress' },
                { label: t('kanban.columns.done'), value: 'done' },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('kanban.form.priority')} name="priority">
            <InputNumber max={3} min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

CreateCardModal.displayName = 'CreateCardModal';

export default CreateCardModal;
