# 🔧 Login Troubleshooting Guide

## Problem: Login stuck / tidak bisa login

### ✅ Step 1: Verify Supabase Connection
```powershell
cd d:\Bot\bot-telegram-pbs\dashboard
node test-supabase-connection.js
```

Expected output: All green checkmarks ✅

---

### ✅ Step 2: Create Admin User (REQUIRED)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `jhrxusliijrgrulrwxjk`
3. Go to: **Authentication** → **Users**
4. Click **"Add user"** button
5. Enter:
   - **Email**: `admin@pbs.com` (or your email)
   - **Password**: Create a strong password (min 6 characters)
   - ✅ **Auto Confirm User**: Turn this ON!
6. Click **"Create user"**

⚠️ **IMPORTANT**: Make sure "Auto Confirm User" is enabled, otherwise you need to verify email first.

---

### ✅ Step 3: Test Login

1. Start dashboard:
```powershell
npm run dev
```

2. Open browser: http://localhost:3000/login

3. Enter credentials:
   - Email: `admin@pbs.com`
   - Password: (password you created)

4. Click **"Sign In"**

5. Check browser console (F12 → Console) for logs:
   - 🔐 Starting login process...
   - 📧 Attempting login with email: ...
   - ✅ Login successful! Session created.
   - 🔄 Redirecting to dashboard...

---

### ❌ Common Errors & Solutions

#### Error: "Invalid email or password"
**Solution**: 
- Check email spelling
- Check password (case sensitive)
- Verify user exists in Supabase Dashboard

#### Error: "Email not confirmed"
**Solution**:
1. Go to Supabase Dashboard → Authentication → Users
2. Find your user
3. Click on the user
4. Click **"Confirm email"**

OR recreate user with "Auto Confirm User" enabled.

#### Stuck on login page (no error)
**Solution**:
1. Open browser console (F12)
2. Check for errors
3. Check Network tab for failed requests
4. Clear cookies and try again:
   ```javascript
   // Run in browser console
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   location.reload();
   ```

#### Redirects back to login immediately
**Solution**:
- Check middleware.ts is not blocking
- Check cookies are being set (Application → Cookies in DevTools)
- Cookie should start with `sb-jhrxusliijrgrulrwxjk-auth-token`

---

### 🧪 Debug Mode

Add this to check if login is working:

1. Open browser console (F12)
2. Go to login page
3. Try to login
4. Check console logs:
   - Look for 🔐 emoji logs
   - Check for errors in red
   - Copy any errors and check them

---

### 🔐 Manual Session Check

Run this in browser console after login attempt:

```javascript
// Check if session exists
const cookies = document.cookie.split(';');
const authCookie = cookies.find(c => c.includes('sb-') && c.includes('auth-token'));
console.log('Auth cookie:', authCookie ? '✅ Found' : '❌ Not found');

// Check localStorage
const keys = Object.keys(localStorage).filter(k => k.includes('supabase'));
console.log('Supabase localStorage keys:', keys);
```

---

### 📧 Contact Support

If still stuck, provide:
1. Browser console output (F12 → Console)
2. Network tab screenshot (F12 → Network)
3. Error messages
4. Steps you've tried

---

### 🎯 Quick Fix Checklist

- [ ] Supabase connection test passed
- [ ] Admin user created in Supabase
- [ ] "Auto Confirm User" was enabled
- [ ] .env.local file exists with correct values
- [ ] npm run dev is running
- [ ] Browser console shows no errors
- [ ] Cookies are not blocked in browser
- [ ] Using correct email/password

If all checked and still not working, try:
1. Restart npm run dev
2. Clear browser cache and cookies
3. Try incognito/private window
4. Try different browser
