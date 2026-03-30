/**
 * Motor de Precificacao
 *
 * Calcula estimativas de custo baseado nos requisitos extraidos da reuniao.
 * Suporta diferentes tiers de preco (basico, padrao, premium) e
 * gera tabelas de precificacao detalhadas por componente/funcionalidade.
 */

const config = require('../config');

class PricingEngine {
  constructor(options = {}) {
    // Valor hora tecnica padrao
    this.hourlyRate = options.hourlyRate || config.pricing.hourlyRate;
    this.currency = options.currency || config.pricing.currency;
    this.defaultDiscount = options.defaultDiscount || config.pricing.defaultDiscount;

    // Multiplicadores por tier
    this.tierMultipliers = {
      basic: 1.0,     // Funcionalidades essenciais apenas
      standard: 1.5,  // Funcionalidades essenciais + importantes
      premium: 2.2,   // Todas as funcionalidades + extras
    };

    // Estimativas base de horas por tipo de componente
    // Estes valores sao ajustados pela complexidade dos requisitos
    this.baseEstimates = {
      // Frontend
      'landing-page': { min: 8, max: 16, label: 'Landing Page' },
      'dashboard': { min: 24, max: 60, label: 'Dashboard/Painel' },
      'formulario-simples': { min: 4, max: 8, label: 'Formulario Simples' },
      'formulario-complexo': { min: 12, max: 24, label: 'Formulario Complexo' },
      'listagem-crud': { min: 16, max: 32, label: 'Listagem CRUD' },
      'relatorios': { min: 16, max: 40, label: 'Modulo de Relatorios' },
      'graficos': { min: 12, max: 24, label: 'Graficos e Visualizacoes' },
      'responsividade': { min: 8, max: 16, label: 'Responsividade Mobile' },

      // Backend
      'api-rest': { min: 16, max: 40, label: 'API REST' },
      'autenticacao': { min: 16, max: 32, label: 'Autenticacao/Autorizacao' },
      'banco-dados': { min: 12, max: 24, label: 'Modelagem de Banco de Dados' },
      'integracao-externa': { min: 16, max: 40, label: 'Integracao com Sistema Externo' },
      'processamento-background': { min: 12, max: 24, label: 'Processamento em Background' },
      'notificacoes': { min: 8, max: 20, label: 'Sistema de Notificacoes' },
      'upload-arquivos': { min: 8, max: 16, label: 'Upload de Arquivos' },
      'busca-avancada': { min: 12, max: 24, label: 'Busca Avancada' },

      // Infraestrutura
      'ci-cd': { min: 8, max: 16, label: 'CI/CD Pipeline' },
      'monitoramento': { min: 8, max: 16, label: 'Monitoramento' },
      'deploy-cloud': { min: 8, max: 24, label: 'Deploy em Cloud' },

      // Extras
      'testes-automatizados': { min: 16, max: 40, label: 'Testes Automatizados' },
      'documentacao': { min: 8, max: 16, label: 'Documentacao Tecnica' },
      'treinamento': { min: 8, max: 16, label: 'Treinamento' },
      'suporte-30dias': { min: 16, max: 32, label: 'Suporte pos-entrega (30 dias)' },
    };
  }

  /**
   * Gera precificacao completa baseada na analise da reuniao
   *
   * @param {Object} analysis - Resultado da analise do MeetingAnalyzer
   * @returns {Object} Dados completos de precificacao com tiers
   */
  generatePricing(analysis) {
    console.log('[Precificacao] Gerando estimativa de custos...');

    // Extrai componentes e funcionalidades dos requisitos
    const lineItems = this._extractLineItems(analysis);

    // Calcula precos para cada tier
    const tiers = {};
    for (const [tierName, multiplier] of Object.entries(this.tierMultipliers)) {
      tiers[tierName] = this._calculateTier(lineItems, tierName, multiplier);
    }

    const result = {
      lineItems,
      tiers,
      hourlyRate: this.hourlyRate,
      currency: this.currency,
      generatedAt: new Date().toISOString(),
      notes: this._generateNotes(analysis),
    };

    console.log(`[Precificacao] Estimativa gerada: ${lineItems.length} itens`);
    console.log(`[Precificacao] Basico: R$ ${tiers.basic.total.toLocaleString('pt-BR')}`);
    console.log(`[Precificacao] Padrao: R$ ${tiers.standard.total.toLocaleString('pt-BR')}`);
    console.log(`[Precificacao] Premium: R$ ${tiers.premium.total.toLocaleString('pt-BR')}`);

    return result;
  }

