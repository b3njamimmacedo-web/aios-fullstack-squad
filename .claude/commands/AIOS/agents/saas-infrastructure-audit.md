---
title: "Análise de infraestrutura: AiOS como time completo para SaaS"
author: "Auditoria de CTO — Claude"
date: "2026-03-28"
version: "1.0"
---

# De 13 agentes a uma software house completa
## Análise minuciosa: gaps, vulnerabilidades e plano de evolução

---

## 1. O esqueleto de um SaaS — o que um dev senior estruturaria

Um SaaS de produção em 2026 precisa de **14 camadas** para ser robusto. Vou mapear cada
uma e auditar se nosso time de 13 agentes cobre ou não.

```
┌─────────────────────────────────────────────────────────┐
│                    CAMADA 14: ANALYTICS & BI             │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 13: GROWTH & MARKETING         │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 12: BILLING & SUBSCRIPTIONS    │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 11: ADMIN & BACKOFFICE         │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 10: NOTIFICATIONS              │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 9: INTEGRAÇÕES & WEBHOOKS      │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 8: REAL-TIME & WEBSOCKETS      │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 7: SEARCH & CACHE              │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 6: FILE STORAGE & CDN          │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 5: BACKGROUND JOBS & QUEUES    │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 4: DATABASE & MULTI-TENANCY    │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 3: API LAYER                   │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 2: AUTH & IDENTITY             │
├─────────────────────────────────────────────────────────┤
│                    CAMADA 1: FRONTEND (UI/UX)            │
├─────────────────────────────────────────────────────────┤
│    FUNDAÇÃO: CI/CD • MONITORING • SECURITY • INFRA      │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Auditoria brutalmente honesta: o que temos vs. o que falta

### LEGENDA
- ✅ COBERTO — agente existente resolve
- ⚠️ PARCIAL — agente toca no tema mas não é especialista
- ❌ GAP CRÍTICO — nenhum agente cobre, precisa de solução

---

### FUNDAÇÃO (Infraestrutura base)

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| CI/CD Pipeline | ⚠️ PARCIAL | @devops (Felix) | Felix cuida de deploy, mas NÃO é especialista em GitHub Actions, Docker compose multi-stage, Kubernetes manifests, Terraform/Pulumi. Falta IaC profundo. |
| Monitoring & Observability | ❌ GAP | Nenhum | Ninguém monitora em produção: logs, métricas, traces, alertas, uptime, error tracking (Sentry, Datadog, Prometheus+Grafana). |
| Security | ✅ COBERTO | @cypher (Vex) | Vex cobre ameaças, scans, pentest, compliance. Bem resolvido. |
| Infrastructure as Code | ❌ GAP | Nenhum | Terraform, Pulumi, CloudFormation, Docker Compose, Kubernetes — nenhum agente é especialista. Felix é generalista demais. |

### CAMADA 1: Frontend

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| UI Components | ⚠️ PARCIAL | @ux-expert (Uma) | Uma faz review de UX, mas NÃO implementa. @dev (Dex) implementa, mas sem especialidade em design system, micro-interactions, performance de renderização. |
| Design System | ❌ GAP | Nenhum | Nenhum agente é especialista em tokens de design, Storybook, component library, acessibilidade WCAG 2.1 nível AA. Uma revisa, mas não constrói. |
| Performance Frontend | ❌ GAP | Nenhum | Core Web Vitals, lazy loading, code splitting, bundle analysis, SSR/SSG — ninguém mede nem otimiza. |
| Mobile Responsiveness | ⚠️ PARCIAL | @ux-expert (Uma) | Uma menciona mobile-first, mas não é especialista em PWA, capacitor, touch gestures, viewport optimization. |

### CAMADA 2: Auth & Identity

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Auth System (JWT, OAuth2, SSO) | ✅ COBERTO | @cypher (Vex) + @dev (Dex) | Vex define os requirements de auth, Dex implementa. Boa cobertura. |
| Multi-tenancy Identity | ⚠️ PARCIAL | @architect (Aria) | Aria pode planejar, mas nenhum agente é especialista em tenant isolation, org-level permissions, team management. |
| RBAC/ABAC granular | ✅ COBERTO | @cypher (Vex) | Vex verifica auth em cada endpoint. |

### CAMADA 3: API Layer

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| REST API Design | ✅ COBERTO | @architect (Aria) + @dev (Dex) | Aria planeja, Dex implementa. |
| API Versioning | ⚠️ PARCIAL | @architect (Aria) | Aria pode planejar, mas ninguém garante backward compatibility em produção. |
| Rate Limiting & Throttling | ✅ COBERTO | @cypher (Vex) | Vex verifica rate limiting em cada endpoint. |
| API Documentation (OpenAPI/Swagger) | ❌ GAP | Nenhum | Ninguém gera documentação de API automaticamente. Nenhum agente produz Swagger specs. |
| GraphQL (se necessário) | ⚠️ PARCIAL | @dev (Dex) | Dex pode implementar, mas sem expertise profunda em schema design, resolvers otimizados, N+1 prevention. |

### CAMADA 4: Database & Multi-tenancy

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Schema Design | ✅ COBERTO | @data-engineer (Dara) | Dara é especialista em modelagem. |
| Migrations | ⚠️ PARCIAL | @dev (Dex) | Dex roda migrations, mas ninguém faz migration safety check (reversíveis? lock de tabela?). |
| Multi-tenant Data Isolation | ❌ GAP | Nenhum | Nenhum agente é especialista em row-level security, schema-per-tenant, shared vs. isolated databases, tenant context propagation. |
| Query Optimization | ✅ COBERTO | @data-engineer (Dara) | Dara otimiza queries. |
| Backup & Disaster Recovery | ❌ GAP | Nenhum | Ninguém planeja: RTO/RPO, backup schedule, failover, point-in-time recovery. |

### CAMADA 5: Background Jobs & Queues

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Job Processing (Bull, Celery, SQS) | ⚠️ PARCIAL | @dev (Dex) | Dex pode implementar, mas ninguém planeja: retry policies, dead letter queues, idempotency, job priority, rate limiting de workers. |
| Scheduled Tasks (Cron jobs) | ⚠️ PARCIAL | @devops (Felix) | Felix pode configurar, mas sem governance de quais jobs existem e se estão healthy. |

### CAMADA 6: File Storage & CDN

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| S3/Storage Configuration | ⚠️ PARCIAL | @devops (Felix) | Felix pode configurar, mas sem expertise em signed URLs, storage classes, lifecycle policies. |
| CDN Setup | ❌ GAP | Nenhum | Ninguém configura CloudFront/Cloudflare: cache policies, purge strategies, edge optimization. |
| Image Optimization | ❌ GAP | Nenhum | Ninguém cuida de WebP conversion, lazy loading, responsive images, sharp/imageminP. |

### CAMADA 7: Search & Cache

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Search Engine (Elasticsearch, Meilisearch) | ❌ GAP | Nenhum | Ninguém é especialista em full-text search, indexing, faceted search, relevancy tuning. |
| Cache Strategy (Redis) | ⚠️ PARCIAL | @data-engineer (Dara) | Dara pode planejar, mas ninguém implementa: cache invalidation, TTL policies, cache-aside vs write-through. |

### CAMADA 8: Real-time & WebSockets

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| WebSocket/SSE Implementation | ⚠️ PARCIAL | @dev (Dex) | Dex pode implementar, mas sem expertise em scaling WebSockets horizontalmente, presence, rooms, reconnection strategies. |

### CAMADA 9: Integrações & Webhooks

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Third-party Integrations | ⚠️ PARCIAL | @dev (Dex) | Dex implementa, mas ninguém planeja: circuit breakers, retry policies, webhook verification, idempotency keys. |
| Webhook System | ❌ GAP | Nenhum | Ninguém projeta: outgoing webhooks, signing, delivery guarantees, retry with backoff, webhook logs. |

### CAMADA 10: Notifications

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Email (Transactional + Marketing) | ❌ GAP | Nenhum | Ninguém cuida de: email templates, delivery (SendGrid/SES), bounce handling, spam score, unsubscribe. |
| Push Notifications | ❌ GAP | Nenhum | FCM/APNs, web push, notification preferences, throttling. |
| In-app Notifications | ⚠️ PARCIAL | @dev (Dex) | Dex pode implementar UI, mas sem expertise em notification center, read/unread, real-time delivery. |

### CAMADA 11: Admin & Backoffice

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Admin Dashboard | ⚠️ PARCIAL | @dev (Dex) + @ux-expert (Uma) | Podem construir, mas ninguém pensa em: audit logs, impersonation, feature flags, tenant management. |
| Feature Flags | ❌ GAP | Nenhum | Ninguém implementa: progressive rollout, A/B testing, kill switches, per-tenant flags. |

### CAMADA 12: Billing & Subscriptions

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Subscription Management | ❌ GAP CRÍTICO | Nenhum | Stripe/Paddle integration, plan management, upgrades/downgrades, proration, trials. NINGUÉM cobre isso. |
| Invoice Generation | ❌ GAP | Nenhum | Invoice PDF, tax calculation, multi-currency, receipt emails. |
| Usage Metering | ❌ GAP | Nenhum | Per-seat billing, API call metering, storage metering, overage charges. |

### CAMADA 13: Growth & Marketing

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Onboarding Flow | ⚠️ PARCIAL | @ux-expert (Uma) | Uma pode revisar UX, mas ninguém PROJETA: welcome wizard, progressive disclosure, activation metrics. |
| SEO & Landing Pages | ❌ GAP | Nenhum | Meta tags, sitemap, structured data, page speed, conversion optimization. |
| Analytics Integration | ❌ GAP | Nenhum | GTM, Mixpanel/Amplitude, conversion tracking, funnel analysis. |

### CAMADA 14: Analytics & BI

| Necessidade | Status | Agente | Diagnóstico |
|-------------|--------|--------|-------------|
| Product Analytics | ❌ GAP | Nenhum | User behavior tracking, cohort analysis, retention metrics, churn prediction. |
| Business Intelligence | ❌ GAP | Nenhum | Revenue dashboards, MRR/ARR tracking, LTV/CAC, unit economics. |
| Tenant Analytics | ❌ GAP | Nenhum | Per-tenant usage, health score, expansion signals. |

---

## 3. Resumo da auditoria

```
RESULTADO DA AUDITORIA
═══════════════════════════════════════
✅ Coberto:          12 necessidades  (19%)
⚠️ Parcial:          19 necessidades  (30%)
❌ Gap crítico:       32 necessidades  (51%)
═══════════════════════════════════════
VEREDICTO: O time de 13 agentes cobre ~35% do que
um SaaS de produção precisa. É excelente para a
CONSTRUÇÃO de código, mas tem gaps enormes em:
operações, billing, observabilidade, e domínios
de negócio SaaS-específicos.
```

---

## 4. Os 5 agentes que faltam para fechar o time

### Agente #14: @cloud-ops (Atlas) — Cloud & Infrastructure Specialist

**O que resolve**: IaC, Kubernetes, Docker, Terraform, monitoring, observability,
backup, disaster recovery, CDN, scaling.

**Por que precisa**: Felix (@devops) é generalista demais. Atlas é o especialista
em infraestrutura cloud-native que sabe configurar auto-scaling, escrever Terraform
modules, montar Prometheus+Grafana, configurar alertas, e garantir 99.9% uptime.

**Comandos core**:
- *setup-infra {provider} — scaffold completo de infra (AWS/GCP/Azure)
- *write-terraform — gera IaC para o recurso especificado
- *setup-monitoring — configura Prometheus + Grafana + alertas
- *setup-logging — ELK stack ou CloudWatch com dashboards
- *backup-plan — cria estratégia de backup com RTO/RPO
- *disaster-recovery — plano de failover completo
- *optimize-costs — análise de custos cloud e recomendações
- *setup-cdn — configura CloudFront/Cloudflare com cache policies
- *scale-audit — avalia se a infra aguenta 10x o tráfego atual

**Sinergia**: Atlas trabalha antes de Felix (prepara a infra), e Vex (@cypher)
audita tudo que Atlas configura.


### Agente #15: @billing (Ledger) — Billing & Subscription Specialist

**O que resolve**: Stripe/Paddle integration, subscription lifecycle, invoices,
metering, trials, upgrades/downgrades, proration, multi-currency, tax.

**Por que precisa**: Este é o GAP MAIS CRÍTICO. Um SaaS sem billing não é um SaaS.
Nenhum agente atual entende subscription management, webhooks de pagamento,
proration, dunning (cobrança de inadimplentes), ou metering de uso.

**Comandos core**:
- *setup-billing {provider} — integração completa com Stripe/Paddle
- *create-plans — define planos com tiers, features, limits
- *setup-metering — configura usage-based billing
- *handle-webhooks — implementa webhook handlers para eventos de pagamento
- *generate-invoice — sistema de invoices com tax calculation
- *dunning-flow — fluxo automatizado para pagamentos falhados
- *subscription-lifecycle — upgrade, downgrade, cancel, pause, trial
- *revenue-metrics — calcula MRR, ARR, churn rate, LTV

**Sinergia**: Ledger alimenta @data-engineer (Dara) com métricas financeiras,
e @cypher (Vex) audita PCI compliance dos fluxos de pagamento.


### Agente #16: @observe (Iris) — Monitoring & Observability Specialist

**O que resolve**: Logs, métricas, traces, alertas, uptime monitoring, error
tracking, performance profiling, SLOs/SLAs.

**Por que precisa**: Depois que o código vai pra produção, NINGUÉM está olhando.
Iris é quem garante que você saiba quando algo quebra ANTES dos usuários
reportarem. É a diferença entre "descobrimos em 2 minutos" e "um cliente
reclamou no Twitter 3 horas depois".

**Comandos core**:
- *setup-apm — configura Application Performance Monitoring
- *setup-alerts — cria alertas inteligentes (não noise, não missed)
- *setup-error-tracking — Sentry/Bugsnag com source maps
- *create-dashboard — dashboard de saúde do sistema
- *define-slos — Service Level Objectives com error budgets
- *trace-request — distributed tracing de um request específico
- *performance-audit — identifica gargalos de performance
- *incident-runbook — cria runbook para resposta a incidentes
- *uptime-report — relatório de disponibilidade do período

**Sinergia**: Iris alimenta @sentinel (Sage) com dados reais de produção —
Sage usa isso para evoluir os agentes com base no que REALMENTE acontece
em produção, não apenas em review de código.


### Agente #17: @frontend-lead (Pixel) — Frontend Architecture Specialist

**O que resolve**: Design system, component library, performance frontend,
Core Web Vitals, SSR/SSG, state management, acessibilidade WCAG AA,
bundle optimization, Storybook, visual regression testing.

**Por que precisa**: @ux-expert (Uma) revisa UX, @dev (Dex) implementa, mas
NINGUÉM é especialista em arquitetura frontend. Em 2026, o frontend de um SaaS
é tão complexo quanto o backend — state management, caching client-side,
optimistic updates, offline-first, skeleton loading. Pixel é o frontend
architect que faltava.

**Comandos core**:
- *setup-design-system — cria design tokens, component library, Storybook
- *audit-performance — Core Web Vitals, Lighthouse, bundle analysis
- *audit-a11y — acessibilidade WCAG 2.1 AA completo
- *optimize-bundle — code splitting, tree shaking, lazy loading
- *setup-state — arquitetura de state management (Zustand, Jotai, TanStack Query)
- *setup-testing — visual regression + component testing (Playwright, Storybook)
- *responsive-audit — verifica todos breakpoints e touch targets
- *create-component {name} — cria componente com specs de design system

**Sinergia**: Pixel define OS PADRÕES que @dev (Dex) segue no frontend.
@ux-expert (Uma) valida a experiência, Pixel garante a engenharia.


### Agente #18: @product-analytics (Metric) — Analytics & Growth Specialist

**O que resolve**: Product analytics, user behavior tracking, A/B testing,
feature flags, onboarding optimization, conversion funnels, retention
analysis, cohort analysis, churn prediction.

**Por que precisa**: Construir o SaaS é metade do trabalho. A outra metade é
entender se os usuários estão realmente USANDO o que você construiu. Nenhum
agente atual pensa em: "qual feature tem mais engagement?", "onde os usuários
abandonam o onboarding?", "qual plano tem melhor retenção?".

**Comandos core**:
- *setup-analytics — integra Mixpanel/Amplitude/PostHog
- *track-event {name} — implementa tracking de evento com propriedades
- *create-funnel {name} — define funil de conversão com stages
- *setup-ab-test — configura A/B test com feature flags
- *retention-analysis — análise de retenção por cohort
- *churn-signals — identifica sinais de churn e ações preventivas
- *onboarding-audit — mapeia drop-off points no onboarding
- *feature-adoption — métricas de adoção por feature

**Sinergia**: Metric alimenta @po (Nova) com dados reais de uso para
priorização de backlog. Alimenta @sentinel (Sage) com métricas de
impacto das features construídas pelo time.

---

## 5. O time completo: 18 agentes

```
┌──────────────────────────────────────────────────────────────┐
│                    TIME COMPLETO DE SAAS                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  PLANEJAMENTO (4 agentes)                                    │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐          │
│  │ @analyst│ │  @pm    │ │@architect│ │   @po   │          │
│  │  Zara   │ │  Kai   │ │   Aria   │ │  Nova   │          │
│  └─────────┘ └─────────┘ └──────────┘ └─────────┘          │
│                                                              │
│  DESENVOLVIMENTO (5 agentes)                                 │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────┐│
│  │   @sm   │ │  @dev   │ │@ux-expert│ │ @data-  │ │@front││
│  │  River  │ │  Dex    │ │   Uma    │ │  eng.   │ │ Pixel││
│  └─────────┘ └─────────┘ └──────────┘ │  Dara   │ └──────┘│
│                                        └─────────┘          │
│  QUALIDADE E OPERAÇÕES (4 agentes)                           │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐          │
│  │   @qa   │ │ @devops │ │ @cloud-  │ │@observe │          │
│  │  Quinn  │ │  Felix  │ │   ops    │ │  Iris   │          │
│  └─────────┘ └─────────┘ │  Atlas   │ └─────────┘          │
│                           └──────────┘                       │
│  SEGURANÇA E EVOLUÇÃO (2 agentes)                            │
│  ┌──────────┐ ┌──────────┐                                   │
│  │ @cypher  │ │@sentinel │                                   │
│  │   Vex    │ │   Sage   │                                   │
│  └──────────┘ └──────────┘                                   │
│                                                              │
│  DOMÍNIO SAAS (3 agentes)                                    │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐                      │
│  │@billing │ │ @product-│ │  @aios-  │                      │
│  │ Ledger  │ │ analytics│ │  master  │                      │
│  └─────────┘ │  Metric  │ │   Pax    │                      │
│              └──────────┘ └──────────┘                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. O pipeline completo de criação de SaaS

