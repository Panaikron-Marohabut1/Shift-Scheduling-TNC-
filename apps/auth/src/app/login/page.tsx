import { redirect } from "next/navigation";

import { loginRedirectTarget } from "@/lib/auth/redirects";
import { getAuthenticatedUser } from "@/lib/auth/guards";
import { getAuthConfig } from "@/lib/auth/config";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect_to?: string; error?: string }>;
};

const days = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const exampleShifts = [
  ["A", "M", "M", "O", "O", "N", "N", "O"],
  ["B", "O", "O", "M", "M", "O", "O", "N"],
  ["C", "N", "N", "O", "O", "M", "M", "O"],
  ["D", "O", "O", "N", "N", "O", "O", "M"],
];

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
    <main className="login-shell">
      <header className="brand-lockup">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span className="brand-name">ShiftFlow</span>
        <span className="brand-company">TNC</span>
      </header>
      <section className="login-frame" aria-label="ShiftFlow">
        <div className="brand-panel">
          <div className="brand-content">
            <h2>ตารางกะฝ่ายผลิต</h2>
            <p>ดูตารางกะและติดตามคำขอของทีม</p>
          </div>
          <figure className="schedule-art" aria-hidden="true">
            <figcaption>ตัวอย่างตารางกะ</figcaption>
            <div className="schedule-row schedule-days"><span>ทีม</span>{days.map(day => <span key={day}>{day}</span>)}</div>
            {exampleShifts.map(([team, ...shifts]) => (
              <div className="schedule-row" key={team}>
                <span className="schedule-team">{team}</span>
                {shifts.map((shift, index) => <span className={`shift shift-${shift}`} key={days[index]}>{shift === "O" ? "·" : shift}</span>)}
              </div>
            ))}
            <div className="schedule-legend"><span><i className="shift-M" />กะเช้า</span><span><i className="shift-N" />กะดึก</span><span><i className="shift-O" />วันหยุด</span></div>
          </figure>
        </div>
        <section className={pilot ? "login-panel login-panel-pilot" : "login-panel"} aria-labelledby="login-title">
          <h1 id="login-title">เข้าสู่ระบบ</h1>
          <p className="login-intro">{pilot ? "ใช้บัญชีทดสอบที่ได้รับสำหรับรอบ Pilot" : "ใช้บัญชีบริษัทผ่าน Microsoft 365"}</p>
          {errorMessage && <div className="login-error" id="login-error" role="alert"><strong>เข้าสู่ระบบไม่สำเร็จ</strong><p>{errorMessage}</p></div>}
          {!pilot && <><form className="microsoft-form" action="/auth/microsoft" method="post">
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <button className="microsoft-button" type="submit">
              <span className="microsoft-mark" aria-hidden="true"><i /><i /><i /><i /></span>
              เข้าสู่ระบบด้วย Microsoft 365
            </button>
          </form>
          <p className="login-divider">หรือใช้อีเมลและรหัสผ่าน</p></>}
          <LoginForm redirectTo={redirectTo} hasError={Boolean(errorMessage)} />
          <p className="login-help">หากเข้าใช้งานไม่ได้ กรุณาติดต่อผู้ดูแลระบบ</p>
        </section>
      </section>
    </main>
  );
}
