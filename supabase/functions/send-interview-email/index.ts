import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (!SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not configured");
    }

    const { candidateEmail, candidateName, jobTitle, interviewLink } = await req.json();

    if (!candidateEmail || !interviewLink || !jobTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: candidateEmail, interviewLink, jobTitle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const greeting = candidateName ? `Dear ${candidateName}` : "Dear Candidate";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Interview Invitation</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px; color: #374151;">${greeting},</p>
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
            You have been invited to take an interview for the position of <strong style="color: #374151;">${jobTitle}</strong>.
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px; color: #374151; font-size: 14px;">Instructions:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
              <li>Click the button below to start your interview</li>
              <li>Ensure you have a stable internet connection</li>
              <li>Allow webcam access when prompted</li>
              <li>Complete all questions within the allotted time</li>
              <li>Do not switch tabs during the interview</li>
            </ul>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${interviewLink}" style="background: #6366f1; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 600; display: inline-block;">
              Start Interview
            </a>
          </div>
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 24px;">
            This link is unique to you and can only be used once. If you have any issues, please contact the HR team.
          </p>
        </div>
      </div>
    `;

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: candidateEmail, name: candidateName || undefined }] }],
        from: { email: "noreply@interview-platform.com", name: "AI Interview Platform" },
        subject: `Interview Invitation – ${jobTitle}`,
        content: [{ type: "text/html", value: htmlContent }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SendGrid error:", errorText);
      throw new Error(`SendGrid API error [${response.status}]: ${errorText}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