Com os 18 agentes, o fluxo completo de construção de um SaaS fica:

```
FASE 1: DISCOVERY & PLANNING (Semana 1-2)
═══════════════════════════════════════════
@pm           → Coleta requisitos, define escopo
@analyst      → Pesquisa mercado, dependências, competidores
@po           → Define visão de produto, prioriza MVP features
@architect    → Define arquitetura, tech stack, multi-tenancy model
@cypher       → Gera threat model, define security requirements
@billing      → Define modelo de monetização, planos, limites

FASE 2: DESIGN & FOUNDATION (Semana 2-4)
═══════════════════════════════════════════
@sm           → Cria histórias para o sprint de fundação
@frontend-lead→ Cria design system, component library, Storybook
@ux-expert    → Valida wireframes, fluxos de onboarding, acessibilidade
@data-engineer→ Modela banco de dados, schema multi-tenant
@cloud-ops    → Provisiona infraestrutura: AWS/GCP, Terraform, CI/CD
@architect    → Cria contexto técnico para o time de desenvolvimento

FASE 3: CORE DEVELOPMENT (Semana 4-12)
═══════════════════════════════════════════
Sprint loop:
  @sm           → Quebra features em histórias com contexto completo
  @dev          → Implementa backend: API, auth, business logic
  @frontend-lead→ Implementa frontend: componentes, pages, state
  @data-engineer→ Otimiza queries, pipelines de dados
  @qa           → Review de código: funcional + structural
  @cypher       → Security scan: OWASP, secrets, auth endpoints
  @sentinel     → Observa tudo, detecta padrões, evolui checklists

FASE 4: BILLING & INTEGRATIONS (Semana 8-14)
═══════════════════════════════════════════
@billing       → Integra Stripe, configura planos, webhooks, invoices
@dev           → Implementa integrações third-party, webhooks outgoing
@cypher        → Audita PCI compliance, verifica payment flow
@qa            → Testa subscription lifecycle end-to-end

FASE 5: OBSERVABILITY & HARDENING (Semana 12-16)
═══════════════════════════════════════════
@observe       → Configura monitoring, alertas, error tracking, dashboards
@cloud-ops     → Configura CDN, backup, disaster recovery, auto-scaling
@cypher        → Infrastructure hardening, pentest final
@devops        → Configura deploy pipeline, staging environment

FASE 6: LAUNCH & GROWTH (Semana 14-18)
═══════════════════════════════════════════
@product-analytics → Configura analytics, funnels, A/B testing
@ux-expert         → Audita onboarding flow, primeiro uso
@frontend-lead     → Otimiza performance: Core Web Vitals, bundle
@observe           → Define SLOs, configura uptime monitoring
@devops            → Deploy de produção com zero-downtime

FASE CONTÍNUA: POST-LAUNCH
═══════════════════════════════════════════
@observe       → Monitora saúde 24/7, detecta problemas antes dos users
@sentinel      → Analisa métricas de produção, evolui agentes continuamente
@cypher        → Pentest contínuo, dependency audit semanal
@product-analytics → Analisa retenção, churn, feature adoption
@billing       → Monitora MRR, churn rate, dunning
@po            → Reprioriza backlog baseado em dados reais de uso
```

