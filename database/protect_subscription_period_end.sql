-- Ajouter subscription_period_end aux champs protégés par le trigger billing.
-- Empêche un JWT client de modifier la date de fin d'abonnement.

CREATE OR REPLACE FUNCTION public.profiles_protect_billing_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt jsonb;
  jwt_role text;
  billing_changed boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  billing_changed :=
    NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    OR NEW.subscription_period_end IS DISTINCT FROM OLD.subscription_period_end;

  IF NOT billing_changed THEN
    RETURN NEW;
  END IF;

  jwt := nullif(trim(current_setting('request.jwt.claims', true)), '')::jsonb;
  jwt_role := coalesce(jwt->>'role', '');

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF jwt_role IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'profiles: billing fields are not user-writable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
