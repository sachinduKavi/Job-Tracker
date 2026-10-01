-- CreateTable
CREATE TABLE `Application` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(20) NOT NULL,
    `company` VARCHAR(200) NOT NULL,
    `position` VARCHAR(200) NOT NULL,
    `location` VARCHAR(200) NULL,
    `status` ENUM('DRAFT', 'APPLIED', 'ACKNOWLEDGED', 'HR_SCREENING', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE') NOT NULL DEFAULT 'DRAFT',
    `source` ENUM('LINKEDIN', 'COMPANY_WEBSITE', 'JOB_BOARD', 'REFERRAL', 'RECRUITER', 'EMAIL', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `jobUrl` VARCHAR(2048) NULL,
    `recipientEmail` VARCHAR(320) NULL,
    `cc` TEXT NULL,
    `bcc` TEXT NULL,
    `emailSubject` VARCHAR(500) NULL,
    `emailBody` TEXT NULL,
    `notes` TEXT NULL,
    `dateApplied` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Application_applicationId_key`(`applicationId`),
    INDEX `Application_status_idx`(`status`),
    INDEX `Application_source_idx`(`source`),
    INDEX `Application_dateApplied_idx`(`dateApplied`),
    INDEX `Application_company_idx`(`company`),
    INDEX `Application_position_idx`(`position`),
    INDEX `Application_location_idx`(`location`),
    INDEX `Application_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationTechnology` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    INDEX `ApplicationTechnology_name_idx`(`name`),
    UNIQUE INDEX `ApplicationTechnology_applicationId_name_key`(`applicationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Email` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `to` VARCHAR(320) NOT NULL,
    `cc` TEXT NULL,
    `bcc` TEXT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `textBody` MEDIUMTEXT NULL,
    `sesMessageId` VARCHAR(255) NULL,
    `emailStatus` ENUM('SENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINT', 'FAILED') NOT NULL DEFAULT 'SENDING',
    `idempotencyKey` VARCHAR(64) NOT NULL,
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `statusUpdatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Email_sesMessageId_key`(`sesMessageId`),
    UNIQUE INDEX `Email_idempotencyKey_key`(`idempotencyKey`),
    INDEX `Email_applicationId_idx`(`applicationId`),
    INDEX `Email_emailStatus_idx`(`emailStatus`),
    INDEX `Email_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `emailId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,

    INDEX `EmailAttachment_emailId_idx`(`emailId`),
    INDEX `EmailAttachment_documentId_idx`(`documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` ENUM('CV', 'COVER_LETTER', 'OTHER') NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `originalFilename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Document_storageKey_key`(`storageKey`),
    INDEX `Document_type_isDefault_idx`(`type`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationDocument` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `role` ENUM('CV', 'COVER_LETTER', 'ADDITIONAL') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationDocument_documentId_idx`(`documentId`),
    UNIQUE INDEX `ApplicationDocument_applicationId_documentId_key`(`applicationId`, `documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'APPLIED', 'ACKNOWLEDGED', 'HR_SCREENING', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE') NULL,
    `toStatus` ENUM('DRAFT', 'APPLIED', 'ACKNOWLEDGED', 'HR_SCREENING', 'TECHNICAL_INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE') NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StatusHistory_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailTemplate_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApplicationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `eventType` ENUM('APPLICATION_CREATED', 'APPLICATION_UPDATED', 'STATUS_CHANGED', 'EMAIL_SENT', 'EMAIL_FAILED', 'EMAIL_DELIVERED', 'EMAIL_BOUNCED', 'EMAIL_COMPLAINT', 'DOCUMENTS_UPDATED', 'NOTE') NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApplicationEvent_applicationId_createdAt_idx`(`applicationId`, `createdAt`),
    INDEX `ApplicationEvent_eventType_idx`(`eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` VARCHAR(20) NOT NULL DEFAULT 'default',
    `fullName` VARCHAR(200) NOT NULL DEFAULT '',
    `email` VARCHAR(320) NOT NULL DEFAULT '',
    `phone` VARCHAR(50) NOT NULL DEFAULT '',
    `location` VARCHAR(200) NOT NULL DEFAULT '',
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Counter` (
    `name` VARCHAR(50) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApplicationTechnology` ADD CONSTRAINT `ApplicationTechnology_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Email` ADD CONSTRAINT `Email_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailAttachment` ADD CONSTRAINT `EmailAttachment_emailId_fkey` FOREIGN KEY (`emailId`) REFERENCES `Email`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailAttachment` ADD CONSTRAINT `EmailAttachment_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationDocument` ADD CONSTRAINT `ApplicationDocument_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationDocument` ADD CONSTRAINT `ApplicationDocument_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StatusHistory` ADD CONSTRAINT `StatusHistory_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationEvent` ADD CONSTRAINT `ApplicationEvent_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
