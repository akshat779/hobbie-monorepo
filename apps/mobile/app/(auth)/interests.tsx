import React from 'react';
import { OnboardingWizard } from '../../src/features/onboarding/OnboardingWizard';

/**
 * Onboarding entry point. The route name is kept as `interests` for
 * compatibility with existing navigation and Maestro flows; the screen itself
 * is a multi-step wizard (Photos → Name → Birthday → Gender → Interests).
 */
export default function ProfileSetupScreen() {
  return <OnboardingWizard />;
}
