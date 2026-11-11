# Entrada WebAuthn do FinanConta

O destino usa HTML/CSS/JavaScript puro, sem backend ou autenticação anterior. O fluxo foi integrado sem alterar as operações financeiras existentes ou as chaves de dados e tema. Nenhum dado financeiro é lido ou renderizado automaticamente antes da entrada.

## Arquivos

- `index.html`: entrada inicial e painel financeiro oculto desde o HTML.
- `css.css`: estilos de entrada isolados, com aparência da referência.
- `auth.js`: cadastro, autenticação, Base64 e liberação do painel.
- `js.js`: inicialização financeira adiada até o sucesso do WebAuthn, executada uma vez por carregamento.
- `tests/auth.test.cjs`: testes locais com respostas simuladas.

## Fidelidade e adaptações

O RP usa o nome `FinanConta` em vez de `Gerenciador de Senhas`. Os demais parâmetros solicitados foram preservados: challenges fixos, usuário local fixo, ES256, timeout de 60000 ms, atestação `direct`, cadastro sem seleção de autenticador e login com verificação `preferred` e transporte `internal`. O ID fica em Base64 comum na chave `credentialId`.

O clique é ligado por addEventListener; as promessas usam async/await. Erros síncronos de acesso ao armazenamento ou de decodificação do ID também recebem a mensagem genérica de falha. Não existe recuperação automática nem remoção do ID em caso de erro. Retorno nulo mantém a entrada sem mensagem adicional. O painel é inicializado antes de ser mostrado, evitando exibir transações parcialmente carregadas.

A recarga começa bloqueada mesmo com ID salvo. Não há estado persistente de login, logout, bloqueio por inatividade ou novo fator. Não foram introduzidos parâmetros de reforço de segurança.

## Ambiente e limites

Sirva via HTTPS ou localhost (por exemplo, Live Server). Não há porta obrigatória no destino. Mantenha protocolo, host e porta estáveis para acessar o mesmo localStorage. O RP ID é inferido pelo navegador; copiar o ID entre origens não migra a credencial. O destino cadastra sua própria credencial quando não encontra `credentialId`. Aplicações na mesma origem compartilham essa chave; use uma origem dedicada para evitar colisões com o gerenciador original.

O diálogo é fornecido pelo navegador e sistema, podendo usar PIN em vez de biometria. Não são capturadas digitais ou imagens. A combinação de cadastro sem restrição e login com transporte interno pode impedir o uso posterior de alguns autenticadores, conforme a referência.

Este fluxo é um bloqueio visual local, não um cofre nem uma sessão autenticada no servidor. Os dados continuam legíveis no localStorage; o código não verifica assinatura, origem, challenge retornado ou flags e pode ser contornado pelo console. O identificador salvo é público. Apagar dados do site não necessariamente apaga a credencial no autenticador. Criptografia e autenticação confiável exigiriam outro desenho.

## Verificação

Execute `node --test tests/auth.test.cjs` na pasta do projeto. Testes automatizados usam mocks e cobrem entrada inicial com/sem ID, cadastro, parâmetros do login, ID com bytes não ASCII, retorno nulo, rejeição, cancelamento, timeout e ausência de suporte. Também foi verificada a sintaxe de `auth.js` e `js.js` com `node --check`.

Não foram executados testes com autenticador virtual ou hardware, inspeção visual no navegador ou testes de ponta a ponta das operações financeiras. No dispositivo de destino, confira cadastro e recarga com a mesma origem, cancelamento do diálogo e, após entrada, adição/edição/exclusão, filtros, navegação mensal, tema e importação/exportação. A aparência do diálogo nativo varia entre plataformas.
