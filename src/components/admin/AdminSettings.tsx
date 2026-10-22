import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../services/resilientFetch';
export function AdminSettings() {
  const [ctx, setCtx] = useState<any>(null);
  useEffect(() => {
    fetchJson('/api/admin/academic-context').then(({data}) => setCtx(data));
  }, []);
  return (
    <div className="p-8">
      <h2 className="text-2xl font-black mb-4">Global Configuration</h2>
      {ctx ? <pre className="bg-mist p-4 rounded text-xs">{JSON.stringify(ctx, null, 2)}</pre> : 'Loading...'}
    </div>
  );
}
