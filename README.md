# Minhas Finanças

Aplicativo pessoal de finanças em React, com controle de ganhos, gastos fixos e variáveis, cartões e investimentos. Os dados são salvos no armazenamento local do navegador.

## Executar

```powershell
npm.cmd install
npm.cmd run dev
```

Abra o endereço informado pelo Vite (em geral `http://localhost:5173`).

## Firebase e publicação

O projeto já está preparado para login com Google e dados isolados por usuário no Firestore.

1. No Firebase Console, mantenha o provedor Google habilitado em Authentication.
2. Em Firestore Database > Rules, publique o conteúdo de `firestore.rules`.
3. Na Vercel, cadastre as mesmas variáveis presentes em `.env.example` (Production, Preview e Development) e faça o deploy do repositório.
4. Depois do primeiro deploy, copie o domínio `*.vercel.app` e adicione-o em Firebase Authentication > Settings > Authorized domains.

Nunca envie chaves privadas, arquivos de conta de serviço ou senhas. As variáveis `VITE_FIREBASE_*` são a configuração pública do app web; as regras do Firestore são o que protege os dados de cada pessoa.

## Observação

O ambiente de criação não conseguiu concluir a instalação das dependências a tempo; o projeto está configurado para buscá-las normalmente pelo `npm install`.
