/**
 * Site Generator - Gera site estático de proposta comercial para o cliente
 * HTML responsivo, tema escuro moderno, com tabela de preços e PDF
 */

const fs = require('fs');
const path = require('path');

class SiteGenerator {
  constructor(options = {}) {
    this.companyName = options.companyName || process.env.COMPANY_NAME || 'Sua Empresa';
    this.companyLogo = options.companyLogo || process.env.COMPANY_LOGO_URL || '';
    this.outputDir = options.outputDir || process.env.OUTPUT_DIR || './output';
  }

  /**
   * Gera o site completo da proposta
   */
  async generate(analysis, pricing, metadata = {}) {
    const clientName = metadata.client || 'Cliente';
    const date = metadata.date || new Date().toISOString().split('T')[0];
    const html = this._buildHTML(analysis, pricing, metadata);

    const siteDir = path.join(this.outputDir, 'proposals', `${date}_${clientName.replace(/\s+/g, '-').toLowerCase()}`);
    fs.mkdirSync(siteDir, { recursive: true });

    const htmlPath = path.join(siteDir, 'index.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // Gera dados JSON para referência
    const dataPath = path.join(siteDir, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify({ analysis, pricing, metadata }, null, 2), 'utf-8');

    console.log(`[SiteGenerator] Proposta gerada em: ${htmlPath}`);
    return { htmlPath, siteDir, dataPath };
  }

  _buildHTML(analysis, pricing, metadata) {
    const clientName = metadata.client || 'Cliente';
    const date = metadata.date || new Date().toISOString().split('T')[0];
    const solucao = analysis.solucao_proposta || {};
    const planos = pricing.planos || {};
    const resumo = pricing.resumo || {};
    const timeline = analysis.estimativa_timeline || {};

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial — ${clientName} | ${this.companyName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-primary: #0a0a0f;
      --bg-secondary: #12121a;
      --bg-card: #1a1a2e;
      --bg-glass: rgba(26, 26, 46, 0.7);
      --text-primary: #e8e8f0;
      --text-secondary: #9898b0;
      --accent: #6c63ff;
      --accent-glow: rgba(108, 99, 255, 0.3);
      --success: #00d4aa;
      --warning: #ffd93d;
      --gradient: linear-gradient(135deg, #6c63ff 0%, #00d4aa 100%);
      --border: rgba(108, 99, 255, 0.15);
    }

    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.7;
      overflow-x: hidden;
    }

    .bg-grid {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-image: radial-gradient(rgba(108,99,255,0.07) 1px, transparent 1px);
      background-size: 40px 40px;
      pointer-events: none; z-index: 0;
    }

    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

    /* Hero */
    .hero {
      min-height: 60vh; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 80px 0;
      background: radial-gradient(ellipse at 50% 0%, var(--accent-glow) 0%, transparent 60%);
    }
    .hero h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 800; margin-bottom: 16px; }
    .hero h1 span { background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero .subtitle { font-size: 1.25rem; color: var(--text-secondary); max-width: 600px; margin: 0 auto 32px; }
    .hero .meta { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; color: var(--text-secondary); font-size: 0.9rem; }
    .hero .meta span { display: flex; align-items: center; gap: 6px; }

    /* Sections */
    section { padding: 80px 0; }
    .section-title {
      font-size: 2rem; font-weight: 700; margin-bottom: 12px;
    }
    .section-title span { background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .section-subtitle { color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 48px; }

    /* Cards */
    .card {
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 16px; padding: 32px;
      backdrop-filter: blur(10px);
      transition: transform 0.3s, border-color 0.3s;
    }
    .card:hover { transform: translateY(-4px); border-color: var(--accent); }

    .card-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }

    /* Summary */
    .summary-text { font-size: 1.1rem; color: var(--text-secondary); line-height: 1.9; max-width: 800px; }

    /* Components table */
    .table-wrapper { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
    table { width: 100%; border-collapse: collapse; }
    th { background: var(--bg-card); padding: 16px; text-align: left; font-weight: 600; color: var(--accent); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
    td { padding: 14px 16px; border-top: 1px solid var(--border); color: var(--text-secondary); }
    tr:hover td { background: rgba(108,99,255,0.05); }

    /* Pricing */
    .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 48px; }
    .price-card {
      background: var(--bg-glass); border: 1px solid var(--border);
      border-radius: 20px; padding: 40px 32px; text-align: center;
      backdrop-filter: blur(10px); position: relative; overflow: hidden;
      transition: transform 0.3s;
    }
    .price-card:hover { transform: translateY(-8px); }
    .price-card.recommended {
      border-color: var(--accent);
      box-shadow: 0 0 40px var(--accent-glow);
    }
    .price-card.recommended::before {
      content: '⭐ RECOMENDADO'; position: absolute; top: 16px; right: -32px;
      background: var(--gradient); color: #fff; padding: 6px 40px;
      font-size: 0.75rem; font-weight: 700; transform: rotate(45deg);
    }
    .price-card h3 { font-size: 1.4rem; margin-bottom: 8px; }
    .price-card .price { font-size: 2.5rem; font-weight: 800; margin: 20px 0; }
    .price-card .price span { background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .price-card .desc { color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 24px; }
    .price-card ul { list-style: none; text-align: left; margin-bottom: 32px; }
    .price-card li { padding: 8px 0; color: var(--text-secondary); font-size: 0.9rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .price-card li::before { content: '✓ '; color: var(--success); font-weight: 700; }
    .price-card .timeline { color: var(--text-secondary); font-size: 0.85rem; margin-top: 8px; }

    /* Timeline */
    .timeline-track { position: relative; padding-left: 40px; }
    .timeline-track::before { content: ''; position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: var(--gradient); }
    .timeline-item { position: relative; margin-bottom: 32px; }
    .timeline-item::before {
      content: ''; position: absolute; left: -33px; top: 6px;
      width: 14px; height: 14px; border-radius: 50%;
      background: var(--accent); box-shadow: 0 0 12px var(--accent-glow);
    }
    .timeline-item h4 { font-size: 1.1rem; margin-bottom: 4px; }
    .timeline-item p { color: var(--text-secondary); font-size: 0.95rem; }

    /* Requirements */
    .req-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 0.8rem; font-weight: 600; margin: 2px;
    }
    .req-alta { background: rgba(255,77,77,0.15); color: #ff4d4d; }
    .req-media { background: rgba(255,217,61,0.15); color: #ffd93d; }
    .req-baixa { background: rgba(0,212,170,0.15); color: #00d4aa; }

    /* CTA */
    .cta-section { text-align: center; padding: 100px 0; }
    .btn {
      display: inline-block; padding: 16px 48px; border-radius: 12px;
      font-size: 1.1rem; font-weight: 700; text-decoration: none;
      background: var(--gradient); color: #fff;
      transition: transform 0.3s, box-shadow 0.3s;
      border: none; cursor: pointer;
    }
    .btn:hover { transform: scale(1.05); box-shadow: 0 8px 30px var(--accent-glow); }
    .btn-outline {
      background: transparent; border: 2px solid var(--accent); color: var(--accent);
      margin-left: 16px;
    }

    /* Footer */
    footer { padding: 40px 0; text-align: center; color: var(--text-secondary); font-size: 0.85rem; border-top: 1px solid var(--border); }

    /* Risks */
    .risk-item { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.02); }
    .risk-icon { font-size: 1.5rem; }

    /* Responsive */
    @media (max-width: 768px) {
      .hero { min-height: auto; padding: 60px 0; }
      .pricing-grid { grid-template-columns: 1fr; }
      .hero .meta { flex-direction: column; align-items: center; }
      .price-card.recommended::before { font-size: 0.65rem; right: -36px; top: 12px; }
    }

    @media print {
      .bg-grid { display: none; }
      body { background: #fff; color: #111; }
      .card, .price-card { border: 1px solid #ddd; background: #f9f9f9; }
      .btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="bg-grid"></div>

  <!-- HERO -->
  <header class="hero">
    <div class="container">
      ${this.companyLogo ? `<img src="${this.companyLogo}" alt="${this.companyName}" style="height:48px;margin-bottom:24px;">` : ''}
      <h1>Proposta Comercial para <span>${clientName}</span></h1>
      <p class="subtitle">${solucao.descricao || 'Solução personalizada desenvolvida sob medida para atender às suas necessidades.'}</p>
      <div class="meta">
        <span>📅 ${date}</span>
        <span>🏢 ${this.companyName}</span>
        <span>💰 ${resumo.faixa_preco || ''}</span>
        <span>⏱️ ${resumo.prazo_recomendado || ''}</span>
      </div>
    </div>
  </header>

  <!-- RESUMO -->
  <section>
    <div class="container">
      <h2 class="section-title"><span>Resumo</span> Executivo</h2>
      <p class="section-subtitle">O que discutimos e o que propomos</p>
      <div class="card">
        <p class="summary-text">${(analysis.resumo_executivo || '').replace(/\n/g, '<br>')}</p>
      </div>
    </div>
  </section>

  <!-- REQUISITOS -->
  <section style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title"><span>Requisitos</span> Identificados</h2>
      <p class="section-subtitle">Tudo que capturamos durante nossa conversa</p>
      <div class="card-grid">
        ${(analysis.requisitos_cliente || []).map(r => `
          <div class="card">
            <span class="req-badge req-${r.prioridade}">${r.prioridade?.toUpperCase()}</span>
            <span class="req-badge" style="background:rgba(108,99,255,0.15);color:var(--accent);">${r.tipo}</span>
            <h4 style="margin-top:12px;">${r.requisito}</h4>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:8px;">${r.detalhes || ''}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- SOLUÇÃO -->
  <section>
    <div class="container">
      <h2 class="section-title"><span>Solução</span> Proposta</h2>
      <p class="section-subtitle">Arquitetura e componentes que vamos construir</p>

      ${solucao.arquitetura_sugerida ? `
      <div class="card" style="margin-bottom:32px;">
        <h4 style="color:var(--accent);margin-bottom:12px;">Arquitetura</h4>
        <p style="color:var(--text-secondary);">${solucao.arquitetura_sugerida}</p>
      </div>
      ` : ''}

      <div class="card-grid">
        ${(solucao.componentes || []).map(c => `
          <div class="card">
            <span class="req-badge req-${c.complexidade}">${c.complexidade}</span>
            <h4 style="margin-top:12px;">${c.nome}</h4>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:8px;">${c.descricao}</p>
          </div>
        `).join('')}
      </div>

      ${(solucao.stack_recomendado || []).length > 0 ? `
      <div style="margin-top:32px;display:flex;gap:8px;flex-wrap:wrap;">
        <span style="color:var(--text-secondary);font-weight:600;">Stack:</span>
        ${solucao.stack_recomendado.map(t => `<span class="req-badge" style="background:rgba(0,212,170,0.15);color:var(--success);">${t}</span>`).join('')}
      </div>
      ` : ''}
    </div>
  </section>

  <!-- COMPONENTES E HORAS -->
  <section style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title"><span>Detalhamento</span> de Componentes</h2>
      <p class="section-subtitle">Estimativa detalhada por componente</p>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr><th>Componente</th><th>Complexidade</th><th>Horas Est.</th><th>Valor</th></tr>
          </thead>
          <tbody>
            ${(pricing.componentes || []).map(c => `
              <tr>
                <td><strong>${c.nome}</strong><br><small style="color:var(--text-secondary)">${c.descricao}</small></td>
                <td><span class="req-badge req-${c.complexidade}">${c.complexidade}</span></td>
                <td>${c.horas_estimadas}h</td>
                <td style="color:var(--success);font-weight:600;">R$ ${c.valor.toLocaleString('pt-BR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- PREÇOS -->
  <section>
    <div class="container">
      <h2 class="section-title"><span>Planos</span> & Investimento</h2>
      <p class="section-subtitle">Escolha o plano que melhor atende seu momento</p>
      <div class="pricing-grid">
        ${Object.entries(planos).map(([key, plan]) => `
          <div class="price-card ${plan.recomendado ? 'recommended' : ''}">
            <h3>${plan.nome}</h3>
            <p class="desc">${plan.descricao}</p>
            <div class="price"><span>${plan.valor_formatado}</span></div>
            <p class="timeline">⏱️ Prazo: ${plan.prazo_estimado} | 📊 ${plan.horas}h estimadas</p>
            <ul>
              ${(plan.inclui || []).map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- TIMELINE -->
  <section style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title"><span>Timeline</span> do Projeto</h2>
      <p class="section-subtitle">Marcos e prazos estimados</p>
      <div class="timeline-track">
        ${timeline.fase_discovery ? `<div class="timeline-item"><h4>Discovery & Planejamento</h4><p>${timeline.fase_discovery}</p></div>` : ''}
        ${timeline.fase_desenvolvimento ? `<div class="timeline-item"><h4>Desenvolvimento</h4><p>${timeline.fase_desenvolvimento}</p></div>` : ''}
        ${timeline.fase_testes ? `<div class="timeline-item"><h4>Testes & QA</h4><p>${timeline.fase_testes}</p></div>` : ''}
        ${timeline.fase_deploy ? `<div class="timeline-item"><h4>Deploy & Go-live</h4><p>${timeline.fase_deploy}</p></div>` : ''}
        ${(timeline.marcos || []).map(m => `<div class="timeline-item"><h4>${m.marco}</h4><p>${m.prazo_estimado}</p></div>`).join('')}
      </div>
    </div>
  </section>

  <!-- RISCOS -->
  ${(analysis.avaliacao_riscos || []).length > 0 ? `
  <section>
    <div class="container">
      <h2 class="section-title"><span>Riscos</span> & Mitigações</h2>
      <p class="section-subtitle">Transparência sobre possíveis desafios</p>
      ${analysis.avaliacao_riscos.map(r => `
        <div class="risk-item">
          <div class="risk-icon">${r.impacto === 'alto' ? '🔴' : r.impacto === 'medio' ? '🟡' : '🟢'}</div>
          <div>
            <strong>${r.risco}</strong>
            <p style="color:var(--text-secondary);font-size:0.9rem;">Impacto: ${r.impacto} | Probabilidade: ${r.probabilidade}</p>
            <p style="color:var(--success);font-size:0.9rem;margin-top:4px;">💡 Mitigação: ${r.mitigacao}</p>
          </div>
        </div>
      `).join('')}
    </div>
  </section>
  ` : ''}

  <!-- CONDIÇÕES -->
  <section style="background: var(--bg-secondary);">
    <div class="container">
      <h2 class="section-title"><span>Condições</span> Comerciais</h2>
      <div class="card">
        <ul style="list-style:none;">
          ${(pricing.condicoes || []).map(c => `<li style="padding:8px 0;border-bottom:1px solid var(--border);color:var(--text-secondary);">📌 ${c}</li>`).join('')}
        </ul>
        <p style="margin-top:16px;color:var(--warning);font-weight:600;">⏰ Proposta válida até: ${pricing.validade?.valido_ate || 'N/A'}</p>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="cta-section">
    <div class="container">
      <h2 class="section-title" style="font-size:2.5rem;">Vamos <span>começar</span>?</h2>
      <p class="section-subtitle">Estamos prontos para transformar sua visão em realidade</p>
      <button class="btn" onclick="window.print()">📄 Baixar PDF</button>
      <a href="mailto:contato@empresa.com?subject=Aprovação Proposta - ${clientName}" class="btn btn-outline">✉️ Entrar em Contato</a>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="container">
      <p>${this.companyName} — Proposta gerada automaticamente em ${date}</p>
      <p style="margin-top:8px;font-size:0.8rem;color:rgba(152,152,176,0.5);">Powered by Meeting Intelligence AI</p>
    </div>
  </footer>

</body>
</html>`;
  }
}

module.exports = SiteGenerator;
