-- Phase 4E: Reviews permissions
-- Canonical permission catalog additions for reviews module

INSERT INTO `permissions` (`id`, `key`, `module`, `action`, `label`) VALUES
('perm_reviews_view', 'reviews.view', 'reviews', 'view', 'View reviews list'),
('perm_reviews_moderate', 'reviews.moderate', 'reviews', 'moderate', 'Publish, reject and return reviews to pending');

-- SUPER_ADMIN: full catalog (enforced in code as a bypass as well).
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_super_reviews_', p.`id`), r.`id`, p.`id`, 'phase-4e-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'SUPER_ADMIN' AND p.`key` IN ('reviews.view', 'reviews.moderate');

-- ADMIN: everything except roles.manage (mirrors today's ADMIN gates)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_admin_reviews_', p.`id`), r.`id`, p.`id`, 'phase-4e-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'ADMIN' AND p.`key` IN ('reviews.view', 'reviews.moderate');

-- STAFF: catalogue/requests/bookings/support R/W, minus users.manage and settings.edit
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`, `grantedBy`)
SELECT CONCAT('rp_staff_reviews_', p.`id`), r.`id`, p.`id`, 'phase-4e-backfill'
FROM `roles` r CROSS JOIN `permissions` p
WHERE r.`key` = 'STAFF' AND p.`key` IN ('reviews.view', 'reviews.moderate');