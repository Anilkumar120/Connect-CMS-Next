ALTER TABLE `Form`
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD INDEX `Form_deletedAt_idx`(`deletedAt`);

ALTER TABLE `FormSubmission`
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD INDEX `FormSubmission_deletedAt_idx`(`deletedAt`);
