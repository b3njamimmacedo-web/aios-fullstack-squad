/**
 * Exportador para Obsidian
 *
 * Gera notas compativeis com o Obsidian (markdown com links [[]],
 * tags e frontmatter YAML) a partir da analise da reuniao.
 * Cria multiplos arquivos organizados por data e cliente.
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

class ObsidianExporter {
  constructor(options = {}) {
    this.vaultPath = options.vaultPath || config.paths.obsidianVault;
    this.outputDir = options.outputDir || config.paths.outputDir;
  }

  /**
   * Exporta todos os dados da analise para o formato Obsidian
   *
   * @param {Object} analysis - Resultado do MeetingAnalyzer
   * @param {Object} pricing - Resultado do PricingEngine (opcional)
   * @param {Object} transcription - Transcricao original (opcional)
   * @returns {Object} Caminhos dos arquivos gerados
   */
  async exportAll(analysis, pricing = null, transcription = null) {
    const meta = analysis.metadata || {};
    const clientName = meta.clientName || 'Cliente';
    const meetingDate = meta.meetingDate || new Date().toISOString().split('T')[0];

    // Define diretorio de saida: vault do Obsidian ou diretorio de output
    const baseDir = this.vaultPath
      ? path.join(this.vaultPath, 'Reunioes', clientName, meetingDate)
      : path.join(this.outputDir, 'obsidian', clientName, meetingDate);

    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    console.log(`[Obsidian] Exportando notas para: ${baseDir}`);

    const files = {};

    // 1. Nota principal da reuniao
    files.meetingNote = this._writeMeetingNote(baseDir, analysis, meetingDate, clientName);

    // 2. Mapa mental
    files.mindMap = this._writeMindMap(baseDir, analysis, meetingDate, clientName);

    // 3. Itens de acao
    files.actionItems = this._writeActionItems(baseDir, analysis, meetingDate, clientName);

    // 4. Proposta (se houver dados de precificacao)
    if (pricing) {
      files.proposal = this._writeProposal(baseDir, analysis, pricing, meetingDate, clientName);
    }

    // 5. Transcricao completa (se disponivel)
    if (transcription) {
      files.transcript = this._writeTranscript(baseDir, transcription, meetingDate, clientName);
    }

    // 6. Requisitos
    files.requirements = this._writeRequirements(baseDir, analysis, meetingDate, clientName);

    console.log(`[Obsidian] ${Object.keys(files).length} arquivos exportados com sucesso!`);
    return files;
  }

  /**
   * Gera a nota principal da reuniao
   * @private
   */
  _writeMeetingNote(baseDir, analysis, date, client) {
    const resumo = analysis.resumoExecutivo || {};
    const filePath = path.join(baseDir, 'nota-reuniao.md');

    const content = `---
tags:
  - reuniao
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
tipo: ${analysis.metadata?.meetingType || 'reuniao'}
status: processada
---

# ${resumo.titulo || `Reuniao com ${client}`}

> [!info] Dados da Reuniao
> **Data:** ${date}
> **Cliente:** ${client}
> **Tipo:** ${analysis.metadata?.meetingType || 'Reuniao'}
> **Sentimento Geral:** ${resumo.sentimentoGeral || 'nao avaliado'}
> **Nivel de Engajamento:** ${resumo.nivelEngajamento || 'nao avaliado'}

## Participantes
${(resumo.participantes || []).map(p => `- ${p}`).join('\n') || '- Nao identificados'}

## Resumo Executivo
${resumo.resumo || 'Sem resumo disponivel.'}

## Documentos Relacionados
- [[mapa-mental|Mapa Mental]]
- [[itens-acao|Itens de Acao]]
- [[requisitos|Requisitos]]
${analysis.orcamentoDiscutido ? '- [[proposta|Proposta Comercial]]' : ''}

## Itens Negociados
${this._formatNegotiatedItems(analysis.itensNegociados)}

## Orcamento Discutido
${this._formatBudget(analysis.orcamentoDiscutido)}

## Riscos Identificados
${this._formatRisks(analysis.avaliacaoRiscos)}

## Insights Adicionais
${this._formatInsights(analysis.insightsAdicionais)}

---
*Nota gerada automaticamente pelo Meeting Intelligence System em ${new Date().toLocaleString('pt-BR')}*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Nota da reuniao: ${filePath}`);
    return filePath;
  }

  /**
   * Gera o mapa mental em markdown
   * @private
   */
  _writeMindMap(baseDir, analysis, date, client) {
    const mapa = analysis.mapaMental || {};
    const filePath = path.join(baseDir, 'mapa-mental.md');

    const content = `---
tags:
  - mapa-mental
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
---

# Mapa Mental - ${mapa.topicoCentral || `Reuniao ${client}`}

> Documento relacionado: [[nota-reuniao|Nota da Reuniao]]

${mapa.markdown || this._generateMindMapFromBranches(mapa)}

---
*Gerado automaticamente pelo Meeting Intelligence System*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Mapa mental: ${filePath}`);
    return filePath;
  }

  /**
   * Gera markdown do mapa mental a partir da estrutura de ramos
   * @private
   */
  _generateMindMapFromBranches(mapa) {
    if (!mapa.ramos || mapa.ramos.length === 0) {
      return '- Sem dados suficientes para gerar mapa mental';
    }

    let md = `- **${mapa.topicoCentral || 'Tema Central'}**\n`;

    for (const ramo of mapa.ramos) {
      md += `  - ${ramo.titulo}\n`;
      if (ramo.subitens) {
        for (const sub of ramo.subitens) {
          md += `    - ${sub.titulo}\n`;
          if (sub.detalhes) {
            for (const detalhe of sub.detalhes) {
              md += `      - ${detalhe}\n`;
            }
          }
        }
      }
    }

    return md;
  }

  /**
   * Gera arquivo de itens de acao / proximos passos
   * @private
   */
  _writeActionItems(baseDir, analysis, date, client) {
    const passos = analysis.proximosPassos || [];
    const filePath = path.join(baseDir, 'itens-acao.md');

    const content = `---
tags:
  - acoes
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
---

# Itens de Acao - ${client} (${date})

> Documento relacionado: [[nota-reuniao|Nota da Reuniao]]

## Proximos Passos

${passos.length > 0 ? passos.map((p, i) => `### ${i + 1}. ${p.acao}
- **Responsavel:** ${p.responsavel || 'A definir'}
- **Prazo:** ${p.prazo || 'A definir'}
- **Prioridade:** ${p.prioridade || 'media'}
- **Status:** - [ ] Pendente
${p.dependencias && p.dependencias.length > 0 ? `- **Dependencias:** ${p.dependencias.join(', ')}` : ''}
`).join('\n') : 'Nenhum item de acao identificado.'}

## Pontos em Aberto
${this._formatOpenPoints(analysis.itensNegociados)}

## Cronograma Estimado
${this._formatTimeline(analysis.estimativaCronograma)}

---
*Gerado automaticamente pelo Meeting Intelligence System*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Itens de acao: ${filePath}`);
    return filePath;
  }

  /**
   * Gera arquivo de proposta comercial
   * @private
   */
  _writeProposal(baseDir, analysis, pricing, date, client) {
    const filePath = path.join(baseDir, 'proposta.md');
    const tiers = pricing.tiers || {};

    const content = `---
tags:
  - proposta
  - comercial
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
---

# Proposta Comercial - ${client}

> Documento relacionado: [[nota-reuniao|Nota da Reuniao]] | [[requisitos|Requisitos]]

## Resumo de Precificacao

| Plano | Itens | Horas Est. | Valor |
|-------|-------|-----------|-------|
${Object.entries(tiers).map(([key, tier]) =>
  `| **${tier.name}** | ${tier.itemCount} | ${tier.totalHours}h | R$ ${tier.total.toLocaleString('pt-BR')} |`
).join('\n')}

## Detalhamento por Plano

${Object.entries(tiers).map(([key, tier]) => `
### Plano ${tier.name}

| Item | Horas | Valor |
|------|-------|-------|
${tier.items.map(item =>
  `| ${item.name} | ${item.hoursEstimate}h | R$ ${item.unitPrice.toLocaleString('pt-BR')} |`
).join('\n')}
| **Total** | **${tier.totalHours}h** | **R$ ${tier.total.toLocaleString('pt-BR')}** |
${tier.discountPercent > 0 ? `\n> Desconto de ${tier.discountPercent}%: -R$ ${tier.discountAmount.toLocaleString('pt-BR')}` : ''}
`).join('\n')}

## Observacoes
${(pricing.notes || []).map(n => `- ${n}`).join('\n')}

## Valor Hora Tecnica
- **R$ ${pricing.hourlyRate}/hora**

---
*Proposta gerada automaticamente pelo Meeting Intelligence System em ${new Date().toLocaleString('pt-BR')}*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Proposta: ${filePath}`);
    return filePath;
  }

  /**
   * Gera arquivo com a transcricao completa
   * @private
   */
  _writeTranscript(baseDir, transcription, date, client) {
    const filePath = path.join(baseDir, 'transcricao.md');

    const WhisperEngine = require('../transcription/whisper-engine');
    const timestampedText = WhisperEngine.toTimestampedText(transcription);

    const content = `---
tags:
  - transcricao
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
---

# Transcricao Completa - ${client} (${date})

> Documento relacionado: [[nota-reuniao|Nota da Reuniao]]
> **Idioma detectado:** ${transcription.language || 'nao identificado'}
> **Duracao:** ${transcription.duration ? `${Math.round(transcription.duration / 60)} minutos` : 'desconhecida'}

## Conteudo

\`\`\`
${timestampedText || transcription.text || 'Transcricao nao disponivel'}
\`\`\`

---
*Transcricao gerada pelo Whisper (OpenAI)*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Transcricao: ${filePath}`);
    return filePath;
  }

  /**
   * Gera arquivo de requisitos
   * @private
   */
  _writeRequirements(baseDir, analysis, date, client) {
    const reqs = analysis.requisitosCliente || {};
    const tech = analysis.requisitosTecnicos || {};
    const filePath = path.join(baseDir, 'requisitos.md');

    const content = `---
tags:
  - requisitos
  - ${this._slugify(client)}
  - ${date}
date: ${date}
cliente: ${client}
---

# Requisitos - ${client}

> Documento relacionado: [[nota-reuniao|Nota da Reuniao]]

## Requisitos Funcionais
${(reqs.funcionais || []).map(r =>
  `### ${r.id} - ${r.titulo}\n- **Descricao:** ${r.descricao}\n- **Prioridade:** ${r.prioridade}\n- **Complexidade:** ${r.complexidade}\n`
).join('\n') || 'Nenhum requisito funcional identificado.'}

