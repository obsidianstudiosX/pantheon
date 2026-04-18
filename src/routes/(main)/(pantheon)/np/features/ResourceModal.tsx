'use client';

import { Modal } from '@lobehub/ui';
import { App, Form, Input, InputNumber, Select } from 'antd';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface NPResourceFormValues {
  description?: string | null;
  sortOrder?: number;
  tags?: string[];
  title: string;
  url: string;
}

interface ResourceModalProps {
  initialValues?: Partial<NPResourceFormValues> & { id?: string };
  onCancel: () => void;
  onSubmit: (values: NPResourceFormValues, id?: string) => Promise<void> | void;
  open: boolean;
}

const DEFAULTS: NPResourceFormValues = {
  description: '',
  sortOrder: 0,
  tags: [],
  title: '',
  url: '',
};

const ResourceModal = memo<ResourceModalProps>(({ open, onCancel, onSubmit, initialValues }) => {
  const { t } = useTranslation('pantheon');
  const { message } = App.useApp();
  const [form] = Form.useForm<NPResourceFormValues>();

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
      console.error('[np.resource.modal.submit]', error);
      message.error(t('np.resources.error'));
    }
  };

  return (
    <Modal
      destroyOnHidden
      okText={isEdit ? t('np.resources.modal.save') : t('np.resources.modal.create')}
      open={open}
      title={isEdit ? t('np.resources.modal.editTitle') : t('np.resources.modal.createTitle')}
      width={480}
      onCancel={onCancel}
      onOk={handleOk}
    >
      <Form autoComplete="off" form={form} initialValues={DEFAULTS} layout="vertical">
        <Form.Item
          label={t('np.resources.form.title')}
          name="title"
          rules={[{ message: t('np.resources.form.titlePlaceholder'), required: true }]}
        >
          <Input maxLength={255} placeholder={t('np.resources.form.titlePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('np.resources.form.url')}
          name="url"
          rules={[
            { message: t('np.resources.form.urlPlaceholder'), required: true },
            { message: t('np.resources.form.urlInvalid'), type: 'url' },
          ]}
        >
          <Input placeholder={t('np.resources.form.urlPlaceholder')} />
        </Form.Item>

        <Form.Item label={t('np.resources.form.description')} name="description">
          <Input.TextArea
            autoSize={{ maxRows: 6, minRows: 2 }}
            placeholder={t('np.resources.form.descriptionPlaceholder')}
          />
        </Form.Item>

        <Form.Item label={t('np.resources.form.tags')} name="tags">
          <Select
            mode={'tags'}
            placeholder={t('np.resources.form.tagsPlaceholder')}
            style={{ width: '100%' }}
            tokenSeparators={[',', ' ']}
          />
        </Form.Item>

        <Form.Item label={t('np.resources.form.sortOrder')} name="sortOrder">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
});

ResourceModal.displayName = 'ResourceModal';

export default ResourceModal;
