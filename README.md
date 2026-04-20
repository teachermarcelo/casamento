# CRM Casamento Perfeito — versão GitHub Pages + Supabase

Esta pasta já está pronta para sair do PHP e funcionar como site estático no GitHub Pages.

## O que mudou
- `planinha_casamento.php` virou `index.html`
- o `api.php` foi substituído por `js/app.js`
- o banco agora é o Supabase
- a interface visual foi preservada

## 1) Criar o banco no Supabase
1. Abra seu projeto no Supabase
2. Vá em **SQL Editor**
3. Rode o arquivo `supabase/schema.sql`

## 2) Pegar as chaves do projeto
No Supabase:
- **Project URL**
- **anon public key**

Depois preencha `js/config.js`:

```js
window.SUPABASE_CONFIG = {
    url: 'SUA_PROJECT_URL',
    anonKey: 'SUA_ANON_PUBLIC_KEY'
};
```

## 3) Subir para o GitHub
Coloque estes arquivos no seu repositório e faça o push.

## 4) Ativar GitHub Pages
No repositório:
- **Settings**
- **Pages**
- em **Build and deployment**, escolha:
  - **Source: Deploy from a branch**
  - **Branch: main**
  - **Folder: /(root)**

## 5) Importante sobre segurança
Esta versão está com políticas abertas no Supabase para funcionar sem backend.
Isso é útil para colocar no ar rápido, mas **não é o ideal para produção pública**.

Se você quiser, na próxima etapa eu posso te entregar uma segunda versão com:
- login por e-mail
- RLS fechado
- acesso apenas para você

## Estrutura
- `index.html`
- `js/app.js`
- `js/config.js`
- `js/config.example.js`
- `supabase/schema.sql`