## Requisitos Nao-Funcionais
${(reqs.naoFuncionais || []).map(r =>
  `### ${r.id} - ${r.titulo}\n- **Descricao:** ${r.descricao}\n- **Categoria:** ${r.categoria}\n`
).join('\n') || 'Nenhum requisito nao-funcional identificado.'}

## Restricoes
${(reqs.restricoes || []).map(r => `- ${r}`).join('\n') || '- Nenhuma restricao identificada'}

## Premissas
${(reqs.premissas || []).map(r => `- ${r}`).join('\n') || '- Nenhuma premissa identificada'}

## Requisitos Tecnicos
- **Tecnologias Exigidas:** ${(tech.tecnologiasExigidas || []).join(', ') || 'Nenhuma'}
- **Tecnologias Sugeridas:** ${(tech.tecnologiasSugeridas || []).join(', ') || 'Nenhuma'}
- **Infraestrutura:** ${tech.infraestrutura || 'Nao especificada'}
- **Volumetria:** ${tech.volumetria || 'Nao especificada'}

### Integracoes
${(tech.integracoes || []).map(i =>
  `- **${i.sistema}** (${i.tipo}): ${i.detalhes}`
).join('\n') || '- Nenhuma integracao identificada'}

### Seguranca
${(tech.seguranca || []).map(s => `- ${s}`).join('\n') || '- Nenhum requisito de seguranca identificado'}

