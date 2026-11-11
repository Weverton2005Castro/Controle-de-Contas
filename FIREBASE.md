# Dados no Firebase

O Firestore substitui a persistência local: `users/{uid}` guarda tema e IDs públicos WebAuthn; `users/{uid}/transactions/{id}` guarda cada transação. Não há leitura/gravação de localStorage no código do aplicativo nem fallback de dados locais. A sessão Auth persiste no IndexedDB; o cache Firestore usa apenas memória. Analytics foi removido para não inicializar armazenamento de telemetria.

## Ativação no projeto contas-d8193

1. No console Firebase, habilite **Authentication → Sign-in method → Google**, definindo e-mail de suporte.
2. Em **Authentication → Settings → Authorized domains**, autorize o domínio de implantação e `localhost` para desenvolvimento quando necessário.
3. Crie o **Cloud Firestore** em modo de produção (banco padrão).
4. Publique o conteúdo de `firestore.rules` na aba **Rules** do Firestore. Alternativamente, com Firebase CLI autenticado, execute na pasta do projeto: `firebase deploy --only firestore:rules --project contas-d8193`.
5. Sirva o aplicativo por localhost ou HTTPS. Entre com Google e, em seguida, clique em Entrar com Biometria.

Os arquivos de configuração e regras estão preparados, mas não foram publicados remotamente nesta sessão. A configuração web fornecida não dá permissão administrativa para habilitar provedores ou publicar regras. Não use regras públicas (`allow read, write: if true`).

## Identidade e entrada

A conta Google cria uma identidade Firebase estável para recuperar os mesmos dados em outro navegador/dispositivo. Recarregar restaura a conta Google salva e exige somente WebAuthn para abrir o painel. Cookies e armazenamento da própria conta Google/provedor são controlados pelo provedor; não armazenamos os dados do aplicativo neles.

WebAuthn continua sendo uma etapa de desbloqueio local, sem verificação de assinatura no servidor. A autorização real do banco é a sessão Google com regras por UID; o Firestore não exige prova biométrica. O usuário WebAuthn agora corresponde ao UID/e-mail da conta, substituindo o usuário fixo anterior. Os IDs públicos ficam em uma lista no perfil remoto; a chave privada permanece no autenticador, como exigido por WebAuthn. Não pode ser enviada ao Firebase. Cadastro ocorre somente quando a lista está vazia; falha não apaga IDs nem recadastra automaticamente. Outro dispositivo precisa ter acesso à credencial correspondente. Não foi adicionada recuperação de credencial.

Os demais parâmetros WebAuthn continuam iguais aos documentados no fluxo anterior. Os challenges fixos e a aceitação de retorno não nulo permanecem limitações do bloqueio local. Não se trata de MFA validado no servidor.

## Operações e falhas

Leituras iniciais consultam o servidor. Inclusão, edição, exclusão, importação, limpeza e tema só atualizam a interface após a confirmação do Firestore; falha mantém o estado anterior e exibe erro. Não há fallback offline persistente. Escritas podem aguardar reconexão se a conexão cair durante o pedido. Importação/limpeza usam lote atômico com limite de 450 registros por operação e informam o limite antes de escrever.

Cada transação tem seu próprio documento; editar um registro não sobrescreve os demais. Os dados são carregados ao entrar; não há listener em tempo real para outras abas. Reentre para atualizar dados alterados em outra sessão. Edições simultâneas do mesmo documento seguem a última gravação confirmada.

Dados antigos do navegador não são enviados nem apagados automaticamente. Um backup JSON exportado anteriormente pode ser importado após a entrada para gravá-lo no Firestore. A aplicação atual não acessa esse armazenamento antigo. Importações geram novos IDs e adicionam registros, inclusive se o mesmo arquivo for importado duas vezes.

## Verificação

Testes locais com serviços simulados verificam entrada, parâmetros WebAuthn, falhas, bytes Base64 e dependência do carregamento remoto. Também é verificada a ausência de localStorage nos scripts do aplicativo. As regras, login Google, acesso real ao Firestore e hardware WebAuthn ainda precisam de validação no projeto/dispositivo de destino; não foram testados contra produção nem emulador.

Referências: https://firebase.google.com/docs/auth/web/auth-state-persistence e https://firebase.google.com/docs/firestore/security/get-started

## Configuração confirmada pelo responsável

Em 11/11/2026, o responsável confirmou a conclusão da ativação do Google, autorização dos domínios, criação do Firestore e publicação das regras. Não é necessário repetir essas etapas, salvo se a interface indicar erro de configuração.

Para validar: abra via localhost ou HTTPS, entre com Google, conclua o WebAuthn e adicione uma transação de teste. Confira o documento em `users/{uid}/transactions` no console Firestore. Recarregue, entre com a mesma conta e confirme que a transação reaparece; teste editar e excluir. Esta validação depende da conta e do autenticador do responsável e não foi executada pelo agente. A interface distingue erros de popup, domínio, provedor desabilitado, conexão e regras.

## Sessão e perfil

A pedido do responsável, Firebase Auth agora usa `indexedDBLocalPersistence` para lembrar a conta neste navegador. Esta é uma adaptação à exigência anterior de manter todo estado apenas em memória: apenas a sessão de autenticação fica persistida no dispositivo, sem localStorage no aplicativo. Dados financeiros, tema e IDs WebAuthn continuam no Firestore. Após instalar esta atualização é necessário entrar uma vez com Google para criar a sessão persistente. Ela pode expirar, ser revogada ou ser apagada pelo navegador, exigindo nova entrada.

A abertura aguarda `authStateReady()` e consulta o perfil. Mesmo com sessão lembrada, não carrega transações nem mostra o painel antes do WebAuthn. O login continua podendo usar PIN ou outro desbloqueio, conforme o autenticador; não garante digital exclusiva.

A foto abre opções de conta; na ausência ou falha da imagem, exibe a inicial do nome. Alterar senha abre a página da conta Google correspondente, porque não existe senha própria do aplicativo. Trocar de conta e Sair encerram a sessão Firebase e recarregam a página para descartar dados em memória. Para trocar, clique em Entrar com Google e escolha outra conta no seletor. Sair do aplicativo não encerra a sessão global do Google no navegador. Mudanças da conta observadas em outra aba bloqueiam e recarregam a interface.

As boas-vindas são escolhidas aleatoriamente a cada carregamento e personalizadas com o primeiro nome no painel. Nenhuma atualização das regras Firestore é necessária para estas mudanças.
