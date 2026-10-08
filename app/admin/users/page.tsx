'use client'

import { useMemo, useState } from 'react'
import { Check, Circle, Eye, EyeOff, Lock, Pencil, Plus, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { PageHead } from '@/components/admin/admin-shell'
import { AdminEmpty, AdminIconAction, AdminStats, AdminTableActions, AdminTableTools, AdminTableWrap, AdminText, Avatar, Card } from '@/components/admin/admin-ui'
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog'
import { useAdminLocale } from '@/components/admin/admin-locale'
import { AdminPagination, usePagination } from '@/components/admin/admin-pagination'
import { SharedSelect } from '@/components/shared-select'
import { mutateDirectoryRole, mutateDirectoryUser, useDbRolesStatus, useDbUsersStatus, type CatalogPermission, type DirectoryRole, type DirectoryUser } from '@/lib/admin-users-client'
import { SortableTh, useAdminTableSort } from '@/components/admin/admin-table-sort'

const SYSTEM_ORDER = ['SUPER_ADMIN', 'ADMIN', 'STAFF']

const roleMeta: Record<string, { en: string; ar: string }> = {
  SUPER_ADMIN: { en: 'Super Admin', ar: 'مدير عام' },
  ADMIN: { en: 'Admin', ar: 'مشرف' },
  STAFF: { en: 'Staff', ar: 'موظف' },
  CUSTOMER: { en: 'Customer', ar: 'عميل' },
}

const statusMeta: Record<DirectoryUser['status'], { en: string; ar: string; color: string }> = {
  ACTIVE: { en: 'Active', ar: 'نشط', color: '#22c55e' },
  PENDING: { en: 'Pending', ar: 'بانتظار التفعيل', color: '#f59e0b' },
  SUSPENDED: { en: 'Suspended', ar: 'موقوف', color: '#ef4444' },
}

const capabilities: Record<string, { en: string[]; ar: string[] }> = {
  SUPER_ADMIN: {
    en: ['Full dashboard access, including settings and email.', 'Invites, edits and deactivates any team member.', 'Creates roles and edits any permission.', 'Protected: the last active Super Admin cannot be removed.'],
    ar: ['وصول كامل للوحة التحكم بما فيها الإعدادات والبريد.', 'يدعو أي عضو في الفريق ويعدّله ويوقفه.', 'ينشئ الأدوار ويعدّل أي صلاحية.', 'حماية: لا يمكن إزالة آخر مدير عام نشط.'],
  },
  ADMIN: {
    en: ['Manages catalogue, requests and bookings.', 'Team management is reserved for Super Admins.', 'Cannot modify Admin or Super Admin accounts.', 'Cannot manage roles or grant Admin roles and above.'],
    ar: ['يدير الكتالوج والطلبات والحجوزات.', 'إدارة الفريق مخصصة للمدير العام.', 'لا يعدّل حسابات المشرفين أو المدراء العامين.', 'لا يدير الأدوار ولا يمنح دور مشرف أو أعلى.'],
  },
  STAFF: {
    en: ['Operates catalogue and request queues.', 'Team directory is read-only for this role.', 'Cannot invite, edit or deactivate members.'],
    ar: ['يشغّل الكتالوج وقوائم الطلبات.', 'دليل الفريق للقراءة فقط لهذا الدور.', 'لا يدعو الأعضاء ولا يعدّلهم ولا يوقفهم.'],
  },
}

function primaryRole(member: DirectoryUser): string {
  for (const key of SYSTEM_ORDER) {
    if (member.roles.includes(key)) return key
  }
  return [...member.roles].sort()[0] ?? 'STAFF'
}

function roleLabel(role: DirectoryRole | undefined, key: string, ar: boolean): string {
  const meta = roleMeta[key]
  if (meta) return ar ? meta.ar : meta.en
  return role?.name ?? key
}

// Short human labels for the permission actions that actually exist in
// the database (view/create/edit/delete/manage/moderate). Unknown future
// actions fall back to a capitalized key — never invented wording.
//
// ACTION_ORDER is the canonical display order used by every matrix row:
// View, Create, Edit, Delete, Manage, Moderate. Only actions defined for
// a module in the database are rendered; keys and semantics never change.
const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'manage', 'moderate'] as const

const ACTION_LABEL: Record<string, { en: string; ar: string }> = {
  view: { en: 'View', ar: 'عرض' },
  create: { en: 'Create', ar: 'إنشاء' },
  edit: { en: 'Edit', ar: 'تعديل' },
  delete: { en: 'Delete', ar: 'حذف' },
  manage: { en: 'Manage', ar: 'إدارة' },
  moderate: { en: 'Moderate', ar: 'مراجعة' },
}

function actionLabel(action: string, ar: boolean): string {
  const hit = ACTION_LABEL[action]
  if (hit) return ar ? hit.ar : hit.en
  return action.charAt(0).toUpperCase() + action.slice(1)
}

