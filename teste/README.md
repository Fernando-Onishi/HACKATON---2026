# Fat Fit

SPA responsiva para acompanhar treinos, alimentação, metas e tendências. Implementada com HTML semântico, CSS e JavaScript ES Modules, sem processo de build.

## Executar

Como os módulos JavaScript usam `import`, abra a pasta `teste` com um servidor HTTP local. Por exemplo, com Python instalado:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000`. Abrir `index.html` diretamente via `file://` não é compatível com módulos ES em todos os navegadores.

## Estrutura

- `index.html`: shell da SPA e navegação responsiva.
- `css/style.css`: tokens visuais, componentes e estilos mobile-first.
- `js/app.js`: navegação por hash, estado compartilhado, validações, renderização e localStorage.
- `js/treino.js`: templates, registro de exercícios, cálculo de volume e progressão.
- `js/dieta.js`: diário alimentar, balanço calórico e sugestões educativas.
- `js/insights.js`: análises cruzadas, conquistas e gráficos Chart.js.

## Dados e integração

Os registros ficam no `localStorage` do navegador. A aplicação inclui dados demonstrativos iniciais e permite restaurá-los no perfil. Para ativar Auth e sincronização, informe no perfil a URL do projeto Supabase e sua chave pública `anon`, crie uma conta ou entre. A aplicação sincroniza uma linha por usuário na tabela `fatfit_state`; políticas RLS devem estar ativas antes de guardar dados pessoais:

```sql
create table public.fatfit_state (
	user_id uuid primary key references auth.users(id) on delete cascade,
	state jsonb not null,
	updated_at timestamptz not null default now()
);

alter table public.fatfit_state enable row level security;
grant select, insert, update on public.fatfit_state to authenticated;

create policy "Users can read their own Fat Fit state"
on public.fatfit_state for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own Fat Fit state"
on public.fatfit_state for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own Fat Fit state"
on public.fatfit_state for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
```

Para habilitar sugestões remotas, configure no perfil a URL de uma Supabase Edge Function que aceite `POST` e retorne JSON com `suggestions: [{ meal, idea, note }]`. A função de borda deve validar a entrada e manter a chave do provedor de IA somente no servidor. O cliente aceita apenas a chave pública `anon`, que não é uma chave secreta.

Sem endpoint configurado, as sugestões usam uma lista local educativa. Não são prescrições médicas ou nutricionais. O gasto calórico de treino é uma estimativa demonstrativa e não deve ser interpretado como medição fisiológica.

## Regras principais

- Volume do exercício: `séries × repetições × carga (kg)`.
- Balanço líquido diário: `calorias consumidas − (meta calórica − gasto estimado do treino)`.
- Formulários validam limites positivos e impedem datas futuras.
- Gráficos usam Chart.js via CDN; fontes Montserrat e Outfit são carregadas do Google Fonts.
