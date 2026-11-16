CREATE TABLE `social_identities` (
    `provider` VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `namespace` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `subject` VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `authorizedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`provider`, `namespace`, `subject`),
    UNIQUE INDEX `social_identities_userId_provider_namespace_key` (`userId`, `provider`, `namespace`),
    CONSTRAINT `social_identities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `facebook_login_revocations` (
    `identityKey` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `revokedThrough` DATETIME(3) NULL,

    PRIMARY KEY (`identityKey`),
    INDEX `facebook_login_revocations_revokedThrough_idx` (`revokedThrough`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
