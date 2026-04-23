# 💍 CRM Casamento Perfeito
Sistema completo de gestão para casamento, hospedado gratuitamente no **GitHub Pages** com banco de dados no **Supabase**.

## 🚀 Como colocar no ar (passo a passo)

### 1. Configurar o Banco de Dados (Supabase)
1. Crie um projeto no [Supabase](https://supabase.com)
2. Acesse **SQL Editor**
3. Cole e execute **todo o conteúdo do arquivo `supabase/dados_completos.sql`**  
   *(Inclui estrutura + todos os seus dados pré-carregados)*
4. Vá em **Project Settings → API** e copie:
   - `Project URL`
   - `anon public key`

### 2. Configurar as Chaves
Abra `config.js` e substitua:
```js
window.SUPABASE_CONFIG = {
  url: 'SUA_URL_AQUI',
  anonKey: 'SUA_CHAVE_ANON_AQUI'
};
