import {
  Organization,
  Announcement,
  CarouselItem,
  Venue,
  VenueBooking,
} from "@prisma/client";
import { adminRepository } from "../repositories/admin.repository";
import { organizationRepository } from "../repositories/organization.repository";
import { auditRepository } from "../repositories/audit.repository";
import { notifyAnnouncementPublished } from "./notification.service";
import { AppError } from "../middleware/errorHandler";
import { ErrorCode } from "../types";
import type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  CreateCarouselItemInput,
  UpdateCarouselItemInput,
  CreateVenueInput,
  CreateBookingInput,
  UpdateBookingInput,
} from "../schemas/admin.schema";

// ─── Organizations ────────────────────────────────────────────────────────────

export async function listOrganizations(
  actorOrgId: string
): Promise<Organization[]> {
  // Scoped to the actor's own organization — prevents cross-tenant data leakage
  const org = await organizationRepository.findById(actorOrgId);
  return org ? [org] : [];
}

export async function createOrganization(
  actorId: string,
  input: CreateOrganizationInput,
  actorOrgId: string
): Promise<Organization> {
  const existing = await organizationRepository.findBySlug(input.slug);
  if (existing) {
    throw new AppError(
      409,
      ErrorCode.CONFLICT,
      `Organization slug "${input.slug}" is already taken`
    );
  }

  const org = await organizationRepository.create(input);

  await auditRepository.create({
    organizationId: actorOrgId,
    actorId,
    eventType: "organization.created",
    resourceType: "Organization",
    resourceId: org.id,
    details: { name: org.name, slug: org.slug },
  });

  return org;
}

export async function updateOrganization(
  orgId: string,
  actorId: string,
  actorOrgId: string,
  input: UpdateOrganizationInput
): Promise<Organization> {
  // Enforce tenant scope — admins may only update their own organization
  if (orgId !== actorOrgId) {
    throw new AppError(
      403,
      ErrorCode.FORBIDDEN,
      "Cannot update a different organization"
    );
  }

  const existing = await organizationRepository.findById(orgId);
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Organization not found");
  }

  const updated = await organizationRepository.update(orgId, input);

  await auditRepository.create({
    organizationId: actorOrgId,
    actorId,
    eventType: "organization.updated",
    resourceType: "Organization",
    resourceId: orgId,
    details: input,
  });

  return updated;
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function listAnnouncements(
  organizationId: string
): Promise<Announcement[]> {
  return adminRepository.findAnnouncements(organizationId);
}

export async function createAnnouncement(
  organizationId: string,
  actorId: string,
  input: CreateAnnouncementInput
): Promise<Announcement> {
  const item = await adminRepository.createAnnouncement({
    organizationId,
    title: input.title,
    body: input.body,
    order: input.order,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
    isPublished: input.isPublished,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "announcement.created",
    resourceType: "Announcement",
    resourceId: item.id,
    details: { title: item.title, isPublished: item.isPublished },
  });

  if (item.isPublished) {
    void notifyAnnouncementPublished(organizationId, item.title, item.body);
  }

  return item;
}

export async function updateAnnouncement(
  announcementId: string,
  organizationId: string,
  actorId: string,
  input: UpdateAnnouncementInput
): Promise<Announcement> {
  const existing = await adminRepository.findAnnouncementById(
    announcementId,
    organizationId
  );
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Announcement not found");
  }

  const updated = await adminRepository.updateAnnouncement(announcementId, {
    ...input,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "announcement.updated",
    resourceType: "Announcement",
    resourceId: announcementId,
    details: input,
  });

  // Notify org users when an announcement transitions to published
  if (input.isPublished && !existing.isPublished) {
    void notifyAnnouncementPublished(organizationId, updated.title, updated.body);
  }

  return updated;
}

export async function deleteAnnouncement(
  announcementId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const existing = await adminRepository.findAnnouncementById(
    announcementId,
    organizationId
  );
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Announcement not found");
  }

  await adminRepository.deleteAnnouncement(announcementId);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "announcement.deleted",
    resourceType: "Announcement",
    resourceId: announcementId,
  });
}

// ─── Carousel Items ───────────────────────────────────────────────────────────

export async function listCarouselItems(
  organizationId: string
): Promise<CarouselItem[]> {
  return adminRepository.findCarouselItems(organizationId);
}

