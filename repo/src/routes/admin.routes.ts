import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { tenantScope } from "../middleware/tenantScope";
import { writeRateLimiter, readRateLimiter } from "../middleware/rateLimiter";
import {
  handleListOrgs,
  handleCreateOrg,
  handleUpdateOrg,
  handleListAnnouncements,
  handleCreateAnnouncement,
  handleUpdateAnnouncement,
  handleDeleteAnnouncement,
  handleListCarouselItems,
  handleCreateCarouselItem,
  handleUpdateCarouselItem,
  handleDeleteCarouselItem,
  handleListVenues,
  handleCreateVenue,
  handleCreateBooking,
  handleUpdateBooking,
} from "../controllers/admin.controller";

const router = Router();
router.use(authenticate, tenantScope);

const adminOnly = requireRole("ADMINISTRATOR");
const modOrAdmin = requireRole("MODERATOR", "ADMINISTRATOR");

// Organizations
router.get("/admin/organizations", readRateLimiter, adminOnly, handleListOrgs);
router.post("/admin/organizations", writeRateLimiter, adminOnly, handleCreateOrg);
router.patch("/admin/organizations/:organizationId", writeRateLimiter, adminOnly, handleUpdateOrg);

// Announcements — list is visible to mods/admins; write operations admin-only
router.get("/admin/announcements", readRateLimiter, modOrAdmin, handleListAnnouncements);
router.post("/admin/announcements", writeRateLimiter, adminOnly, handleCreateAnnouncement);
router.patch("/admin/announcements/:announcementId", writeRateLimiter, adminOnly, handleUpdateAnnouncement);
router.delete("/admin/announcements/:announcementId", writeRateLimiter, adminOnly, handleDeleteAnnouncement);

// Carousel Items
router.get("/admin/carousel-items", readRateLimiter, modOrAdmin, handleListCarouselItems);
router.post("/admin/carousel-items", writeRateLimiter, adminOnly, handleCreateCarouselItem);
router.patch("/admin/carousel-items/:itemId", writeRateLimiter, adminOnly, handleUpdateCarouselItem);
router.delete("/admin/carousel-items/:itemId", writeRateLimiter, adminOnly, handleDeleteCarouselItem);

// Venues — all authenticated users can read; writes require admin
router.get("/admin/venues", readRateLimiter, handleListVenues);
router.post("/admin/venues", writeRateLimiter, adminOnly, handleCreateVenue);
router.post("/admin/venues/:venueId/bookings", writeRateLimiter, handleCreateBooking);
router.patch("/admin/venue-bookings/:bookingId", writeRateLimiter, handleUpdateBooking);

export default router;
