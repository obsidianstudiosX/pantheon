'use client';

import { Modal } from '@lobehub/ui';
import { App, Form, Input, Select } from 'antd';
import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { NPSubmissionStatus } from './SubmissionList';

export interface NPSubmissionFormValues {
  externalTrackingId?: string | null;
  patientInitials?: string | null;
  status?: NPSubmissionStatus;
  submissionText?: string | null;
  submittedBy?: string | null;
  title: string;
}

interface SubmissionModalProps {
  initialValues?: Partial<NPSubmissionFormValues> & { id?: string };
  onCancel: () => void;
  onSubmit: (values: NPSubmissionFormValues, id?: string) => Promise<void> | void;
  open: boolean;
}

const DEFAULTS: NPSubmissionFormValues = {
  externalTrackingId: '',
  patientInitials: '',
  status: 'draft',
  submissionText: '',
  submittedBy: '',
  title: '',
};

const INITIALS_PATTERN = /^[A-Z.\- ]*$/i;

const SubmissionModal = memo<SubmissionModalProps>(
  ({ open, onCancel, onSubmit, initialValues }) => {
    const { t } = useTranslation('pantheon');
    const { message } = App.useApp();
    const [form] = Form.useForm<NPSubmissionFormValues>();

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
        console.error('[np.submission.modal.submit]', error);
        message.error(t('np.submissions.error'));
      }
    };

    return (
      <Modal
        destroyOnHidden
        okText={isEdit ? t('np.submissions.modal.save') : t('np.submissions.modal.create')}
        open={open}
        width={560}
        title={isEdit ? t('np.submissions.modal.editTitle') : t('np.submissions.modal.createTitle')}
        onCancel={onCancel}
        onOk={handleOk}
      >
        <Form autoComplete="off" form={form} initialValues={DEFAULTS} layout="vertical">
          <Form.Item
            label={t('np.submissions.form.title')}
            name="title"
            rules={[{ message: t('np.submissions.form.titlePlaceholder'), required: true }]}
          >
            <Input maxLength={255} placeholder={t('np.submissions.form.titlePlaceholder')} />
          </Form.Item>

          <Form.Item
            extra={t('np.submissions.form.patientInitialsHelp')}
            label={t('np.submissions.form.patientInitials')}
            name="patientInitials"
            rules={[
              { max: 8, message: t('np.submissions.form.patientInitialsHelp') },
              {
                message: t('np.submissions.form.patientInitialsHelp'),
                validator: (_, value: string) => {
                  if (!value) return Promise.resolve();
                  return INITIALS_PATTERN.test(value)
                    ? Promise.resolve()
                    : Promise.reject(new Error('bad initials'));
                },
              },
            ]}
          >
            <Input
              maxLength={8}
              placeholder={t('np.submissions.form.patientInitialsPlaceholder')}
            />
          </Form.Item>

          <Form.Item label={t('np.submissions.form.submittedBy')} name="submittedBy">
            <Input maxLength={255} placeholder={t('np.submissions.form.submittedByPlaceholder')} />
          </Form.Item>

          <Form.Item label={t('np.submissions.form.submissionText')} name="submissionText">
            <Input.TextArea
              autoSize={{ maxRows: 10, minRows: 4 }}
              placeholder={t('np.submissions.form.submissionTextPlaceholder')}
            />
          </Form.Item>

          <Form.Item label={t('np.submissions.form.status')} name="status">
            <Select
              options={[
                { label: t('np.submissions.status.draft'), value: 'draft' },
                { label: t('np.submissions.status.submitted'), value: 'submitted' },
                { label: t('np.submissions.status.completed'), value: 'completed' },
              ]}
            />
          </Form.Item>

          <Form.Item label={t('np.submissions.form.trackingId')} name="externalTrackingId">
            <Input maxLength={255} placeholder={t('np.submissions.form.trackingIdPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    );
  },
);

SubmissionModal.displayName = 'SubmissionModal';

export default SubmissionModal;
