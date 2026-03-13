import { useState } from 'react';
import { CreateEventForm, CreateLightningForm } from '@/components/create';
import PageHeader from '@/components/layout/PageHeader';
import Tabs from '@/components/shared/Tabs';
import Card from '@/components/shared/Card';

export default function CreateMarket() {
  const [type, setType] = useState('event');

  const tabs = [
    { id: 'event', label: 'Event Market' },
    { id: 'lightning', label: '⚡ Lightning Market' },
  ];

  return (
    <div>
      <PageHeader
        title="Create Market"
        subtitle="Launch a new prediction market on Aleo with full privacy"
      />

      <div className="max-w-2xl mx-auto mt-6">
        <Tabs tabs={tabs} activeTab={type} onChange={setType} />

        <Card className="p-6 mt-4">
          {type === 'event' && <CreateEventForm />}
          {type === 'lightning' && <CreateLightningForm />}
        </Card>
      </div>
    </div>
  );
}
