# Entrada atual

A migração para Firestore substituiu o fluxo exclusivamente local. Primeiro o usuário entra com Google (Firebase Authentication); em seguida o WebAuthn libera a interface. O identificador da credencial fica no perfil Firestore, vinculado ao UID. A sessão não persiste ao recarregar.

Consulte `FIREBASE.md` para ativação, regras, parâmetros adaptados, limitações e testes. O bloqueio WebAuthn continua local e não é um segundo fator validado pelo Firebase.
