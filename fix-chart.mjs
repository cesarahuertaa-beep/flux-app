import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const oldChart = `<Line
                  type="monotone"
                  dataKey="peso"
                  stroke="var(--brand-primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--brand-primary)", r: 4 }}
                  name="Peso (kg)"
                />`;

const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
const linesCode = Array.from({ length: 6 }).map((_, i) => 
  `                {numSeries > ${i} && (
                  <Line
                    type="monotone"
                    dataKey="serie_${i}"
                    stroke="${colors[i]}"
                    strokeWidth={2}
                    dot={{ fill: "${colors[i]}", r: 3 }}
                    name="Serie ${i + 1}"
                    connectNulls={false}
                  />
                )}`
).join('\n');

content = content.replace(oldChart, linesCode);
fs.writeFileSync('src/components/cliente/Training.jsx', content);
