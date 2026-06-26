const fs = require("fs");
const path = require("path");

const mdPath = path.join(__dirname, "../README.md");
const docPath = path.join(__dirname, "../README.docx");

if (!fs.existsSync(mdPath)) {
  console.error("README.md not found!");
  process.exit(1);
}

const md = fs.readFileSync(mdPath, "utf8");

// Parse basic markdown elements to HTML
let html = md
  .replace(/\r\n/g, "\n")
  // Headers
  .replace(/^### (.*$)/gim, "<h3>$1</h3>")
  .replace(/^## (.*$)/gim, "<h2>$1</h2>")
  .replace(/^# (.*$)/gim, "<h1>$1</h1>")
  // Bold & Italic
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
  // Inline Code
  .replace(/`(.*?)`/g, '<code style="background-color:#f1f5f9; color:#0f172a; padding:2px 4px; border-radius:4px; font-family:monospace; font-size:10pt;">$1</code>')
  // Blockquotes / Alerts
  .replace(/^> \[\!(.*?)\]\n([\s\S]*?)(?=\n\n|\n[^\s>])/gm, (match, type, content) => {
    const borderColors = {
      NOTE: "#3b82f6",
      TIP: "#10b981",
      IMPORTANT: "#8b5cf6",
      WARNING: "#f59e0b",
      CAUTION: "#ef4444"
    };
    const color = borderColors[type.toUpperCase()] || "#cccccc";
    return `<div style="background-color:#fafafa; border-left:4px solid ${color}; padding:12px; margin:12px 0; font-family:sans-serif;"><strong>[${type.toUpperCase()}]</strong><br/>${content.replace(/^> /gm, "").trim()}</div>`;
  })
  .replace(/^> (.*$)/gim, '<blockquote style="border-left: 4px solid #cccccc; padding-left: 10px; margin-left: 0; color: #666666;">$1</blockquote>')
  // Code Blocks
  .replace(/```(.*?)\n([\s\S]*?)```/gm, '<pre style="background-color:#1e293b; color:#f8fafc; padding:16px; border-radius:8px; font-family:monospace; font-size:9.5pt; overflow-x:auto; line-height:1.4;">$2</pre>')
  // Images
  .replace(/!\[(.*?)\]\((.*?)\)/g, '<p style="text-align:center; margin:20px 0;"><img src="$2" alt="$1" style="max-width:100%; height:auto;" /><br/><em style="font-size:9.5pt; color:#666;">$1</em></p>')
  // Links
  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:#0284c7; text-decoration:underline;">$1</a>');

// Parse Tables
const lines = html.split("\n");
let inTable = false;
let tableHtml = "";
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith("|")) {
    if (!inTable) {
      inTable = true;
      tableHtml = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; font-family:sans-serif; margin:16px 0; border:1px solid #cbd5e1;">\n';
    }
    
    if (line.includes("---")) {
      continue;
    }
    
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    const isHeader = i > 0 && !lines[i-1].trim().startsWith("|");
    
    tableHtml += "  <tr>\n";
    for (const cell of cells) {
      if (isHeader) {
        tableHtml += `    <th style="background-color:#f8fafc; font-weight:bold; text-align:left; border:1px solid #cbd5e1; font-size:10pt; color:#1e293b;">${cell}</th>\n`;
      } else {
        tableHtml += `    <td style="border:1px solid #cbd5e1; font-size:10pt; color:#334155;">${cell}</td>\n`;
      }
    }
    tableHtml += "  </tr>\n";
  } else {
    if (inTable) {
      inTable = false;
      tableHtml += "</table>\n";
      newLines.push(tableHtml);
    }
    newLines.push(lines[i]);
  }
}
if (inTable) {
  tableHtml += "</table>\n";
  newLines.push(tableHtml);
}
html = newLines.join("\n");

// Clean up paragraphs and lists
html = html
  .replace(/\n\n/g, "<p></p>")
  .replace(/^- (.*$)/gim, '<li style="margin-left:20px; font-family:sans-serif; color:#334155;">$1</li>')
  .replace(/(<li.*?>.*?<\/li>)+/gs, '<ul style="margin:10px 0;">$&</ul>');

// Wrap in full HTML document with Microsoft Word schema bindings
const fullDoc = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Project Zenith Documentation</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
      color: #334155;
      line-height: 1.5;
      margin: 40px;
    }
    h1 {
      font-family: 'Calibri Light', sans-serif;
      font-size: 24pt;
      color: #1e3a8a;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 8px;
      margin-top: 30px;
    }
    h2 {
      font-family: 'Calibri Light', sans-serif;
      font-size: 16pt;
      color: #1e40af;
      margin-top: 24px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    h3 {
      font-size: 12.5pt;
      color: #0f766e;
      margin-top: 18px;
    }
    p, li {
      font-size: 11pt;
      margin-bottom: 8px;
    }
    pre {
      font-family: Consolas, monospace;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
`;

fs.writeFileSync(docPath, fullDoc, "utf8");
console.log("README.docx successfully generated in workspace root!");
