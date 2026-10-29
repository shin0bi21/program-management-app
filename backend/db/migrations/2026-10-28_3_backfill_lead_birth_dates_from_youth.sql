-- Only a linked profile supplies an exact DOB; preserve known Lead dates and unknowns.
UPDATE leads AS lead
SET date_of_birth = profile.date_of_birth,
    updated_at = NOW()
FROM youth_profiles AS profile
WHERE lead.status = 'signed_up'
  AND lead.converted_youth_id = profile.user_id
  AND lead.date_of_birth IS NULL
  AND profile.date_of_birth IS NOT NULL;
