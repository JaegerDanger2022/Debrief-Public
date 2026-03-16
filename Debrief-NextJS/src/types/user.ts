export type SubscriptionTier = "free" | "pro";

export interface User {
  id: string;
  email: string;
  onboarding_complete: boolean;
  consent_prosody: boolean;
  subscription_tier: SubscriptionTier;
  created_at: string;
}
