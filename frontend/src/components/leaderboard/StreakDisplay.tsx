import { FireIcon, TrophyIcon } from '@/components/icons';
import Card from '@/components/shared/Card';

interface StreakDisplayProps {
  currentStreak: number;
  bestStreak: number;
}

export default function StreakDisplay({ currentStreak, bestStreak }: StreakDisplayProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
          <FireIcon className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-heading font-semibold text-white">Win Streak</h3>
          <p className="text-[10px] text-gray-600">Consecutive winning trades</p>
        </div>
      </div>

      <div className="flex items-end gap-6">
        <div>
          <p className="text-3xl font-mono font-bold text-amber-400">{currentStreak}</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Current</p>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <TrophyIcon className="w-3.5 h-3.5 text-amber-400/60" />
            <p className="text-lg font-mono font-bold text-gray-400">{bestStreak}</p>
          </div>
          <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-1">Best</p>
        </div>
      </div>

      {currentStreak >= 3 && (
        <div className="mt-4 p-2.5 bg-amber-400/5 rounded-lg border border-amber-400/10">
          <p className="text-[10px] text-amber-400">
            🔥 You&apos;re on fire! {currentStreak} wins in a row
          </p>
        </div>
      )}
    </Card>
  );
}
