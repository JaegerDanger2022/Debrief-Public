import Link from "next/link";
export default function OnboardingWelcomePage() {
  return (
    <div>
      <h1 className="text-4xl font-black uppercase">Welcome to Debrief</h1>
      <p className="mt-4 text-lg">We'll analyze the tone of your voice — not just the words — to surface patterns you can't see yourself.</p>
      <Link href="/onboarding/consent" className="mt-8 inline-block bg-brand-black text-brand-white px-8 py-4 font-bold uppercase shadow-brutal">
        Continue →
      </Link>
    </div>
  );
}
