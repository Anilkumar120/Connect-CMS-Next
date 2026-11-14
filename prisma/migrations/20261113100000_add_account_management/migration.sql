ALTER TABLE `User`
    ADD COLUMN `phone` VARCHAR(32) NULL,
    ADD COLUMN `avatarUrl` VARCHAR(1000) NULL,
    ADD UNIQUE INDEX `User_phone_key` (`phone`);

CREATE TABLE `PasswordResetOtp` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `recipientHash` CHAR(64) NOT NULL,
    `requestIpHash` CHAR(64) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `failedAttempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `PasswordResetOtp_recipientHash_channel_createdAt_idx` (`recipientHash`, `channel`, `createdAt`),
    INDEX `PasswordResetOtp_requestIpHash_createdAt_idx` (`requestIpHash`, `createdAt`),
    INDEX `PasswordResetOtp_userId_idx` (`userId`),
    CONSTRAINT `PasswordResetOtp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
