'use client';

import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Outlet } from 'react-router-dom';

const PantheonTopologyLayout: FC = () => {
  return (
    <Flexbox flex={1} height={'100%'} width={'100%'}>
      <Outlet />
    </Flexbox>
  );
};

export default PantheonTopologyLayout;
