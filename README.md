# AiOS Fullstack Squad

Framework open source com **19 agentes de IA** para desenvolvimento completo de SaaS, construido sobre o [Synkra AiOS](https://github.com/SynkraAI/aios-core).

## O que e isso?

Um time completo de agentes IA que substitui uma equipe de 12+ desenvolvedores especializados. Cada agente tem personalidade, comandos e expertise propria.

## 19 Agentes

### Core (11 - baseados no Synkra AiOS)
| Agente | Nome | Funcao |
|--------|------|--------|
| @analyst | Zara | Pesquisa e analise de viabilidade |
| @pm | Kai | Product management e PRDs |
| @architect | Aria | Arquitetura de software |
| @po | Nova | Product ownership e backlog |
| @sm | River | Scrum master e historias |
| @dev | Dex | Desenvolvimento de codigo |
| @qa | Quinn | Quality assurance |
| @devops | Felix | CI/CD e deploy |
| @ux-design-expert | Uma | UX/UI e acessibilidade |
| @data-engineer | Dara | Modelagem de dados |
| @aiox-master | Pax | Orquestrador do time |

### Customizados (8 - criados para SaaS completo)
| Agente | Nome | Funcao |
|--------|------|--------|
| @squad-creator | - | Cria novos squads |
| @sentinel | Sage | Evolucao continua do time |
| @cypher | Vex | Cyberseguranca e pentest |
| @cloud-ops | Atlas | Infraestrutura cloud e IaC |
| @billing | Ledger | Billing e subscriptions |
| @observe | Iris | Monitoring e observabilidade |
| @frontend-lead | Pixel | Arquitetura frontend |
| @product-analytics | Metric | Analytics e growth |

## Instalacao
```bash
git clone https://github.com/SEU_USER/aios-fullstack-squad.git
cd aios-fullstack-squad
npm install
```

Copie os agentes para o Claude Code:
```bash
cp .aios-core/development/agents/* .claude/commands/AIOS/agents/
```

## Creditos

- Agentes core baseados no [Synkra AiOS](https://github.com/SynkraAI/aios-core) por Pedro Valerio
- Agentes customizados (sentinel, cypher, cloud-ops, billing, observe, frontend-lead, product-analytics) criados com Claude AI
- Conceito inspirado no trabalho de Alan Nicolas, Thiago Finch e Pedro Valerio

## Licenca

MIT
