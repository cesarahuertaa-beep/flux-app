import fs from 'fs';

let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const modalStart = '{/* Modal preview */}';
const parts = content.split(modalStart);

if (parts.length > 1) {
  // Extract the modal block
  let beforeModal = parts[0];
  let afterModal = parts[1];
  
  // The modal block ends at the closing brace of the conditional `{previewEx && ( ... )}`
  // Looking at the injection:
  //       {/* Modal preview */}
  //       {previewEx && (
  //         ...
  //         </div>
  //       )}
  //     </div>
  //   );
  // }
  
  const closingTagStr = '      )}\r?\n';
  const modalParts = afterModal.split(/      \)\}\r?\n/);
  
  if (modalParts.length > 1) {
    const extractedModal = modalStart + modalParts[0] + '      )}\n';
    const restOfTimerCard = modalParts.slice(1).join('      )}\n');
    
    content = beforeModal + restOfTimerCard;
    
    // Now append `extractedModal` to the very end of `Training` component
    content = content.replace(/(\s*)<\/div>\r?\n\s*\);\r?\n\}/, `$1${extractedModal}$1</div>\n  );\n}`);
    
    fs.writeFileSync('src/components/cliente/Training.jsx', content);
    console.log("Moved modal to bottom of Training component");
  }
}
