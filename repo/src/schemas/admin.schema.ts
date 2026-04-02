import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with hyphens"
    ),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

const announcementFields = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(10_000),
  order: z.number().int().min(0).optional(),
  startAt: z.string().datetime({ message: "startAt must be ISO 8601 UTC" }).optional(),
  endAt: z.string().datetime({ message: "endAt must be ISO 8601 UTC" }).optional(),
  isPublished: z.boolean().optional(),
});

const announcementDateOrderRefine = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (d: z.infer<typeof announcementFields>) => {
      if (d.startAt && d.endAt) return new Date(d.startAt) < new Date(d.endAt);
      return true;
    },
    { message: "endAt must be after startAt", path: ["endAt"] }
  );

export const createAnnouncementSchema = announcementDateOrderRefine(announcementFields);

export const updateAnnouncementSchema = announcementDateOrderRefine(announcementFields.partial());

export const createCarouselItemSchema = z.object({
  title: z.string().min(1).max(300),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
  order: z.number().int().min(0).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const updateCarouselItemSchema = createCarouselItemSchema.partial();

export const createVenueSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  capacity: z.number().int().positive().optional(),
});

const bookingFields = z.object({
  title: z.string().min(1).max(300),
  startAt: z.string().datetime({ message: "startAt must be ISO 8601 UTC" }),
  endAt: z.string().datetime({ message: "endAt must be ISO 8601 UTC" }),
});

export const createBookingSchema = bookingFields.refine(
  (d) => new Date(d.startAt) < new Date(d.endAt),
  {
    message: "endAt must be after startAt",
    path: ["endAt"],
  }
);

export const updateBookingSchema = bookingFields.partial().refine(
  (d) => {
    if (d.startAt && d.endAt) return new Date(d.startAt) < new Date(d.endAt);
    return true;
  },
  { message: "endAt must be after startAt", path: ["endAt"] }
);

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreateCarouselItemInput = z.infer<typeof createCarouselItemSchema>;
export type UpdateCarouselItemInput = z.infer<typeof updateCarouselItemSchema>;
export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
