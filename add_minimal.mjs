import fs from 'fs';

let content = fs.readFileSync('src/lib/supabase.js', 'utf8');

if (!content.includes('dbPostMinimal')) {
  content = content.replace(
    /export const dbPost   = \(p,b\) => q\(p, \{ method:"POST", body:JSON\.stringify\(b\) \}\);/,
    `export const dbPost   = (p,b) => q(p, { method:"POST", body:JSON.stringify(b) });
export const dbPostMinimal = (p,b) => q(p, { method:"POST", body:JSON.stringify(b), headers: { Prefer: "return=minimal" } });`
  );
  fs.writeFileSync('src/lib/supabase.js', content);
  console.log("dbPostMinimal added to supabase.js");
}
