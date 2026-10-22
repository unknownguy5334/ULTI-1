#!/bin/bash
mkdir -p src/components/admin

cat << 'INNER' > src/components/admin/AdminStudents.tsx
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../utils/api';
export function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    fetchJson('/api/admin/students?search=' + search).then(({data}) => {
      setStudents((data as any)?.students || []);
    });
  }, [search]);
  return (
    <div className="p-8">
      <h2 className="text-2xl font-black mb-4">Students Directory</h2>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="w-full p-2 border border-line rounded mb-4"/>
      <div className="bg-white border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm"><thead className="bg-mist p-2"><tr><th>Email</th><th>Role</th><th>Created</th></tr></thead>
        <tbody>
          {students.map(s => <tr key={s.id}><td>{s.email}</td><td>{s.role}</td><td>{s.createdAt}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
INNER

cat << 'INNER' > src/components/admin/AdminProducts.tsx
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../utils/api';
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
INNER

# Do this for Payment Methods, Academic context
cat << 'INNER' > src/components/admin/AdminSettings.tsx
import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../utils/api';
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
INNER