## Arquitetura Proposta
${analysis.arquiteturaProposta ? `
${analysis.arquiteturaProposta.visaoGeral || ''}

\`\`\`
${analysis.arquiteturaProposta.diagramaASCII || 'Diagrama nao disponivel'}
\`\`\`

### Componentes
${(analysis.arquiteturaProposta.componentes || []).map(c =>
  `- **${c.nome}** (${c.tecnologia}): ${c.descricao}`
).join('\n') || 'Componentes nao detalhados'}

### Justificativa
${analysis.arquiteturaProposta.justificativa || 'Nao detalhada'}
` : 'Arquitetura nao proposta nesta reuniao.'}

---
*Gerado automaticamente pelo Meeting Intelligence System*
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`[Obsidian] Requisitos: ${filePath}`);
    return filePath;
  }

  // === Helpers de formatacao ===

  _formatNegotiatedItems(items) {
    if (!items) return 'Nenhum item negociado identificado.';
    let md = '';
    if (items.acordos && items.acordos.length > 0) {
      md += '### Acordos\n';
      md += items.acordos.map(a =>
        `- **${a.item}** (${a.status}) - ${a.detalhes}${a.responsavel ? ` | Responsavel: ${a.responsavel}` : ''}`
      ).join('\n');
      md += '\n\n';
    }
    if (items.concessoes && items.concessoes.length > 0) {
      md += '### Concessoes\n';
      md += items.concessoes.map(c => `- ${c}`).join('\n');
    }
    return md || 'Nenhum item negociado identificado.';
  }

  _formatBudget(budget) {
    if (!budget) return 'Orcamento nao discutido.';
    return `- **Valor mencionado:** ${budget.valorMencionado || 'Nao mencionado'}
- **Expectativa do cliente:** ${budget.expectativaCliente || 'Nao informada'}
- **Modelo comercial:** ${budget.modeloComercial || 'Nao definido'}
${budget.observacoes ? `- **Observacoes:** ${budget.observacoes}` : ''}`;
  }

  _formatRisks(risks) {
    if (!risks || risks.length === 0) return 'Nenhum risco identificado.';
    return risks.map(r =>
      `- **${r.risco}** | Prob: ${r.probabilidade} | Impacto: ${r.impacto} | Mitigacao: ${r.mitigacao}`
    ).join('\n');
  }

  _formatInsights(insights) {
    if (!insights) return 'Sem insights adicionais.';
    let md = '';
    if (insights.oportunidades && insights.oportunidades.length > 0) {
      md += '### Oportunidades\n' + insights.oportunidades.map(o => `- ${o}`).join('\n') + '\n\n';
    }
    if (insights.alertas && insights.alertas.length > 0) {
      md += '### Alertas\n' + insights.alertas.map(a => `- ${a}`).join('\n') + '\n\n';
    }
    if (insights.citacoesImportantes && insights.citacoesImportantes.length > 0) {
      md += '### Citacoes Importantes\n' + insights.citacoesImportantes.map(c =>
        `> "${c.fala}"\n> *${c.contexto} - ${c.relevancia}*`
      ).join('\n\n');
    }
    return md || 'Sem insights adicionais.';
  }

  _formatOpenPoints(items) {
    if (!items || !items.pontosAbertos || items.pontosAbertos.length === 0) {
      return 'Nenhum ponto em aberto.';
    }
    return items.pontosAbertos.map(p =>
      `- [ ] **${p.item}** - ${p.contexto} | Acao: ${p.acaoNecessaria}`
    ).join('\n');
  }

  _formatTimeline(timeline) {
    if (!timeline) return 'Cronograma nao estimado.';
    let md = `- **Duracao total estimada:** ${timeline.duracaoTotal || 'A definir'}\n`;
    if (timeline.fases && timeline.fases.length > 0) {
      md += '\n| Fase | Duracao | Entregaveis |\n|------|---------|-------------|\n';
      md += timeline.fases.map(f =>
        `| ${f.fase} | ${f.duracao} | ${(f.entregaveis || []).join(', ')} |`
      ).join('\n');
    }
    return md;
  }

  /**
   * Converte texto para slug (sem acentos, lowercase, hifens)
   * @private
   */
  _slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

module.exports = ObsidianExporter;
