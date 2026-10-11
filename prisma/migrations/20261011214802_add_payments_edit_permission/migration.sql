-- Seed the manual/offline payment permission (Phase 1: staff-recorded
-- receipts, no gateway). Data-only: one catalog row plus explicit
-- grants. SUPER_ADMIN holds everything by code bypass as well; ADMIN
-- mirrors bookings.edit; STAFF intentionally excluded (money movement
-- stays ADMIN+ until reviewed otherwise).
INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_payments_edit', 'payments.edit', 'payments', 'edit', 'Record offline payments and refunds');

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT 'rp_super_perm_payments_edit', r.`id`, p.`id`, 'manual-payments-phase1'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'SUPER_ADMIN' AND p.`key` = 'payments.edit';

INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT 'rp_admin_perm_payments_edit', r.`id`, p.`id`, 'manual-payments-phase1'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'ADMIN' AND p.`key` = 'payments.edit';
