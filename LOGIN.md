# Entrada atual

No primeiro acesso, entre com Google e conclua o WebAuthn. A sessão Google fica salva pelo Firebase Auth no IndexedDB. Nos próximos acessos, a conta é restaurada e o painel continua oculto até o desbloqueio WebAuthn.

A foto do perfil abre as opções Alterar senha da conta Google, Trocar de conta e Sair. As ações de saída removem a sessão Firebase e descartam o estado em memória; trocar requer selecionar a outra conta no próximo clique em Entrar com Google. As opções ficam exclusivamente no modal de perfil dentro do painel autenticado.

Consulte `FIREBASE.md` para os detalhes e limites. WebAuthn continua sendo um bloqueio local, não um segundo fator validado pelo servidor. O método pode usar PIN; não há garantia de digital exclusiva.

As ações de conta aparecem somente dentro do sistema: clique na foto do cabeçalho para abrir o modal com foto, nome e e-mail. Ele fecha pelo botão ×, Escape ou clique no fundo. Não há opções de sair ou trocar de conta na tela de entrada.
