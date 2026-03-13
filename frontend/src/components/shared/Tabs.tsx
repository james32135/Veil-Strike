type TabItem = string | { id: string; label: string };

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex items-center gap-1 p-1 bg-dark-200/50 rounded-xl ${className}`}>
      {tabs.map((tab) => {
        const id = typeof tab === 'string' ? tab : tab.id;
        const label = typeof tab === 'string' ? tab : tab.label;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`
              px-4 py-2 text-sm font-heading font-medium rounded-lg transition-all duration-200
              ${
                activeTab === id
                  ? 'bg-dark-300 text-teal shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }
            `}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
