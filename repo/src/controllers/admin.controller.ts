import { Request, Response, NextFunction } from "express";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createCarouselItemSchema,
  updateCarouselItemSchema,
  createVenueSchema,
  createBookingSchema,
  updateBookingSchema,
} from "../schemas/admin.schema";
import * as adminService from "../services/admin.service";

// ─── Organizations ────────────────────────────────────────────────────────────

export async function handleListOrgs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orgs = await adminService.listOrganizations();
    res.json({ data: orgs });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createOrganizationSchema.parse(req.body);
    const org = await adminService.createOrganization(
      req.user!.id,
      input,
      req.user!.organizationId
    );
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateOrg(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateOrganizationSchema.parse(req.body);
    const org = await adminService.updateOrganization(
      req.params.organizationId,
      req.user!.id,
      req.user!.organizationId,
      input
    );
    res.json(org);
  } catch (err) {
    next(err);
  }
}

// ─── Announcements ────────────────────────────────────────────────────────────

export async function handleListAnnouncements(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await adminService.listAnnouncements(req.user!.organizationId);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createAnnouncementSchema.parse(req.body);
    const item = await adminService.createAnnouncement(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateAnnouncementSchema.parse(req.body);
    const item = await adminService.updateAnnouncement(
      req.params.announcementId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteAnnouncement(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await adminService.deleteAnnouncement(
      req.params.announcementId,
      req.user!.organizationId,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Carousel Items ───────────────────────────────────────────────────────────

export async function handleListCarouselItems(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await adminService.listCarouselItems(req.user!.organizationId);
    res.json({ data: items });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateCarouselItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createCarouselItemSchema.parse(req.body);
    const item = await adminService.createCarouselItem(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateCarouselItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateCarouselItemSchema.parse(req.body);
    const item = await adminService.updateCarouselItem(
      req.params.itemId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteCarouselItem(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await adminService.deleteCarouselItem(
      req.params.itemId,
      req.user!.organizationId,
      req.user!.id
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function handleListVenues(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const venues = await adminService.listVenues(req.user!.organizationId);
    res.json({ data: venues });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateVenue(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createVenueSchema.parse(req.body);
    const venue = await adminService.createVenue(
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(venue);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createBookingSchema.parse(req.body);
    const booking = await adminService.createBooking(
      req.params.venueId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateBooking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = updateBookingSchema.parse(req.body);
    const booking = await adminService.updateBooking(
      req.params.bookingId,
      req.user!.organizationId,
      req.user!.id,
      input
    );
    res.json(booking);
  } catch (err) {
    next(err);
  }
}
