import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Publicado em https://<usuario>.github.io/Meu-Aluguel/ (GitHub Pages de projeto),
// então os assets precisam ser referenciados com esse prefixo em produção.
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Meu-Aluguel/' : '/',
  plugins: [react()],
})
