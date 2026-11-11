# Screenshots do dashboard

Imagens geradas a partir da execução local (`npm run dev`), com viewport de 1440 px, tema claro e
filtros “Limpar filtros” (Brasil inteiro, ago/2025–jan/2026). São referenciadas no README da raiz e
em `dashboard/README.md`.

| Arquivo | Conteúdo |
|---|---|
| `01-visao-geral.png` | cabeçalho, faixa de ressalvas, filtros e os 6 KPIs |
| `02-graficos.png` | série mensal, ranking de setores, mapa por UF e matriz interseccional |
| `03-gaps-drilldown.png` | gap por setor e drill-down com breadcrumb |
| `04-tabela.png` | tabela paginada e botão de export CSV |

Para regerar após mudanças na UI, suba o dashboard e capture novamente as quatro seções com um
script Playwright (ou `Cmd + Shift + 4` no macOS). Mantenha os mesmos nomes de arquivo para não
quebrar os links dos READMEs.
