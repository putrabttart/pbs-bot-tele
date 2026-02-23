#!/bin/bash
# Apply web store migration to Supabase

# Load environment variables
if [ -f ".env.local" ]; then
  export $(cat .env.local | grep -v '#' | xargs)
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI is not installed. Please install it first:"
  echo "   npm install -g supabase"
  exit 1
fi

# Apply migration
echo "📝 Applying web store migration..."
supabase db push

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully!"
  echo "The orders table has been updated with web store columns:"
  echo "  - transaction_id"
  echo "  - customer_name"
  echo "  - customer_email"
  echo "  - customer_phone"
  echo "  - payment_method"
  echo "  - items (JSONB array)"
else
  echo "❌ Failed to apply migration. Check your Supabase connection."
  exit 1
fi
