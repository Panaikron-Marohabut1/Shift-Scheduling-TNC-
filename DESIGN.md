---
version: alpha
name: ShiftFlow
description: "A Thai-language shift ledger for TNC production teams."
colors:
  background: "#f3f4f6"
  surface: "#ffffff"
  ink: "#141b24"
  muted: "#677181"
  line: "#e4e7eb"
  primary: "#1f4f99"
  morning: "#fff1c4"
  night: "#dde8fb"
typography:
  sans:
    fontFamily: "Sarabun, Leelawadee UI, Noto Sans Thai, Tahoma, sans-serif"
rounded:
  control: "6px"
  session-card: "12px"
---

# ShiftFlow design

ShiftFlow helps TNC production staff read duty rosters and handle requests. Use the visual language of a shift ledger with white surfaces, thin rules, and clear Thai labels. Keep the saturated blue for primary actions and selection. Use morning and night colors where they identify actual shifts.

Use the TNC mark from the application sidebar on entry screens. Sign-in pairs production photography with a dark navy form. Alternate between the operator and product photos. Keep a still photo when reduced motion is enabled. Microsoft 365 is the primary action above email and password whenever both methods are available. On narrow screens, place the photo and brand in a short header above the form. Keep recovery in a compact column and show in-progress loading as a text status on the app background.

The main application palette lives in [base.css](apps/web/styles/base.css). The main app and sign-in use the same [Sarabun definitions](apps/web/styles/sarabun.css) and font stack. The sign-in colors live in [globals.css](apps/auth/src/app/globals.css). Both entry surfaces consume [session-shell.css](apps/web/styles/session-shell.css) for the responsive container and brand.