  /**
   * Extrai itens de linha dos requisitos analisados
   * @private
   */
  _extractLineItems(analysis) {
    const items = [];
    const reqs = analysis.requisitosCliente || {};
    const funcionais = reqs.funcionais || [];
    const naoFuncionais = reqs.naoFuncionais || [];
    const tecReqs = analysis.requisitosTecnicos || {};
    const integracoes = tecReqs.integracoes || [];

    // Mapeia requisitos funcionais para itens de preco
    for (const req of funcionais) {
      const estimate = this._estimateHours(req);
      items.push({
        id: req.id || `RF${items.length + 1}`,
        category: 'funcionalidade',
        name: req.titulo,
        description: req.descricao,
        priority: req.prioridade || 'importante',
        complexity: req.complexidade || 'media',
        hoursMin: estimate.min,
        hoursMax: estimate.max,
        hoursEstimate: estimate.estimate,
        unitPrice: estimate.estimate * this.hourlyRate,
        includedIn: this._getIncludedTiers(req.prioridade),
      });
    }

    // Integracoes como itens separados
    for (const integ of integracoes) {
      const hours = this.baseEstimates['integracao-externa'] || { min: 16, max: 40 };
      const estimate = Math.round((hours.min + hours.max) / 2);
      items.push({
        id: `INT${items.length + 1}`,
        category: 'integracao',
        name: `Integracao: ${integ.sistema}`,
        description: `${integ.tipo} - ${integ.detalhes}`,
        priority: 'importante',
        complexity: 'alta',
        hoursMin: hours.min,
        hoursMax: hours.max,
        hoursEstimate: estimate,
        unitPrice: estimate * this.hourlyRate,
        includedIn: ['standard', 'premium'],
      });
    }

    // Itens de infraestrutura (sempre inclusos)
    const infraItems = [
      { key: 'ci-cd', priority: 'essencial' },
      { key: 'deploy-cloud', priority: 'essencial' },
      { key: 'monitoramento', priority: 'importante' },
    ];

    for (const infra of infraItems) {
      const hours = this.baseEstimates[infra.key];
      if (hours) {
        const estimate = Math.round((hours.min + hours.max) / 2);
        items.push({
          id: `INF${items.length + 1}`,
          category: 'infraestrutura',
          name: hours.label,
          description: `Configuracao e setup de ${hours.label.toLowerCase()}`,
          priority: infra.priority,
          complexity: 'media',
          hoursMin: hours.min,
          hoursMax: hours.max,
          hoursEstimate: estimate,
          unitPrice: estimate * this.hourlyRate,
          includedIn: this._getIncludedTiers(infra.priority),
        });
      }
    }

    // Extras para tiers superiores
    const extras = [
      { key: 'testes-automatizados', tiers: ['standard', 'premium'] },
      { key: 'documentacao', tiers: ['standard', 'premium'] },
      { key: 'treinamento', tiers: ['premium'] },
      { key: 'suporte-30dias', tiers: ['premium'] },
    ];

    for (const extra of extras) {
      const hours = this.baseEstimates[extra.key];
      if (hours) {
        const estimate = Math.round((hours.min + hours.max) / 2);
        items.push({
          id: `EXT${items.length + 1}`,
          category: 'extra',
          name: hours.label,
          description: `${hours.label} do projeto`,
          priority: 'desejavel',
          complexity: 'media',
          hoursMin: hours.min,
          hoursMax: hours.max,
          hoursEstimate: estimate,
          unitPrice: estimate * this.hourlyRate,
          includedIn: extra.tiers,
        });
      }
    }

    // Se nao extraiu nenhum item dos requisitos, gera itens genericos
    if (items.length === 0) {
      return this._generateDefaultItems();
    }

    return items;
  }

  /**
   * Estima horas para um requisito funcional
   * @private
   */
  _estimateHours(requirement) {
    const complexityMultiplier = {
      baixa: 0.7,
      media: 1.0,
      alta: 1.5,
    };

    // Base: 16-32 horas para um requisito medio
    const baseMin = 12;
    const baseMax = 32;
    const mult = complexityMultiplier[requirement.complexidade] || 1.0;

    const min = Math.round(baseMin * mult);
    const max = Math.round(baseMax * mult);
    const estimate = Math.round((min + max) / 2);

    return { min, max, estimate };
  }

