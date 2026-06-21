import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";

const result = await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
  loader: { ".js": "jsx", ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  legalComments: "eof",
});
const js = result.outputFiles[0].text;

const head = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,FAVICON_PLACEHOLDER" />
    <title>Miriad Construction Control (MCC)</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#141414;-webkit-font-smoothing:antialiased}
      input,select,textarea,button{font-family:'Inter',system-ui,sans-serif}
      code{background:#0001;padding:1px 5px;border-radius:4px;font-size:0.92em}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <!--
      Miriad Construction Control (MCC) — v7.2
      Novidades: Dashboard de RDOs (último respondido + alerta de pendência no dia),
      condição de pagamento na OC-i (à vista / entrada+parcelas / parcelado puro, por dias),
      Financeiro: Custos por obra (serviço × material) e Custos diretos por obra (tabela editável tipo Premissas),
      Gerar medição em PDF (acumulada/por período, c/ e s/ BDI), favicon capacete; OC-i gera PDF para o fornecedor (material x EAP, CNO, solicitante, comprador).
    -->
    <script>
`;
const tail = `
    </script>
  </body>
</html>
`;

// favicon: capacete laranja vibrante (SVG inline, URL-encoded)
const favicon = readFileSync("favicon.svg", "utf8").replace(/\n/g, "").trim();
const faviconEnc = encodeURIComponent(favicon);

writeFileSync("index.html", head.replace("FAVICON_PLACEHOLDER", faviconEnc) + js + tail);
console.log("Build OK — index.html:", (head.length + js.length + tail.length), "bytes");