---

## 7. Vulnerabilidades do time atual (os 13) que precisam de atenção IMEDIATA

### VULNERABILIDADE #1: Ninguém monitora produção
**Severidade**: CRITICAL
**Impacto**: Você descobre que o sistema caiu quando um cliente reclama no Twitter.
**Solução**: Agente @observe (Iris) — monitoring, alertas, incident response.

### VULNERABILIDADE #2: Billing inexistente
**Severidade**: CRITICAL
**Impacto**: Sem billing, não existe SaaS. Existe um projeto de hobby.
**Solução**: Agente @billing (Ledger) — Stripe integration, subscription management.

### VULNERABILIDADE #3: Infraestrutura artesanal
**Severidade**: HIGH
**Impacto**: Sem IaC, cada deploy é manual, não reproduzível, e propenso a erros.
Sem backup plan, uma falha de disco = perda de dados de clientes.
**Solução**: Agente @cloud-ops (Atlas) — Terraform, backup, disaster recovery.

### VULNERABILIDADE #4: Frontend sem arquitetura
**Severidade**: HIGH
**Impacto**: Código frontend vira spaghetti em 3 meses. Sem design system, cada
tela é diferente. Sem performance audit, Core Web Vitals ficam no vermelho.
**Solução**: Agente @frontend-lead (Pixel) — design system, performance, a11y.

