-- Phase 4B customer permissions. Additive catalog rows only: no table
-- changes, no backfill of user data. Grants mirror the operational tier
-- that already manages bookings and requests (SUPER_ADMIN / ADMIN / STAFF).
INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_customers_view', 'customers.view', 'customers', 'view', 'View customer directory'),
('perm_customers_edit', 'customers.edit', 'customers', 'edit', 'Suspend and reactivate customers');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_', LOWER(r.`key`), '_perm_customers_view'), r.`id`, p.`id`, 'phase-4b-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` IN ('SUPER_ADMIN', 'ADMIN', 'STAFF') AND p.`key` = 'customers.view';

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_', LOWER(r.`key`), '_perm_customers_edit'), r.`id`, p.`id`, 'phase-4b-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` IN ('SUPER_ADMIN', 'ADMIN', 'STAFF') AND p.`key` = 'customers.edit';