function sortRoles<T extends { key: string }>(roles: readonly T[]): T[] {
  return [...roles].sort((a, b) => {
    const ai = SYSTEM_ORDER.indexOf(a.key)
    const bi = SYSTEM_ORDER.indexOf(b.key)
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    return a.key.localeCompare(b.key)
  })
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'name', string>>

export default function UsersPage() {
  const ar = useAdminLocale() === 'ar'
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('all')
  const [actionError, setActionError] = useState('')
  const [successNote, setSuccessNote] = useState('')
  // DB-authoritative directory with no static fallback: while the API is
  // loading or failing, the screen shows loading/error — never mock rows
  // masquerading as database records.
  const { data, viewerPublicId, viewerRoles, grantableRoles, loading, error, retry, refresh } = useDbUsersStatus()
  const { roles: roleRows, catalog, canManageRoles, restrictedPermissions, loading: rolesLoading, error: rolesError, retry: retryRoles, refresh: refreshRoles } = useDbRolesStatus()
  // SUPER_ADMIN-only capabilities (users.manage, roles.manage): legacy
  // grant rows may still exist, but they confer no power and render as
  // locked on every non-SUPER_ADMIN role — matching API enforcement.
  const restricted = useMemo(() => new Set(restrictedPermissions), [restrictedPermissions])
  const effectiveCount = (item: DirectoryRole) => item.key === 'SUPER_ADMIN'
    ? item.permissions.length
    : item.permissions.filter((key) => !restricted.has(key)).length
  const liveUsers = data ?? []
  const liveRoles = useMemo(() => (roleRows ?? []).filter((item) => item.key !== 'CUSTOMER'), [roleRows])
  const orderedRoles = useMemo(() => sortRoles(liveRoles), [liveRoles])
  // The SUPER_ADMIN column renders as one spanning Full Access cell
  // instead of repetitive per-permission toggles; every other role gets
  // labeled per-permission pills in the same column order.
  const superAdminRole = useMemo(() => orderedRoles.find((item) => item.key === 'SUPER_ADMIN') ?? null, [orderedRoles])
  const matrixRoles = useMemo(() => orderedRoles.filter((item) => item.key !== 'SUPER_ADMIN'), [orderedRoles])
  const roleByKey = useMemo(() => new Map(liveRoles.map((item) => [item.key, item])), [liveRoles])
  const canManage = viewerRoles.includes('SUPER_ADMIN')

  const modules = useMemo(() => {
    const groups = new Map<string, CatalogPermission[]>()
    for (const perm of catalog) {
      const list = groups.get(perm.module) ?? []
      list.push(perm)
      groups.set(perm.module, list)
    }
    const rank = (action: string) => {
      const index = (ACTION_ORDER as readonly string[]).indexOf(action)
      return index === -1 ? ACTION_ORDER.length : index
    }
    return [...groups.entries()].map(([module, actions]) => ({
      module,
      actions: [...actions].sort((a, b) => rank(a.action) - rank(b.action)),
    }))
  }, [catalog])

  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteFirst, setInviteFirst] = useState('')
  const [inviteLast, setInviteLast] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  // Password starts masked on every invite; the admin reveals it explicitly.
  const [inviteShowPassword, setInviteShowPassword] = useState(false)
  const [inviteRole, setInviteRole] = useState('STAFF')
  const [inviteErrors, setInviteErrors] = useState<FieldErrors>({})
  const [inviteServerError, setInviteServerError] = useState('')
  const [inviteSaving, setInviteSaving] = useState(false)

  const [editTarget, setEditTarget] = useState<DirectoryUser | null>(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('STAFF')
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE')
  // Select controls are only sent when the admin explicitly touches them:
  // otherwise opening Edit on a PENDING member (whose select defaults to
  // ACTIVE) would silently activate them, and any concurrent role change
  // would be overwritten with a stale value.
  const [editRoleTouched, setEditRoleTouched] = useState(false)
  const [editStatusTouched, setEditStatusTouched] = useState(false)
  const [editErrors, setEditErrors] = useState<FieldErrors>({})
  const [editServerError, setEditServerError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [statusTarget, setStatusTarget] = useState<{ member: DirectoryUser; to: 'ACTIVE' | 'SUSPENDED' } | null>(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusServerError, setStatusServerError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<DirectoryUser | null>(null)

  const [roleDialog, setRoleDialog] = useState<{ mode: 'create' } | { mode: 'edit'; role: DirectoryRole } | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [roleErrors, setRoleErrors] = useState<FieldErrors>({})
  const [roleServerError, setRoleServerError] = useState('')
  const [roleSaving, setRoleSaving] = useState(false)
  const [matrixError, setMatrixError] = useState('')

  const openInvite = () => {
    setInviteFirst('')
    setInviteLast('')
    setInviteEmail('')
    setInvitePassword('')
    setInviteShowPassword(false)
    setInviteRole(grantableRoles.includes('STAFF') ? 'STAFF' : (grantableRoles[0] ?? 'STAFF'))
    setInviteErrors({})
    setInviteServerError('')
    setInviteOpen(true)
  }

  const openEdit = (member: DirectoryUser) => {
    setEditTarget(member)
    setEditFirst(member.firstName ?? '')
    setEditLast(member.lastName ?? '')
    setEditEmail(member.email)
    setEditRole(primaryRole(member))
    setEditStatus(member.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE')
    setEditRoleTouched(false)
    setEditStatusTouched(false)
    setEditErrors({})
    setEditServerError('')
  }

  const openRoleDialog = (target: { mode: 'create' } | { mode: 'edit'; role: DirectoryRole }) => {
    setRoleDialog(target)
    setRoleName(target.mode === 'edit' ? target.role.name : '')
    setRoleDescription(target.mode === 'edit' ? (target.role.description ?? '') : '')
    setRoleErrors({})
    setRoleServerError('')
  }

  const validateName = (value: string, field: 'firstName' | 'lastName', labelEn: string, labelAr: string): string | undefined => {
    if (!value.trim()) return undefined
    if (value.trim().length > 80) return ar ? `${labelAr}: بحد أقصى 80 حرفًا.` : `${labelEn}: max 80 characters.`
    return undefined
  }

  const submitInvite = async () => {
    const errors: FieldErrors = {}
    const firstError = validateName(inviteFirst, 'firstName', 'First name', 'الاسم الأول')
    if (firstError) errors.firstName = firstError
    const lastError = validateName(inviteLast, 'lastName', 'Last name', 'اسم العائلة')
    if (lastError) errors.lastName = lastError
    if (!EMAIL_PATTERN.test(inviteEmail.trim())) errors.email = ar ? 'أدخل بريدًا إلكترونيًا صالحًا.' : 'Enter a valid email address.'
    if (invitePassword.length < 6 || invitePassword.length > 8) errors.password = ar ? 'كلمة المرور من 6 إلى 8 أحرف.' : 'Password must be 6-8 characters.'
    setInviteErrors(errors)
    if (Object.keys(errors).length > 0) return
    setInviteSaving(true)
    setInviteServerError('')
    try {
      await mutateDirectoryUser('POST', '/api/admin/users', {
        email: inviteEmail.trim(),
        password: invitePassword,
        firstName: inviteFirst.trim() || null,
        lastName: inviteLast.trim() || null,
        roleKey: inviteRole,
      })
      setInviteOpen(false)
      setSuccessNote(ar ? 'تمت دعوة العضو بنجاح.' : 'Team member invited.')
      setActionError('')
      refresh()
    } catch (err) {
      setInviteServerError(err instanceof Error ? err.message : (ar ? 'تعذر إتمام الدعوة.' : 'Could not invite the member.'))
    } finally {
      setInviteSaving(false)
    }
  }

  const submitEdit = async () => {
    if (!editTarget) return
    const errors: FieldErrors = {}
    const firstError = validateName(editFirst, 'firstName', 'First name', 'الاسم الأول')
    if (firstError) errors.firstName = firstError
    const lastError = validateName(editLast, 'lastName', 'Last name', 'اسم العائلة')
    if (lastError) errors.lastName = lastError
    if (!EMAIL_PATTERN.test(editEmail.trim())) errors.email = ar ? 'أدخل بريدًا إلكترونيًا صالحًا.' : 'Enter a valid email address.'
    setEditErrors(errors)
    if (Object.keys(errors).length > 0) return
    const isSelf = editTarget.publicId === viewerPublicId
    // Diff-only payload: untouched role/status selects are never sent, so
    // saving a name/email change cannot silently activate a PENDING member
    // or rewrite a concurrently changed role. The server also rejects
    // empty updates with "Nothing to update."
    const payload: Record<string, unknown> = {}
    const nextEmail = editEmail.trim()
    if (nextEmail !== editTarget.email) payload.email = nextEmail
    const nextFirst = editFirst.trim() || null
    if (nextFirst !== (editTarget.firstName ?? null)) payload.firstName = nextFirst
    const nextLast = editLast.trim() || null
    if (nextLast !== (editTarget.lastName ?? null)) payload.lastName = nextLast
    if (!isSelf) {
      if (editRoleTouched && editRole !== primaryRole(editTarget)) payload.roleKey = editRole
      if (editStatusTouched && editStatus !== editTarget.status) payload.status = editStatus
    }
    if (Object.keys(payload).length === 0) {
      setEditTarget(null)
      setSuccessNote(ar ? 'لا توجد تغييرات للحفظ.' : 'No changes to save.')
      return
    }
    setEditSaving(true)
    setEditServerError('')
    try {
      await mutateDirectoryUser('PUT', `/api/admin/users/${encodeURIComponent(editTarget.publicId)}`, payload)
      setEditTarget(null)
      setSuccessNote(ar ? 'تم حفظ التعديلات.' : 'Changes saved.')
      setActionError('')
      refresh()
    } catch (err) {
      setEditServerError(err instanceof Error ? err.message : (ar ? 'تعذر حفظ التعديلات.' : 'Could not save changes.'))
    } finally {
      setEditSaving(false)
    }
  }

  const submitStatus = async () => {
    if (!statusTarget) return
    setStatusSaving(true)
    setStatusServerError('')
    try {
      await mutateDirectoryUser('PUT', `/api/admin/users/${encodeURIComponent(statusTarget.member.publicId)}`, {
        status: statusTarget.to,
      })
      setStatusTarget(null)
      setSuccessNote(statusTarget.to === 'ACTIVE'
        ? (ar ? 'تم تفعيل العضو.' : 'Member activated.')
        : (ar ? 'تم إيقاف العضو.' : 'Member suspended.'))
      setActionError('')
      refresh()
    } catch (err) {
      setStatusServerError(err instanceof Error ? err.message : (ar ? 'تعذر تحديث الحالة.' : 'Could not update status.'))
    } finally {
      setStatusSaving(false)
    }
  }

  const submitRole = async () => {
    if (!roleDialog) return
    const errors: FieldErrors = {}
    if (!roleName.trim()) errors.name = ar ? 'أدخل اسم الدور.' : 'Enter a role name.'
    else if (roleName.trim().length > 100) errors.name = ar ? 'بحد أقصى 100 حرف.' : 'Max 100 characters.'
    setRoleErrors(errors)
    if (Object.keys(errors).length > 0) return
    setRoleSaving(true)
    setRoleServerError('')
    try {
      if (roleDialog.mode === 'create') {
        await mutateDirectoryRole('POST', '/api/admin/roles', { name: roleName.trim(), description: roleDescription.trim() || undefined })
        setSuccessNote(ar ? 'تم إنشاء الدور. حدد صلاحياته من المصفوفة.' : 'Role created. Assign its permissions in the matrix.')
      } else {
        await mutateDirectoryRole('PUT', `/api/admin/roles/${encodeURIComponent(roleDialog.role.key)}`, { name: roleName.trim(), description: roleDescription.trim() || null })
        setSuccessNote(ar ? 'تم حفظ الدور.' : 'Role saved.')
      }
      setRoleDialog(null)
      setActionError('')
      refreshRoles()
    } catch (err) {
      setRoleServerError(err instanceof Error ? err.message : (ar ? 'تعذر حفظ الدور.' : 'Could not save the role.'))
    } finally {
      setRoleSaving(false)
    }
  }

  const toggleMatrixPermission = async (role: DirectoryRole, permission: string, granted: boolean) => {
    setMatrixError('')
    try {
      await mutateDirectoryRole('PUT', `/api/admin/roles/${encodeURIComponent(role.key)}/permissions`, {
        permissions: granted ? role.permissions.filter((key) => key !== permission) : [...role.permissions, permission],
      })
      setSuccessNote(ar ? `تم تحديث صلاحيات ${role.name}.` : `${role.name} permissions updated.`)
      refreshRoles()
    } catch (err) {
      setMatrixError(err instanceof Error ? err.message : (ar ? 'تعذر تحديث الصلاحيات.' : 'Could not update permissions.'))
    }
  }

  const rows = useMemo(() => liveUsers
    .filter((member) => role === 'all' || member.roles.includes(role))
    .filter((member) => `${member.displayName} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())), [liveUsers, query, role])
  const staffSort = useAdminTableSort(rows, {
    member: (member) => member.displayName,
    role: (member) => roleLabel(roleByKey.get(primaryRole(member)), primaryRole(member), false),
    email: (member) => member.email,
    status: (member) => member.status,
  }, 'member', 'asc')
  const paging = usePagination(staffSort.sortedRows)
  const matrixAccessors = useMemo(() => Object.fromEntries([
    ['module', (row: { module: string }) => row.module],
    ...orderedRoles.map((item) => [item.key, (row: { grants: Record<string, string[]> }) => (row.grants[item.key] ?? []).join(',')]),
  ]), [orderedRoles])
  const matrixRows = useMemo(() => modules.map(({ module, actions }) => {
    const grants: Record<string, string[]> = {}
    for (const item of orderedRoles) {
      grants[item.key] = actions.filter((perm) => item.permissions.includes(perm.key)).map((perm) => perm.action)
    }
    return { module, actions, grants }
  }), [modules, orderedRoles])
  const matrixSort = useAdminTableSort(matrixRows, matrixAccessors, 'module', 'asc')
  const distinctRoles = useMemo(() => {
    const keys = new Set<string>()
    for (const member of liveUsers) for (const key of member.roles) if (key !== 'CUSTOMER') keys.add(key)
    return keys.size
  }, [liveUsers])
  const onlineCount = liveUsers.filter((member) => member.online).length
  const editIsSelf = editTarget !== null && editTarget.publicId === viewerPublicId
  const reviewRoleKey = reviewTarget ? primaryRole(reviewTarget) : null
  const reviewCaps = reviewRoleKey ? capabilities[reviewRoleKey] : null
  const reviewGranted = reviewTarget && !reviewCaps
    ? (roleByKey.get(reviewRoleKey!)?.permissions ?? [])
      // Legacy SUPER_ADMIN-only rows confer no power; never present them
      // as effective capabilities (same policy overlay as the matrix).
      .filter((key) => reviewRoleKey === 'SUPER_ADMIN' || !restricted.has(key))
      .map((key) => catalog.find((perm) => perm.key === key)?.label ?? key)
    : []

  return <>
    <PageHead eyebrow="Team" title="Users & Roles" titleAr="المستخدمون والصلاحيات" sub="Team access, operational roles and module permissions" subAr="وصول الفريق والأدوار التشغيلية وصلاحيات الوحدات" actions={canManage ? <button type="button" className="sp-btn primary" onClick={openInvite}><Plus size={17} /> <AdminText en="Invite staff" ar="دعوة موظف" /></button> : undefined} />
    <AdminStats items={[
      { label: <AdminText en="Staff members" ar="أعضاء الفريق" />, value: liveUsers.length, note: <AdminText en="Dashboard accounts" ar="حسابات الداشبورد" />, icon: Users },
      { label: <AdminText en="Online now" ar="متصلون الآن" />, value: onlineCount, note: <AdminText en="Active team members" ar="أعضاء نشطون" />, icon: UserCheck, tone: 'orange' },
      { label: <AdminText en="Roles in use" ar="الأدوار المستخدمة" />, value: distinctRoles, note: <AdminText en="Operational permission groups" ar="مجموعات صلاحيات تشغيلية" />, icon: ShieldCheck, tone: 'green' },
      { label: <AdminText en="Modules" ar="الوحدات" />, value: modules.length || 14, note: <AdminText en="Permission-controlled areas" ar="مناطق محكومة بالصلاحيات" />, icon: Check, tone: 'violet' },
    ]} />
    <Card title={<AdminText en="Staff directory" ar="دليل الفريق" />} sub={<AdminText en={`${rows.length} of ${liveUsers.length} team members shown`} ar={`عرض ${rows.length} من ${liveUsers.length} أعضاء`} />}>
      <AdminTableTools query={query} onQueryChange={setQuery} placeholder={ar ? 'ابحث بعضو أو بريد...' : 'Search member or email...'}>
        <SharedSelect value={role} onChange={setRole} locale={ar ? 'ar' : 'en'} label={ar ? 'فلترة حسب الدور' : 'Filter by role'} options={[{ value: 'all', label: ar ? 'كل الأدوار' : 'All roles' }, ...orderedRoles.map((item) => ({ value: item.key, label: roleLabel(item, item.key, ar) }))]} />
      </AdminTableTools>
      {actionError ? <p role="alert" style={{ color: '#b91c1c', margin: '8px 0 0' }}>{actionError}</p> : null}
      {successNote ? <p role="status" style={{ color: '#15803d', margin: '8px 0 0' }}>{successNote}</p> : null}
      {loading ? <AdminEmpty title={<AdminText en="Loading team…" ar="جارٍ تحميل الفريق…" />} copy={<AdminText en="Reading the team directory." ar="تتم قراءة دليل الفريق." />} />
      : error ? <><AdminEmpty title={<AdminText en="Could not load team" ar="تعذر تحميل الفريق" />} copy={<AdminText en={error} ar={error} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retry}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : rows.length ? <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Member" ar="العضو" />} column="member" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Role" ar="الدور" />} column="role" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Email" ar="البريد" />} column="email" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><SortableTh label={<AdminText en="Status" ar="الحالة" />} column="status" sortKey={staffSort.sortKey} direction={staffSort.direction} onSort={staffSort.sortBy} /><th></th></tr></thead>
        <tbody>{paging.pageRows.map((member, index) => {
          const memberRole = primaryRole(member)
          const status = statusMeta[member.status] ?? statusMeta.ACTIVE!
          const suspended = member.status === 'SUSPENDED'
          // Self-protection in the UI (mirrors the server 403): the
          // suspend/activate action is never offered on your own row,
          // for every role. Compared by stable publicId, never names.
          const rowIsSelf = member.publicId === viewerPublicId
          return <tr key={member.publicId}><td className="sp-row-number">{paging.from + index}</td><td><span className="sp-cust"><Avatar name={member.displayName} size={34} online={member.online} /><span><strong>{member.displayName}</strong><small>{roleLabel(roleByKey.get(memberRole), memberRole, ar)}</small></span></span></td><td>{roleLabel(roleByKey.get(memberRole), memberRole, ar)}</td><td dir="ltr">{member.email}</td><td><span className="sp-inline-meta"><Circle size={8} fill={status.color} color={status.color} />{ar ? status.ar : status.en}</span></td><td>{canManage ? <AdminTableActions>
            <AdminIconAction icon={Pencil} label={ar ? `تعديل ${member.displayName}` : `Edit ${member.displayName}`} onClick={() => openEdit(member)} />
            {!rowIsSelf ? <AdminIconAction icon={suspended ? Eye : EyeOff} tone={suspended ? 'default' : 'danger'} label={suspended ? (ar ? `تفعيل ${member.displayName}` : `Activate ${member.displayName}`) : (ar ? `إيقاف ${member.displayName}` : `Suspend ${member.displayName}`)} onClick={() => { setStatusServerError(''); setStatusTarget({ member, to: suspended ? 'ACTIVE' : 'SUSPENDED' }) }} /> : null}
            <AdminIconAction icon={ShieldCheck} label={ar ? 'عرض الصلاحيات' : 'View permissions'} onClick={() => setReviewTarget(member)} />
          </AdminTableActions> : null}</td></tr>
        })}</tbody>
      </table></AdminTableWrap> : <AdminEmpty title={<AdminText en="No team members found" ar="لا يوجد أعضاء" />} copy={<AdminText en="Try changing the search or filters." ar="جرب تغيير البحث أو الفلاتر." />} />}
        {rows.length > 0 && <AdminPagination page={paging.page} pageCount={paging.pageCount} onPage={paging.setPage} pageSize={paging.pageSize} onPageSize={paging.setPageSize} from={paging.from} to={paging.to} total={paging.total} />}
    </Card>
    <Card title={<AdminText en="Roles" ar="الأدوار" />} sub={<AdminText en="Configurable staff roles - Super Admin only" ar="أدوار الفريق القابلة للضبط - للمدير العام فقط" />} action={canManageRoles ? <button type="button" className="sp-btn primary" onClick={() => openRoleDialog({ mode: 'create' })}><Plus size={17} /> <AdminText en="New role" ar="دور جديد" /></button> : undefined}>
      {rolesLoading ? <AdminEmpty title={<AdminText en="Loading roles…" ar="جارٍ تحميل الأدوار…" />} copy={<AdminText en="Reading the role catalogue." ar="تتم قراءة سجل الأدوار." />} />
      : rolesError ? <><AdminEmpty title={<AdminText en="Could not load roles" ar="تعذر تحميل الأدوار" />} copy={<AdminText en={rolesError} ar={rolesError} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retryRoles}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : <AdminTableWrap><table className="sp-table">
        <thead><tr><th className="sp-row-number">#</th><th><AdminText en="Role" ar="الدور" /></th><th><AdminText en="Members" ar="الأعضاء" /></th><th><AdminText en="Permissions" ar="الصلاحيات" /></th><th></th></tr></thead>
        <tbody>{orderedRoles.map((item, index) => <tr key={item.key}><td className="sp-row-number">{index + 1}</td><td><strong>{item.name}</strong><br /><small style={{ color: 'var(--sp-muted)' }}>{item.key}{item.isSystem ? (ar ? ' · نظام' : ' · System') : null}{item.description ? ` - ${item.description}` : null}</small></td><td>{item.memberCount}</td><td>{item.key === 'SUPER_ADMIN' ? (ar ? 'وصول كامل' : 'Full access') : effectiveCount(item)}</td><td>{canManageRoles && !item.isSystem ? <AdminTableActions><AdminIconAction icon={Pencil} label={ar ? `تعديل ${item.name}` : `Edit ${item.name}`} onClick={() => openRoleDialog({ mode: 'edit', role: item })} /></AdminTableActions> : null}</td></tr>)}</tbody>
      </table></AdminTableWrap>}
    </Card>
    <Card title={<AdminText en="Permission matrix" ar="مصفوفة الصلاحيات" />} sub={<AdminText en="Live role permissions from the database - Super Admins toggle cells to change access" ar="صلاحيات الأدوار الحية من قاعدة البيانات - يبدّل المدير العام الخلايا لتغيير الوصول" />}>
      {matrixError ? <p role="alert" style={{ color: '#b91c1c', margin: '0 0 8px' }}>{matrixError}</p> : null}
      {rolesLoading ? <AdminEmpty title={<AdminText en="Loading matrix…" ar="جارٍ تحميل المصفوفة…" />} copy={<AdminText en="Reading role permissions." ar="تتم قراءة صلاحيات الأدوار." />} />
      : rolesError ? <><AdminEmpty title={<AdminText en="Could not load matrix" ar="تعذر تحميل المصفوفة" />} copy={<AdminText en={rolesError} ar={rolesError} />} /><div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><button type="button" className="sp-btn" onClick={retryRoles}><AdminText en="Retry" ar="إعادة المحاولة" /></button></div></>
      : <><div className="sp-mx-legend">
        <span className="sp-mx-legend-item"><Check size={14} color="#15803d" /><AdminText en="Granted" ar="ممنوحة" /></span>
        <span className="sp-mx-legend-item"><span aria-hidden="true" style={{ color: '#cbd5e1' }}>–</span><AdminText en="Not granted" ar="غير ممنوحة" /></span>
        <span className="sp-mx-legend-item"><Lock size={13} color="#94a3b8" /><AdminText en="Super Admin only" ar="للمدير العام فقط" /></span>
        <span className="sp-mx-legend-item"><ShieldCheck size={14} color="var(--sp-blue-deep)" /><AdminText en="Full access" ar="وصول كامل" /></span>
      </div><AdminTableWrap><table className="sp-table sp-perm">
        <thead><tr><th className="sp-row-number">#</th><SortableTh label={<AdminText en="Module" ar="الوحدة" />} column="module" sortKey={matrixSort.sortKey} direction={matrixSort.direction} onSort={matrixSort.sortBy} />{superAdminRole ? <th key={superAdminRole.key}><span className="sp-mx-superhead"><ShieldCheck size={15} /><span>{superAdminRole.name}</span><small><AdminText en="Full access" ar="وصول كامل" /></small></span></th> : null}{matrixRoles.map((item) => <SortableTh key={item.key} label={item.name} column={item.key} sortKey={matrixSort.sortKey} direction={matrixSort.direction} onSort={matrixSort.sortBy} />)}</tr></thead>
        <tbody>{matrixSort.sortedRows.map((row, index) => <tr key={row.module}><td className="sp-row-number">{index + 1}</td><td><strong style={{ textTransform: 'capitalize' }}>{row.module}</strong></td>{superAdminRole ? <td key={superAdminRole.key}><span className="sp-mx-covered"><ShieldCheck size={14} aria-hidden="true" /></span></td> : null}{matrixRoles.map((item) => <td key={item.key}><span className="sp-mx-pills">{row.actions.map((perm) => {
          const granted = (row.grants[item.key] ?? []).includes(perm.action)
          // Policy overlay: SUPER_ADMIN-only capabilities render as locked
          // on every other role — even when a legacy grant row exists —
          // because the APIs never honor them. Never toggleable.
          const reserved = restricted.has(perm.key)
          const label = reserved
            ? `${perm.label ?? perm.action} - ${row.module} - ${item.name} (${ar ? 'مخصص للمدير العام: لا يمنح أي وصول.' : 'Reserved for Super Admins: grants no access.'})`
            : `${granted ? (ar ? 'إلغاء' : 'Revoke') : (ar ? 'منح' : 'Grant')} ${perm.label ?? perm.action} - ${row.module} - ${item.name}`
          const pill = <>{granted ? <Check size={14} /> : null}<span>{actionLabel(perm.action, ar)}</span></>
          if (reserved) {
            return <span key={perm.key} className="sp-mx-pill is-locked" title={label} aria-label={label}><Lock size={13} /><span>{actionLabel(perm.action, ar)}</span></span>
          }
          const className = granted ? 'sp-mx-pill is-on' : 'sp-mx-pill'
          return canManageRoles
            ? <button key={perm.key} type="button" className={className} onClick={() => void toggleMatrixPermission(item, perm.key, granted)} aria-label={label} title={perm.label ?? label} aria-pressed={granted}>{pill}</button>
            : <span key={perm.key} className={className} title={perm.label ?? label} aria-label={label}>{pill}</span>
        })}</span></td>)}</tr>)}</tbody>
      </table></AdminTableWrap></>}
    </Card>

    <AdminConfirmDialog
      open={inviteOpen}
      onClose={() => { if (!inviteSaving) setInviteOpen(false) }}
      onConfirm={() => void submitInvite()}
      title={<AdminText en="Invite staff member" ar="دعوة عضو في الفريق" />}
      description={<AdminText en="Creates an active dashboard account with the selected role." ar="ينشئ حساب داشبورد نشطًا بالدور المحدد." />}
      confirmLabel={inviteSaving ? <AdminText en="Inviting…" ar="جارٍ الدعوة…" /> : <AdminText en="Invite member" ar="دعوة العضو" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      canConfirm={!inviteSaving}
    >
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="First name" ar="الاسم الأول" /><input value={inviteFirst} onChange={(e) => setInviteFirst(e.target.value)} placeholder="Mona" /></label>
          <label><AdminText en="Last name" ar="اسم العائلة" /><input value={inviteLast} onChange={(e) => setInviteLast(e.target.value)} placeholder="Samy" /></label>
        </div>
        {(inviteErrors.firstName || inviteErrors.lastName) && <p role="alert" style={{ color: '#b91c1c' }}>{inviteErrors.firstName ?? inviteErrors.lastName}</p>}
        <label><AdminText en="Email" ar="البريد الإلكتروني" /><input dir="ltr" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@starpyramids.com" /></label>
        {inviteErrors.email && <p role="alert" style={{ color: '#b91c1c' }}>{inviteErrors.email}</p>}
        <label><AdminText en="Initial password" ar="كلمة المرور الأولية" /><span className="sp-password-field"><input dir="ltr" type={inviteShowPassword ? 'text' : 'password'} autoComplete="new-password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="••••••" /><button type="button" className="sp-password-toggle" onClick={() => setInviteShowPassword((show) => !show)} aria-label={inviteShowPassword ? (ar ? 'إخفاء كلمة المرور' : 'Hide password') : (ar ? 'إظهار كلمة المرور' : 'Show password')} aria-pressed={inviteShowPassword}>{inviteShowPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><small><AdminText en="6-8 characters. Share it securely - it is never shown again." ar="من 6 إلى 8 أحرف. شاركها بشكل آمن - لن تظهر مرة أخرى." /></small></label>
        {inviteErrors.password && <p role="alert" style={{ color: '#b91c1c' }}>{inviteErrors.password}</p>}
        <label><AdminText en="Role" ar="الدور" /><SharedSelect value={inviteRole} onChange={setInviteRole} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={grantableRoles.map((key) => ({ value: key, label: roleLabel(roleByKey.get(key), key, ar) }))} /></label>
        {inviteServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{inviteServerError}</p> : null}
      </div>
    </AdminConfirmDialog>

    <AdminConfirmDialog
      open={editTarget !== null}
      onClose={() => { if (!editSaving) setEditTarget(null) }}
      onConfirm={() => void submitEdit()}
      title={<AdminText en="Edit team member" ar="تعديل عضو الفريق" />}
      description={editTarget ? <AdminText en={editTarget.email} ar={editTarget.email} /> : undefined}
      confirmLabel={editSaving ? <AdminText en="Saving…" ar="جارٍ الحفظ…" /> : <AdminText en="Save changes" ar="حفظ التعديلات" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      canConfirm={!editSaving}
    >
      <div className="sp-form">
        <div className="sp-form-2">
          <label><AdminText en="First name" ar="الاسم الأول" /><input value={editFirst} onChange={(e) => setEditFirst(e.target.value)} /></label>
          <label><AdminText en="Last name" ar="اسم العائلة" /><input value={editLast} onChange={(e) => setEditLast(e.target.value)} /></label>
        </div>
        {(editErrors.firstName || editErrors.lastName) && <p role="alert" style={{ color: '#b91c1c' }}>{editErrors.firstName ?? editErrors.lastName}</p>}
        <label><AdminText en="Email" ar="البريد الإلكتروني" /><input dir="ltr" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></label>
        {editErrors.email && <p role="alert" style={{ color: '#b91c1c' }}>{editErrors.email}</p>}
        {editIsSelf ? <>
          <label><AdminText en="Role" ar="الدور" /><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input readOnly value={roleLabel(roleByKey.get(primaryRole(editTarget!)), primaryRole(editTarget!), ar)} style={{ flex: 1 }} /><Lock size={16} color="var(--sp-muted)" aria-hidden="true" /></span></label>
          <p role="note" style={{ color: 'var(--sp-muted)' }}><AdminText en="Your Super Admin role is protected and cannot be changed from your own account." ar="دورك كمدير عام محمي ولا يمكن تغييره من حسابك نفسه." /></p>
        </> : <label><AdminText en="Role" ar="الدور" /><SharedSelect value={editRole} onChange={(next) => { setEditRole(next); setEditRoleTouched(true) }} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={grantableRoles.map((key) => ({ value: key, label: roleLabel(roleByKey.get(key), key, ar) }))} /></label>}
        {editIsSelf ? <>
          <label><AdminText en="Status" ar="الحالة" /><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input readOnly value={ar ? (statusMeta[editTarget!.status]?.ar ?? editTarget!.status) : (statusMeta[editTarget!.status]?.en ?? editTarget!.status)} style={{ flex: 1 }} /><Lock size={16} color="var(--sp-muted)" aria-hidden="true" /></span></label>
          <p role="note" style={{ color: 'var(--sp-muted)' }}><AdminText en="Your account status is protected to prevent accidental loss of administrative access." ar="حالة حسابك محمية لمنع فقدان الوصول الإداري عن طريق الخطأ." /></p>
        </> : <label><AdminText en="Status" ar="الحالة" /><SharedSelect value={editStatus} onChange={(next) => { setEditStatus(next as 'ACTIVE' | 'SUSPENDED'); setEditStatusTouched(true) }} locale={ar ? 'ar' : 'en'} popupWidth="trigger" options={[{ value: 'ACTIVE', label: ar ? statusMeta.ACTIVE!.ar : statusMeta.ACTIVE!.en }, { value: 'SUSPENDED', label: ar ? statusMeta.SUSPENDED!.ar : statusMeta.SUSPENDED!.en }]} /></label>}
        {editServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{editServerError}</p> : null}
      </div>
    </AdminConfirmDialog>

    <AdminConfirmDialog
      open={statusTarget !== null}
      onClose={() => { if (!statusSaving) setStatusTarget(null) }}
      onConfirm={() => void submitStatus()}
      title={statusTarget?.to === 'ACTIVE'
        ? <AdminText en="Activate this member?" ar="تفعيل هذا العضو؟" />
        : <AdminText en="Suspend this member?" ar="إيقاف هذا العضو؟" />}
      description={statusTarget ? (statusTarget.to === 'ACTIVE'
        ? <AdminText en={`${statusTarget.member.displayName} will be able to sign in again.`} ar={`سيتمكن ${statusTarget.member.displayName} من تسجيل الدخول مجددًا.`} />
        : <AdminText en={`${statusTarget.member.displayName} will lose dashboard access immediately.`} ar={`سيفقد ${statusTarget.member.displayName} الوصول للوحة التحكم فورًا.`} />) : undefined}
      confirmLabel={statusSaving
        ? <AdminText en="Working…" ar="جارٍ التنفيذ…" />
        : statusTarget?.to === 'ACTIVE'
          ? <AdminText en="Activate" ar="تفعيل" />
          : <AdminText en="Suspend" ar="إيقاف" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      tone={statusTarget?.to === 'ACTIVE' ? 'primary' : 'danger'}
      canConfirm={!statusSaving}
    >
      {statusServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{statusServerError}</p> : null}
    </AdminConfirmDialog>

    <AdminConfirmDialog
      open={reviewTarget !== null}
      onClose={() => setReviewTarget(null)}
      onConfirm={() => setReviewTarget(null)}
      title={reviewTarget ? <AdminText en={`Role Permissions — ${reviewTarget.displayName}`} ar={`صلاحيات الدور — ${reviewTarget.displayName}`} /> : ''}
      description={reviewTarget ? <AdminText en={`Effective permissions for the ${roleLabel(roleByKey.get(reviewRoleKey!), reviewRoleKey!, false)} role`} ar={`الصلاحيات الفعلية لدور ${roleLabel(roleByKey.get(reviewRoleKey!), reviewRoleKey!, true)}`} /> : undefined}
      confirmLabel={<AdminText en="Close" ar="إغلاق" />}
      cancelLabel={<AdminText en="Close" ar="إغلاق" />}
      canConfirm={false}
      hideConfirm
    >
      {reviewRoleKey === 'SUPER_ADMIN' ? <p style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sp-blue-deep)', fontWeight: 700 }}><ShieldCheck size={16} /><AdminText en="Full Access — unrestricted access to every module, including settings, email and team management." ar="وصول كامل — وصول غير مقيد إلى كل الوحدات بما فيها الإعدادات والبريد وإدارة الفريق." /></p> : null}
      {reviewCaps
        ? <ul style={{ margin: '0 0 4px', paddingInlineStart: 18, display: 'grid', gap: 8 }}>{(ar ? reviewCaps.ar : reviewCaps.en).map((line) => <li key={line}>{line}</li>)}</ul>
        : <ul style={{ margin: '0 0 4px', paddingInlineStart: 18, display: 'grid', gap: 8 }}>{reviewGranted.map((line) => <li key={line}>{line}</li>)}</ul>}
    </AdminConfirmDialog>

    <AdminConfirmDialog
      open={roleDialog !== null}
      onClose={() => { if (!roleSaving) setRoleDialog(null) }}
      onConfirm={() => void submitRole()}
      title={roleDialog?.mode === 'edit'
        ? <AdminText en="Edit role" ar="تعديل الدور" />
        : <AdminText en="New role" ar="دور جديد" />}
      description={<AdminText en="Keys derive from the name and never change. Assign permissions in the matrix." ar="يُشتق المعرف من الاسم ولا يتغير. حدد الصلاحيات من المصفوفة." />}
      confirmLabel={roleSaving
        ? <AdminText en="Saving…" ar="جارٍ الحفظ…" />
        : roleDialog?.mode === 'edit'
          ? <AdminText en="Save role" ar="حفظ الدور" />
          : <AdminText en="Create role" ar="إنشاء الدور" />}
      cancelLabel={<AdminText en="Cancel" ar="إلغاء" />}
      canConfirm={!roleSaving}
    >
      <div className="sp-form">
        <label><AdminText en="Role name" ar="اسم الدور" /><input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Data Entry" /></label>
        {roleErrors.name && <p role="alert" style={{ color: '#b91c1c' }}>{roleErrors.name}</p>}
        <label><AdminText en="Description" ar="الوصف" /><textarea rows={2} value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Operational scope for this role" /></label>
        {roleServerError ? <p role="alert" style={{ color: '#b91c1c' }}>{roleServerError}</p> : null}
      </div>
    </AdminConfirmDialog>
  </>
}
