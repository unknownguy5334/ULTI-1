import React from 'react';

export function AdminPlaceholder({ title, description }: { title: string, description?: string }) {
  return (
    <div className="p-8 space-y-6 animate-in fade-in">
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <p className="text-text-secondary max-w-2xl">
        {description || `This is the dedicated management console for ${title}.`}
      </p>
      
      <div className="bg-paper border border-line rounded-2xl p-12 text-center shadow-sm">
        <h3 className="text-lg font-bold mb-2">Module Active</h3>
        <p className="text-text-secondary text-sm">
          Operational infrastructure for this module is monitored centrally.
        </p>
      </div>
    </div>
  );
}
