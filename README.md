# Saathi — Real Profile Photo + Username Search + Chat

Ek working Node.js starter app jisme:

- **Real registration/login** (password bcrypt se hash hota hai)
- **Profile photo upload** — signup ke time ya baad me bhi badal sakte hain
- **Username se search** — koi bhi apna unique username banata hai, dusre log usi username se use dhoondh sakte hain
- **Real-time chat** — Socket.IO ke zariye do alag logo ke beech turant messaging
- Data ek simple JSON file me store hota hai (`data/users.json`, `data/messages.json`) — koi native database install nahi karna padta.

## ⚠️ Important note

Yeh ek **functional starter/MVP** hai, production-grade dating app nahi. Public par launch karne se pehle neeche di gayi "Production ke liye zaroori cheezein" section zaroor padhein — especially security, moderation aur legal cheezein.

## Local par chalane ka tarika

```bash
git clone <apka-repo-url>
cd saathi-app
npm install
npm start
```

Phir browser me kholein: `http://localhost:3000`

Ek naya account banayein (username + password + apni photo), phir dusre browser/incognito window me ek aur account banakar pehle wale ko uske username se search karke chat karein.

### Environment variable (optional)

```bash
cp .env.example .env
```

`.env` me `SESSION_SECRET` ko ek random string se replace kar dein (production ke liye zaroori).

## Render.com par deploy karna (render.yaml ke saath)

Is repo me ek `render.yaml` file already hai, isliye Render par deploy karna sirf kuch clicks ka kaam hai:

1. GitHub par is repo ko public/private push kar dein.
2. [Render.com](https://render.com) par account banayein (GitHub se sign up kar sakte hain).
3. Dashboard me **"New +" → "Blueprint"** choose karein aur apna GitHub repo connect karein.
4. Render `render.yaml` ko khud detect karke service bana dega — build/start command aur `SESSION_SECRET` (auto-generated) already set hain.
5. Deploy hone ke baad Render ek live URL dega, jaise `https://saathi-app.onrender.com` — yahi link kisi ko bhi bhej sakte hain.

**Persistent storage ke baare me zaroori baat:** `render.yaml` me ek `disk` section hai jo profile photos aur chat data ko restart/redeploy ke baad bhi surakshit rakhta hai. Render ka **free plan persistent disk support nahi karta** — disk sirf paid "Starter" instance type (~$7/month) se upar milta hai.

- **Free plan par test karna hai** → `render.yaml` me se poora `disk:` block hata dein. App chalegi, lekin har restart/redeploy par `uploads` aur data reset ho jayenge (demo/testing ke liye theek hai).
- **Real users ke liye chalana hai** → paid instance type chunein taaki disk mil sake, ya better option: photos ke liye Cloudinary/S3 aur data ke liye MongoDB Atlas jaisi free-tier cloud services use karein (dono hi restart-proof hote hain aur free plan par bhi chal jaate hain).

Render ke alawa Railway.app ya Fly.io par bhi isi tarah (bina `render.yaml` ke, unke apne config format me) deploy kiya ja sakta hai.

## Project structure

```
saathi-app/
├── server.js          # Express + Socket.IO backend
├── db.js              # Simple JSON-file "database" helper
├── render.yaml         # Render.com par ek-click deploy ke liye config
├── storage/
│   ├── data/           # users.json / messages.json yahan save hote hain (gitignored)
│   └── uploads/        # Profile photos yahan save hoti hain (gitignored)
└── public/
    ├── index.html      # Login / Register page
    ├── app.html        # Main app: profile, search, chat
    ├── css/style.css
    └── js/app.js
```

## GitHub par public karne se pehle

1. `data/*.json` aur `uploads/*` files commit na karein — `.gitignore` isko already handle karta hai.
2. Agar aap chahte hain ki repo clone karte hi kaam kare, `data/` folder empty hi rehne dein — server pehli baar chalne par khud `users.json` / `messages.json` bana lega.
3. `SESSION_SECRET` ko kabhi bhi hardcode/commit na karein.

## Production ke liye zaroori cheezein (agar real users ke liye deploy karna hai)

Yeh starter demo/learning ke liye theek hai, lekin real logon ke data ke saath production me daalne se pehle in cheezon par kaam zaroori hai:

- **Database**: JSON file ki jagah PostgreSQL / MongoDB jaisa real database use karein — concurrent users ke saath JSON file corrupt ho sakti hai.
- **Session store**: `express-session` ka default memory store restart hone par sab logout kar deta hai aur scale nahi karta — Redis jaisा session store use karein.
- **Photo storage**: Local disk ki jagah S3 / Cloudinary jaisi cloud storage use karein, especially agar aap Heroku/Render jaise platform par deploy kar rahe hain jahan disk persistent nahi hota.
- **HTTPS**: Cookies ko `secure: true` set karein aur poori site HTTPS par serve karein.
- **Rate limiting**: Login/register/search endpoints par rate limiting lagayein taaki spam/bot signups na ho.
- **Content moderation**: Photo verification, fake-profile detection, report/block features add karein (yeh MVP me shamil nahi hain).
- **Email/phone verification**: Sirf username-password ke bajaye email ya OTP verification add karna behtar rahega.
- **Input validation & sanitization**: Extra XSS/SQL-injection jaisi checks (chhoti app me basic validation already hai, lekin production ke liye aur mazboot karein).
- **Privacy & legal**: Terms of Service, Privacy Policy, aur data-protection laws (jaise India ka DPDP Act) follow karna zaroori hai agar real users ka data collect kar rahe hain.

## License

Ise free me modify/use/deploy karein apni marzi se.
