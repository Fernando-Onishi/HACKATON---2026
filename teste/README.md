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
- `js/app.js`: navegação por hash, estado compartilhado, validações, renderização e integração de conta.
- `js/chatbot.js`: perguntas e respostas prontas, escolhidas localmente por assunto, sem API de IA.
- `js/firebase.js`: inicialização do Firebase, Analytics e acesso ao Firestore.
- `js/treino.js`: divisões e catálogo de exercícios, conclusão de movimentos e análise de vídeo.
- `js/storageManager.js`: persistência dos vídeos individuais em IndexedDB.
- `js/poseAnalyzer.js`: carregamento MediaPipe Pose, amostragem de vídeo, avaliação angular e persistência/restauração dos resultados diários.
- `data/alimentos.json`: catálogo nutricional educativo com valores aproximados por 100 g.
- `data/exercicios.json`: catálogo de exercícios e parâmetros de análise de pose disponíveis.
- `js/dieta.js`: diário alimentar, balanço calórico e sugestões educativas.
- `js/insights.js`: análises cruzadas, conquistas e gráficos Chart.js.

## Dados e integração

O Firebase Auth gerencia cadastro e sessão, e cada conta sincroniza seus registros no documento `users/{uid}` do Cloud Firestore. Os dados do app também ficam em um cache `localStorage` separado por UID para continuar disponíveis após logout/relogin; e-mail e senha não são armazenados nesse cache. O Firestore continua sendo a fonte de sincronização entre dispositivos. Para ativar a integração no projeto Firebase:

1. Ative o provedor **E-mail/senha** em Authentication > Sign-in method.
2. Crie o banco Cloud Firestore padrão, `(default)`, no mesmo projeto.
3. Publique estas regras antes de usar dados pessoais:

```javascript
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /users/{userId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
	}
}
```

Contas antigas que existiam apenas no `localStorage` precisam ser cadastradas no Firebase. Dados de `fatfit-state-v1` são importados automaticamente quando o e-mail legado corresponde e ainda não há estado na nuvem. Se o proprietário não puder ser verificado ou já houver dados na nuvem, o app pede confirmação antes da importação/substituição; a cópia local só é removida após sincronização. Senhas antigas não são migradas. Se uma gravação falhar, uma cópia temporária pendente fica neste navegador por UID e é removida após sincronizar com o Firestore.

O coach e as sugestões alimentares não usam API de IA nem fazem requisições para gerar texto. `js/chatbot.js` contém perguntas rápidas e respostas prontas selecionadas por assunto; `js/dieta.js` contém um catálogo local de refeições com porções, calorias e macronutrientes aproximados. O cardápio usa a meta estimada e a preferência alimentar informadas no perfil.

Porções e calorias são aproximações: variam conforme marca, preparo e alimento utilizado. O plano é educativo, não é prescrição médica ou nutricional. Em caso de condição clínica, gestação, histórico de transtorno alimentar ou menoridade, procure orientação profissional. O gasto calórico de treino também é uma estimativa demonstrativa.

Os vídeos de cada exercício ficam no IndexedDB deste navegador; o feedback do dia fica no `localStorage`. Camera Utils e MediaPipe Pose são carregados antes do app pela CDN jsDelivr. A análise amostra quadros com limites de tempo para leitura e inferência e aplica os parâmetros em `data/exercicios.json`. Apenas os movimentos com critérios cadastrados recebem feedback; os outros não são pontuados. As medidas são estimativas 2D em uma única vista, não garantem avaliação completa da técnica e não substituem orientação profissional. A análise de pose não estima calorias, portanto não adiciona gasto calórico ao balanço. No registro de refeições, o alimento deve ser selecionado de `data/alimentos.json`; calorias e macronutrientes são calculados pela quantidade registrada e não podem ser editados manualmente. Itens fora da tabela direcionam para o Agente Nutri-IA no Gemini. As sugestões prontas de cardápio continuam sendo estimativas educativas; o balanço diário usa as refeições registradas e os gastos de treino informados.

## Regras principais

- Volume do exercício: `séries × repetições × carga (kg)`.
- Balanço líquido diário: `calorias consumidas − (meta calórica − gasto estimado do treino)`.
- Formulários validam limites positivos e impedem datas futuras.
- Gráficos usam Chart.js via CDN; fontes Montserrat e Outfit são carregadas do Google Fonts.