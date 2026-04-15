-- Stripe : colonnes profil + protection plan / IDs (mises à jour webhook = service_role uniquement)
-- Exécuter après création des produits/prix dans Stripe.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

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
    OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id;

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

DROP TRIGGER IF EXISTS profiles_protect_billing_fields ON public.profiles;
CREATE TRIGGER profiles_protect_billing_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_protect_billing_fields();
