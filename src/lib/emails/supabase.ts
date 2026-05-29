type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type TemplateParams = {
  subject: string;
  title: string;
  preheader: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  outro: string;
};

const BRAND_NAME = "Studyhive";
const BRAND_TAGLINE = "Collaborative study hub";
const PRIMARY = "#3a5a40";
const BG = "#f6f4ee";
const CARD = "#ffffff";
const TEXT = "#1f2933";
const MUTED = "#6b7280";

function renderTemplate(params: TemplateParams): EmailTemplate {
  const { subject, title, preheader, intro, ctaLabel, ctaUrl, outro } = params;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};">
    <span style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${CARD};border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px 32px 8px 32px;font-family:Segoe UI, Helvetica, Arial, sans-serif;color:${TEXT};">
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="height:40px;width:40px;border-radius:12px;background:${PRIMARY};color:#ffffff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">SH</div>
                  <div>
                    <div style="font-size:18px;font-weight:700;">${BRAND_NAME}</div>
                    <div style="font-size:12px;color:${MUTED};">${BRAND_TAGLINE}</div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;font-family:Segoe UI, Helvetica, Arial, sans-serif;color:${TEXT};">
                <h1 style="margin:16px 0 8px 0;font-size:26px;line-height:1.2;">${title}</h1>
                <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:${MUTED};">${intro}</p>
                <div style="margin:24px 0;">
                  <a href="${ctaUrl}" style="display:inline-block;background:${PRIMARY};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600;">${ctaLabel}</a>
                </div>
                <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:${MUTED};">If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:0 0 20px 0;font-size:12px;line-height:1.6;word-break:break-all;"><a href="${ctaUrl}" style="color:${PRIMARY};text-decoration:underline;">${ctaUrl}</a></p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">${outro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;font-family:Segoe UI, Helvetica, Arial, sans-serif;color:${MUTED};font-size:12px;border-top:1px solid #ece8de;">
                If you did not request this email, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${title}`,
    "",
    intro,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    outro,
    "",
    "If you did not request this email, you can safely ignore it.",
  ].join("\n");

  return { subject, html, text };
}

const CONFIRMATION_URL = "{{ .ConfirmationURL }}";

export function magicLinkSignInEmail(): EmailTemplate {
  return renderTemplate({
    subject: "Sign in to Studyhive",
    title: "Sign in with your secure link",
    preheader: "Use this link to sign in to Studyhive.",
    intro: "Use the button below to sign in to your Studyhive account. This link can only be used once.",
    ctaLabel: "Sign in",
    ctaUrl: CONFIRMATION_URL,
    outro: "If you did not request a sign-in link, you can ignore this message.",
  });
}

export function confirmEmailAddress(): EmailTemplate {
  return renderTemplate({
    subject: "Confirm your email for Studyhive",
    title: "Confirm your email address",
    preheader: "Confirm your email to finish setting up Studyhive.",
    intro: "Thanks for joining Studyhive. Please confirm your email address to finish setting up your account.",
    ctaLabel: "Confirm email",
    ctaUrl: CONFIRMATION_URL,
    outro: "If you did not create an account, you can ignore this email.",
  });
}

export function resetPasswordEmail(): EmailTemplate {
  return renderTemplate({
    subject: "Reset your Studyhive password",
    title: "Reset your password",
    preheader: "Reset your Studyhive password.",
    intro: "We received a request to reset your password. Use the link below to choose a new one.",
    ctaLabel: "Reset password",
    ctaUrl: CONFIRMATION_URL,
    outro: "If you did not request a reset, you can ignore this email.",
  });
}

export function inviteUserEmail(): EmailTemplate {
  return renderTemplate({
    subject: "You are invited to Studyhive",
    title: "You have been invited",
    preheader: "Accept your Studyhive invite.",
    intro: "You have been invited to join Studyhive. Accept the invite to get started.",
    ctaLabel: "Accept invite",
    ctaUrl: CONFIRMATION_URL,
    outro: "If you were not expecting this invite, you can ignore this email.",
  });
}
