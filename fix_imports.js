import fs from 'fs';

// 1. AdminApp.tsx
let content = fs.readFileSync('src/AdminApp.tsx', 'utf-8');
if (!content.includes('AdminLayout')) {
  content = content.replace(
    "import { ShieldCheck",
    "import { AdminLayout } from './components/admin/AdminLayout';\nimport { AdminDashboard } from './components/admin/AdminDashboard';\nimport { AdminAuditLog } from './components/admin/AdminAuditLog';\nimport { AdminPlaceholder } from './components/admin/AdminPlaceholder';\nimport { AdminStudents } from './components/admin/AdminStudents';\nimport { AdminProducts } from './components/admin/AdminProducts';\nimport { AdminSettings } from './components/admin/AdminSettings';\nimport { ShieldCheck"
  );
  fs.writeFileSync('src/AdminApp.tsx', content);
}

// 2. Utils imports in admin components
const fixUtils = (file) => {
  let c = fs.readFileSync(file, 'utf-8');
  c = c.replace("../../utils/api", "../../api");
  c = c.replace("../../hooks/useAuth", "../../AuthContext");
  fs.writeFileSync(file, c);
};

fixUtils('src/components/admin/AdminAuditLog.tsx');
fixUtils('src/components/admin/AdminDashboard.tsx');
fixUtils('src/components/admin/AdminLayout.tsx');
fixUtils('src/components/admin/AdminProducts.tsx');
fixUtils('src/components/admin/AdminSettings.tsx');
fixUtils('src/components/admin/AdminStudents.tsx');

// Fix AdminAuditLog date formatting
let auditLog = fs.readFileSync('src/components/admin/AdminAuditLog.tsx', 'utf-8');
auditLog = auditLog.replace("import { formatTimeAgo } from '../../utils/dateFormatting';", "");
auditLog = auditLog.replace("formatTimeAgo(log.timestamp)", "new Date(log.timestamp).toLocaleString()");
fs.writeFileSync('src/components/admin/AdminAuditLog.tsx', auditLog);

console.log("Imports fixed");
