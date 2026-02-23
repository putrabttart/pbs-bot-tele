-- Create settings table for app configuration
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read settings
CREATE POLICY "Allow authenticated to read settings"
ON public.settings FOR SELECT
TO authenticated
USING (true);

-- Policy: Only authenticated users can update settings (admin check should be done in app)
CREATE POLICY "Allow authenticated to update settings"
ON public.settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('store_name', 'Putra Btt Store', 'Store name displayed in bot and dashboard'),
  ('store_description', 'Toko Digital Terpercaya #1', 'Store description for marketing'),
  ('support_contact', '@aryadwinata543', 'Support contact (Telegram username or phone)'),
  ('catalog_banner_url', 'https://imgcdn.dev/i/YaULTN', 'Banner image URL for catalog'),
  ('items_per_page', '10', 'Number of items displayed per page in catalog'),
  ('grid_cols', '5', 'Number of columns in product grid'),
  ('enable_promo', 'true', 'Enable promo code feature'),
  ('enable_referral', 'true', 'Enable referral system'),
  ('enable_analytics', 'true', 'Enable analytics tracking'),
  ('enable_favorites', 'true', 'Enable user favorites feature'),
  ('payment_ttl_minutes', '15', 'Payment expiry time in minutes'),
  ('currency', 'IDR', 'Currency code (e.g., IDR, USD)'),
  ('locale', 'id-ID', 'Locale for formatting (e.g., id-ID, en-US)')
ON CONFLICT (key) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION update_settings_updated_at();

-- Add comment
COMMENT ON TABLE public.settings IS 'Application settings that can be configured from admin dashboard';
