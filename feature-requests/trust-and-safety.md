# Trust & Safety — MVP To-Dos

Deferred decision: full **face-scan identity verification is out of scope for the MVP**.
Instead, build trust cheaply with the items below. Revisit vendor-backed verification
post-PMF, once catfish/no-show reports are measurable and hurting retention.

## Todo

- [ ] Enforce and surface phone verification, and add a `verification_method` field so
      stronger verification can be layered in later without a schema rewrite.
- [ ] Lean on `trust_score` + completed-squad history + mutual connections as the visible
      reputation signal.
- [ ] Safety UX: report/block (table already exists), meet-in-public prompts,
      share-live-meetup with an emergency contact, rate limits, and account-age signals.
- [ ] On report, human-review the reported profile/photo rather than scanning everyone.
- [ ] Optionally, device Face ID app lock as a privacy feature later.

## Notes

- Device Face ID is a privacy/app-lock feature, **not** identity verification — don't market
  it as security against other users.
- If account-takeover security is the near-term concern, Supabase Auth **TOTP MFA** is the
  cheap, high-value addition.