// @ts-nocheck
"use client";

/**
 * ZeroQCM — Onboarding Tour (device router)
 *
 * Renders the correct guide component based on viewport width:
 *   - < 640px  → IphoneOnboardingGuide (bottom-sheet, mobile-first)
 *   - 640–1023px → IpadOnboardingGuide (bottom-sheet, tablet layout)
 *   - ≥ 1024px → DesktopOnboardingGuide (spotlight tooltip, sidebar layout)
 *
 * All three components:
 *   - Only trigger after user is logged in AND activation_keys.status = 'approved'
 *   - Mark profiles.preferences.onboarding_done = true on finish/skip
 *   - Cover every page and feature comprehensively
 *   - Never show again after the first completion
 */

import { useEffect, useState } from "react";
import { DesktopOnboardingGuide } from "./DesktopOnboardingGuide";
import { IpadOnboardingGuide }    from "./IpadOnboardingGuide";
import { IphoneOnboardingGuide }  from "./IphoneOnboardingGuide";

type DeviceType = "desktop" | "ipad" | "iphone" | null;

function useDeviceType(): DeviceType {
  const [device, setDevice] = useState<DeviceType>(null);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setDevice("desktop");
      else if (w >= 640) setDevice("ipad");
      else setDevice("iphone");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return device;
}

export function OnboardingTour() {
  const device = useDeviceType();

  if (!device) return null; // SSR safe — no flash

  if (device === "desktop") return <DesktopOnboardingGuide />;
  if (device === "ipad")    return <IpadOnboardingGuide />;
  return <IphoneOnboardingGuide />;
}
