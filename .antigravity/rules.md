# Diretrizes de Engenharia e Governança - Calculadora Cotripar

Este documento estabelece as regras obrigatórias de governança local, qualidade de código, ciclo de pre-commit e migração de banco de dados para o projeto **Calculadora Cotripar**.

---

## 1. Diretrizes de Pre-Commit e Qualidade Local

Todo desenvolvimento, refatoração e correção no repositório da Calculadora Cotripar deve cumprir as seguintes etapas de validação antes do commit ou envio de alterações:

### 1.1 Análise Estática e Tipagem
- Executar o linter de alta velocidade:
  ```bash
  npm run lint
  ```
- Validar a integridade de compilação TypeScript com `tsc -b`. Erros de tipagem ou ausência de tipos em cálculos financeiros são inaceitáveis.

### 1.2 Verificação de Testes Unitários
- Executar a suíte de testes de verificação:
  ```bash
  npm run verify
  ```
- O ciclo local deve finalizar com **100% dos testes aprovados (exit code 0)**.
- O motor de cálculo de amortização (Sistema Alemão com IVA sobre juros e taxas administrativas) é a base de negócio do sistema; qualquer alteração no motor deve conter testes de regressão correspondentes.

### 1.3 Segurança e Segredos
- Proibido o commit de tokens da Vercel (`.env.local`), chaves de serviço do Supabase ou credenciais corporativas.
- Garantir que `.env` e `.env.local` estejam estritamente declarados no `.gitignore`.

### 1.4 Padrão de Commits
- Seguir o padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).

---

## 2. Diretrizes de Migração de Banco de Dados (Supabase / PostgreSQL)

A Calculadora Cotripar consome tabelas de parametrização bancária, coeficientes de financiamento, marcas e histórico de simulações.

### 2.1 Controle de Versão e Migrações
- Quaisquer ajustes nas tabelas (taxas bancárias, bancos, prazos, perfis de usuários e logs de propostas) devem ser versionados em scripts SQL rastreáveis.
- Nenhuma alteração de schema ou exclusão de coluna deve ser executada diretamente em produção sem script documentado.

### 2.2 Row Level Security (RLS) e Políticas de Acesso
- O RLS deve permanecer ativado em todas as tabelas:
  ```sql
  ALTER TABLE public.<nome_tabela> ENABLE ROW LEVEL SECURITY;
  ```
- Leitura e gravação de histórico de propostas e usuários devem respeitar rigorosamente a separação de privilégios (`authenticated` vs `anon`).

### 2.3 Resiliência e Integridade Fiscal
- Mudanças nas fórmulas de cálculo ou taxas gravadas em propostas históricas não podem retroagir em simulações já consolidadas (preservação de snapshots em JSON nas propostas salvas).
- Garantir constraints de integridade (`CHECK (tasa >= 0)`, `FOREIGN KEY`, `NOT NULL`) para evitar propostas com valores corrompidos.
