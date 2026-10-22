import React, { useEffect, useState } from 'react';
import { fetchJson } from '../../services/resilientFetch';
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
