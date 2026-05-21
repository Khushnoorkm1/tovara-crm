"use server";

import { revalidatePath } from "next/cache";
import { publicBookingSchema } from "@/lib/validators/public-booking";
import {
  createPublicBooking,
  PublicBookingError,
} from "@/server/services/public-booking.service";

export type PublicActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

/**
 * Submit a booking from the public widget. Returns the confirmation code on
 * success so the client can navigate to /book/[slug]/confirmed/[code].
 */
export async function submitPublicBookingAction(
  input: unknown,
): Promise<
  PublicActionResult<{ confirmationCode: string; status: string; checkoutUrl: string | null }>
> {
  const parsed = publicBookingSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return {
      ok: false,
      error: first?.message ?? "Validation failed",
      field: first?.path?.[0]?.toString(),
    };
  }
  try {
    const result = await createPublicBooking(parsed.data);
    // Show new bookings on the host's reservation list right away
    revalidatePath("/reservations");
    revalidatePath("/dashboard");
    revalidatePath("/floor");
    return {
      ok: true,
      data: {
        confirmationCode: result.confirmationCode,
        status: result.status,
        checkoutUrl: result.checkoutUrl,
      },
    };
  } catch (err) {
    if (err instanceof PublicBookingError) {
      return { ok: false, error: err.message };
    }
    console.error("[public-booking] error:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
