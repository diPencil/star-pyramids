-- Phase 4F: Website Enquiries permissions
-- Canonical permission catalog additions for enquiries module

INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_enquiries_view', 'enquiries.view', 'enquiries', 'view', 'View website enquiries list'),
('perm_enquiries_manage', 'enquiries.manage', 'enquiries', 'manage', 'Update enquiry status, assign, add internal notes');

-- SUPER_ADMIN: full catalog (enforced in code as a bypass as well).
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_super_enquiries_', p.`id`), r.`id`, p.`id`, 'phase-4f-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'SUPER_ADMIN' AND p.`key` IN ('enquiries.view', 'enquiries.manage');

-- ADMIN: everything except roles.manage (mirrors today's ADMIN gates)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_admin_enquiries_', p.`id`), r.`id`, p.`id`, 'phase-4f-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'ADMIN' AND p.`key` IN ('enquiries.view', 'enquiries.manage');

-- STAFF: catalogue/requests/bookings/support R/W, minus users.manage and settings.edit
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_staff_enquiries_', p.`id`), r.`id`, p.`id`, 'phase-4f-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'STAFF' AND p.`key` IN ('enquiries.view', 'enquiries.manage');