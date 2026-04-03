import {
  Announcement,
  CarouselItem,
  Venue,
  VenueBooking,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma";

// ─── Announcements ────────────────────────────────────────────────────────────

export interface CreateAnnouncementInput {
  organizationId: string;
  title: string;
  body: string;
  order?: number;
  startAt?: Date;
  endAt?: Date;
  isPublished?: boolean;
}

export const adminRepository = {
  // Announcements
  findAnnouncements(organizationId: string): Promise<Announcement[]> {
    return prisma.announcement.findMany({
      where: { organizationId },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  },

  findAnnouncementById(
    id: string,
    organizationId: string
  ): Promise<Announcement | null> {
    return prisma.announcement.findFirst({ where: { id, organizationId } });
  },

  createAnnouncement(data: CreateAnnouncementInput): Promise<Announcement> {
    return prisma.announcement.create({ data });
  },

  updateAnnouncement(
    id: string,
    data: Partial<
      Pick<
        Announcement,
        "title" | "body" | "order" | "startAt" | "endAt" | "isPublished"
      >
    >
  ): Promise<Announcement> {
    return prisma.announcement.update({ where: { id }, data });
  },

  deleteAnnouncement(id: string): Promise<Announcement> {
    return prisma.announcement.delete({ where: { id } });
  },

  // Carousel items
  findCarouselItems(organizationId: string): Promise<CarouselItem[]> {
    return prisma.carouselItem.findMany({
      where: { organizationId },
      orderBy: { order: "asc" },
    });
  },

  findCarouselItemById(
    id: string,
    organizationId: string
  ): Promise<CarouselItem | null> {
    return prisma.carouselItem.findFirst({ where: { id, organizationId } });
  },

  createCarouselItem(
    data: Omit<Prisma.CarouselItemCreateInput, "organization"> & {
      organizationId: string;
    }
  ): Promise<CarouselItem> {
    const { organizationId, ...rest } = data;
    return prisma.carouselItem.create({
      data: {
        ...rest,
        organization: { connect: { id: organizationId } },
      },
    });
  },

  updateCarouselItem(
    id: string,
    data: Partial<
      Pick<
        CarouselItem,
        "title" | "imageUrl" | "linkUrl" | "order" | "startAt" | "endAt" | "isActive"
      >
    >
  ): Promise<CarouselItem> {
    return prisma.carouselItem.update({ where: { id }, data });
  },

  deleteCarouselItem(id: string): Promise<CarouselItem> {
    return prisma.carouselItem.delete({ where: { id } });
  },

  // Venues
  findVenues(organizationId: string): Promise<Venue[]> {
    return prisma.venue.findMany({ where: { organizationId } });
  },

  findVenueById(id: string, organizationId: string): Promise<Venue | null> {
    return prisma.venue.findFirst({ where: { id, organizationId } });
  },

  createVenue(data: {
    organizationId: string;
    name: string;
    description?: string;
    capacity?: number;
  }): Promise<Venue> {
    return prisma.venue.create({ data });
  },

  // Venue bookings
  findOverlappingBooking(
    venueId: string,
    startAt: Date,
    endAt: Date,
    excludeBookingId?: string
  ): Promise<VenueBooking | null> {
    return prisma.venueBooking.findFirst({
      where: {
        venueId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
        ...(excludeBookingId && { id: { not: excludeBookingId } }),
      },
    });
  },

  createBooking(data: {
    organizationId: string;
    venueId: string;
    bookedById: string;
    title: string;
    startAt: Date;
    endAt: Date;
  }): Promise<VenueBooking> {
    return prisma.venueBooking.create({ data });
  },

  findBookingById(id: string): Promise<VenueBooking | null> {
    return prisma.venueBooking.findUnique({ where: { id } });
  },

  updateBooking(
    id: string,
    data: Partial<Pick<VenueBooking, "title" | "startAt" | "endAt">>
  ): Promise<VenueBooking> {
    return prisma.venueBooking.update({ where: { id }, data });
  },
};
