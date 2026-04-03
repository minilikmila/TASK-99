-- Add organizationId to VenueBooking (backfill from Venue relation)
ALTER TABLE `VenueBooking` ADD COLUMN `organizationId` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `VenueBooking` vb
  INNER JOIN `Venue` v ON vb.venueId = v.id
  SET vb.organizationId = v.organizationId;
ALTER TABLE `VenueBooking` ADD CONSTRAINT `VenueBooking_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX `VenueBooking_organizationId_idx` ON `VenueBooking`(`organizationId`);

-- Add organizationId to RecycleBinItem (backfill from Thread/Reply relations)
ALTER TABLE `RecycleBinItem` ADD COLUMN `organizationId` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `RecycleBinItem` rbi
  LEFT JOIN `Thread` t ON rbi.threadId = t.id
  LEFT JOIN `Reply` r ON rbi.replyId = r.id
  LEFT JOIN `Thread` rt ON r.threadId = rt.id
  SET rbi.organizationId = COALESCE(t.organizationId, rt.organizationId, '');
ALTER TABLE `RecycleBinItem` ADD CONSTRAINT `RecycleBinItem_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX `RecycleBinItem_organizationId_idx` ON `RecycleBinItem`(`organizationId`);

-- Add organizationId to NotificationSubscription (backfill from User relation)
ALTER TABLE `NotificationSubscription` ADD COLUMN `organizationId` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `NotificationSubscription` ns
  INNER JOIN `User` u ON ns.userId = u.id
  SET ns.organizationId = u.organizationId;
ALTER TABLE `NotificationSubscription` ADD CONSTRAINT `NotificationSubscription_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX `NotificationSubscription_organizationId_idx` ON `NotificationSubscription`(`organizationId`);
