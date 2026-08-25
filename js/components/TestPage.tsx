import React from 'react';
import { Button, theme } from 'lx_client';

export const TestPage: React.FC = () => {
  return (
    <div style={{ padding: theme.spacing.medium }}>
      <h1>Test Page</h1>
      <Button label="Click Me" onClick={() => console.log('Clicked')} />
    </div>
  );
};