  /**
   * Determina em quais tiers um item esta incluido baseado na prioridade
   * @private
   */
  _getIncludedTiers(priority) {
    switch (priority) {
      case 'essencial':
        return ['basic', 'standard', 'premium'];
      case 'importante':
        return ['standard', 'premium'];
      case 'desejavel':
        return ['premium'];
      default:
        return ['standard', 'premium'];
    }
  }

  /**
   * Calcula totais para um tier especifico
   * @private
   */
  _calculateTier(lineItems, tierName, multiplier) {
    const includedItems = lineItems.filter(item =>
      item.includedIn.includes(tierName)
    );

    const subtotal = includedItems.reduce((sum, item) => sum + item.unitPrice, 0);
    const totalHours = includedItems.reduce((sum, item) => sum + item.hoursEstimate, 0);

    // Aplica desconto se configurado
    const discountPercent = this.defaultDiscount;
    const discountAmount = subtotal * (discountPercent / 100);
    const total = subtotal - discountAmount;

    return {
      name: this._getTierLabel(tierName),
      items: includedItems,
      itemCount: includedItems.length,
      totalHours,
      subtotal,
      discountPercent,
      discountAmount,
      total,
      monthlyEstimate: Math.round(total / (totalHours / 160)), // Estimativa mensal (160h/mes)
    };
  }

  /**
   * Retorna label do tier em portugues
   * @private
   */
  _getTierLabel(tierName) {
    const labels = {
      basic: 'Basico',
      standard: 'Padrao',
      premium: 'Premium',
    };
    return labels[tierName] || tierName;
  }

  /**
   * Gera notas/observacoes para a proposta
   * @private
   */
  _generateNotes(analysis) {
    return [
      'Valores estimados com base na analise preliminar dos requisitos discutidos em reuniao.',
      'A estimativa detalhada sera refinada apos levantamento tecnico completo.',
      'Horas sao estimativas e podem variar conforme complexidade real identificada na execucao.',
      'Valores nao incluem custos de infraestrutura cloud (servidores, dominio, etc.).',
      'Proposta valida por 15 dias a partir da data de emissao.',
      'Forma de pagamento a combinar: entrada + parcelas por entrega ou mensal.',
    ];
  }

  /**
   * Gera itens padrao quando nao foi possivel extrair requisitos detalhados
   * @private
   */
  _generateDefaultItems() {
    const defaultItems = [
      'dashboard', 'api-rest', 'autenticacao', 'banco-dados',
      'listagem-crud', 'responsividade', 'ci-cd', 'deploy-cloud',
    ];

    return defaultItems.map((key, index) => {
      const hours = this.baseEstimates[key];
      const estimate = Math.round((hours.min + hours.max) / 2);
      return {
        id: `ITEM${index + 1}`,
        category: 'funcionalidade',
        name: hours.label,
        description: `Desenvolvimento de ${hours.label.toLowerCase()}`,
        priority: index < 4 ? 'essencial' : 'importante',
        complexity: 'media',
        hoursMin: hours.min,
        hoursMax: hours.max,
        hoursEstimate: estimate,
        unitPrice: estimate * this.hourlyRate,
        includedIn: index < 4
          ? ['basic', 'standard', 'premium']
          : ['standard', 'premium'],
      };
    });
  }

  /**
   * Aplica desconto personalizado a uma precificacao existente
   *
   * @param {Object} pricing - Resultado do generatePricing
   * @param {number} discountPercent - Percentual de desconto (0-100)
   * @returns {Object} Precificacao com desconto aplicado
   */
  applyDiscount(pricing, discountPercent) {
    const updated = { ...pricing };

    for (const [tierName, tier] of Object.entries(updated.tiers)) {
      const discountAmount = tier.subtotal * (discountPercent / 100);
      updated.tiers[tierName] = {
        ...tier,
        discountPercent,
        discountAmount,
        total: tier.subtotal - discountAmount,
      };
    }

    return updated;
  }

  /**
   * Formata valor monetario em BRL
   * @param {number} value - Valor numerico
   * @returns {string} Valor formatado
   */
  static formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}

module.exports = PricingEngine;
