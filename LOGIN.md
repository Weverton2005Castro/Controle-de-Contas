# Entrada atual

No primeiro acesso, entre com Google e conclua o WebAuthn. A sessão Google fica salva pelo Firebase Auth no IndexedDB. O painel permanece desbloqueado na mesma aba durante uso ativo e após recarga, desde que não decorram cinco minutos sem atividade.

O prazo fica no sessionStorage da aba (somente UID e horário). Recarregar não renova o prazo; interação do usuário na página visível renova. Ao expirar, o painel volta a exigir WebAuthn e a conta Google continua lembrada. Sair/Trocar de conta encerram a sessão Firebase e removem o desbloqueio.

A foto do cabeçalho, no canto superior direito, abre um modal interno com foto, nome, e-mail, alteração da senha Google, troca de conta e saída. Essas opções não aparecem na entrada.

Consulte `FIREBASE.md` para detalhes. O bloqueio WebAuthn e seu prazo são locais, não um segundo fator validado pelo servidor; o dispositivo pode usar PIN em vez de digital.
