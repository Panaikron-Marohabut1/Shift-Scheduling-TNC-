"use client";

import { useEffect, useState } from "react";

const photoClasses = ["operator", "product"];
const photoIntervalMs = 5000;

export default function LoginPhotos() {
  const [photo, setPhoto] = useState(0);
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;

    function updateTimer() {
      window.clearInterval(timer);
      if (!reducedMotion.matches && !document.hidden) {
        timer = window.setInterval(
          () => setPhoto(current => (current + 1) % photoClasses.length),
          photoIntervalMs,
        );
      }
    }

    updateTimer();
    reducedMotion.addEventListener("change", updateTimer);
    document.addEventListener("visibilitychange", updateTimer);
    return () => {
      window.clearInterval(timer);
      reducedMotion.removeEventListener("change", updateTimer);
      document.removeEventListener("visibilitychange", updateTimer);
    };
  }, []);

  return (
    <div className="login-photos" aria-hidden="true">
      {photoClasses.map((name, index) => (
        <div
          key={name}
          className={`login-photo login-photo-${name}`}
          data-active={index === photo}
        />
      ))}
    </div>
  );
}
