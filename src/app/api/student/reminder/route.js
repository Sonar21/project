import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const body = await req.json();
    const { studentId, email, name, reminders } = body || {};
    if (!studentId || !email || !Array.isArray(reminders)) {
      return new Response(JSON.stringify({ error: "missing parameters" }), {
        status: 400,
      });
    }

    // Build simple email body
    const subject = `支払いリマインダー — ${name || studentId}`;
    const monthsList = reminders.map((m) => `・${m}`).join("\n");
    const text = `以下の期間の支払いが未登録または未確認です:\n\n${monthsList}\n\nPayeduより自動送信されました。ご不明点は運営までご連絡ください。`;

    // Configure transporter using env vars
    const host = process.env.EMAIL_HOST;
    const port = Number(process.env.EMAIL_PORT || 587);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const from = process.env.FROM_EMAIL || user;

    if (!host || !user || !pass) {
      // In development, allow a console-only fallback so the UI can function
      // without SMTP configured. In production, require proper SMTP settings.
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "nodemailer not configured — logging reminder instead of sending"
        );
        console.log("[reminder email] to:", email);
        console.log("[reminder subject]:", subject);
        console.log("[reminder body]:\n", text);
        return new Response(JSON.stringify({ ok: true, info: "logged" }), {
          status: 200,
        });
      }

      return new Response(JSON.stringify({ error: "mail config not set" }), {
        status: 500,
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error("/api/student/reminder error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
}
