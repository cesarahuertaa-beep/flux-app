import fs from 'fs';

let content = fs.readFileSync('src/lib/supabase.js', 'utf8');

content = content.replace(
  /if \(d\.session\) \{[\s\S]*?saveRefreshToken\(d\.session\.refresh_token\);[\s\S]*?\}/,
  `if (d.session) {
      if (d.session.refresh_token) saveRefreshToken(d.session.refresh_token);
      if (d.session.access_token) setAuthToken(d.session.access_token);
    }`
);

fs.writeFileSync('src/lib/supabase.js', content);
console.log("supabase.js authSignUp fixed to set token.");
