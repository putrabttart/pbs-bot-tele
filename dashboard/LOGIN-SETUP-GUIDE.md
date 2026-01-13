# 🚀 Complete Login Setup & Troubleshooting Guide

## ✅ Build Status
Dashboard compiled successfully ✓

---

## 📋 Complete Setup Steps (DO THIS IN ORDER)

### STEP 1: Configure Supabase Redirect URLs
**This is CRITICAL for login to work!**

1. Go to: https://supabase.com/dashboard
2. Select project: `jhrxusliijrgrulrwxjk`
3. Click **Settings** in sidebar
4. Click **Authentication** tab
5. Scroll to **Redirect URLs** section
6. Click **"Add URL"** button
7. Add these URLs (one by one):
   ```
   http://localhost:3000/
   http://localhost:3000/auth/callback
   http://localhost:3000/dashboard
   ```
8. Click **"Save changes"** button

✅ You should now have:
- `https://independent-bravery-production.up.railway.app/**` (production)
- `http://localhost:3000/` (development)
- `http://localhost:3000/auth/callback` (development)
- `http://localhost:3000/dashboard` (development)

---

### STEP 2: Verify/Create Admin User
1. Supabase Dashboard → **Authentication** → **Users**
2. Check if `admin@pbs.com` exists
3. If NOT: Click **"Add user"** button
   - Email: `admin@pbs.com`
   - Password: Create a strong password
   - ✅ **CHECK "Auto Confirm User"** checkbox
   - Click **"Create user"**
4. If EXISTS: Click on the user and verify:
   - Email should show as "confirmed" ✅
   - If NOT confirmed, click **"Confirm email"** button

---

### STEP 3: Start Dashboard
```powershell
cd D:\Bot\bot-telegram-pbs\dashboard
npm run dev
```

Wait for:
```
▲ Next.js 16.1.1
- Local:        http://localhost:3000
✓ Ready in 2.5s
```

---

### STEP 4: Test Login

1. Open browser: **http://localhost:3000/login**

2. Enter credentials:
   - Email: `admin@pbs.com`
   - Password: (password from Step 2)

3. Click **"Sign In"** button

4. **IMPORTANT**: Open browser console (F12 → Console) and look for:
   ```
   🔐 ========== LOGIN PROCESS START ==========
   📧 Email: admin@pbs.com
   ✅ Supabase client created
   🔑 Attempting to sign in...
   📡 Sign in response received
   ✅ Session created successfully
   🔄 Preparing redirect to dashboard...
   ✅ Redirecting to /dashboard...
   🔐 ========== LOGIN SUCCESS ==========
   ```

5. If successful → Redirect to `/dashboard` automatically ✅

---

## ❌ Troubleshooting If Login Fails

### Error: "Invalid email or password"
**Possible causes:**
- Email spelled wrong
- Password wrong
- User not created

**Fix:**
1. Double-check email and password
2. Verify user exists in Supabase Dashboard
3. Test by going to Supabase → Users and recreating user

---

### Error: "Email not confirmed"
**Cause:** User email not verified

**Fix:**
1. Supabase Dashboard → Authentication → Users
2. Click on `admin@pbs.com`
3. Click **"Confirm email"** button
4. Try login again

OR recreate user with "Auto Confirm User" checked

---

### Login Stuck / No Error Displayed
**Possible causes:**
- Redirect URL not configured in Supabase
- Session cookies not being set
- Browser cookies blocked

**Fix:**
1. Verify Step 1 (Redirect URLs) completed
2. Clear browser cookies:
   - Chrome: F12 → Application → Cookies → Delete All
   - Firefox: F12 → Storage → Cookies → Delete All
3. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Try login again

---

### Console shows "Error" but no message
**Fix:**
1. Open F12 console
2. Look for red error logs
3. Copy full error message
4. Read error carefully - it explains what's wrong

---

## 🧪 Testing Tools

### Test Supabase Connection
```powershell
node test-supabase-connection.js
```

Should show:
```
✅ Products table accessible
✅ Product items table accessible
✅ Orders table accessible
✅ Auth endpoint accessible
✅ All checks completed!
```

### Detailed Troubleshooting
```powershell
node troubleshoot-login.js
```

Shows:
- Environment configuration
- Database tables
- User list
- Auth status
- Setup checklist

---

## 🔍 Debug Mode in Browser

### Show Debug Info in UI
1. Click **"Show Debug Info"** link on login page
2. See:
   - Supabase URL status
   - Supabase Key status
   - Environment
   - Timestamp

### Console Logs
1. F12 → Console tab
2. Look for logs with emojis:
   - 🔐 Login process
   - 📧 Email attempt
   - ✅ Success
   - ❌ Errors

---

## 📱 Mobile/Different Device

If login works on one device but not another:
1. Clear ALL cookies and cache
2. Check Redirect URLs include localhost URL
3. Make sure using http:// (not https://) for localhost

---

## 🎯 Quick Checklist

Before trying to login:
- [ ] ✅ Redirect URLs added to Supabase (Step 1)
- [ ] ✅ Admin user created and confirmed (Step 2)
- [ ] ✅ npm run dev is running (Step 3)
- [ ] ✅ Browser at http://localhost:3000/login (Step 4)
- [ ] ✅ Email & password are correct
- [ ] ✅ F12 Console open to see logs

---

## 🎉 Success Signs

When login works:
1. Console shows: `🔐 ========== LOGIN SUCCESS ==========`
2. Page automatically redirects to `/dashboard`
3. You see sidebar with menu:
   - Products
   - Product Items
   - Orders
   - Users
   - Analytics
   - Settings
4. Logout button visible (left sidebar bottom)

---

## 📧 Still Stuck?

Provide this information:
1. Screenshot of F12 Console (all logs)
2. Screenshot of Network tab (failed requests if any)
3. What error message you see (if any)
4. Output of `node troubleshoot-login.js`
5. Steps you've already tried

---

## 🔧 Advanced: Manual Session Check

Run in browser console (F12):

```javascript
// Check auth cookies
const cookies = document.cookie.split(';');
const authCookie = cookies.find(c => c.includes('sb-') && c.includes('auth-token'));
console.log('Auth cookie:', authCookie ? '✅ Found' : '❌ Not found');

// Check localStorage
const keys = Object.keys(localStorage).filter(k => k.includes('supabase'));
console.log('Supabase keys:', keys);

// Check if session exists
async function checkSession() {
  const response = await fetch('http://localhost:3000/auth/session');
  const session = await response.json();
  console.log('Session:', session);
}
checkSession();
```

---

## ✨ Pro Tips

1. **Default email is pre-filled**: `admin@pbs.com` - change only if you created different user
2. **Password hints in error**: Console shows what field has the issue
3. **Clear cache if stuck**: Ctrl+Shift+Delete, clear all, try again
4. **Check network tab**: Network → filter "auth" or "supabase" to see API calls
5. **Try incognito window**: Eliminates extension/cache issues

Good luck! 🚀
