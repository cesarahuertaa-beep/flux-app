import fs from 'fs';

let content = fs.readFileSync('src/lib/supabase.js', 'utf8');

if (!content.includes('export const dbPostMinimal')) {
  content += `\nexport const dbPostMinimal = (p,b) => q(p, { method:"POST", body:JSON.stringify(b), headers: { Prefer: "return=minimal" } });\n`;
  fs.writeFileSync('src/lib/supabase.js', content);
  console.log("Added dbPostMinimal");
} else {
  console.log("dbPostMinimal already exists");
}
