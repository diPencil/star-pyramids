'use client'

import { useMemo, useState } from 'react'
import { Check, Circle, Pencil, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { permissionRows, roleLabels, staff } from '@/components/admin/admin-data'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'

const cols = [
  { key: 'super', label: 'Super' }, { key: 'tours', label: 'Tours' }, { key: 'content', label: 'Content' },
  { key: 'support', label: 'Support' }, { key: 'accounts', label: 'Accounts' }, { key: 'viewer', label: 'View' },
] as const

export default function UsersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const rows = useMemo(() => staff.filter((member) => role === 'all' || member.role === role).filter((member) => `${member.name} ${member.nameAr} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())), [query, role])
  const staffSort = useAdminTableSort(rows, {
    member: (member) => member.name,
    role: (member) => roleLabels[member.role],
    email: (member) => member.email,
    status: (member) => member.online,
  }, 'member', 'asc')
  const paging = usePagination(staffSort.sortedRows)
  const permissionSort = useAdminTableSort(permissionRows, {
    module: (row) => row.module,
    super: (row) => row.super,
    tours: (row) => row.tours,
    content: (row) => row.content,
    support: (row) => row.support,
    accounts: (row) => row.accounts,
    viewer: (row) => row.viewer,
  }, 'module', 'asc')
  const roles = [...new Set(staff.map((member) => member.role))]

  return <>
    <PageHead eyebrow="Team" title="Users & Roles" titleAr="المستخدمون والصلاحيات" sub="Team access, operational roles and module permissions" subAr="وصول الفريق والأدوار التشغيلية وصلاحيات الوحدات" actions={<button type="button" className="sp-btn primary"><Plus size={17} /> <AdminText en="Invite staff" ar="دعوة موظف" /></button>} />
    <AdminStats items={[
      { label: <AdminText en="Staff members" ar="أعضاء الفريق" />, value: staff.length, note: <AdminText en="Dashboard accounts" ar="حسابات الداشبورد" />, icon: Users },
      { label: <AdminText en="Online now" ar="متصلون الآن" />, value: staff.filter((member) => member.online).length, note: <AdminText en="Active team members" ar="أعضاء نشطون" />, icon: UserCheck, tone: 'orange' },
      { label: <AdminText en="Roles in use" ar="الأدوار المستخدمة" />, value: roles.length, note: <AdminText en="Operational permission groups" ar="مجموعات صلاحيات تشغيلية" />, icon: ShieldCheck, tone: 'green' },
      { label: <AdminText en="Modules" ar="الوحدات" />, value: permissionRows.length, note: <AdminText en="Permission-controlled areas" ar="مناطق محكومة بالصلاحيات" />, icon: Check, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Staff directory" ar="دليل الفريق" />} sub={<AdminText en={`${rows.length} of ${staff.length} team members shown`} ar={`عرض ${rows.length} من ${staff.length} أعضاء`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعضو أو بريد...' : 'Search member or email...'}>
        <select className="sp-filter-select" value={role} onChange={(event) => setRole(event.target.value)} aria-label={ar ? 'فلترة حسب الدور' : 'Filter by role'}><option value="all">{ar ? 'كل الأدوار' : 'All roles'}</option>{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
      </AdminTableTools>
      {rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Member" ar="العضو" />} column="member" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Role" ar="الدور" />} column="role" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Email" ar="البريد" />} column="email" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((member, index) => <tr key={member.id}><td className="sp-row-number">{paging.from + index}</td><td><span className="sp-cust"><Avatar name={member.name} src={member.avatar} size={34} online={member.online} /><span><strong><AdminText en={member.name} ar={member.nameAr} /></strong><small>{roleLabels[member.role]}</small></span></span></td><td>{roleLabels[member.role]}</td><td>{member.email}</td><td><span className="sp-inline-meta"><Circle size={8} fill={member.online ? '#22c55e' : '#cbd5e1'} color={member.online ? '#22c55e' : '#cbd5e1'} />{member.online ? (ar ? 'متصل' : 'Online') : (ar ? 'غير متصل' : 'Offline')}</span></td><td><AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${member.name}` : `Edit ${member.name}`} href={`/admin/users?edit=${member.id}`} /><AdminIconAction icon={ShieldCheck} label={ar ? `مراجعة صلاحيات ${member.name}` : `Review ${member.name} permissions`} href={`/admin/users?permissions=${member.id}`} /></AdminTableActions></td></tr>)}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No team members found" ar="لا يوجد أعضاء" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <Card title={<AdminText en="Permission matrix" ar="مصفوفة الصلاحيات" />} sub={<AdminText en="The frontend reflects which modules and actions each role can access" ar="تعكس الواجهة الوحدات والإجراءات المتاحة لكل دور" />}>
      <AdminTableWrap><table className="sp-table sp-perm">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Module" ar="الوحدة" />} column="module" sortKey={permissionSort.sortKey} direction={permissionSort.direction} onSort={permissionSort.sortBy} />{cols.map((column) => <SortableTh key={column.key} label={column.label} column={column.key} sortKey={permissionSort.sortKey} direction={permissionSort.direction} onSort={permissionSort.sortBy} />)}</tr></thead>
        <tbody>{permissionSort.sortedRows.map((row, index) => <tr key={row.module}><td className="sp-row-number">{index + 1}</td><td><strong>{row.module}</strong></td>{cols.map((column) => <td key={column.key}>{row[column.key] ? <Check size={16} color="#15803d" /> : <span style={{ color: '#cbd5e1' }}>-</span>}</td>)}</tr>)}</tbody>
      </table></AdminTableWrap>
    </Card>
  </>
}
