import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMovement,
  gapDefinition,
  gapGroupValues,
  metricDefinition,
  normalize,
  resolvePerfilGroups,
} from '../src/businessRules.js';

const SEXOS = ['Homem', 'Mulher'];
const RACAS = [
  'Amarela',
  'Branca',
  'Indígena',
  'Não Identificado',
  'Não Informada',
  'Parda',
  'Preta',
];

test('normalize remove acentos, caixa e espaços', () => {
  assert.equal(normalize('  Não Informada '), 'nao informada');
  assert.equal(normalize('ADMISSÃO'), 'admissao');
});

test('resolvePerfilGroups encontra os grupos reais do CAGED', () => {
  const grupos = resolvePerfilGroups(SEXOS, RACAS);
  assert.deepEqual(grupos.mulheres, ['Mulher']);
  assert.deepEqual(grupos.homens, ['Homem']);
  assert.deepEqual(grupos.negras.sort(), ['Parda', 'Preta']);
  assert.deepEqual(grupos.brancas, ['Branca']);
});

test('resolvePerfilGroups falha listando os valores quando não há correspondência', () => {
  assert.throws(
    () => resolvePerfilGroups(['Masculino'], ['Branca', 'Preta', 'Parda']),
    (error) => {
      assert.match(error.message, /mulheres/);
      assert.match(error.message, /Masculino/);
      assert.match(error.message, /Branca/);
      return true;
    }
  );
});

test('classificação de movimentação: começa com Admiss = admissão', () => {
  assert.equal(classifyMovement('Admissão'), 'admissao');
  assert.equal(classifyMovement('Admissão Por Reintegração'), 'admissao');
  assert.equal(classifyMovement('ADMISSÃO'), 'admissao');
  assert.equal(classifyMovement('Desligamento A Pedido'), 'desligamento');
  assert.equal(classifyMovement('Culpa Recíproca'), 'desligamento');
  assert.equal(classifyMovement('Término Contrato Trabalho Prazo Determinado'), 'desligamento');
});

test('whitelist de métricas rejeita nomes fora da lista', () => {
  assert.ok(metricDefinition('salario_medio'));
  assert.ok(metricDefinition('rotatividade'));
  assert.equal(metricDefinition('mediana'), null);
});

test('gap interseccional compara homens brancos com mulheres negras', () => {
  const definicao = gapDefinition('interseccional');
  const grupos = gapGroupValues(definicao, resolvePerfilGroups(SEXOS, RACAS));
  assert.deepEqual(grupos.grupoA.sexos, ['Homem']);
  assert.deepEqual(grupos.grupoA.racas, ['Branca']);
  assert.deepEqual(grupos.grupoB.sexos, ['Mulher']);
  assert.deepEqual(grupos.grupoB.racas.sort(), ['Parda', 'Preta']);
});