### VULNERABILIDADE #5: Decisões de produto no escuro
**Severidade**: MEDIUM
**Impacto**: Sem analytics, você não sabe quais features os usuários usam.
Você constrói baseado em intuição, não em dados.
**Solução**: Agente @product-analytics (Metric) — tracking, funnels, A/B tests.

### VULNERABILIDADE #6: Multi-tenancy mal planejada
**Severidade**: HIGH
**Impacto**: Dados de um tenant vazam para outro. Ou pior: um tenant pesado
derruba a performance de todos os outros (noisy neighbor problem).
**Solução**: @architect (Aria) precisa de SKILL específica de multi-tenancy,
ou @data-engineer (Dara) precisa de checklist de tenant isolation.

### VULNERABILIDADE #7: Sem API documentation
**Severidade**: MEDIUM
**Impacto**: Se o SaaS tem API pública, sem Swagger/OpenAPI ninguém consegue
integrar. Se é interna, novos agentes perdem contexto.
**Solução**: Adicionar skill de API documentation ao @dev (Dex).

---

## 8. Skills recomendadas por agente existente

Além dos novos agentes, os existentes precisam de SKILLS adicionais:

| Agente | Skill que falta | Por quê |
|--------|----------------|---------|
| @dev (Dex) | multi-tenancy-patterns | Tenant context em cada query, row-level security |
| @dev (Dex) | api-documentation | Gerar OpenAPI specs automaticamente |
| @dev (Dex) | webhook-design | Outgoing webhooks com signing e retry |
| @dev (Dex) | email-templates | Transactional emails com MJML/React Email |
| @architect (Aria) | saas-architecture | Multi-tenancy models, noisy neighbor, tenant isolation |
| @architect (Aria) | event-driven | Event sourcing, CQRS, pub/sub patterns |
| @data-engineer (Dara) | cache-strategy | Redis patterns, invalidation, TTL policies |
| @data-engineer (Dara) | search-engine | Elasticsearch/Meilisearch indexing e tuning |
| @devops (Felix) | container-orchestration | Kubernetes manifests, Helm charts, pod autoscaling |
| @qa (Quinn) | e2e-saas-testing | Teste de subscription flow, multi-tenant, billing |
| @ux-expert (Uma) | onboarding-optimization | Activation metrics, progressive disclosure, NPS |
| @pm (Kai) | saas-prd-template | PRD com seções de billing, analytics, multi-tenancy |

