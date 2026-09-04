import re

path = r'c:\Users\Nitro 5\flux-app\src\components\admin\ProgramarCliente.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { C } from \"../../styles/theme\";\nimport { Btn, Modal, Field } from \"../ui\";', 
'import { Trash2, Calendar, Activity, CheckCircle2, AlertCircle, Save, Edit2, Plus, Search, FileText, Lock, X, Utensils, Dumbbell, BarChart2 } from \"lucide-react\";')

content = re.sub(r'setMsg\(\"? (.*?)\"\)', r'setMsg(<div className=\"flex items-center gap-1.5\"><AlertCircle className=\"w-4 h-4 text-red-500\" /> \1</div>)', content)
content = re.sub(r'setMsg\(\"? (.*?)\"\)', r'setMsg(<div className=\"flex items-center gap-1.5\"><CheckCircle2 className=\"w-4 h-4 text-green-500\" /> \1</div>)', content)
content = re.sub(r'setMsg\(\"?? (.*?)\"\)', r'setMsg(<div className=\"flex items-center gap-1.5\"><AlertCircle className=\"w-4 h-4 text-yellow-500\" /> \1</div>)', content)
content = re.sub(r'setMsg\(\"??? (.*?)\"\)', r'setMsg(<div className=\"flex items-center gap-1.5\"><Trash2 className=\"w-4 h-4 text-red-500\" /> \1</div>)', content)
content = re.sub(r'setMsg\(\"? \" \+ (.*?)\)', r'setMsg(<div className=\"flex items-center gap-1.5\"><AlertCircle className=\"w-4 h-4 text-red-500\" /> { \1 }</div>)', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
