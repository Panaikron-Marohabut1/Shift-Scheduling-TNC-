"use client";

import { useEffect, useState } from "react";

export default function LoginForm({ redirectTo, hasError }: { redirectTo: string; hasError: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form className="login-form" action="/auth/sign-in" method="post" onSubmit={() => setSubmitting(true)} aria-busy={submitting}>
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <div className="form-field">
        <label htmlFor="email">อีเมล</label>
        <input id="email" name="email" type="email" placeholder="name@example.com" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby={hasError ? "login-error" : undefined} required />
      </div>
      <div className="form-field">
        <label htmlFor="password">รหัสผ่าน</label>
        <div className="password-field">
          <input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="กรอกรหัสผ่านของคุณ" autoComplete="current-password" aria-describedby={hasError ? "login-error" : undefined} required />
          <button className="password-toggle" type="button" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
          </button>
        </div>
      </div>
      <button className="submit-button" type="submit" disabled={submitting}>
        <span aria-live="polite">{submitting ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</span>
        {!submitting && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6" /></svg>}
      </button>
    </form>
  );
}
