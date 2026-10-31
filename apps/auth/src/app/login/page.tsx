import { redirect } from "next/navigation";

import { loginRedirectTarget } from "@/lib/auth/redirects";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = loginRedirectTarget(params.redirect_to);
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
    <main className="login-shell">
      <section className="brand-panel" aria-label="ระบบจัดตารางกะ TNC">
        <div className="brand-lockup"><span className="brand-mark">TNC</span><span>Shift Scheduling</span></div>
        <div className="brand-content">
          <h2>ทุกกะการทำงาน<br />วางแผนร่วมกันได้</h2>
          <p>ตารางกะ คำขอสลับกะ และการติดตามสถานะ<br className="desktop-break" /> ในพื้นที่เดียวสำหรับทีมของคุณ</p>
          <div className="schedule-art" aria-hidden="true">
            <div className="schedule-caption"><span>ภาพตัวอย่างตารางกะ</span><span>จ. — อา.</span></div>
            <div className="schedule-days"><span>จ.</span><span>อ.</span><span>พ.</span><span>พฤ.</span><span>ศ.</span><span>ส.</span><span>อา.</span></div>
            <div className="schedule-track"><span className="shift morning">กะเช้า</span><span className="shift night">กะดึก</span><span className="shift rest">พัก</span></div>
            <div className="schedule-track second"><span className="shift rest">พัก</span><span className="shift morning">กะเช้า</span><span className="shift night">กะดึก</span></div>
            <div className="schedule-track third"><span className="shift night">กะดึก</span><span className="shift rest">พัก</span><span className="shift morning">กะเช้า</span></div>
          </div>
        </div>
        <p className="brand-footer">TNC · ระบบจัดตารางกะ</p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-content">
          <h1 id="login-title">เข้าสู่ระบบ</h1>
          <p className="login-intro">ยินดีต้อนรับกลับมา<br />ใช้อีเมลและรหัสผ่านของคุณเพื่อเริ่มต้นใช้งาน</p>
          <form className="microsoft-form" action="/auth/microsoft" method="post">
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <button className="microsoft-button" type="submit">เข้าสู่ระบบด้วย Microsoft 365</button>
          </form>
          <p className="login-divider">หรือเข้าสู่ระบบด้วยอีเมล</p>
          <LoginForm redirectTo={redirectTo} errorMessage={errorMessage} />
          <p className="login-help">หากไม่มีบัญชีหรือเข้าสู่ระบบไม่ได้<br />กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
        <p className="login-footer">TNC Shift Scheduling</p>
      </section>
    </main>
  );
}
