import fs from 'fs';
let content = fs.readFileSync('src/components/cliente/Training.jsx', 'utf8');

const regex = /<LineChart data=\{graficaData\}>[\s\S]*?<\/LineChart>/;

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

const newChart = `<LineChart data={graficaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4FA" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <YAxis tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#6B7A8D" }} />
                <Tooltip
                  contentStyle={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 11,
                    border: "1px solid #E2E8F0",
                    borderRadius: 8,
                  }}
                  formatter={(value, name) => [\`\${value} kg\`, name]}
                />
${linesCode}
              </LineChart>`;

content = content.replace(regex, newChart);
fs.writeFileSync('src/components/cliente/Training.jsx', content);
