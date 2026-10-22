import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../services/resilientFetch';
export function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    fetchJson('/api/admin/products').then(({data}) => {
      setProducts((data as any)?.products || []);
    });
  }, []);
  return (
    <div className="p-8">
      <h2 className="text-2xl font-black mb-4">Products & Pricing</h2>
      <div className="space-y-4">
        {products.map(p => (
          <div key={p.id} className="p-4 border border-line rounded bg-white">
            <h3 className="font-bold">{p.name}</h3>
            <p>{p.price} {p.currency}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
