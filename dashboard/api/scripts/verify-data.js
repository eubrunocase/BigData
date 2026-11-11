/**
 * Conferência dos números de aceite da Fase 6 e da ponderação das médias.
 *
 * Uso: npm run verify:data (dentro de dashboard/api, com .env preenchido)
 *
 * A query abaixo é a referência documentada no README:
 * - soma e contagem da fato;
 * - média ponderada vs. média simples de salário (mostra por que AVG é errado);
 * - salário ponderado por sexo e por raça/cor (preta + parda = negra).
 */
import { closePool, query, toInt, toNumber } from '../src/db.js';

const ESPERADO_LINHAS = 137_920;
const ESPERADO_MOVIMENTACOES = 25_004_635;

function fmt(valor) {
  return Number(valor).toLocaleString('pt-BR');
}

async function main() {
  const [total] = await query(`
    SELECT COUNT(*)::int AS linhas,
           COALESCE(SUM(total_movimentacoes), 0)::bigint AS movimentacoes,
           SUM(salario_medio * total_movimentacoes) FILTER (WHERE salario_medio IS NOT NULL)
             / NULLIF(SUM(total_movimentacoes) FILTER (WHERE salario_medio IS NOT NULL), 0)
             AS salario_ponderado,
           AVG(salario_medio) AS salario_simples,
           SUM(idade_media * total_movimentacoes) FILTER (WHERE idade_media IS NOT NULL)
             / NULLIF(SUM(total_movimentacoes) FILTER (WHERE idade_media IS NOT NULL), 0)
             AS idade_ponderada,
           AVG(idade_media) AS idade_simples
      FROM fato_movimentacao
  `);

  const linhas = toInt(total.linhas);
  const movimentacoes = toInt(total.movimentacoes);

  console.log('=== Conferência da fato ===');
  console.log(`Linhas: ${fmt(linhas)} (esperado: ${fmt(ESPERADO_LINHAS)})`);
  console.log(
    `Movimentações: ${fmt(movimentacoes)} (esperado: ${fmt(ESPERADO_MOVIMENTACOES)})`
  );

  console.log('\n=== Ponderação das médias ===');
  console.log(
    `Salário — ponderado: R$ ${toNumber(total.salario_ponderado, 2)?.toFixed(2)} | ` +
      `AVG simples (incorreto): R$ ${toNumber(total.salario_simples, 2)?.toFixed(2)}`
  );
  console.log(
    `Idade   — ponderada: ${toNumber(total.idade_ponderada, 1)?.toFixed(1)} | ` +
      `AVG simples (incorreto): ${toNumber(total.idade_simples, 1)?.toFixed(1)}`
  );

  const grupos = await query(`
    SELECT p.sexo,
           p.raca_cor,
           SUM(f.total_movimentacoes)::bigint AS movimentacoes,
           SUM(f.salario_medio * f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL)
             / NULLIF(SUM(f.total_movimentacoes) FILTER (WHERE f.salario_medio IS NOT NULL), 0)
             AS salario_ponderado
      FROM fato_movimentacao f
      JOIN dim_perfil p USING (id_perfil)
     GROUP BY p.sexo, p.raca_cor
     ORDER BY p.sexo, p.raca_cor
  `);

  console.log('\n=== Salário ponderado por perfil ===');
  for (const grupo of grupos) {
    console.log(
      `${grupo.sexo.padEnd(7)} | ${grupo.raca_cor.padEnd(16)} | ` +
        `${fmt(grupo.movimentacoes).padStart(12)} mov. | R$ ` +
        `${toNumber(grupo.salario_ponderado, 2)?.toFixed(2)}`
    );
  }

  const erros = [];
  if (linhas !== ESPERADO_LINHAS) erros.push(`linhas=${linhas}`);
  if (movimentacoes !== ESPERADO_MOVIMENTACOES) erros.push(`movimentacoes=${movimentacoes}`);

  if (erros.length > 0) {
    console.error(`\nFALHA: divergência nos critérios de aceite (${erros.join(', ')}).`);
    process.exitCode = 1;
  } else {
    console.log('\nOK: linhas e movimentações conferem com o relatório da Fase 2.');
  }
}

main()
  .catch((error) => {
    console.error('Erro na conferência:', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
