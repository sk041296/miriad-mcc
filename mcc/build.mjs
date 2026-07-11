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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#141414" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,FAVICON_PLACEHOLDER" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <title>Miriad Construction Control (MCC)</title>
    <style>
      :root{ --laranja:#f37335; --laranja-esc:#d94f1a; --preto:#141414; --linha:#e7e7e4; --cinza:#f5f5f3; }
      *{box-sizing:border-box}
      html{ -webkit-text-size-adjust:100%; }
      body{margin:0;background:#141414;font-family:'Inter',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
      input,select,textarea,button{font-family:inherit}
      code{background:#0001;padding:1px 5px;border-radius:4px;font-size:0.92em}

      /* transições e foco globais */
      button,a,input,select,textarea{transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .12s ease}
      input:focus,select:focus,textarea:focus{border-color:var(--laranja)!important;box-shadow:0 0 0 3px rgba(243,115,53,.16)}
      button:not(:disabled){-webkit-tap-highlight-color:transparent}

      /* botões premium: leve elevação no hover, afundar no clique */
      .mcc-btn:not(:disabled):hover{filter:brightness(1.04);transform:translateY(-1px);box-shadow:0 4px 12px rgba(20,20,20,.12)}
      .mcc-btn:not(:disabled):active{transform:translateY(0);box-shadow:none;filter:brightness(.97)}

      /* cartões: hover sutil */
      .mcc-card{transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease}
      .mcc-card:hover{box-shadow:0 6px 22px rgba(16,24,40,.08),0 2px 6px rgba(16,24,40,.05)}
      .mcc-kpi{transition:box-shadow .2s ease,transform .2s ease}
      .mcc-kpi:hover{transform:translateY(-2px)}

      /* linhas de tabela com realce no hover */
      tbody tr{transition:background-color .12s ease}
      tbody tr:hover{background:rgba(243,115,53,.045)}

      /* entrada suave do conteúdo principal */
      @keyframes mccFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .mcc-fade{animation:mccFade .28s ease both}

      /* drawer mobile */
      @keyframes mccSlide{from{transform:translateX(-100%)}to{transform:none}}
      .mcc-drawer{animation:mccSlide .22s ease both}
      @keyframes mccDim{from{opacity:0}to{opacity:1}}
      .mcc-backdrop{animation:mccDim .2s ease both}

      /* scrollbars discretas */
      *{scrollbar-width:thin;scrollbar-color:#cfcfca transparent}
      ::-webkit-scrollbar{width:9px;height:9px}
      ::-webkit-scrollbar-thumb{background:#cfcfca;border-radius:8px;border:2px solid transparent;background-clip:padding-box}
      ::-webkit-scrollbar-thumb:hover{background:#b3b3ad;background-clip:padding-box}

      /* rolagem horizontal suave em tabelas no toque */
      .mcc-card div[style*="overflow"]{-webkit-overflow-scrolling:touch}

      /* ajustes mobile */
      @media (max-width:820px){
        h1{font-size:19px!important}
        .mcc-main{padding:16px 14px!important}
        .mcc-card{padding:14px!important;border-radius:12px!important}
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <!--
      Miriad Construction Control (MCC) — v11.06
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
