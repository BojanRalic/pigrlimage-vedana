'use client'

export default function Tabs({ activeTab, onTabChange, selectedCount }) {
  const tabs = [
    { id: 'pilgrimage', label: 'Pilgrimage Village' },
    { id: 'vedana', label: 'Vedana Lagoon' },
    { id: 'chosen', label: `Chosen photos${selectedCount > 0 ? ` (${selectedCount})` : ''}` },
  ]

  return (
    <div className="flex gap-1 p-1 bg-teal-900/10 rounded-full w-fit mx-auto flex-wrap justify-center">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-teal-800 text-cream-50 shadow-sm'
              : 'text-teal-700 hover:text-teal-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