export async function createCarouselItem(
  organizationId: string,
  actorId: string,
  input: CreateCarouselItemInput
): Promise<CarouselItem> {
  const item = await adminRepository.createCarouselItem({
    organizationId,
    title: input.title,
    imageUrl: input.imageUrl,
    linkUrl: input.linkUrl,
    order: input.order,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
    isActive: input.isActive,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "carousel_item.created",
    resourceType: "CarouselItem",
    resourceId: item.id,
  });

  return item;
}

export async function updateCarouselItem(
  itemId: string,
  organizationId: string,
  actorId: string,
  input: UpdateCarouselItemInput
): Promise<CarouselItem> {
  const existing = await adminRepository.findCarouselItemById(
    itemId,
    organizationId
  );
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Carousel item not found");
  }

  const updated = await adminRepository.updateCarouselItem(itemId, {
    ...input,
    startAt: input.startAt ? new Date(input.startAt) : undefined,
    endAt: input.endAt ? new Date(input.endAt) : undefined,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "carousel_item.updated",
    resourceType: "CarouselItem",
    resourceId: itemId,
  });

  return updated;
}

export async function deleteCarouselItem(
  itemId: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const existing = await adminRepository.findCarouselItemById(
    itemId,
    organizationId
  );
  if (!existing) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Carousel item not found");
  }

  await adminRepository.deleteCarouselItem(itemId);

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "carousel_item.deleted",
    resourceType: "CarouselItem",
    resourceId: itemId,
  });
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function listVenues(organizationId: string): Promise<Venue[]> {
  return adminRepository.findVenues(organizationId);
}

export async function createVenue(
  organizationId: string,
  actorId: string,
  input: CreateVenueInput
): Promise<Venue> {
  const venue = await adminRepository.createVenue({ ...input, organizationId });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "venue.created",
    resourceType: "Venue",
    resourceId: venue.id,
    details: { name: venue.name },
  });

  return venue;
}

// ─── Venue Bookings ───────────────────────────────────────────────────────────

export async function createBooking(
  venueId: string,
  organizationId: string,
  actorId: string,
  input: CreateBookingInput
): Promise<VenueBooking> {
  const venue = await adminRepository.findVenueById(venueId, organizationId);
  if (!venue) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Venue not found");
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  const conflict = await adminRepository.findOverlappingBooking(
    venueId,
    startAt,
    endAt
  );
  if (conflict) {
    throw new AppError(
      409,
      ErrorCode.BOOKING_CONFLICT,
      "Venue is already booked during the requested time window"
    );
  }

  const booking = await adminRepository.createBooking({
    organizationId,
    venueId,
    bookedById: actorId,
    title: input.title,
    startAt,
    endAt,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "venue_booking.created",
    resourceType: "VenueBooking",
    resourceId: booking.id,
    details: { venueId, startAt: input.startAt, endAt: input.endAt },
  });

  return booking;
}

export async function updateBooking(
  bookingId: string,
  organizationId: string,
  actorId: string,
  input: UpdateBookingInput
): Promise<VenueBooking> {
  const booking = await adminRepository.findBookingById(bookingId);
  if (!booking) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Booking not found");
  }

  // Verify the venue belongs to this org
  const venue = await adminRepository.findVenueById(
    booking.venueId,
    organizationId
  );
  if (!venue) {
    throw new AppError(404, ErrorCode.NOT_FOUND, "Booking not found");
  }

  const startAt = input.startAt ? new Date(input.startAt) : booking.startAt;
  const endAt = input.endAt ? new Date(input.endAt) : booking.endAt;

  // Validate merged times — startAt must be before endAt
  if (startAt >= endAt) {
    throw new AppError(
      400,
      ErrorCode.VALIDATION_ERROR,
      "Booking start time must be before end time"
    );
  }

  const conflict = await adminRepository.findOverlappingBooking(
    booking.venueId,
    startAt,
    endAt,
    bookingId
  );
  if (conflict) {
    throw new AppError(
      409,
      ErrorCode.BOOKING_CONFLICT,
      "Venue is already booked during the requested time window"
    );
  }

  const updated = await adminRepository.updateBooking(bookingId, {
    title: input.title,
    startAt,
    endAt,
  });

  await auditRepository.create({
    organizationId,
    actorId,
    eventType: "venue_booking.updated",
    resourceType: "VenueBooking",
    resourceId: bookingId,
  });

  return updated;
}