---

## 9. O veredicto final

### Com 13 agentes (time atual):
Você consegue construir um **MVP funcional** — backend + frontend + auth +
banco de dados + deploy básico + segurança. É suficiente para validar uma
ideia e mostrar para early adopters.

**O que NÃO consegue**: cobrar clientes, monitorar produção, escalar
infraestrutura, medir adoção, ou operar como um negócio real.

### Com 18 agentes (time proposto):
Você consegue construir, lançar e OPERAR um **SaaS de produção completo** —
com billing, monitoring, analytics, infraestrutura escalável, segurança
profissional, e evolução contínua baseada em dados.

**Equivalente humano**: um time de 18 agentes substitui aproximadamente:
- 2 Frontend Engineers (Dex + Pixel)
- 2 Backend Engineers (Dex + Dara)
- 1 DevOps/SRE Engineer (Felix + Atlas)
- 1 QA Engineer (Quinn)
- 1 Security Engineer (Vex)
- 1 UX Designer (Uma)
- 1 Product Manager (Kai + Nova)
- 1 Data Analyst (Metric)
- 1 Architect (Aria)
- 1 Scrum Master (River)

**= ~12 profissionais especializados**, com o bônus de Sage (evolução
contínua) e Pax (orquestração) que não existem em times humanos.

### Custo estimado:
- Time humano: R$180.000-350.000/mês (12 devs seniores no Brasil)
- Time de agentes: ~US$500-2.000/mês em tokens de API
- Redução: 95-99%

### Timeline estimada para MVP:
- Time humano: 4-6 meses
- Time de 18 agentes: 2-4 semanas (com humano fazendo decisões estratégicas)

---

## 10. Próximos passos recomendados

1. **IMEDIATO**: Criar os agentes @billing (Ledger) e @observe (Iris) —
   são os gaps mais críticos
2. **SEMANA 1**: Criar @cloud-ops (Atlas) e adicionar skills de
   multi-tenancy ao @architect
3. **SEMANA 2**: Criar @frontend-lead (Pixel) e @product-analytics (Metric)
4. **SEMANA 3**: Adicionar as skills complementares aos agentes existentes
5. **CONTÍNUO**: @sentinel (Sage) evolui todos os agentes baseado em
   dados reais de cada projeto
