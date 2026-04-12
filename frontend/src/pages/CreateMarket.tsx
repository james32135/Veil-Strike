import { CreateEventForm } from '@/components/create';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/shared/Card';

export default function CreateMarket() {
  return (
    <div>
      <PageHeader
        title="Create Event Market"
        subtitle="Launch a prediction market on any real-world event — fully private on Aleo"
      />

      <div className="max-w-2xl mx-auto mt-6">
        <Card className="p-6">
          <CreateEventForm />
        </Card>
        <p className="text-xs text-smoke/40 text-center mt-4">
          Strike Rounds are created automatically every 5 minutes by the Round Bot.
        </p>
      </div>
    </div>
  );
}
