import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../../db/index.js";
import { dailyExpenses } from "../../db/schema.js";

export default async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");

    if (date) {
      const [record] = await db.select().from(dailyExpenses).where(eq(dailyExpenses.date, date));
      return Response.json(record ?? null);
    }

    if (dateFrom && dateTo) {
      const records = await db
        .select()
        .from(dailyExpenses)
        .where(and(gte(dailyExpenses.date, dateFrom), lte(dailyExpenses.date, dateTo)))
        .orderBy(dailyExpenses.date);
      return Response.json(records);
    }

    const records = await db.select().from(dailyExpenses).orderBy(desc(dailyExpenses.createdAt));
    return Response.json(records);
  }

  if (req.method === "POST") {
    const { date, counter, expenses, action } = await req.json();

    if (!date) {
      return Response.json(
        { success: false, error: "Date is required for expense records." },
        { status: 400 },
      );
    }

    const [existing] = await db.select().from(dailyExpenses).where(eq(dailyExpenses.date, date));

    if (existing) {
      if (action === "append") {
        const [updated] = await db
          .update(dailyExpenses)
          .set({
            counter,
            expenses: [...(existing.expenses as unknown[]), ...expenses],
            updatedAt: new Date(),
          })
          .where(eq(dailyExpenses.date, date))
          .returning();
        return Response.json({ success: true, data: updated });
      }

      if (action === "replace") {
        const [updated] = await db
          .update(dailyExpenses)
          .set({ counter, expenses, updatedAt: new Date() })
          .where(eq(dailyExpenses.date, date))
          .returning();
        return Response.json({ success: true, data: updated });
      }

      return Response.json(
        {
          success: false,
          error: "A record for this date already exists.",
          conflict: true,
          data: existing,
        },
        { status: 409 },
      );
    }

    const [created] = await db
      .insert(dailyExpenses)
      .values({ date, counter, expenses })
      .returning();
    return Response.json({ success: true, data: created }, { status: 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};
