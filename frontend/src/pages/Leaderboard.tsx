import { LeaderboardTable, StreakDisplay } from '@/components/leaderboard';
import PageHeader from '@/components/layout/PageHeader';

// Leaderboard data is derived from on-chain trading records — starts empty on fresh deployment
const leaderboard: import('@/types').LeaderboardEntry[] = [];

export default function Leaderboard() {
  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Top traders ranked by profit and loss"
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        <div className="lg:col-span-3">
          <LeaderboardTable entries={leaderboard} />
        </div>
        <div>
          <StreakDisplay currentStreak={0} bestStreak={0} />
        </div>
      </div>
    </div>
  );
}
