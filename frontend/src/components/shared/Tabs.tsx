import { motion } from 'framer-motion';

type TabItem = string | { id: string; label: string };

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`nav-pill ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`relative ${isActive ? 'active' : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
