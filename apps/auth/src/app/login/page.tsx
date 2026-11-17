import { redirect } from "next/navigation";
import Image from "next/image";

import tncLogo from "../../../../web/assets/tnc-logo.png";
import { loginRedirectTarget } from "@/lib/auth/redirects";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { getAuthConfig } from "@/lib/auth/config";
import LoginForm from "./login-form";
import LoginPhotos from "./login-photos";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = loginRedirectTarget(params.redirect_to);
  const { pilot } = getAuthConfig();
  const { user } = await getAuthenticatedUser();

  if (user) redirect(redirectTo);

  const errorMessage = params.error === "domain_not_allowed"
    ? "อีเมลนี้ไม่ได้รับอนุญาตให้เข้าสู่ระบบ กรุณาใช้บัญชีที่ผู้ดูแลระบบกำหนด"
    : params.error === "microsoft_unavailable"
    ? "ยังไม่สามารถเชื่อมต่อ Microsoft 365 ได้ กรุณาลองใหม่ หรือเข้าสู่ระบบด้วยอีเมล"
    : params.error === "invalid_callback"
    ? "การเข้าสู่ระบบด้วย Microsoft 365 ไม่สำเร็จหรือถูกยกเลิก กรุณาลองใหม่"
    : params.error ? "โปรดตรวจสอบอีเมลและรหัสผ่าน แล้วลองอีกครั้ง หากยังไม่ได้ กรุณาติดต่อผู้ดูแลระบบ" : undefined;

  return (
    <main className="session-shell login-shell">
      <div className="login-frame">
        <header className="login-brand-panel">
          <div className="session-brand">
            <Image src={tncLogo} alt="TNC" width={36} height={36} unoptimized />
            <b>ShiftFlow</b>
          </div>
          <p className="login-product">ตารางกะฝ่ายผลิต</p>
          <LoginPhotos />
        </header>
        <section className="login-panel" aria-labelledby="login-title">
          <h1 id="login-title">เข้าสู่ระบบ</h1>
          {pilot && <p className="session-description">ใช้บัญชีทดสอบที่ได้รับ</p>}
          {errorMessage && (
            <div className="login-error" id="login-error" role="alert">
              <strong>เข้าสู่ระบบไม่สำเร็จ</strong>
              <p>{errorMessage}</p>
            </div>
          )}
          {!pilot && (
            <>
              <form className="microsoft-form" action="/auth/microsoft" method="post">
                <input type="hidden" name="redirect_to" value={redirectTo} />
                <button className="microsoft-button" type="submit">
                  <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
                  ใช้บัญชี Microsoft 365
                </button>
              </form>
              <p className="login-divider">หรือใช้อีเมลและรหัสผ่าน</p>
            </>
          )}
          <LoginForm redirectTo={redirectTo} hasError={Boolean(errorMessage)} />
          <p className="login-divider">หากเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ</p>
        </section>
      </div>
    </main>
  );
}
