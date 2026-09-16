import fs from 'fs';

let content = fs.readFileSync('src/components/admin/ProgramarCliente.jsx', 'utf8');

const t4 = `            </div>
          )}
          </div>
        )}`;
const r4 = `            </div>
          )}
          </div>
        )}
      </div>`;

content = content.replace(t4, r4);
content = content.replace(t4.replace(/\\r\\n/g, '\\n'), r4.replace(/\\r\\n/g, '\\n'));

fs.writeFileSync('src/components/admin/ProgramarCliente.jsx', content);
console.log("ProgramarCliente brace patched!");
