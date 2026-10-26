import React from 'react';
import { MobileAppShell } from '../layouts/MobileAppShell';
import { DriverAppView } from '../components/driver/DriverAppView';

export const DriverAppPage: React.FC = () => {
  return (
    <MobileAppShell>
      <DriverAppView />
    </MobileAppShell>
  );
};

